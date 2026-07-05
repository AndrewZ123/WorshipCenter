-- Add missing INSERT policy for service_chats table
-- Migration 015 only created a SELECT policy for service_chats.
-- The getOrCreate function in store.ts needs to INSERT when no chat exists,
-- which was failing with 403 due to the missing INSERT policy.

CREATE POLICY "Users can create service chats for their church"
  ON service_chats FOR INSERT
  WITH CHECK (
    church_id IN (SELECT church_id FROM users WHERE id = auth.uid())
  );

-- Ensure service_chat_messages is in the realtime publication
-- so postgres_changes subscriptions work (new messages appear live)
ALTER PUBLICATION supabase_realtime ADD TABLE service_chat_messages;
