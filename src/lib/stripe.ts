import Stripe from 'stripe';
import { env } from './env';

// Lazy initialization of Stripe to avoid build-time errors
let stripeInstance: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (!stripeInstance) {
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
