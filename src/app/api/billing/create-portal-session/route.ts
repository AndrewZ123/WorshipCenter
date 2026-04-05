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
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { Subscription } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    // ── 1. Validate Stripe ────────────────────────────────────────────────
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Payment system is not configured.' },
        { status: 503 }
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Payment system unavailable.' }, { status: 503 });
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

    if (!customerId) {
      return NextResponse.json(
        { error: 'No billing account found. Please subscribe first.' },
        { status: 400 }
      );
    }

    // ── 4. Create Portal Session ──────────────────────────────────────────
    const appUrl = env.appUrl();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
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