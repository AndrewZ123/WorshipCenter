import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';
import { env } from '@/lib/env';

// Lazy initialization of Supabase client
const getSupabase = () => createClient(
  env.supabaseUrl(),
  env.supabaseServiceRoleKey()
);

/**
 * DEBUG ENDPOINT: Get subscription debug information
 * 
 * SECURITY: This endpoint should only be used in development or by super-admins.
 * In production, consider disabling this endpoint entirely or adding additional
 * authentication layers (e.g., IP whitelist, additional API keys).
 * 
 * Current behavior: Returns subscription info for the authenticated user's church only.
 * To see all subscriptions, the user must have a super-admin role.
 */

export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const stripe = getStripe();
  
  try {
    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's church and role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('church_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.church_id) {
      console.error('[Debug Subscription] User not found or missing church:', user.id);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Determine if user can see all subscriptions (super-admin only)
    const isSuperAdmin = userData.role === 'super_admin';
    
    // Get subscriptions - scoped to user's church unless super-admin
    let subscriptionsQuery = supabase
      .from('subscriptions')
      .select('*');
    
    if (!isSuperAdmin) {
      subscriptionsQuery = subscriptionsQuery.eq('church_id', userData.church_id);
    }
    
    const { data: subscriptions, error: subError } = await subscriptionsQuery;
  
    if (subError) {
      console.error('[Debug Subscription] Failed to fetch subscriptions:', subError);
      return NextResponse.json({ error: 'Failed to fetch subscription data' }, { status: 500 });
    }
    
    // For each subscription, check Stripe
    const results = await Promise.all(
      (subscriptions || []).map(async (sub: any) => {
        let stripeSub = null;
        let stripeError = null;
        
        if (sub.stripe_subscription_id && !sub.stripe_subscription_id.startsWith('sub_pending_')) {
          try {
            const response = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
            stripeSub = response as any;
          } catch (e: any) {
            stripeError = e.type || 'unknown_error';
            console.error(`[Debug Subscription] Failed to retrieve Stripe subscription ${sub.stripe_subscription_id}:`, e.message);
          }
        }
        
        return {
          church_id: sub.church_id,
          database_status: sub.status,
          database_trial_end: sub.trial_end,
          database_stripe_sub_id: sub.stripe_subscription_id,
          database_customer_id: sub.stripe_customer_id,
          stripe_status: (stripeSub as any)?.status || null,
          stripe_trial_end: (stripeSub as any)?.trial_end ? new Date((stripeSub as any).trial_end * 1000).toISOString() : null,
          stripe_current_period_end: (stripeSub as any)?.current_period_end ? new Date((stripeSub as any).current_period_end * 1000).toISOString() : null,
          stripe_error: stripeError,
          needs_sync: sub.status !== (stripeSub as any)?.status,
        };
      })
    );
  
    return NextResponse.json({ 
      subscriptions: results,
      scope: isSuperAdmin ? 'all_churches' : 'your_church_only',
      user_church_id: userData.church_id,
    });
  } catch (error) {
    console.error('[Debug Subscription] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debug information' },
      { status: 500 }
    );
  }
}