-- 062_nullable_subscription_trial_dates.sql
--
-- Problem: trial_start / trial_end are NOT NULL, but a paid subscription must
-- clear the leftover trial dates when it becomes active (also past_due,
-- canceled, incomplete). The NOT NULL constraint made those updates fail, so
-- billing confirm/sync returned 500 and the stale trial dates stayed behind.
--
-- Solution: make the trial columns nullable. Paid subscriptions have no trial
-- window; the UI only shows trial copy while status is trialing.

ALTER TABLE subscriptions ALTER COLUMN trial_start DROP NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN trial_end DROP NOT NULL;

COMMENT ON COLUMN subscriptions.trial_start IS 'Trial start. NULL once the subscription is no longer trialing (e.g. active, past_due, canceled).';
COMMENT ON COLUMN subscriptions.trial_end IS 'Trial end. NULL once the subscription is no longer trialing, so paid plans never show stale trial dates.';
