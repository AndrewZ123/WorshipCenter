import { describe, expect, it } from 'vitest';
import {
  buildSubscriptionUpdate,
  resolveSubscriptionPeriods,
  type StripeSubscriptionLike,
} from './stripe-subscription';

const PERIOD_START = 1762000000;
const PERIOD_END = 1764592000;
const STALE_TRIAL_END = 1796601600; // 2026-12-07 — the stale sandbox date.

function itemLevelSubscription(
  overrides: Partial<StripeSubscriptionLike> = {}
): StripeSubscriptionLike {
  return {
    id: 'sub_live_shape',
    status: 'active',
    customer: 'cus_real123',
    items: {
      data: [
        {
          current_period_start: PERIOD_START,
          current_period_end: PERIOD_END,
          price: { recurring: { interval: 'month', interval_count: 1 } },
        },
      ],
    },
    ...overrides,
  };
}

describe('buildSubscriptionUpdate', () => {
  it('activates an item-level checkout payload and clears stale trial dates', () => {
    const update = buildSubscriptionUpdate(itemLevelSubscription(), {
      status: 'active',
      customerId: 'cus_real123',
      priceType: 'monthly',
    });

    expect(update).toMatchObject({
      status: 'active',
      stripe_subscription_id: 'sub_live_shape',
      stripe_customer_id: 'cus_real123',
      price_type: 'monthly',
      current_period_start: new Date(PERIOD_START * 1000).toISOString(),
      current_period_end: new Date(PERIOD_END * 1000).toISOString(),
      trial_start: null,
      trial_end: null,
    });
  });

  it('clears the stale trial_end from an already-trialing row when activated', () => {
    const update = buildSubscriptionUpdate(
      itemLevelSubscription({
        trial_start: 1762000000,
        trial_end: STALE_TRIAL_END,
      }),
      { status: 'active' }
    );

    expect(update.status).toBe('active');
    expect(update.trial_start).toBeNull();
    expect(update.trial_end).toBeNull();
  });

  it('clears trial dates for past_due, canceled and incomplete statuses', () => {
    for (const status of ['past_due', 'canceled', 'incomplete'] as const) {
      const update = buildSubscriptionUpdate(
        itemLevelSubscription({ trial_end: STALE_TRIAL_END }),
        { status }
      );
      expect(update.trial_end).toBeNull();
      expect(update.trial_start).toBeNull();
    }
  });

  it('keeps trial dates while the written status is still trialing', () => {
    const update = buildSubscriptionUpdate(
      itemLevelSubscription({
        status: 'trialing',
        trial_start: 1762000000,
        trial_end: STALE_TRIAL_END,
      }),
      { status: 'trialing' }
    );

    expect(update.status).toBe('trialing');
    expect(update.trial_start).toBe(new Date(1762000000 * 1000).toISOString());
    expect(update.trial_end).toBe(new Date(STALE_TRIAL_END * 1000).toISOString());
  });
});

describe('resolveSubscriptionPeriods', () => {
  it('prefers item-level period fields from the 2026 API shape', () => {
    const periods = resolveSubscriptionPeriods(itemLevelSubscription());

    expect(periods.start?.toISOString()).toBe(new Date(PERIOD_START * 1000).toISOString());
    expect(periods.end?.toISOString()).toBe(new Date(PERIOD_END * 1000).toISOString());
  });
});
