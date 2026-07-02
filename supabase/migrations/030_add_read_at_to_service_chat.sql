-- Add read_at column to service_chat_messages for read receipts
ALTER TABLE service_chat_messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Backfill existing messages as read
UPDATE service_chat_messages SET read_at = created_at WHERE read_at IS NULL;

-- Index for efficient unread queries
CREATE INDEX IF NOT EXISTS idx_service_chat_messages_read_at
  ON service_chat_messages(read_at)
  WHERE read_at IS NULL;