/**
 * GET /api/billing/status
 *
 * Lightweight, unauthenticated check that tells the client whether
 * Stripe is fully configured (secret key, publishable key, price IDs).
 *
 * The client cannot read STRIPE_SECRET_KEY directly (server-only), so
 * without this endpoint the billing UI would have to either:
 *   - always show pricing cards (bad: users click Subscribe then hit a 503), or
 *   - always hide them (bad: can't upgrade even when configured).
 *
 * This route returns { configured: boolean } without leaking any secrets.
 */

import { NextResponse } from 'next/server';
import { isStripeConfigured } from '@/lib/stripe';

export async function GET() {
  return NextResponse.json({ configured: isStripeConfigured() });
}