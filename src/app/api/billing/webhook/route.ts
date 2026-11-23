/**
 * POST /api/billing/webhook
 *
 * Handles Stripe webhook events. This is the source of truth for subscription state.
 *
 * Key events handled:
 * - checkout.session.completed → Activate subscription
 * - customer.subscription.created/updated → Sync subscription changes
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
import { StripeWebhookEventSchema, invalidInputResponse } from '@/lib/validation';
import {
  activateSubscriptionFromCheckout,
  findSubscriptionRow,
  syncSubscriptionRecord,
} from '@/lib/billing-sync';
import { stripeObjectId } from '@/lib/stripe-subscription';

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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Webhook] Signature verification failed:', message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Signature is valid — now validate the event shape before touching the DB.
    const parsedEvent = StripeWebhookEventSchema.safeParse(event);
    if (!parsedEvent.success) {
      console.error('[Webhook] Event payload failed validation');
      return invalidInputResponse();
    }

    console.log('[Webhook] Received event:', event.type, event.id);

    // ── 3. Route to handler ───────────────────────────────────────────────
    // Handlers return false only when a write that should be retried failed.
    // Mapping problems (e.g. missing church metadata) are acknowledged so
    // Stripe does not retry an event that can never succeed.
    let ok = true;

    switch (event.type) {
      case 'checkout.session.completed':
        ok = await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        ok = await handleSubscriptionChanged(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        ok = await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        ok = await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        ok = await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log('[Webhook] Unhandled event type:', event.type);
    }

    if (!ok) {
      return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
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
async function handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<boolean> {
  console.log('[Webhook] Checkout completed:', session.id);

  const stripe = getStripe();
  if (!stripe) {
    console.error('[Webhook] Stripe not initialized');
    return false;
  }

  const result = await activateSubscriptionFromCheckout(supabaseAdmin, stripe, session);

  if (!result.ok) {
    console.error('[Webhook] Failed to activate subscription in DB:', result.error);
    return false;
  }

  if (result.churchId) {
    console.log('[Webhook] Subscription activated successfully for church:', result.churchId);
  }

  return true;
}

/**
 * Subscription was created or updated (plan change, renewal, etc.)
 */
async function handleSubscriptionChanged(subscription: Stripe.Subscription): Promise<boolean> {
  console.log('[Webhook] Subscription changed:', subscription.id);
  const result = await syncSubscriptionRecord(supabaseAdmin, subscription);

  if (!result.ok) {
    console.error('[Webhook] Failed to sync subscription in DB:', result.error);
    return false;
  }

  return true;
}

/**
 * Subscription was fully deleted (after cancellation period ended)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<boolean> {
  console.log('[Webhook] Subscription deleted:', subscription.id);

  const metadataChurchId = subscription.metadata?.church_id ?? null;
  const customerId = stripeObjectId(subscription.customer);

  // The customer fallback matters when the subscription metadata is missing
  // (e.g. created before church_id was written): the row is already linked.
  const row = await findSubscriptionRow(supabaseAdmin, {
    churchId: metadataChurchId,
    customerId,
  });
  const churchId = row?.church_id ?? metadataChurchId;

  if (!churchId) {
    console.error('[Webhook] Could not map deleted subscription to a church:', subscription.id);
    return true;
  }

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'canceled',
      stripe_subscription_id: null,
      current_period_start: null,
      current_period_end: null,
      trial_start: null,
      trial_end: null,
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('church_id', churchId);

  if (error) {
    console.error('[Webhook] Failed to delete subscription in DB:', error);
    return false;
  }

  return true;
}

/**
 * Payment failed — mark as past_due so user knows to update payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<boolean> {
  // The 2026 API may expand `customer`; accept either a string or an object.
  const customerId = stripeObjectId(invoice.customer);
  console.log('[Webhook] Payment failed for customer:', customerId);

  if (!customerId) {
    console.error('[Webhook] Invoice has no customer id:', invoice.id);
    return true;
  }

  // Find subscription by customer ID
  const { data: sub, error: findError } = await supabaseAdmin
    .from('subscriptions')
    .select('church_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (findError || !sub) {
    console.error('[Webhook] Could not find subscription for customer:', customerId);
    return true;
  }

  const churchId = (sub as { church_id?: string }).church_id;
  if (!churchId) {
    console.error('[Webhook] Subscription row has no church_id for customer:', customerId);
    return true;
  }

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'past_due',
      // A failed payment is no longer a trial; don't leave stale trial dates.
      trial_start: null,
      trial_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq('church_id', churchId);

  if (error) {
    console.error('[Webhook] Failed to mark subscription as past_due:', error);
    return false;
  }

  return true;
}

/**
 * Payment succeeded (initial payment or a recovered failed payment) — sync the
 * subscription so its status/periods match Stripe, typically back to `active`.
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe) {
    console.error('[Webhook] Stripe not initialized');
    return false;
  }

  // The 2026 invoice shape puts the subscription under `parent`; older payloads
  // may still carry a top-level `subscription` field.
  const parentSubscription = invoice.parent?.subscription_details?.subscription;
  const legacySubscription = (invoice as Stripe.Invoice & { subscription?: unknown })
    .subscription;
  const subscriptionId =
    stripeObjectId(parentSubscription) ?? stripeObjectId(legacySubscription);

  if (!subscriptionId) {
    console.log('[Webhook] Invoice is not for a subscription:', invoice.id);
    return true;
  }

  console.log('[Webhook] Payment succeeded for subscription:', subscriptionId);

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const result = await syncSubscriptionRecord(
    supabaseAdmin,
    subscription as unknown as Parameters<typeof syncSubscriptionRecord>[1]
  );

  if (!result.ok) {
    console.error('[Webhook] Failed to sync subscription after payment:', result.error);
    return false;
  }

  return true;
}
