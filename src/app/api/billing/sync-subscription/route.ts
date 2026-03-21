import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { hasPermission } from '@/lib/rbac';
import { env } from '@/lib/env';

// Lazy initialization of Supabase client
const getSupabase = () => createClient(
  env.supabaseUrl(),
  env.supabaseServiceRoleKey()
);

export async function POST(request: NextRequest) {
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

    // Get user's church and subscription
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('church_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.church_id) {
      console.error('[Sync Subscription] User not found or missing church:', user.id);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has permission to manage billing (admin only)
    if (!userData.role || !hasPermission(userData.role as any, 'billing', 'manage')) {
      return NextResponse.json(
        { error: 'You do not have permission to manage billing. Only admins can sync subscriptions.' },
        { status: 403 }
      );
    }

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('church_id', userData.church_id)
      .single();

    if (subError || !subscription) {
      console.error('[Sync Subscription] Subscription not found for church:', userData.church_id);
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    let customerId = subscription.stripe_customer_id;

    // If still using pending customer ID, we can't sync yet
    if (customerId.startsWith('cus_pending_')) {
      return NextResponse.json({ 
        error: 'Cannot sync: Customer not yet created in Stripe',
        needsCustomer: true 
      }, { status: 400 });
    }

    // Fetch all subscriptions for this customer from Stripe
    let stripeSubscriptions;
    try {
      stripeSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 10,
      });
    } catch (stripeError) {
      console.error('[Sync Subscription] Failed to fetch subscriptions from Stripe:', stripeError);
      return NextResponse.json(
        { error: 'Failed to fetch subscription data from Stripe' },
        { status: 500 }
      );
    }

    const activeSubscription = stripeSubscriptions.data.find(sub => sub.status === 'active');
    const trialingSubscription = stripeSubscriptions.data.find(sub => sub.status === 'trialing');
    const pastDueSubscription = stripeSubscriptions.data.find(sub => sub.status === 'past_due');

    // Determine the correct status
    let newStatus = subscription.status;
    let updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (activeSubscription) {
      newStatus = 'active';
      const subData = activeSubscription as any;
      updates = {
        ...updates,
        stripe_subscription_id: activeSubscription.id,
        stripe_price_id: activeSubscription.items.data[0].price.id,
        status: 'active',
        current_period_start: new Date(subData.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subData.current_period_end * 1000).toISOString(),
        cancel_at_period_end: activeSubscription.cancel_at_period_end,
      };
    } else if (pastDueSubscription) {
      newStatus = 'past_due';
      const subData = pastDueSubscription as any;
      updates = {
        ...updates,
        stripe_subscription_id: pastDueSubscription.id,
        stripe_price_id: pastDueSubscription.items.data[0].price.id,
        status: 'past_due',
        current_period_start: new Date(subData.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subData.current_period_end * 1000).toISOString(),
        cancel_at_period_end: pastDueSubscription.cancel_at_period_end,
      };
    } else if (trialingSubscription) {
      newStatus = 'trialing';
      const subData = trialingSubscription as any;
      updates = {
        ...updates,
        stripe_subscription_id: trialingSubscription.id,
        stripe_price_id: trialingSubscription.items.data[0].price.id,
        status: 'trialing',
        current_period_start: new Date(subData.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subData.current_period_end * 1000).toISOString(),
        cancel_at_period_end: trialingSubscription.cancel_at_period_end,
      };
    } else {
      // No active subscriptions found - check if trial has expired
      if (subscription.status === 'trialing') {
        const trialEnded = new Date(subscription.trial_end) < new Date();
        if (trialEnded) {
          newStatus = 'canceled';
          updates = {
            ...updates,
            status: 'canceled',
          };
        }
      }
    }

    // Apply updates if status changed or we have subscription details
    if (newStatus !== subscription.status || activeSubscription || pastDueSubscription || trialingSubscription) {
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update(updates)
        .eq('church_id', userData.church_id);

      if (updateError) {
        console.error('[Sync Subscription] Failed to update subscription:', updateError);
        return NextResponse.json(
          { error: 'Failed to update subscription in database' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      previousStatus: subscription.status,
      newStatus,
      updates,
      stripeSubscriptionsFound: stripeSubscriptions.data.length,
    });
  } catch (error) {
    console.error('[Sync Subscription] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to sync subscription' },
      { status: 500 }
    );
  }
}