-- Add service chat tables
-- Each service can have one chat for team communication

-- Service chats table (one per service)
CREATE TABLE IF NOT EXISTS service_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_id)
);

-- Service chat messages table
CREATE TABLE IF NOT EXISTS service_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES service_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security policies
ALTER TABLE service_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_chat_messages ENABLE ROW LEVEL SECURITY;

-- Service chats: users can read chats for their church
CREATE POLICY "Users can view service chats for their church"
  ON service_chats FOR SELECT
  USING (church_id IN (
    SELECT church_id FROM users WHERE id = auth.uid()
  ));

-- Service chat messages: users can read messages for chats in their church
CREATE POLICY "Users can view messages for their church"
  ON service_chat_messages FOR SELECT
  USING (chat_id IN (
    SELECT id FROM service_chats WHERE church_id IN (
      SELECT church_id FROM users WHERE id = auth.uid()
    )
  ));

-- Service chat messages: users can insert messages for chats in their church
CREATE POLICY "Users can insert messages for their church"
  ON service_chat_messages FOR INSERT
  WITH CHECK (
    chat_id IN (
      SELECT id FROM service_chats WHERE church_id IN (
        SELECT church_id FROM users WHERE id = auth.uid()
      )
    )
    AND user_id = auth.uid()
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_chats_service_id ON service_chats(service_id);
CREATE INDEX IF NOT EXISTS idx_service_chats_church_id ON service_chats(church_id);
CREATE INDEX IF NOT EXISTS idx_service_chat_messages_chat_id ON service_chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_service_chat_messages_user_id ON service_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_service_chat_messages_created_at ON service_chat_messages(created_at DESC);