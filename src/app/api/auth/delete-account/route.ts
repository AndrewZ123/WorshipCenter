/**
 * POST /api/auth/delete-account
 *
 * Permanently deletes the authenticated user's account and all associated data.
 * This includes:
 *   - User profile (users, team_members)
 *   - Content (chat messages, debriefs, notifications)
 *   - Subscription (cancels Stripe subscription if active)
 *   - Church (if user is the admin — only deletes church if confirmed)
 *
 * Requires authentication via Supabase session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { getStripe, isStripeConfigured } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the request using the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);

    // Create a Supabase client with the user's auth token to verify identity
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    const userId = authUser.id;

    // 2. Get user profile to check role and church
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const churchId = userProfile.church_id;
    const userRole = userProfile.role;

    // 3. Handle Stripe subscription cancellation if configured and active
    try {
      if (isStripeConfigured()) {
        const stripe = getStripe();

        const { data: subscription } = await supabaseAdmin
          .from('subscriptions')
          .select('stripe_subscription_id, status')
          .eq('church_id', churchId)
          .maybeSingle();

        if (subscription?.stripe_subscription_id && subscription?.status === 'active') {
          await stripe!.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: true,
          });
        }
      }
    } catch (stripeError) {
      // Log but don't block deletion — Stripe may not be configured
      console.warn('[DeleteAccount] Stripe cancellation error:', stripeError);
    }

    // 4. Delete user's data from all tables (service_role bypasses RLS)
    await supabaseAdmin
      .from('service_chat_messages')
      .delete()
      .eq('user_id', userId);

    await supabaseAdmin
      .from('service_debriefs')
      .delete()
      .eq('user_id', userId);

    await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    await supabaseAdmin
      .from('team_members')
      .delete()
      .eq('user_id', userId);

    await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    // 5. Check if this was the last admin — if so, mark the church as inactive
    if (userRole === 'admin') {
      const { count } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('church_id', churchId)
        .eq('role', 'admin');

      if (count === 0) {
        await supabaseAdmin
          .from('churches')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', churchId);
      }
    }

    // 6. Delete the auth user from Supabase Auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('[DeleteAccount] Failed to delete auth user:', deleteAuthError);
      return NextResponse.json({ error: 'Failed to complete account deletion' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Account permanently deleted' });
  } catch (error) {
    console.error('[DeleteAccount] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
