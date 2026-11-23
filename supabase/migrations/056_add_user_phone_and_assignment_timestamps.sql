-- 056_add_user_phone_and_assignment_timestamps.sql
-- Remainder of 018. status and service_assignments_status_check already
-- exist on production, so those statements are omitted (they would fail).
-- Adds users.phone / phone_verified, assignment timestamps, indexes, and
-- the status-change trigger.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

ALTER TABLE service_assignments
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_service_assignments_status ON service_assignments(status);
CREATE INDEX IF NOT EXISTS idx_service_assignments_service_status ON service_assignments(service_id, status);

COMMENT ON COLUMN users.phone IS 'Optional phone number for SMS notifications';
COMMENT ON COLUMN users.phone_verified IS 'Whether the phone number has been verified via SMS';
COMMENT ON COLUMN service_assignments.confirmed_at IS 'Timestamp when the assignment was confirmed';
COMMENT ON COLUMN service_assignments.declined_at IS 'Timestamp when the assignment was declined';

CREATE OR REPLACE FUNCTION update_assignment_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    NEW.confirmed_at = NOW();
  END IF;

  IF NEW.status = 'declined' AND (OLD.status IS NULL OR OLD.status != 'declined') THEN
    NEW.declined_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS on_assignment_status_updated ON service_assignments;
CREATE TRIGGER on_assignment_status_updated
  BEFORE UPDATE ON service_assignments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_assignment_timestamps();
