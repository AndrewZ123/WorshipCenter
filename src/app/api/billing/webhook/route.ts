/**
 * POST /api/billing/webhook
 *
 * Handles Stripe webhook events. This is the source of truth for subscription state.
 *
 * Key events handled:
 * - checkout.session.completed → Activate subscription
 * - customer.subscription.updated → Sync subscription changes
 * - customer.subscription.deleted → Mark subscription as canceled
 * - invoice.payment_failed → Mark subscription as past_due
 *
 * IMPORTANT: This route uses the raw body for signature verification.
 * The `stripe webhook` CLI command forwards events here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import type Stripe from 'stripe';
import { env } from '@/lib/env';

// Disable body parsing — we need the raw body for signature verification
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      console.error('[Webhook] Stripe not initialized');
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
    }

    const webhookSecret = env.stripeWebhookSecret();
    if (!webhookSecret) {
      console.error('[Webhook] STRIPE_WEBHOOK_SECRET not set');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    // ── 1. Get raw body and signature ─────────────────────────────────────
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('[Webhook] Missing stripe-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // ── 2. Verify webhook signature ───────────────────────────────────────
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('[Webhook] Signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('[Webhook] Received event:', event.type, event.id);

    // ── 3. Route to handler ───────────────────────────────────────────────
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log('[Webhook] Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] Fatal error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Event Handlers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * When checkout completes, we have a new subscription.
 * Extract the subscription details and activate in our DB.
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  console.log('[Webhook] Checkout completed:', session.id);

  const churchId = session.metadata?.church_id;
  const priceType = session.metadata?.price_type || 'monthly';

  if (!churchId) {
    console.error('[Webhook] No church_id in checkout session metadata');
    return;
  }

  // Get the subscription from Stripe
  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    console.error('[Webhook] No subscription ID in checkout session');
    return;
  }

  const stripe = getStripe()!;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;

  // Calculate period end
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();

  console.log('[Webhook] Activating subscription for church:', churchId, {
    subscriptionId,
    priceType,
    currentPeriodEnd,
  });

  // Update our DB — activate the subscription
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'active',
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: session.customer as string,
      price_type: priceType,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      canceled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('church_id', churchId);

  if (error) {
    console.error('[Webhook] Failed to activate subscription in DB:', error);
  } else {
    console.log('[Webhook] Subscription activated successfully for church:', churchId);
  }
}

/**
 * Subscription was updated (plan change, renewal, etc.)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const sub = subscription as any;
  console.log('[Webhook] Subscription updated:', sub.id);

  const churchId = sub.metadata?.church_id;
  if (!churchId) {
    console.error('[Webhook] No church_id in subscription metadata');
    return;
  }

  const currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
  const currentPeriodStart = new Date(sub.current_period_start * 1000).toISOString();

  // Determine our status from Stripe status
  const status = mapStripeStatus(sub.status);
  const priceType = sub.metadata?.price_type || 'monthly';

  // If subscription is canceled at period end, record that
  const canceledAt = sub.canceled_at
    ? new Date(sub.canceled_at * 1000).toISOString()
    : null;

  console.log('[Webhook] Updating subscription:', {
    churchId,
    status,
    priceType,
    currentPeriodEnd,
    canceledAt,
  });

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status,
      price_type: priceType,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      canceled_at: canceledAt,
      updated_at: new Date().toISOString(),
    })
    .eq('church_id', churchId);

  if (error) {
    console.error('[Webhook] Failed to update subscription in DB:', error);
  }
}

/**
 * Subscription was fully deleted (after cancellation period ended)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('[Webhook] Subscription deleted:', subscription.id);

  const churchId = subscription.metadata?.church_id;
  if (!churchId) {
    console.error('[Webhook] No church_id in subscription metadata');
    return;
  }

  // Downgrade to free trial
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'canceled',
      stripe_subscription_id: null,
      current_period_start: null,
      current_period_end: null,
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('church_id', churchId);

  if (error) {
    console.error('[Webhook] Failed to delete subscription in DB:', error);
  }
}

/**
 * Payment failed — mark as past_due so user knows to update payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('[Webhook] Payment failed for customer:', invoice.customer);

  // Find subscription by customer ID
  const { data: sub, error: findError } = await supabaseAdmin
    .from('subscriptions')
    .select('church_id')
    .eq('stripe_customer_id', invoice.customer as string)
    .single();

  if (findError || !sub) {
    console.error('[Webhook] Could not find subscription for customer:', invoice.customer);
    return;
  }

  const churchId = (sub as any).church_id as string;

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('church_id', churchId);

  if (error) {
    console.error('[Webhook] Failed to mark subscription as past_due:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'unpaid':
      return 'canceled';
    case 'trialing':
      return 'trialing';
    case 'incomplete':
      return 'incomplete';
    case 'incomplete_expired':
      return 'canceled';
    case 'paused':
      return 'paused';
    default:
      console.warn('[Webhook] Unknown Stripe status:', stripeStatus);
      return stripeStatus;
  }
}