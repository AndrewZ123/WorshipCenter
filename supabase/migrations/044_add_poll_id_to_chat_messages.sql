-- 044_add_poll_id_to_chat_messages.sql
-- Link chat_messages to chat_polls so polls render inline in the message feed

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS poll_id UUID REFERENCES chat_polls(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_poll_id ON chat_messages(poll_id);

-- Enable realtime for chat_poll_votes so vote updates are instant
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_poll_votes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_poll_votes;
  END IF;
END $$;

-- Add DELETE policy for chat_poll_votes so users can change their votes
DROP POLICY IF EXISTS "Users can delete their own votes" ON chat_poll_votes;
CREATE POLICY "Users can delete their own votes"
  ON chat_poll_votes FOR DELETE
  USING (user_id = auth.uid());
