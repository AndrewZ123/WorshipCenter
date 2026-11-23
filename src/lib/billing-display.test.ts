import { describe, expect, it } from 'vitest';
import { getBillingPeriodText, getPlanCtaLabel } from './billing-display';

describe('getPlanCtaLabel', () => {
  it('offers a free trial only to churches with no trial or paid plan', () => {
    expect(getPlanCtaLabel({ priceType: 'monthly' })).toBe('Start Free Trial');
    expect(getPlanCtaLabel({ priceType: 'yearly' })).toBe('Start Free Trial');
  });

  it('never offers a new trial while the church is already trialing', () => {
    expect(
      getPlanCtaLabel({ priceType: 'monthly', isTrialing: true })
    ).toBe('Upgrade to Monthly');
    expect(
      getPlanCtaLabel({ priceType: 'yearly', isTrialing: true })
    ).toBe('Upgrade to Yearly');
  });

  it('uses switch copy for an active plan', () => {
    expect(
      getPlanCtaLabel({
        priceType: 'yearly',
        currentPlan: 'monthly',
        isActive: true,
      })
    ).toBe('Switch to Yearly');
    expect(
      getPlanCtaLabel({
        priceType: 'monthly',
        currentPlan: 'yearly',
        isActive: true,
      })
    ).toBe('Switch to Monthly');
    expect(
      getPlanCtaLabel({
        priceType: 'monthly',
        currentPlan: 'monthly',
        isActive: true,
      })
    ).toBe('Current Plan');
  });

  it('uses subscribe copy for a previous subscriber without a trial', () => {
    expect(
      getPlanCtaLabel({
        priceType: 'yearly',
        hasSubscription: true,
        isActive: false,
        isTrialing: false,
      })
    ).toBe('Subscribe to Yearly');
  });
});

describe('getBillingPeriodText', () => {
  it('shows the trial end date instead of a dash while trialing', () => {
    expect(
      getBillingPeriodText({
        isTrialing: true,
        trialEnd: '2026-12-07T00:00:00.000Z',
        formatDate: () => 'December 7, 2026',
      })
    ).toBe('Trial ends December 7, 2026');
  });

  it('shows the paid period when not trialing', () => {
    expect(getBillingPeriodText({ priceType: 'yearly' })).toBe('Yearly');
    expect(getBillingPeriodText({ priceType: 'monthly' })).toBe('Monthly');
    expect(getBillingPeriodText({ priceType: null })).toBe('—');
  });

  it('never shows trial copy for an active plan, even with a stale trial_end', () => {
    expect(
      getBillingPeriodText({
        priceType: 'monthly',
        isActive: true,
        isTrialing: true,
        trialEnd: '2026-12-07T00:00:00.000Z',
        formatDate: () => 'December 7, 2026',
      })
    ).toBe('Monthly');

    expect(
      getBillingPeriodText({
        priceType: 'yearly',
        isActive: true,
        trialEnd: '2026-12-07T00:00:00.000Z',
        formatDate: () => 'December 7, 2026',
      })
    ).toBe('Yearly');
  });
});
