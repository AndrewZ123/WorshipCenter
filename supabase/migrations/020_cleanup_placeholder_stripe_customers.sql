-- ============================================================
-- Cleanup: Remove placeholder stripe_customer_id values
-- ============================================================
--
-- Background: Migration 019 (and earlier versions of the signup triggers)
-- inserted fake placeholder values like 'cus_pending_a1b2c3...' into
-- subscriptions.stripe_customer_id instead of NULL.
--
-- This broke billing because:
--   - /api/billing/create-portal-session passed the fake ID to Stripe,
--     which returned "No such customer: cus_pending_..."
--   - /api/billing/create-checkout-session thought a customer already
--     existed and skipped customer creation
--
-- Fix: Set any placeholder customer IDs back to NULL so the checkout
-- flow creates a real Stripe customer on the next purchase.
-- ============================================================

UPDATE subscriptions
SET stripe_customer_id = NULL,
    updated_at = NOW()
WHERE stripe_customer_id LIKE 'cus_pending_%';

-- Index for finding subscriptions by Stripe customer (used by webhook)
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
  ON subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON MIGRATION 020 IS 'Removes placeholder cus_pending_* customer IDs inserted by the old signup trigger so billing checkout/portal work correctly.';