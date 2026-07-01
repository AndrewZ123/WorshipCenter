/**
 * GET /api/billing/status
 *
 * Lightweight, unauthenticated check that tells the client whether
 * billing is fully configured (Stripe secret key, publishable key, price IDs,
 * and Supabase service role key for server-side DB writes).
 *
 * The client cannot read STRIPE_SECRET_KEY / SUPABASE_SERVICE_ROLE directly
 * (server-only), so without this endpoint the billing UI would have to either:
 *   - always show pricing cards (bad: users click Subscribe then hit a 503), or
 *   - always hide them (bad: can't upgrade even when configured).
 *
 * This route returns { configured: boolean, missing?: string[] } without
 * leaking any secret values — only the NAMES of missing env vars.
 */

import { NextResponse } from 'next/server';
import { isStripeConfigured, getMissingStripeConfig } from '@/lib/stripe';
import { isSupabaseAdminConfigured, getMissingSupabaseConfig } from '@/lib/supabase';

export async function GET() {
  const stripeOk = isStripeConfigured();
  const supabaseOk = isSupabaseAdminConfigured();

  if (stripeOk && supabaseOk) {
    return NextResponse.json({ configured: true });
  }

  // Report which env vars are missing (names only, not values)
  const missing = [
    ...(stripeOk ? [] : getMissingStripeConfig()),
    ...(supabaseOk ? [] : getMissingSupabaseConfig()),
  ];

  return NextResponse.json({ configured: false, missing });
}