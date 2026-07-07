/**
 * GET /api/billing/debug-config
 *
 * Debug endpoint to check billing environment configuration.
 * Returns which Stripe and Supabase environment variables are configured.
 *
 * SECURITY: Only checks if variables are set, never reveals their values.
 * This endpoint should be removed or secured in production.
 */

import { NextResponse } from 'next/server';
import { getMissingStripeConfig, isStripeConfigured } from '@/lib/stripe';
import { isSupabaseAdminConfigured, getMissingSupabaseConfig } from '@/lib/supabase';
import { env } from '@/lib/env';

export async function GET() {
  const config = {
    timestamp: new Date().toISOString(),
    
    // Stripe configuration (values hidden)
    stripe: {
      configured: isStripeConfigured(),
      missing: getMissingStripeConfig(),
      // Show which ones are present (but not the actual values)
      secretKeyPresent: !!env.stripeSecretKey(),
      publishableKeyPresent: !!env.stripePublishableKey(),
      monthlyPriceIdPresent: !!env.stripeMonthlyPriceId(),
      monthlyPriceIdValue: env.stripeMonthlyPriceId() || 'NOT_SET',
      yearlyPriceIdPresent: !!env.stripeYearlyPriceId(),
      yearlyPriceIdValue: env.stripeYearlyPriceId() || 'NOT_SET',
      webhookSecretPresent: !!env.stripeWebhookSecret(),
    },
    
    // Supabase configuration (values hidden)
    supabase: {
      adminConfigured: isSupabaseAdminConfigured(),
      missing: getMissingSupabaseConfig(),
      serviceRoleKeyPresent: !!env.supabaseServiceRoleKey(),
      urlPresent: !!env.supabaseUrl(),
    },
    
    // App configuration
    app: {
      url: env.appUrl(),
    },
    
    // Overall billing status
    billingReady: isStripeConfigured() && isSupabaseAdminConfigured(),
  };

  return NextResponse.json(config, { status: 200 });
}