/**
 * Stripe Configuration & Initialization
 *
 * This module provides a clean, singleton Stripe client and pricing configuration.
 * All billing API routes import getStripe() from here.
 */

import Stripe from 'stripe';
import { env } from './env';

// ─── Stripe Singleton ───────────────────────────────────────────────────────

let _stripe: Stripe | null = null;

/**
 * Get the Stripe client instance (lazy-initialized singleton).
 * Returns null if Stripe is not configured (missing keys).
 */
export function getStripe(): Stripe | null {
  if (_stripe) return _stripe;

  const secretKey = env.stripeSecretKey();
  if (!secretKey) {
    console.warn('[Stripe] STRIPE_SECRET_KEY not set — billing disabled');
    return null;
  }

  _stripe = new Stripe(secretKey, {
    // Use the Stripe account's pinned API version (do not hardcode an invalid version)
    typescript: true,
  });

  return _stripe;
}

/**
 * Check if Stripe is properly configured
 */
export function isStripeConfigured(): boolean {
  return getMissingStripeConfig().length === 0;
}

/**
 * Returns the names of Stripe env vars that are missing/empty.
 * Used to produce actionable 503 error messages instead of an opaque
 * "Payment system not configured" — so operators can see exactly what
 * to set in Vercel/`.env`.
 *
 * NOTE: Only surfaces server-side vars. Publishable key is checked too
 * because isStripeConfigured() historically required it.
 */
export function getMissingStripeConfig(): string[] {
  const missing: string[] = [];
  if (!env.stripeSecretKey()) missing.push('STRIPE_SECRET_KEY');
  if (!env.stripePublishableKey()) missing.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  if (!env.stripeMonthlyPriceId()) missing.push('STRIPE_MONTHLY_PRICE_ID');
  if (!env.stripeYearlyPriceId()) missing.push('STRIPE_YEARLY_PRICE_ID');
  return missing;
}

// ─── Pricing Configuration ──────────────────────────────────────────────────

export type PriceTier = 'monthly' | 'yearly';

export const PRICING = {
  monthly: {
    priceId: () => env.stripeMonthlyPriceId(),
    amount: 2900,       // $29.00 in cents
    label: '$29/month',
    period: 'month',
    name: 'Monthly',
    description: 'Flexible monthly billing',
  },
  yearly: {
    priceId: () => env.stripeYearlyPriceId(),
    amount: 29000,      // $290.00 in cents
    label: '$290/year',
    period: 'year',
    name: 'Yearly',
    description: 'Save $58 — best value',
  },
} as const;

