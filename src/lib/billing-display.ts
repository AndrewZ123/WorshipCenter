export type BillingPlan = 'monthly' | 'yearly';

export interface PlanCtaInput {
  priceType: BillingPlan;
  currentPlan?: string | null;
  isActive?: boolean;
  isTrialing?: boolean;
  hasSubscription?: boolean;
}

/**
 * Copy for a pricing-card button. “Start Free Trial” is reserved for churches
 * that are neither trialing nor on a paid plan — an existing subscriber must
 * never be invited to start a second trial.
 */
export function getPlanCtaLabel({
  priceType,
  currentPlan,
  isActive,
  isTrialing,
  hasSubscription,
}: PlanCtaInput): string {
  const planName = priceType === 'yearly' ? 'Yearly' : 'Monthly';

  if (currentPlan === priceType) return 'Current Plan';
  if (currentPlan === 'monthly' && priceType === 'yearly') return 'Switch to Yearly';
  if (currentPlan === 'yearly' && priceType === 'monthly') return 'Switch to Monthly';

  if (isTrialing || isActive) return `Upgrade to ${planName}`;
  if (hasSubscription) return `Subscribe to ${planName}`;

  return 'Start Free Trial';
}

export interface BillingPeriodInput {
  priceType?: string | null;
  isActive?: boolean;
  isTrialing?: boolean;
  trialEnd?: string | null;
  /** Injectable formatter so tests do not depend on the host locale. */
  formatDate?: (date: string) => string;
}

/**
 * Billing period shown on the current-plan card. During a trial there is no
 * paid billing period yet, so show the trial end date (not “—” and not an
 * invented Stripe period). An active plan always wins: stale trial data must
 * never make a paid subscription look like a trial.
 */
export function getBillingPeriodText({
  priceType,
  isActive,
  isTrialing,
  trialEnd,
  formatDate = (date) => date,
}: BillingPeriodInput): string {
  if (!isActive && isTrialing) {
    return trialEnd ? `Trial ends ${formatDate(trialEnd)}` : '—';
  }
  if (priceType === 'yearly') return 'Yearly';
  if (priceType === 'monthly') return 'Monthly';
  return '—';
}
