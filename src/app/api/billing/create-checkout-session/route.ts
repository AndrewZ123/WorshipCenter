import { NextRequest, NextResponse } from 'next/server';
import { getStripe, PRICING, isStripeConfigured, getMissingStripeVars } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

// Lazy initialization of Supabase admin client
const getSupabase = () => createClient(
  env.supabaseUrl(),
  env.supabaseServiceRoleKey()
);

export async function POST(request: NextRequest) {
  try {
    // Check Stripe configuration first
    if (!isStripeConfigured()) {
      const missing = getMissingStripeVars();
      console.error('[create-checkout-session] Stripe not configured. Missing:', missing);
      return NextResponse.json(
        { 
          error: 'Payment system is not configured. Please contact support.',
          code: 'STRIPE_NOT_CONFIGURED',
          details: `Missing: ${missing.join(', ')}`
        },
        { status: 503 }
      );
    }

    // Parse request body - accept both priceId and priceType
    let body: { priceId?: string; priceType?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      );
    }

    // Resolve priceId from either direct priceId or priceType
    let priceId = body.priceId;
    if (!priceId && body.priceType) {
      const priceTypeMap: Record<string, string> = {
        'monthly': PRICING.monthlyPriceId,
        'yearly': PRICING.yearlyPriceId,
      };
      priceId = priceTypeMap[body.priceType];
    }

    if (!priceId) {
      return NextResponse.json(
        { error: 'Plan selection is required. Please specify a plan (monthly or yearly).' },
        { status: 400 }
      );
    }

    // Validate price ID matches configured prices
    const validPriceIds = [PRICING.monthlyPriceId, PRICING.yearlyPriceId];
    if (!validPriceIds.includes(priceId)) {
      console.error('[create-checkout-session] Invalid price ID:', priceId, 'Expected one of:', validPriceIds);
      return NextResponse.json(
        { error: 'Invalid plan selected. Please refresh the page and try again.' },
        { status: 400 }
      );
    }

    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    // Authenticate user with Supabase
    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[create-checkout-session] Auth error:', authError?.message);
      return NextResponse.json(
        { error: 'Invalid or expired session. Please sign in again.' },
        { status: 401 }
      );
    }

    // Get the user's church
    const { data: member, error: memberError } = await supabase
      .from('team_members')
      .select('church_id')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (memberError) {
      console.error('[create-checkout-session] Error fetching church membership:', memberError);
      return NextResponse.json(
        { error: 'Failed to verify church membership.' },
        { status: 500 }
      );
    }

    if (!member?.church_id) {
      return NextResponse.json(
        { error: 'No church found. Please create a church first, or you may not have admin access.' },
        { status: 404 }
      );
    }

    const churchId = member.church_id;

    // Check if church already has an active subscription (not trialing)
    const { data: existingSub, error: subFetchError } = await supabase
      .from('subscriptions')
      .select('id, status, stripe_subscription_id, stripe_customer_id')
      .eq('church_id', churchId)
      .maybeSingle();

    if (subFetchError) {
      console.error('[create-checkout-session] Error checking existing subscription:', subFetchError);
      return NextResponse.json(
        { error: 'Failed to check existing subscription status.' },
        { status: 500 }
      );
    }

    if (existingSub?.status === 'active' && existingSub.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'You already have an active subscription. Use the billing portal to manage it.' },
        { status: 400 }
      );
    }

    // Get app URL safely with fallback
    let appUrl: string;
    try {
      appUrl = env.appUrl();
    } catch {
      console.warn('[create-checkout-session] APP_URL not set, using request origin');
      appUrl = request.headers.get('origin') || 'http://localhost:3000';
    }

    // Create or retrieve Stripe customer
    const stripe = getStripe();
    let customerId: string | undefined;

    if (existingSub?.stripe_customer_id) {
      customerId = existingSub.stripe_customer_id;
      console.log('[create-checkout-session] Using existing customer:', customerId);
    } else {
      // Create a new Stripe customer
      try {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            church_id: churchId,
            user_id: user.id,
          },
        });
        customerId = customer.id;
        console.log('[create-checkout-session] Created new Stripe customer:', customerId);

        // Update the subscription record with the customer ID
        if (existingSub) {
          await supabase
            .from('subscriptions')
            .update({ stripe_customer_id: customerId })
            .eq('church_id', churchId);
        }
      } catch (stripeErr: any) {
        console.error('[create-checkout-session] Failed to create Stripe customer:', stripeErr);
        return NextResponse.json(
          { error: 'Failed to set up payment customer. Please try again.' },
          { status: 500 }
        );
      }
    }

    // Create the Checkout Session
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
          church_id: churchId,
          user_id: user.id,
        },
        subscription_data: {
          metadata: {
            church_id: churchId,
          },
        },
      });

      console.log('[create-checkout-session] Created session:', session.id, 'for church:', churchId);

      return NextResponse.json({ 
        sessionId: session.id,
        url: session.url,
      });
    } catch (stripeErr: any) {
      console.error('[create-checkout-session] Stripe checkout session creation failed:', stripeErr);
      
      // Detect specific Stripe errors
      const errorMessage = stripeErr?.message || '';
      if (errorMessage.includes('No such price') || errorMessage.includes('Invalid price')) {
        return NextResponse.json(
          { error: 'The selected plan is not available yet. Please contact support.' },
          { status: 400 }
        );
      }
      if (errorMessage.includes('api_key') || errorMessage.includes('authentication')) {
        return NextResponse.json(
          { error: 'Payment system configuration error. Please contact support.' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to start checkout. Please try again in a moment.' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[create-checkout-session] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}