-- 044_add_poll_id_to_chat_messages.sql
-- Link chat_messages to chat_polls so polls render inline in the message feed

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS poll_id UUID REFERENCES chat_polls(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_poll_id ON chat_messages(poll_id);

-- Enable realtime for chat_poll_votes so vote updates are instant
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS chat_poll_votes;
