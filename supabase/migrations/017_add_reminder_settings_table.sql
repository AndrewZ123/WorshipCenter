-- Add reminder settings table for configuring automated reminders

CREATE TABLE IF NOT EXISTS reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL UNIQUE REFERENCES churches(id) ON DELETE CASCADE,
  initial_reminder_hours INTEGER NOT NULL DEFAULT 48,
  pre_rehearsal_reminder_hours INTEGER NOT NULL DEFAULT 24,
  pre_service_reminder_hours INTEGER NOT NULL DEFAULT 48,
  escalation_hours INTEGER NOT NULL DEFAULT 24,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE reminder_settings ENABLE ROW LEVEL SECURITY;

-- Users can read reminder settings for their church
CREATE POLICY "Users can view reminder settings for their church"
  ON reminder_settings FOR SELECT
  USING (church_id IN (
    SELECT church_id FROM users WHERE id = auth.uid()
  ));

-- Users can update reminder settings for their church
CREATE POLICY "Users can update reminder settings for their church"
  ON reminder_settings FOR UPDATE
  USING (church_id IN (
    SELECT church_id FROM users WHERE id = auth.uid()
  ));

-- Insert function to create default settings when a church is created
CREATE OR REPLACE FUNCTION create_default_reminder_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO reminder_settings (church_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create reminder settings for new churches
DROP TRIGGER IF EXISTS on_church_created ON churches;
CREATE TRIGGER on_church_created
  AFTER INSERT ON churches
  FOR EACH ROW
  EXECUTE FUNCTION create_default_reminder_settings();

-- Add comments
COMMENT ON TABLE reminder_settings IS 'Configuration for automated reminders per church';
COMMENT ON COLUMN reminder_settings.initial_reminder_hours IS 'Hours after assignment creation to send initial confirmation reminder';
COMMENT ON COLUMN reminder_settings.pre_rehearsal_reminder_hours IS 'Hours before rehearsal start time to send reminder';
COMMENT ON COLUMN reminder_settings.pre_service_reminder_hours IS 'Hours before service start time to send reminder';
COMMENT ON COLUMN reminder_settings.escalation_hours IS 'Hours before service start time to escalate pending assignments to leaders';

-- Update function to modify updated_at timestamp
CREATE OR REPLACE FUNCTION update_reminder_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS on_reminder_settings_updated ON reminder_settings;
CREATE TRIGGER on_reminder_settings_updated
  BEFORE UPDATE ON reminder_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_reminder_settings_updated_at();