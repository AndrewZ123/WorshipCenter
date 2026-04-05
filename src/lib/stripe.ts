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
    apiVersion: '2026-02-25.clover',
    typescript: true,
  });

  return _stripe;
}

/**
 * Check if Stripe is properly configured
 */
export function isStripeConfigured(): boolean {
  return !!(
    env.stripeSecretKey() &&
    env.stripePublishableKey() &&
    env.stripeMonthlyPriceId() &&
    env.stripeYearlyPriceId()
  );
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

