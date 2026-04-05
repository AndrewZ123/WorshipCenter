/**
 * POST /api/billing/create-checkout-session
 *
 * Creates a Stripe Checkout Session for subscribing to a paid plan.
 * This is the ONLY way users subscribe — no payment intents, no embedded forms.
 *
 * Flow:
 * 1. Client posts { priceType: 'monthly' | 'yearly' }
 * 2. We find the user's church and subscription record
 * 3. We create or reuse a Stripe customer
 * 4. We create a Checkout Session and return the URL
 * 5. User pays on Stripe's hosted page
 * 6. Stripe webhook updates our DB
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripe, PRICING, isStripeConfigured, type PriceTier } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { Subscription } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    // ── 1. Validate Stripe is configured ──────────────────────────────────
    if (!isStripeConfigured()) {
      console.error('[Checkout] Stripe is not configured — missing env vars');
      return NextResponse.json(
        { error: 'Payment system is not configured. Please contact support.', code: 'STRIPE_NOT_CONFIGURED' },
        { status: 503 }
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: 'Payment system unavailable.', code: 'STRIPE_NOT_CONFIGURED' },
        { status: 503 }
      );
    }

    // ── 2. Parse and validate request body ────────────────────────────────
    let body: { priceType?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const priceType = body.priceType as PriceTier;
    if (priceType !== 'monthly' && priceType !== 'yearly') {
      return NextResponse.json(
        { error: 'Invalid price type. Must be "monthly" or "yearly".' },
        { status: 400 }
      );
    }

    // ── 3. Authenticate the user via Authorization header ──────────────────
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify the user's token with Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      console.error('[Checkout] Auth error:', authError);
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    // ── 4. Get the user's church_id and existing subscription ─────────────
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('church_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.church_id) {
      console.error('[Checkout] Profile error:', profileError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const churchId = profile.church_id as string;

    // Get existing subscription record
    const { data: existingSub, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('church_id', churchId)
      .single();

    if (subError || !existingSub) {
      console.error('[Checkout] Subscription record not found:', subError);
      return NextResponse.json(
        { error: 'Subscription record not found. Please try again or contact support.' },
        { status: 404 }
      );
    }

    const sub = existingSub as unknown as Subscription;

    // Don't allow checkout if already active
    if (sub.status === 'active' && sub.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'You already have an active subscription. Use the billing portal to manage it.' },
        { status: 400 }
      );
    }

    // ── 5. Create or reuse Stripe customer ────────────────────────────────
    let customerId = sub.stripe_customer_id;

    if (!customerId) {
      console.log('[Checkout] Creating new Stripe customer for church:', churchId);
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          church_id: churchId,
          user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to DB
      await supabaseAdmin
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('church_id', churchId);
    }

    // ── 6. Create the Checkout Session ────────────────────────────────────
    const priceId = PRICING[priceType].priceId();
    const appUrl = env.appUrl();

    console.log('[Checkout] Creating session:', { customerId, priceId, priceType, churchId });

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
        price_type: priceType,
      },
      subscription_data: {
        metadata: {
          church_id: churchId,
          price_type: priceType,
        },
      },
    });

    console.log('[Checkout] Session created:', session.id);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('[Checkout] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session. Please try again.' },
      { status: 500 }
    );
  }
}