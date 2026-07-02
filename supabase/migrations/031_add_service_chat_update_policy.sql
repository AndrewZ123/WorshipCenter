-- Add UPDATE policy for service_chat_messages
-- Required for markAsRead (read receipts) to work under RLS.
-- Migration 015 only created SELECT and INSERT policies.

CREATE POLICY "Users can update messages for their church"
  ON service_chat_messages FOR UPDATE
  USING (
    chat_id IN (
      SELECT id FROM service_chats WHERE church_id IN (
        SELECT church_id FROM users WHERE id = auth.uid()
      )
    )
  );