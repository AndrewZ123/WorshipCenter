import { NextRequest, NextResponse } from 'next/server';
import { getStripe, PRICING } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { hasPermission } from '@/lib/rbac';
import { env } from '@/lib/env';
import { checkRateLimit, sanitizeRequestBody } from '@/lib/auth-middleware';

// Lazy initialization of Supabase client
const getSupabase = () => createClient(
  env.supabaseUrl(),
  env.supabaseServiceRoleKey()
);

// Rate limit payment intent creation
const MAX_PAYMENT_ATTEMPTS = 10;
const PAYMENT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const stripe = getStripe();
  
  try {
    // Parse and validate request body
    const body = await request.json();
    const sanitized = sanitizeRequestBody(body);
    const { priceType } = sanitized;

    // Validate priceType
    if (!priceType || typeof priceType !== 'string') {
      return NextResponse.json(
        { error: 'priceType is required (monthly or yearly)' },
        { status: 400 }
      );
    }

    if (priceType !== 'monthly' && priceType !== 'yearly') {
      return NextResponse.json(
        { error: 'Invalid priceType. Must be "monthly" or "yearly"' },
        { status: 400 }
      );
    }

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

    // Rate limiting by user
    const rateLimit = checkRateLimit(
      `payment-intent-${user.id}`,
      MAX_PAYMENT_ATTEMPTS,
      PAYMENT_WINDOW_MS
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Too many payment attempts. Please try again later.',
          resetAt: rateLimit.resetAt 
        },
        { status: 429 }
      );
    }

    // Get user's church and subscription
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('church_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.church_id) {
      console.error('[Payment Intent] User not found or missing church:', user.id);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has permission to manage billing (admin only)
    if (!userData.role || !hasPermission(userData.role as any, 'billing', 'manage')) {
      return NextResponse.json(
        { error: 'You do not have permission to manage billing. Only admins can manage subscriptions.' },
        { status: 403 }
      );
    }

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('church_id', userData.church_id)
      .maybeSingle();

    // Auto-create subscription if missing
    let sub = subscription;
    if (!sub && !subError) {
      console.log('[Payment Intent] No subscription found, auto-creating for church:', userData.church_id);
      const { data: newSub, error: createSubError } = await supabase
        .from('subscriptions')
        .insert({
          church_id: userData.church_id,
          stripe_customer_id: 'cus_pending_' + crypto.randomUUID().replace(/-/g, ''),
          stripe_subscription_id: null,
          status: 'trialing',
          trial_start: new Date().toISOString(),
          trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          current_period_start: null,
          current_period_end: null,
          cancel_at_period_end: false,
        })
        .select('*')
        .single();

      if (createSubError || !newSub) {
        console.error('[Payment Intent] Failed to auto-create subscription:', createSubError);
        return NextResponse.json({ error: 'Failed to initialize subscription' }, { status: 500 });
      }
      sub = newSub;
    }

    if (subError || !sub) {
      console.error('[Payment Intent] Subscription not found for church:', userData.church_id);
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Prevent creating payment intent if user already has active subscription
    if (sub.status === 'active') {
      return NextResponse.json(
        { error: 'You already have an active subscription' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    let customerId = sub.stripe_customer_id;
    
    if (!customerId || customerId.startsWith('cus_pending_')) {
      try {
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
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({ stripe_customer_id: customerId })
          .eq('church_id', userData.church_id);

        if (updateError) {
          console.error('[Payment Intent] Failed to update subscription:', updateError);
          // Continue anyway since customer was created
        }
      } catch (stripeError) {
        console.error('[Payment Intent] Failed to create Stripe customer:', stripeError);
        return NextResponse.json(
          { error: 'Failed to create customer account' },
          { status: 500 }
        );
      }
    }

    // Check Stripe for existing active subscriptions
    // This catches cases where the webhook hasn't updated the database yet
    let existingSubscriptions;
    try {
      existingSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1,
      });
    } catch (stripeError) {
      console.error('[Payment Intent] Failed to check existing subscriptions:', stripeError);
      return NextResponse.json(
        { error: 'Failed to verify subscription status' },
        { status: 500 }
      );
    }

    if (existingSubscriptions.data.length > 0) {
      // Update the database to reflect the actual Stripe state
      const stripeSubscription = existingSubscriptions.data[0];
      const subData = stripeSubscription as any;
      
      const { error: updateError } = await supabase
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

      if (updateError) {
        console.error('[Payment Intent] Failed to update subscription:', updateError);
      }

      return NextResponse.json(
        { error: 'You already have an active subscription. Refreshing your subscription status...' },
        { status: 400 }
      );
    }

    // Determine the amount
    const amount = priceType === 'yearly' ? PRICING.yearlyPrice : PRICING.monthlyPrice;
    
    if (!amount) {
      console.error('[Payment Intent] Invalid price amount for type:', priceType);
      return NextResponse.json(
        { error: 'Invalid price configuration' },
        { status: 500 }
      );
    }
    
    // Create a Payment Intent for the subscription
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
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
    } catch (stripeError) {
      console.error('[Payment Intent] Failed to create payment intent:', stripeError);
      return NextResponse.json(
        { error: 'Failed to create payment intent' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret,
      customerId,
      amount,
      priceType,
    });
  } catch (error) {
    console.error('[Payment Intent] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}