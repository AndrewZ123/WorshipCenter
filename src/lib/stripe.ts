import Stripe from 'stripe';

// Lazy initialization of Stripe to avoid build-time errors
let stripeInstance: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeInstance = new Stripe(key, {
      apiVersion: '2026-02-25.clover',
    });
  }
  return stripeInstance;
};

// Export stripe for convenience (lazy-loaded via getter)
export const stripe = {
  get checkout() { return getStripe().checkout; },
  get customers() { return getStripe().customers; },
  get billingPortal() { return getStripe().billingPortal; },
  get webhooks() { return getStripe().webhooks; },
  get subscriptions() { return getStripe().subscriptions; },
};

// Pricing configuration
export const PRICING = {
  monthlyPriceId: process.env.STRIPE_MONTHLY_PRICE_ID!,
  yearlyPriceId: process.env.STRIPE_YEARLY_PRICE_ID!,
  monthlyPrice: 2900, // $29.00 in cents
  yearlyPrice: 29000, // $290.00 in cents
  trialDays: 14,
} as const;

// Helper to get Stripe public key for client
export const getStripePublishableKey = () => {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!;
};