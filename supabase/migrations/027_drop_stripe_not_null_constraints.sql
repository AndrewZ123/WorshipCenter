-- Fix: Drop NOT NULL constraints from stripe columns in subscriptions table
--
-- Problem: Trial subscriptions are created with NULL values for stripe_customer_id
-- and stripe_subscription_id (before user actually subscribes), but the columns
-- have NOT NULL constraints, causing database errors.
--
-- Solution: Make these columns nullable since trial subscriptions don't have
-- Stripe data yet.

ALTER TABLE subscriptions ALTER COLUMN stripe_customer_id DROP NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN stripe_subscription_id DROP NOT NULL;

COMMENT ON COLUMN subscriptions.stripe_customer_id IS 'Stripe customer ID. NULL for trial subscriptions, populated after first payment.';
COMMENT ON COLUMN subscriptions.stripe_subscription_id IS 'Stripe subscription ID. NULL for trial subscriptions, populated after first payment.';