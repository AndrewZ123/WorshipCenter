/**
 * POST /api/billing/confirm-checkout
 *
 * Authenticated recovery path for the checkout success page. Retrieves the
 * caller's completed Checkout Session from Stripe, verifies it is paid and
 * belongs to the caller's church, then applies the same subscription fields as
 * the webhook (idempotently). Returns the updated subscription so the page can
 * stop polling and show real plan details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripe, isStripeConfigured, getMissingStripeConfig } from '@/lib/stripe';
import {
  supabaseAdmin,
  isSupabaseAdminConfigured,
  getMissingSupabaseConfig,
} from '@/lib/supabase';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/auth-middleware';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import { activateSubscriptionFromCheckout } from '@/lib/billing-sync';
import { stripeObjectId } from '@/lib/stripe-subscription';
import { BillingConfirmCheckoutSchema, invalidInputResponse } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    // ── Rate limit ────────────────────────────────────────────────────────
    const limit = checkRateLimit(
      `billing-confirm-checkout:${getClientIp(request)}`,
      RateLimitTiers.BILLING_STATUS.requests,
      RateLimitTiers.BILLING_STATUS.window
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    // ── Configuration guards ──────────────────────────────────────────────
    if (!isStripeConfigured()) {
      const missing = getMissingStripeConfig();
      console.error('[ConfirmCheckout] Stripe not configured. Missing env vars:', missing);
      return NextResponse.json(
        {
          error: `Payment system not configured. Missing environment variables: ${missing.join(', ')}.`,
          code: 'STRIPE_NOT_CONFIGURED',
          missing,
        },
        { status: 503 }
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Payment system unavailable.' }, { status: 503 });
    }

    if (!isSupabaseAdminConfigured()) {
      const missing = getMissingSupabaseConfig();
      console.error('[ConfirmCheckout] Supabase admin not configured — missing:', missing);
      return NextResponse.json(
        {
          error: `Server database is not configured. Missing: ${missing.join(', ')}.`,
          code: 'SUPABASE_NOT_CONFIGURED',
          missing,
        },
        { status: 503 }
      );
    }

    // ── Authenticate ──────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    // ── Validate body ─────────────────────────────────────────────────────
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return invalidInputResponse();
    }

    const parsed = BillingConfirmCheckoutSchema.safeParse(rawBody);
    if (!parsed.success) {
      return invalidInputResponse();
    }

    // ── Load caller's church and subscription row ─────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('church_id')
      .eq('id', user.id)
      .single();

    if (!profile?.church_id) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const churchId = profile.church_id as string;

    const { data: subRow } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('church_id', churchId)
      .maybeSingle();

    if (!subRow) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // ── Retrieve and verify the Checkout Session ──────────────────────────
    const session = await stripe.checkout.sessions.retrieve(parsed.data.session_id);

    if (session.status !== 'complete' || session.payment_status !== 'paid') {
      return NextResponse.json(
        {
          error: 'Checkout is not complete yet. Try again in a moment.',
          code: 'CHECKOUT_NOT_COMPLETE',
        },
        { status: 409 }
      );
    }

    const sessionChurchId = session.metadata?.church_id;
    const sessionCustomerId = stripeObjectId(session.customer);
    const rowCustomerId = (subRow as { stripe_customer_id?: string | null }).stripe_customer_id;
    // Prefer the church carried in server-set Checkout metadata. Only fall back
    // to the Stripe customer when metadata is absent.
    const ownsSession = sessionChurchId
      ? sessionChurchId === churchId
      : Boolean(sessionCustomerId) && sessionCustomerId === rowCustomerId;

    if (!ownsSession) {
      return NextResponse.json(
        { error: 'This checkout session does not belong to your account.' },
        { status: 403 }
      );
    }

    // ── Persist the activation (same fields as the webhook) ───────────────
    const result = await activateSubscriptionFromCheckout(supabaseAdmin, stripe, session, {
      churchId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: 'Failed to confirm checkout. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      confirmed: true,
      session_status: session.status,
      payment_status: session.payment_status,
      subscription: result.subscription,
    });
  } catch (error: unknown) {
    console.error('[ConfirmCheckout] Error:', error);
    return NextResponse.json(
      { error: 'Failed to confirm checkout. Please try again.' },
      { status: 500 }
    );
  }
}
