/**
 * POST /api/billing/sync-subscription
 *
 * Manually syncs the subscription state from Stripe to our DB.
 * Used as a diagnostic/recovery tool when webhook may have been missed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import type { Subscription } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: 'Payment system not configured.' }, { status: 503 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Payment system unavailable.' }, { status: 503 });
    }

    // ── Authenticate ──────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // ── Get subscription record ───────────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('church_id')
      .eq('id', user.id)
      .single();

    if (!profile?.church_id) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { data: sub, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('church_id', profile.church_id)
      .single();

    if (subError || !sub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const subscription = sub as unknown as Subscription;

    // If no Stripe subscription, nothing to sync
    if (!subscription.stripe_subscription_id) {
      return NextResponse.json({
        synced: false,
        message: 'No Stripe subscription to sync. Free/trial plan.',
        subscription: subscription,
      });
    }

    // ── Fetch from Stripe ─────────────────────────────────────────────────
    const stripeSub = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    ) as any;

    const currentPeriodEnd = new Date(stripeSub.current_period_end * 1000).toISOString();
    const currentPeriodStart = new Date(stripeSub.current_period_start * 1000).toISOString();
    const status = stripeSub.status === 'active' ? 'active'
      : stripeSub.status === 'past_due' ? 'past_due'
      : stripeSub.status === 'canceled' ? 'canceled'
      : stripeSub.status === 'trialing' ? 'trialing'
      : subscription.status;

    const canceledAt = stripeSub.canceled_at
      ? new Date(stripeSub.canceled_at * 1000).toISOString()
      : null;

    // ── Update DB ─────────────────────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        canceled_at: canceledAt,
        updated_at: new Date().toISOString(),
      })
      .eq('church_id', profile.church_id);

    if (updateError) {
      console.error('[Sync] Failed to update:', updateError);
      return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
    }

    // Return updated subscription
    const { data: updated } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('church_id', profile.church_id)
      .single();

    return NextResponse.json({
      synced: true,
      message: 'Subscription synced with Stripe.',
      subscription: updated,
    });
  } catch (error: any) {
    console.error('[Sync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync subscription.' },
      { status: 500 }
    );
  }
}