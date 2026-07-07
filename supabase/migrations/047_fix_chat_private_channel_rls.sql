-- Fix chat RLS policies for private channel visibility and member access.
--
-- Two bugs fixed:
--   1. chat_channels SELECT let all church members see private channels.
--      Now requires is_private=FALSE OR explicit membership via chat_channel_members.
--   2. chat_channel_members SELECT only let admins/leaders see members.
--      Now allows any church member to see members of accessible channels.
--   3. chat_messages INSERT had no channel access check.
--      Now requires the user can access the target channel.

-- ─── chat_channels ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view public channels in their church" ON chat_channels;

CREATE POLICY "Users can view channels they have access to"
  ON chat_channels FOR SELECT
  USING (
    church_id IN (SELECT church_id FROM users WHERE id = auth.uid())
    AND (
      is_private = FALSE
      OR id IN (SELECT channel_id FROM chat_channel_members WHERE user_id = auth.uid())
    )
  );

-- ─── chat_channel_members ────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view channel members" ON chat_channel_members;

CREATE POLICY "Users can view channel members"
  ON chat_channel_members FOR SELECT
  USING (
    channel_id IN (
      SELECT id FROM chat_channels
      WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid())
      AND (is_private = FALSE OR id IN (SELECT channel_id FROM chat_channel_members WHERE user_id = auth.uid()))
    )
  );

-- ─── chat_messages ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can post messages" ON chat_messages;

CREATE POLICY "Users can post messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      channel_id IS NULL
      OR channel_id IN (
        SELECT id FROM chat_channels
        WHERE (is_private = FALSE OR id IN (SELECT channel_id FROM chat_channel_members WHERE user_id = auth.uid()))
      )
    )
  );
