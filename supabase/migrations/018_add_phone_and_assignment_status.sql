-- Add phone number to users table and enhance assignments with status tracking

-- Add phone number to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Create index for phone
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Add status and timestamps to service_assignments
ALTER TABLE service_assignments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;

-- Update existing assignments to have 'pending' status
UPDATE service_assignments
SET status = 'pending'
WHERE status IS NULL;

-- Add constraint for status values
ALTER TABLE service_assignments
  ADD CONSTRAINT service_assignments_status_check
  CHECK (status IN ('pending', 'confirmed', 'declined'));

-- Create index for status
CREATE INDEX IF NOT EXISTS idx_service_assignments_status ON service_assignments(status);

-- Create composite index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_service_assignments_service_status ON service_assignments(service_id, status);

-- Add comments
COMMENT ON COLUMN users.phone IS 'Optional phone number for SMS notifications';
COMMENT ON COLUMN users.phone_verified IS 'Whether the phone number has been verified via SMS';
COMMENT ON COLUMN service_assignments.status IS 'Assignment status: pending, confirmed, or declined';
COMMENT ON COLUMN service_assignments.confirmed_at IS 'Timestamp when the assignment was confirmed';
COMMENT ON COLUMN service_assignments.declined_at IS 'Timestamp when the assignment was declined';

-- Update function to set confirmed_at when status changes to confirmed
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
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
DROP TRIGGER IF EXISTS on_assignment_status_updated ON service_assignments;
CREATE TRIGGER on_assignment_status_updated
  BEFORE UPDATE ON service_assignments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_assignment_timestamps();