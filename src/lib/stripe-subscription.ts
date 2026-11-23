/**
 * Helpers for reading subscription state from Stripe API responses.
 *
 * Stripe's 2026 "flexible billing" API moved `current_period_start` /
 * `current_period_end` from the Subscription root onto each SubscriptionItem.
 * Reading the root fields directly yields `undefined`, and
 * `new Date(undefined * 1000).toISOString()` throws `RangeError: Invalid time
 * value`. That throw used to 500 the webhook, so Stripe retried forever and the
 * DB was never updated.
 *
 * These helpers never throw on a missing timestamp: callers either skip the
 * column or use a period derived from the item's recurring price interval.
 */

import type { SubscriptionStatus } from './types';

type MaybeSeconds = number | null | undefined;

export interface SubscriptionItemLike {
  current_period_start?: MaybeSeconds;
  current_period_end?: MaybeSeconds;
  price?: {
    recurring?: {
      interval?: string | null;
      interval_count?: number | null;
    } | null;
  } | null;
}

export interface SubscriptionLike {
  current_period_start?: MaybeSeconds;
  current_period_end?: MaybeSeconds;
  billing_cycle_anchor?: MaybeSeconds;
  items?: { data?: SubscriptionItemLike[] | null } | null;
}

export interface SubscriptionStateFields {
  id?: string | null;
  status?: string | null;
  cancel_at_period_end?: boolean | null;
  canceled_at?: number | null;
  trial_start?: MaybeSeconds;
  trial_end?: MaybeSeconds;
  customer?: string | { id?: string | null } | null;
  metadata?: { church_id?: string; price_type?: string } | null;
}

export type StripeSubscriptionLike = SubscriptionLike & SubscriptionStateFields;

export type PriceType = 'monthly' | 'yearly';

export interface ResolvedPeriods {
  start: Date | null;
  end: Date | null;
}

function fromUnixSeconds(seconds: MaybeSeconds): Date | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function unixToIso(seconds: MaybeSeconds): string | null {
  const date = fromUnixSeconds(seconds);
  return date ? date.toISOString() : null;
}

function addInterval(
  date: Date,
  interval: string | null | undefined,
  count: number | null | undefined
): Date | null {
  const amount = typeof count === 'number' && Number.isFinite(count) && count > 0 ? count : 1;
  const next = new Date(date.getTime());

  switch (interval) {
    case 'day':
      next.setUTCDate(next.getUTCDate() + amount);
      break;
    case 'week':
      next.setUTCDate(next.getUTCDate() + 7 * amount);
      break;
    case 'month':
      next.setUTCMonth(next.getUTCMonth() + amount);
      break;
    case 'year':
      next.setUTCFullYear(next.getUTCFullYear() + amount);
      break;
    default:
      return null;
  }

  return Number.isNaN(next.getTime()) ? null : next;
}

/**
 * Resolve the current billing period. Item-level fields take precedence (the
 * live 2026 API shape); root-level fields are kept as a fallback for older
 * payloads. If only the start is available, the end is derived from the item's
 * recurring interval so the DB still gets a usable renewal date.
 */
export function resolveSubscriptionPeriods(subscription: SubscriptionLike): ResolvedPeriods {
  const item = subscription.items?.data?.[0];

  const start =
    fromUnixSeconds(item?.current_period_start) ??
    fromUnixSeconds(subscription.current_period_start) ??
    fromUnixSeconds(subscription.billing_cycle_anchor);

  const end =
    fromUnixSeconds(item?.current_period_end) ??
    fromUnixSeconds(subscription.current_period_end) ??
    (start
      ? addInterval(
          start,
          item?.price?.recurring?.interval,
          item?.price?.recurring?.interval_count
        )
      : null);

  return { start, end };
}

export function isoOrNull(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

export function normalizePriceType(value: unknown): PriceType | null {
  if (value === 'monthly' || value === 'yearly') return value;
  return null;
}

export function inferPriceType(subscription: StripeSubscriptionLike): PriceType | null {
  const fromMetadata = normalizePriceType(subscription.metadata?.price_type);
  if (fromMetadata) return fromMetadata;

  const interval = subscription.items?.data?.[0]?.price?.recurring?.interval;
  if (interval === 'year') return 'yearly';
  if (interval === 'month') return 'monthly';
  return null;
}

/** Read an `id` from either a Stripe ID string or an expanded Stripe object. */
export function stripeObjectId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

export interface SubscriptionUpdateOptions {
  status: SubscriptionStatus;
  customerId?: string | null;
  priceType?: PriceType | null;
  /** Pass null to explicitly clear `canceled_at` (e.g. a fresh checkout). */
  canceledAt?: string | null;
  cancelAtPeriodEnd?: boolean | null;
}

/**
 * Build a DB update payload from a Stripe subscription. Period columns are only
 * included when a real date could be resolved, so a partial payload never wipes
 * previously-known billing dates.
 */
export function buildSubscriptionUpdate(
  subscription: StripeSubscriptionLike,
  options: SubscriptionUpdateOptions
): Record<string, unknown> {
  const update: Record<string, unknown> = {
    status: options.status,
    updated_at: new Date().toISOString(),
  };

  if (subscription.id) {
    update.stripe_subscription_id = subscription.id;
  }

  if (options.customerId) {
    update.stripe_customer_id = options.customerId;
  }

  const priceType = options.priceType ?? inferPriceType(subscription);
  if (priceType) {
    update.price_type = priceType;
  }

  const { start, end } = resolveSubscriptionPeriods(subscription);
  const startIso = isoOrNull(start);
  const endIso = isoOrNull(end);
  if (startIso) update.current_period_start = startIso;
  if (endIso) update.current_period_end = endIso;

  const cancelAtPeriodEnd =
    options.cancelAtPeriodEnd !== undefined
      ? options.cancelAtPeriodEnd
      : subscription.cancel_at_period_end;
  if (typeof cancelAtPeriodEnd === 'boolean') {
    update.cancel_at_period_end = cancelAtPeriodEnd;
  }

  // Trial dates only belong to a `trialing` plan. Once Stripe reports any other
  // status, a stale `trial_end` (e.g. left over from the pre-checkout trial row)
  // must be cleared so no status-independent UI can render trial copy.
  if (options.status === 'trialing') {
    const trialStartIso = unixToIso(subscription.trial_start);
    const trialEndIso = unixToIso(subscription.trial_end);
    if (trialStartIso) update.trial_start = trialStartIso;
    if (trialEndIso) update.trial_end = trialEndIso;
  } else {
    update.trial_start = null;
    update.trial_end = null;
  }

  update.canceled_at =
    options.canceledAt !== undefined
      ? options.canceledAt
      : unixToIso(subscription.canceled_at);

  return update;
}

/**
 * Maps a Stripe subscription status to our internal SubscriptionStatus type.
 * Our DB has a CHECK constraint that only allows:
 *   'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
 * Returning an unmapped value (like 'paused' or a raw Stripe status) would
 * violate the constraint and crash the DB update.
 */
export function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'unpaid':
      // Treat unpaid as canceled — access is revoked
      return 'canceled';
    case 'trialing':
      return 'trialing';
    case 'incomplete':
      return 'incomplete';
    case 'incomplete_expired':
      return 'canceled';
    default:
      // Never return the raw Stripe status — that would violate our DB CHECK
      // constraint. Default to the safest non-active status.
      console.warn('[Stripe] Unknown Stripe status, defaulting to canceled:', stripeStatus);
      return 'canceled';
  }
}
