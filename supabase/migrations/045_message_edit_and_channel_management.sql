-- 045_message_edit_and_channel_management.sql
-- ============================================================
-- Add edit tracking to messages, UPDATE RLS policies,
-- poll editing RLS, service chat message update RLS
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Add updated_at to chat_messages for edit tracking
-- ─────────────────────────────────────────────────────────────
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────
-- 2. UPDATE RLS policy for chat_messages (own messages only)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update their own messages" ON chat_messages;
CREATE POLICY "Users can update their own messages"
  ON chat_messages FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 3. UPDATE RLS policy for chat_polls (own polls only)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update their own polls" ON chat_polls;
CREATE POLICY "Users can update their own polls"
  ON chat_polls FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 4. UPDATE RLS policy for service_chat_messages (own messages)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update their own service chat messages" ON service_chat_messages;
CREATE POLICY "Users can update their own service chat messages"
  ON service_chat_messages FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
