import { NextRequest, NextResponse } from 'next/server';
import { getStripe, PRICING } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { withAuth, checkRateLimit, sanitizeRequestBody } from '@/lib/auth-middleware';

// Lazy initialization of Supabase client
const getSupabase = () => createClient(
  env.supabaseUrl(),
  env.supabaseServiceRoleKey()
);

// Rate limit checkout session creation
const MAX_CHECKOUT_ATTEMPTS = 5;
const CHECKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const stripe = getStripe();
    
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
      `checkout-${user.id}`,
      MAX_CHECKOUT_ATTEMPTS,
      CHECKOUT_WINDOW_MS
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Too many checkout attempts. Please try again later.',
          resetAt: rateLimit.resetAt 
        },
        { status: 429 }
      );
    }

    // Get user's church
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('church_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.church_id) {
      console.error('[Checkout] User not found or missing church:', user.id);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get or create subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('church_id', userData.church_id)
      .maybeSingle();

    if (subError) {
      console.error('[Checkout] Subscription query error:', subError);
      return NextResponse.json({ 
        error: 'Failed to lookup subscription', 
        debug: { code: subError.code, message: subError.message, details: subError.details }
      }, { status: 500 });
    }

    // Auto-create subscription if missing (e.g., race condition during signup)
    let sub = subscription;
    if (!sub) {
      console.log('[Checkout] No subscription found for church, auto-creating:', userData.church_id);
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
        console.error('[Checkout] Failed to auto-create subscription:', createSubError);
        return NextResponse.json({ 
          error: 'Failed to initialize subscription. Please try again.',
          debug: { message: createSubError?.message }
        }, { status: 500 });
      }
      sub = newSub;
    }

    // Get or create Stripe customer
    let customerId = sub?.stripe_customer_id;
    
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
          console.error('[Checkout] Failed to update subscription:', updateError);
          // Continue anyway since customer was created
        }
      } catch (stripeError: any) {
        console.error('[Checkout] Failed to create Stripe customer:', stripeError);
        return NextResponse.json(
          { error: 'Failed to create customer account', debug: { message: stripeError?.message, type: stripeError?.type } },
          { status: 500 }
        );
      }
    }

    // Create Checkout Session
    const priceId = priceType === 'yearly' ? PRICING.yearlyPriceId : PRICING.monthlyPriceId;
    const appUrl = env.appUrl();
    
    console.log('[Checkout] Creating session with priceId:', priceId, 'customerId:', customerId, 'appUrl:', appUrl);
    
    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${appUrl}/settings/billing?success=true`,
        cancel_url: `${appUrl}/settings/billing?canceled=true`,
        metadata: {
          church_id: userData.church_id,
        },
      });

      return NextResponse.json({ url: session.url });
    } catch (stripeError: any) {
      console.error('[Checkout] Failed to create checkout session:', stripeError);
      return NextResponse.json(
        { error: 'Failed to create checkout session', debug: { message: stripeError?.message, type: stripeError?.type, raw: stripeError?.raw?.message } },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[Checkout] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.', debug: { message: error?.message, stack: error?.stack?.split('\n').slice(0, 3) } },
      { status: 500 }
    );
  }
}
