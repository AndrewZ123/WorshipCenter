/**
 * GET /api/billing/status
 *
 * Lightweight, rate-limited check that tells the client whether
 * billing is fully configured (Stripe secret key, publishable key, price IDs,
 * and Supabase service role key for server-side DB writes).
 *
 * This endpoint is rate-limited to prevent abuse and reconnaissance attacks.
 * It returns minimal configuration information without exposing sensitive data.
 *
 * This route returns { configured: boolean } without leaking any secret values.
 * The specific missing configuration details are omitted to reduce information disclosure.
 */

import { NextResponse } from 'next/server';
import { isStripeConfigured } from '@/lib/stripe';
import { isSupabaseAdminConfigured } from '@/lib/supabase';
import { withRateLimit, RateLimitTiers } from '@/lib/comprehensiveRateLimit';

export const GET = withRateLimit(async () => {
  const stripeOk = isStripeConfigured();
  const supabaseOk = isSupabaseAdminConfigured();

  // Return minimal configuration status - don't reveal what's specifically missing
  // This reduces information disclosure while still allowing the UI to function
  const configured = stripeOk && supabaseOk;
  
  return NextResponse.json({ configured });
}, {
  ...RateLimitTiers.BILLING,
  identifier: 'billing-status',
});
