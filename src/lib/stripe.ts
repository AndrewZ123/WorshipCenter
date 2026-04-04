import Stripe from 'stripe';
import { env } from './env';

// Lazy initialization of Stripe to avoid build-time errors
let stripeInstance: Stripe | null = null;

/**
 * Check which Stripe environment variables are missing
 * Returns an array of missing variable names
 */
export function getMissingStripeVars(): string[] {
  const required = [
    'STRIPE_SECRET_KEY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_MONTHLY_PRICE_ID',
    'STRIPE_YEARLY_PRICE_ID',
    'STRIPE_WEBHOOK_SECRET',
  ];
  return required.filter(name => !process.env[name]);
}

/**
 * Check if Stripe is properly configured
 */
export function isStripeConfigured(): boolean {
  return getMissingStripeVars().length === 0;
}

export const getStripe = (): Stripe => {
  if (!stripeInstance) {
    const missing = getMissingStripeVars();
    if (missing.length > 0) {
      console.error('[Stripe] Missing environment variables:', missing);
      throw new Error(
        `Stripe is not configured. Missing environment variables: ${missing.join(', ')}. ` +
        `Please add these in your Vercel project settings under Environment Variables.`
      );
    }
    try {
      const key = env.stripeSecretKey();
      stripeInstance = new Stripe(key);
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
      throw new Error('Server configuration error: Unable to initialize payment provider');
    }
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
  get monthlyPriceId() { return env.stripeMonthlyPriceId(); },
  get yearlyPriceId() { return env.stripeYearlyPriceId(); },
  monthlyPrice: 2900, // $29.00 in cents
  yearlyPrice: 29000, // $290.00 in cents
  trialDays: 14,
} as const;

// Helper to get Stripe public key for client
export const getStripePublishableKey = () => {
  try {
    return env.stripePublishableKey();
  } catch (error) {
    console.error('Failed to get Stripe publishable key:', error);
    return ''; // Return empty string for client-side fallback
  }
};
