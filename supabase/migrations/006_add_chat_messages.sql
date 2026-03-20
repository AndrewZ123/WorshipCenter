-- Chat Messages Table
-- Stores team chat messages for each church

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying by church and time
CREATE INDEX idx_chat_messages_church_created ON chat_messages(church_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view messages from their own church
CREATE POLICY "Users can view messages from their church" ON chat_messages
  FOR SELECT
  USING (
    church_id IN (
      SELECT church_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert messages to their own church
CREATE POLICY "Users can insert messages to their church" ON chat_messages
  FOR INSERT
  WITH CHECK (
    church_id IN (
      SELECT church_id FROM users WHERE id = auth.uid()
    )
  );

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;