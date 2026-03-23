-- Enhance notifications table for multi-channel notifications and assignment tracking

-- Add new columns to notifications table
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES service_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS link_url TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS channels_sent JSONB DEFAULT '{"in_app": false, "email": false, "sms": false}'::jsonb;

-- Create index for assignment_id
CREATE INDEX IF NOT EXISTS idx_notifications_assignment_id ON notifications(assignment_id);

-- Create index for sent_at
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at);

-- Create index for user_id and sent_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_sent_at ON notifications(user_id, sent_at DESC);

-- Add comment explaining the structure
COMMENT ON COLUMN notifications.assignment_id IS 'Optional: Link to the specific service assignment this notification relates to';
COMMENT ON COLUMN notifications.link_url IS 'Deep link to navigate the user to relevant content';
COMMENT ON COLUMN notifications.sent_at IS 'Timestamp when the notification was actually sent (may differ from created_at)';
COMMENT ON COLUMN notifications.channels_sent IS 'JSONB tracking which channels (in_app, email, sms) were used to send this notification';