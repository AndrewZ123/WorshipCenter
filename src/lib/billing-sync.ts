/**
 * Shared billing activation / sync helpers.
 *
 * Used by the Stripe webhook, the authenticated sync endpoint, and the
 * success-page confirmation route. Keeping the DB writes in one place means a
 * missed webhook can be recovered from a Checkout Session with exactly the same
 * fields (and idempotent upsert semantics) as the webhook path.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import {
  buildSubscriptionUpdate,
  inferPriceType,
  mapStripeStatus,
  normalizePriceType,
  stripeObjectId,
  type StripeSubscriptionLike,
} from './stripe-subscription';

export interface SubscriptionRowSummary {
  church_id?: string | null;
  status?: string | null;
  stripe_customer_id?: string | null;
  [key: string]: unknown;
}

export interface BillingActionResult {
  ok: boolean;
  churchId: string | null;
  subscription?: Record<string, unknown> | null;
  error?: string;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}

/**
 * Find the caller's subscription row by church id first, then by Stripe
 * customer id. The customer fallback matters when a webhook/subscription
 * metadata payload is missing `church_id` but the customer is already linked.
 */
export async function findSubscriptionRow(
  db: SupabaseClient,
  lookup: { churchId?: string | null; customerId?: string | null }
): Promise<SubscriptionRowSummary | null> {
  if (lookup.churchId) {
    const { data } = await db
      .from('subscriptions')
      .select('church_id, status, stripe_customer_id')
      .eq('church_id', lookup.churchId)
      .maybeSingle();
    if (data) return data as SubscriptionRowSummary;
  }

  if (lookup.customerId) {
    const { data } = await db
      .from('subscriptions')
      .select('church_id, status, stripe_customer_id')
      .eq('stripe_customer_id', lookup.customerId)
      .maybeSingle();
    if (data) return data as SubscriptionRowSummary;
  }

  return null;
}

/**
 * Activate (or re-activate) a subscription from a completed Checkout Session.
 *
 * This is intentionally idempotent: the success page, sync endpoint and Stripe
 * webhook may all call it for the same session.
 */
export async function activateSubscriptionFromCheckout(
  db: SupabaseClient,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  options: { churchId?: string | null } = {}
): Promise<BillingActionResult> {
  const sessionChurchId = session.metadata?.church_id ?? null;
  const customerId = stripeObjectId(session.customer);
  const subscriptionId = stripeObjectId(session.subscription);

  if (!subscriptionId) {
    console.warn('[Billing] Checkout session has no subscription:', session.id);
    return { ok: true, churchId: sessionChurchId ?? options.churchId ?? null, subscription: null };
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const sub = subscription as unknown as StripeSubscriptionLike;

  const knownChurchId = options.churchId ?? sessionChurchId;
  const lookupRow = knownChurchId
    ? null
    : await findSubscriptionRow(db, { customerId });
  const churchId =
    knownChurchId ??
    lookupRow?.church_id ??
    sub.metadata?.church_id ??
    null;

  if (!churchId) {
    // Recoverable mapping problem: retrying will not add the missing metadata,
    // so log and acknowledge the event instead of forcing Stripe to retry.
    console.warn('[Billing] Could not map checkout session to a church:', session.id);
    return { ok: true, churchId: null, subscription: null };
  }

  const priceType =
    normalizePriceType(session.metadata?.price_type) ?? inferPriceType(sub);

  const update = buildSubscriptionUpdate(sub, {
    status: 'active',
    customerId: customerId ?? stripeObjectId(sub.customer),
    priceType,
    canceledAt: null,
  });

  const { error } = await db
    .from('subscriptions')
    .update(update)
    .eq('church_id', churchId);

  if (error) {
    console.error('[Billing] Failed to activate subscription:', errorMessage(error));
    return { ok: false, churchId, subscription: null, error: errorMessage(error) };
  }

  const { data } = await db
    .from('subscriptions')
    .select('*')
    .eq('church_id', churchId)
    .maybeSingle();

  return {
    ok: true,
    churchId,
    subscription: (data as Record<string, unknown> | null) ?? null,
  };
}

/**
 * Apply a `customer.subscription.created` / `.updated` event to the DB.
 * Finds the row by metadata.church_id or stripe_customer_id and writes the
 * Stripe subscription id, status, price type and billing period.
 */
export async function syncSubscriptionRecord(
  db: SupabaseClient,
  subscription: StripeSubscriptionLike
): Promise<BillingActionResult> {
  const metadataChurchId = subscription.metadata?.church_id ?? null;
  const customerId = stripeObjectId(subscription.customer);

  const row = await findSubscriptionRow(db, {
    churchId: metadataChurchId,
    customerId,
  });
  const churchId = row?.church_id ?? metadataChurchId ?? null;

  if (!churchId) {
    console.warn('[Billing] Could not map subscription to a church:', subscription.id);
    return { ok: true, churchId: null };
  }

  const incomingStatus = mapStripeStatus(subscription.status ?? '');

  // Protect against downgrading active → trialing. When a Stripe Price has
  // trial_period_days configured, Stripe creates the subscription in
  // 'trialing' status. checkout.session.completed correctly sets 'active'
  // because the user already paid; a later subscription.updated event carrying
  // 'trialing' must not put a paying user back on the trial screen.
  const effectiveStatus =
    incomingStatus === 'trialing' && row?.status === 'active'
      ? 'active'
      : incomingStatus;

  const update = buildSubscriptionUpdate(subscription, {
    status: effectiveStatus,
    customerId,
  });

  const { error } = await db
    .from('subscriptions')
    .update(update)
    .eq('church_id', churchId);

  if (error) {
    console.error('[Billing] Failed to sync subscription:', errorMessage(error));
    return { ok: false, churchId, error: errorMessage(error) };
  }

  return { ok: true, churchId };
}
