/**
 * POST /api/billing/sync-subscription
 *
 * Manually syncs the subscription state from Stripe to our DB.
 * Used as a diagnostic/recovery tool when webhook may have been missed.
 *
 * Body (optional): { session_id?: string }
 * When the DB row has no stripe_subscription_id yet, a Checkout Session id can
 * be supplied to recover a missed checkout.session.completed webhook.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripe, isStripeConfigured, getMissingStripeConfig } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/auth-middleware';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import {
  activateSubscriptionFromCheckout,
  syncSubscriptionRecord,
} from '@/lib/billing-sync';
import { stripeObjectId, type StripeSubscriptionLike } from '@/lib/stripe-subscription';
import type { Subscription } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    // ── Rate limit ────────────────────────────────────────────────────────
    // Sync calls Stripe — throttle by client IP before any work.
    const limit = checkRateLimit(
      `billing-sync-subscription:${getClientIp(request)}`,
      RateLimitTiers.BILLING.requests,
      RateLimitTiers.BILLING.window
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    if (!isStripeConfigured()) {
      const missing = getMissingStripeConfig();
      console.error('[Sync] Stripe not configured. Missing env vars:', missing);
      return NextResponse.json(
        {
          error: `Payment system not configured. Missing environment variables: ${missing.join(', ')}. Set these in Vercel → Project → Settings → Environment Variables and redeploy.`,
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

    // ── Authenticate ──────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // ── Get subscription record ───────────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('church_id')
      .eq('id', user.id)
      .single();

    if (!profile?.church_id) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
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

    // Optional recovery path: confirm a completed Checkout Session.
    let sessionId: string | null = null;
    try {
      const body = await request.json();
      if (body && typeof body.session_id === 'string') {
        sessionId = body.session_id;
      }
    } catch {
      // No body is fine — this is an optional recovery parameter.
    }

    if (!subscription.stripe_subscription_id) {
      if (!sessionId) {
        return NextResponse.json({
          synced: false,
          message: 'No Stripe subscription to sync. Free/trial plan.',
          subscription,
        });
      }

      if (!sessionId.startsWith('cs_')) {
        return NextResponse.json({ error: 'Invalid checkout session id' }, { status: 400 });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);
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
      const ownsSession = sessionChurchId
        ? sessionChurchId === churchId
        : Boolean(sessionCustomerId) &&
          sessionCustomerId === subscription.stripe_customer_id;

      if (!ownsSession) {
        return NextResponse.json(
          { error: 'This checkout session does not belong to your account.' },
          { status: 403 }
        );
      }

      const result = await activateSubscriptionFromCheckout(supabaseAdmin, stripe, session, {
        churchId,
      });

      if (!result.ok) {
        return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
      }

      return NextResponse.json({
        synced: true,
        message: 'Subscription activated from checkout session.',
        subscription: result.subscription,
      });
    }

    // ── Fetch from Stripe ─────────────────────────────────────────────────
    const stripeSub = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    );

    const result = await syncSubscriptionRecord(
      supabaseAdmin,
      stripeSub as unknown as StripeSubscriptionLike
    );

    if (!result.ok) {
      console.error('[Sync] Failed to update subscription');
      return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
    }

    // Return updated subscription
    const { data: updated } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('church_id', churchId)
      .single();

    return NextResponse.json({
      synced: true,
      message: 'Subscription synced with Stripe.',
      subscription: updated,
    });
  } catch (error: unknown) {
    console.error('[Sync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync subscription.' },
      { status: 500 }
    );
  }
}
