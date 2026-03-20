import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { hasPermission } from '@/lib/rbac';

// Lazy initialization of Supabase client
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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
    const { data: userData } = await supabase
      .from('users')
      .select('church_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.church_id) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 });
    }

    // Check if user has permission to manage billing (admin only)
    if (!userData.role || !hasPermission(userData.role as any, 'billing', 'manage')) {
      return NextResponse.json(
        { error: 'You do not have permission to manage billing. Only admins can sync subscriptions.' },
        { status: 403 }
      );
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('church_id', userData.church_id)
      .single();

    if (!subscription) {
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
    const stripeSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10,
    });

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
      await supabase
        .from('subscriptions')
        .update(updates)
        .eq('church_id', userData.church_id);
    }

    return NextResponse.json({
      success: true,
      previousStatus: subscription.status,
      newStatus,
      updates,
      stripeSubscriptionsFound: stripeSubscriptions.data.length,
    });
  } catch (error) {
    console.error('Error syncing subscription:', error);
    return NextResponse.json(
      { error: 'Failed to sync subscription' },
      { status: 500 }
    );
  }
}