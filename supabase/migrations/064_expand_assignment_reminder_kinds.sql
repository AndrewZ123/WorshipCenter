-- 064_expand_assignment_reminder_kinds.sql
--
-- Additive expansion of the assignment reminder idempotency ledger. The new
-- kinds cover initial confirmation reminders, pre-rehearsal / pre-service
-- reminders, and leader escalations. The existing 3-day / 1-day rows and the
-- service-role-only RLS posture are unchanged.

ALTER TABLE assignment_reminders_sent
  DROP CONSTRAINT IF EXISTS assignment_reminders_sent_kind_check;

ALTER TABLE assignment_reminders_sent
  ADD CONSTRAINT assignment_reminders_sent_kind_check
  CHECK (kind IN ('3d', '1d', 'initial', 'pre_rehearsal', 'pre_service', 'escalation'));

-- Service-role only. No client policies by design; re-asserted so this
-- migration does not accidentally relax the existing table.
ALTER TABLE assignment_reminders_sent ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE assignment_reminders_sent IS
  'Idempotency ledger for assignment reminder emails: 3-day, 1-day, initial, pre-rehearsal, pre-service, and leader escalation. Service-role access only (RLS enabled, no client policies).';
