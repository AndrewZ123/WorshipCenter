/**
 * POST /api/billing/create-checkout-session
 *
 * Creates a Stripe Checkout Session for subscribing to a paid plan.
 * This is the ONLY way users subscribe — no payment intents, no embedded forms.
 *
 * Flow:
 * 1. Client posts { priceType: 'monthly' | 'yearly', successUrl?, cancelUrl? }
 * 2. We find the user's church and subscription record
 * 3. We create or reuse a Stripe customer
 * 4. We create a Checkout Session and return the URL
 * 5. User pays on Stripe's hosted page
 * 6. Stripe webhook updates our DB
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/auth-middleware';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import { getStripe, PRICING, isStripeConfigured, getMissingStripeConfig } from '@/lib/stripe';
import { supabaseAdmin, isSupabaseAdminConfigured, getMissingSupabaseConfig } from '@/lib/supabase';
import { getOrCreatePortalConfiguration } from '@/lib/stripe-portal';
import { env } from '@/lib/env';
import { BillingCheckoutRequestSchema, invalidInputResponse } from '@/lib/validation';
import type { Subscription } from '@/lib/types';

/**
 * Returns true only when the value is a REAL Stripe customer ID.
 * Migration 019 historically inserted fake placeholders like
 * 'cus_pending_<uuid>' into subscriptions.stripe_customer_id; those must be
 * treated as "no customer yet" so we create a real one at checkout time.
 */
function isValidStripeCustomerId(id: string | null | undefined): id is string {
  if (!id) return false;
  // Real Stripe customer IDs start with 'cus_' followed by an alphanumeric
  // key (e.g. 'cus_QAbc123XYZ'). Placeholders start with 'cus_pending_'.
  return /^cus_[A-Za-z0-9]+$/.test(id) && !id.startsWith('cus_pending_');
}

/**
 * Resolve a client-supplied return URL to an absolute http(s) URL.
 *
 * Older clients sent protocol-relative paths (`//settings/billing`), which
 * Stripe rejects. Treat those (and plain relative paths) as app paths and
 * prefix them with the configured app URL. Absolute http(s) URLs are kept
 * verbatim so Stripe's `{CHECKOUT_SESSION_ID}` placeholder is not encoded.
 */
function resolveReturnUrl(value: string | undefined, fallbackPath: string): string {
  const fallback = `${env.appUrl()}${fallbackPath}`;
  if (!value) return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Any other scheme (javascript:, data:, etc.) is not a safe return URL.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return fallback;
  }

  // Relative or protocol-relative: strip the leading slashes and append.
  return `${env.appUrl()}/${trimmed.replace(/^\/+/, '')}`;
}

export async function POST(request: NextRequest) {
  try {
    // ── 0. Rate limit ─────────────────────────────────────────────────────
    // Checkout creates Stripe customers/sessions, so throttle by client IP.
    const limit = checkRateLimit(
      `billing-checkout:${getClientIp(request)}`,
      RateLimitTiers.BILLING.requests,
      RateLimitTiers.BILLING.window
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    // ── 1. Validate Stripe is configured ──────────────────────────────────
    if (!isStripeConfigured()) {
      const missing = getMissingStripeConfig();
      console.error('[Checkout] Stripe is not configured — missing env vars:', missing);
      return NextResponse.json(
        {
          error: `Payment system is not configured. Missing environment variables: ${missing.join(', ')}. Set these in Vercel → Project → Settings → Environment Variables and redeploy.`,
          code: 'STRIPE_NOT_CONFIGURED',
          missing,
        },
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

    // ── 1b. Validate Supabase admin is configured ─────────────────────────
    // Without a service role key, auth.getUser() and DB writes silently hit
    // a dummy client, producing misleading 401/404 errors. Fail fast instead.
    if (!isSupabaseAdminConfigured()) {
      const missing = getMissingSupabaseConfig();
      console.error('[Checkout] Supabase admin not configured — missing:', missing);
      return NextResponse.json(
        {
          error: `Server database is not configured. Missing: ${missing.join(', ')}. Set in Vercel → Project → Settings → Environment Variables and redeploy.`,
          code: 'SUPABASE_NOT_CONFIGURED',
          missing,
        },
        { status: 503 }
      );
    }

    // ── 2. Parse and validate request body ────────────────────────────────
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return invalidInputResponse();
    }

    const parsedBody = BillingCheckoutRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return invalidInputResponse();
    }

    const { priceType } = parsedBody.data;

    // Use custom URLs if provided, otherwise use defaults. The client may send
    // a relative/protocol-relative path; Stripe requires an absolute URL.
    const successUrl = resolveReturnUrl(
      parsedBody.data.successUrl,
      '/settings/billing?success=true'
    );
    const cancelUrl = resolveReturnUrl(
      parsedBody.data.cancelUrl,
      '/settings/billing?canceled=true'
    );

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

    let sub: Subscription;

    if (subError || !existingSub) {
      // Auto-create a trial subscription if none exists. This handles users
      // who signed up before the DB triggers that seed the row existed, so
      // checkout never fails with a 404 "Subscription record not found".
      console.warn('[Checkout] No subscription row for church — auto-creating:', churchId, subError?.message);

      const nowIso = new Date().toISOString();
      const trialEndIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      const { data: createdSub, error: createError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          id: crypto.randomUUID(),
          church_id: churchId,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          status: 'trialing',
          trial_start: nowIso,
          trial_end: trialEndIso,
          current_period_start: nowIso,
          current_period_end: trialEndIso,
          cancel_at_period_end: false,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('*')
        .single();

      if (createError || !createdSub) {
        console.error('[Checkout] Failed to auto-create subscription:', createError);
        return NextResponse.json(
          { error: 'Could not initialize your billing account. Please contact support.' },
          { status: 500 }
        );
      }

      sub = createdSub as unknown as Subscription;
      console.log('[Checkout] Auto-created subscription:', sub.id);
    } else {
      sub = existingSub as unknown as Subscription;
    }

    // ── 5. Handle active subscribers wanting to switch plans ──────────────
    if (sub.status === 'active' && sub.stripe_subscription_id) {
      // If same plan, reject
      if (sub.price_type === priceType) {
        return NextResponse.json(
          { error: `You are already subscribed to the ${priceType} plan.` },
          { status: 400 }
        );
      }

      // Different plan — redirect to Stripe portal for plan switching.
      // Use isValidStripeCustomerId so legacy placeholder IDs are rejected
      // instead of being passed to Stripe (which would 400).
      if (!isValidStripeCustomerId(sub.stripe_customer_id)) {
        return NextResponse.json(
          { error: 'No valid billing account found. Please contact support to finish setting up your account.' },
          { status: 400 }
        );
      }

      const portalAppUrl = env.appUrl();

      // Reuse an existing active configuration, or create one with the
      // configured monthly/yearly products so plan switching works.
      const configurationId = await getOrCreatePortalConfiguration(stripe);

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        configuration: configurationId,
        return_url: `${portalAppUrl}/settings/billing`,
      });

      console.log(`[Checkout] Redirecting ${user.email} to portal for plan switch: ${sub.price_type} → ${priceType}`);
      return NextResponse.json({ url: portalSession.url });
    }

    // ── 6. Create or reuse Stripe customer ────────────────────────────────
    // Treat placeholder/NULL customer IDs as "no customer yet" so we always
    // create a real Stripe customer. (Migration 019 historically seeded
    // 'cus_pending_<uuid>' placeholders; those must NOT be sent to Stripe.)
    let customerId = sub.stripe_customer_id;

    if (!isValidStripeCustomerId(customerId)) {
      if (customerId) {
        console.warn('[Checkout] Replacing invalid/placeholder customer ID:', customerId);
      }
      console.log('[Checkout] Creating new Stripe customer for church:', churchId);
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          church_id: churchId,
          user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save the REAL customer ID to DB (overwrites any stale placeholder)
      await supabaseAdmin
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('church_id', churchId);
    }

    // ── 7. Create the Checkout Session ────────────────────────────────────
    const priceId = PRICING[priceType].priceId();

    console.log('[Checkout] Creating session:', { customerId, priceId, priceType, churchId });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
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
  } catch (error) {
    console.error('[Checkout] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session. Please try again.' },
      { status: 500 }
    );
  }
}