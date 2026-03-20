import { NextRequest, NextResponse } from 'next/server';
import { getStripe, PRICING } from '@/lib/stripe';
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
    const { priceType } = await request.json(); // 'monthly' or 'yearly'
    
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
        { error: 'You do not have permission to manage billing. Only admins can manage subscriptions.' },
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

    // Prevent creating payment intent if user already has active subscription
    if (subscription.status === 'active') {
      return NextResponse.json(
        { error: 'You already have an active subscription' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    let customerId = subscription.stripe_customer_id;
    
    if (customerId.startsWith('cus_pending_')) {
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          church_id: userData.church_id,
          user_id: user.id,
        },
      });
      customerId = customer.id;

      // Update subscription with real customer ID
      await supabase
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('church_id', userData.church_id);
    }

    // Check Stripe for existing active subscriptions
    // This catches cases where the webhook hasn't updated the database yet
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (existingSubscriptions.data.length > 0) {
      // Update the database to reflect the actual Stripe state
      const stripeSubscription = existingSubscriptions.data[0];
      const subData = stripeSubscription as any;
      
      await supabase
        .from('subscriptions')
        .update({
          stripe_subscription_id: stripeSubscription.id,
          stripe_price_id: stripeSubscription.items.data[0].price.id,
          status: 'active',
          current_period_start: new Date(subData.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subData.current_period_end * 1000).toISOString(),
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        })
        .eq('church_id', userData.church_id);

      return NextResponse.json(
        { error: 'You already have an active subscription. Refreshing your subscription status...' },
        { status: 400 }
      );
    }

    // Determine the amount
    const amount = priceType === 'yearly' ? PRICING.yearlyPrice : PRICING.monthlyPrice;
    
    // Create a Payment Intent for the subscription
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        church_id: userData.church_id,
        price_type: priceType,
        user_id: user.id,
      },
      setup_future_usage: 'off_session', // Allows saving the payment method for future use
    });

    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret,
      customerId,
      amount,
      priceType,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}