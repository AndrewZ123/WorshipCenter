/**
 * POST /api/billing/create-portal-session
 *
 * Creates a Stripe Customer Portal Session so users can:
 * - View/update payment methods
 * - View invoices
 * - Cancel their subscription
 * - Update billing details
 *
 * This is the ONLY way to manage an existing subscription.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripe, isStripeConfigured, getMissingStripeConfig, PRICING } from '@/lib/stripe';
import { supabaseAdmin, isSupabaseAdminConfigured, getMissingSupabaseConfig } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { Subscription } from '@/lib/types';

/**
 * Returns true only when the value is a REAL Stripe customer ID.
 * Migration 019 historically inserted fake placeholders like
 * 'cus_pending_<uuid>' into subscriptions.stripe_customer_id; those must be
 * treated as "no customer yet" so we never pass them to Stripe.
 */
function isValidStripeCustomerId(id: string | null | undefined): id is string {
  if (!id) return false;
  return /^cus_[A-Za-z0-9]+$/.test(id) && !id.startsWith('cus_pending_');
}

export async function POST(request: NextRequest) {
  try {
    // ── 1. Validate Stripe ────────────────────────────────────────────────
    if (!isStripeConfigured()) {
      const missing = getMissingStripeConfig();
      console.error('[Portal] Stripe is not configured — missing env vars:', missing);
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
      return NextResponse.json({ error: 'Payment system unavailable.' }, { status: 503 });
    }

    // ── 1b. Validate Supabase admin is configured ─────────────────────────
    if (!isSupabaseAdminConfigured()) {
      const missing = getMissingSupabaseConfig();
      console.error('[Portal] Supabase admin not configured — missing:', missing);
      return NextResponse.json(
        {
          error: `Server database is not configured. Missing: ${missing.join(', ')}. Set in Vercel → Project → Settings → Environment Variables and redeploy.`,
          code: 'SUPABASE_NOT_CONFIGURED',
          missing,
        },
        { status: 503 }
      );
    }

    // ── 2. Authenticate ───────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    // ── 3. Get subscription with Stripe customer ID ───────────────────────
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('church_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.church_id) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const churchId = profile.church_id as string;

    const { data: sub, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('church_id', churchId)
      .single();

    if (subError || !sub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const subscription = sub as unknown as Subscription;
    const customerId = subscription.stripe_customer_id;

    // Reject placeholder/invalid customer IDs (legacy migration 019 artifacts)
    if (!isValidStripeCustomerId(customerId)) {
      return NextResponse.json(
        { error: 'No billing account found. Please subscribe first, or contact support if you believe this is an error.' },
        { status: 400 }
      );
    }

    // ── 4. Create Portal Session with plan-switching support ──────────────
    const appUrl = env.appUrl();

    // Reuse an existing default billing-portal configuration instead of
    // creating a new one on every request (avoids Stripe rate limits & clutter).
    let configurationId: string | undefined;
    try {
      const configurations = await stripe.billingPortal.configurations.list({
        active: true,
        is_default: true,
        limit: 1,
      });
      configurationId = configurations.data[0]?.id;
    } catch (cfgErr) {
      console.warn('[Portal] Could not list portal configurations:', cfgErr);
    }

    // Fallback: create one if none exists yet
    if (!configurationId) {
      const configuration = await stripe.billingPortal.configurations.create({
        business_profile: {
          headline: 'WorshipCenter Subscription Management',
        },
        features: {
          subscription_update: {
            enabled: true,
            default_allowed_updates: ['price', 'promotion_code'],
            proration_behavior: 'create_prorations',
          },
          subscription_cancel: {
            enabled: true,
            mode: 'at_period_end',
            cancellation_reason: {
              enabled: true,
              options: [
                'too_expensive',
                'missing_features',
                'switched_service',
                'unused',
                'other',
              ],
            },
          },
          payment_method_update: { enabled: true },
          invoice_history: { enabled: true },
        },
      });
      configurationId = configuration.id;
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration: configurationId,
      return_url: `${appUrl}/settings/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    console.error('[Portal] Error:', error);
    return NextResponse.json(
      { error: 'Failed to open billing portal. Please try again.' },
      { status: 500 }
    );
  }
}