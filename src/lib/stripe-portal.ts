/**
 * Stripe Customer Portal configuration helper.
 *
 * Newer Stripe API versions require `features.subscription_update.products`
 * whenever subscription updates are enabled. Omitting it made
 * `billingPortal.configurations.create` fail with:
 *   Missing required param: features[subscription_update][products]
 *
 * We resolve the configured monthly/yearly prices (never hardcode live IDs),
 * group them by product, and reuse any active portal configuration when one
 * already exists.
 */

import type Stripe from 'stripe';
import { PRICING } from './stripe';

interface PortalProduct {
  product: string;
  prices: string[];
}

async function buildSubscriptionUpdateProducts(
  stripe: Stripe,
  priceIds: string[]
): Promise<PortalProduct[]> {
  const pricesByProduct = new Map<string, string[]>();

  for (const priceId of Array.from(new Set(priceIds))) {
    const price = await stripe.prices.retrieve(priceId);
    const productId =
      typeof price.product === 'string' ? price.product : price.product?.id;

    if (!productId) continue;

    const prices = pricesByProduct.get(productId) ?? [];
    if (!prices.includes(priceId)) prices.push(priceId);
    pricesByProduct.set(productId, prices);
  }

  return Array.from(pricesByProduct.entries()).map(([product, prices]) => ({
    product,
    prices,
  }));
}

/**
 * Return an existing active portal configuration id, or create one configured
 * for monthly/yearly plan switching. Throws if Stripe rejects the payload so
 * the route can return a clear 500 rather than a misleading portal URL.
 */
export async function getOrCreatePortalConfiguration(stripe: Stripe): Promise<string> {
  // Reuse any active configuration, not just the default one.
  try {
    const configurations = await stripe.billingPortal.configurations.list({
      active: true,
      limit: 1,
    });
    const existing = configurations.data[0];
    if (existing) return existing.id;
  } catch (error) {
    console.warn('[Portal] Could not list portal configurations:', error);
  }

  const products = await buildSubscriptionUpdateProducts(stripe, [
    PRICING.monthly.priceId(),
    PRICING.yearly.priceId(),
  ]);

  const configuration = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: 'WorshipCenter Subscription Management',
    },
    features: {
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price', 'promotion_code'],
        proration_behavior: 'create_prorations',
        products,
      },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: {
          enabled: true,
          options: [
            'too_expensive',
            'missing_features',
            'switched_service',
            'unused',
            'other',
          ],
        },
      },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
    },
  });

  return configuration.id;
}
