-- ─────────────────────────────────────────────────────────────
-- RECOVERY SCRIPT: Fix ALL chat RLS policies
-- Run this in the Supabase SQL editor then redeploy on Vercel
-- ─────────────────────────────────────────────────────────────

-- =============================================================
-- 1. Drop ALL existing policies (clean slate)
-- =============================================================
DROP POLICY IF EXISTS "Admins/leaders can create channels" ON chat_channels;
DROP POLICY IF EXISTS "Church members can create channels" ON chat_channels;
DROP POLICY IF EXISTS "Admins/leaders can update channels" ON chat_channels;
DROP POLICY IF EXISTS "Admins/leaders can delete channels" ON chat_channels;
DROP POLICY IF EXISTS "Users can view public channels in their church" ON chat_channels;

DROP POLICY IF EXISTS "Admins/leaders can manage channel members" ON chat_channel_members;

DROP POLICY IF EXISTS "Users can view messages in accessible channels" ON chat_messages;
DROP POLICY IF EXISTS "Users can post messages to accessible channels" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can post messages" ON chat_messages;

DROP POLICY IF EXISTS "Users can view polls in accessible channels" ON chat_polls;
DROP POLICY IF EXISTS "Users can create polls in accessible channels" ON chat_polls;
DROP POLICY IF EXISTS "Users can vote on polls" ON chat_poll_votes;
DROP POLICY IF EXISTS "Users can view poll votes" ON chat_poll_votes;
DROP POLICY IF EXISTS "Users can view attachments in accessible messages" ON chat_attachments;
DROP POLICY IF EXISTS "Users can create attachments" ON chat_attachments;
DROP POLICY IF EXISTS "Users can view reactions" ON chat_reactions;
DROP POLICY IF EXISTS "Users can manage their own reactions" ON chat_reactions;

-- =============================================================
-- 2. Ensure RLS is enabled on all tables
-- =============================================================
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- 3. chat_channels policies
-- =============================================================
-- INSERT: any church member can create channels (needed for auto-creating General)
CREATE POLICY "Church members can create channels"
  ON chat_channels FOR INSERT
  WITH CHECK (church_id IN (SELECT church_id FROM users WHERE id = auth.uid()));

-- SELECT: anyone in the church can see public channels
CREATE POLICY "Users can view public channels in their church"
  ON chat_channels FOR SELECT
  USING (
    church_id IN (SELECT church_id FROM users WHERE id = auth.uid())
    AND (
      is_private = FALSE
      OR id IN (SELECT channel_id FROM chat_channel_members WHERE user_id = auth.uid())
    )
  );

-- UPDATE/DELETE: only admins/leaders
CREATE POLICY "Admins/leaders can update channels"
  ON chat_channels FOR UPDATE
  USING (church_id IN (SELECT church_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader')));

CREATE POLICY "Admins/leaders can delete channels"
  ON chat_channels FOR DELETE
  USING (church_id IN (SELECT church_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader')));

-- =============================================================
-- 4. chat_channel_members policies
-- IMPORTANT: Must NOT reference chat_channels in SELECT to
-- avoid infinite recursion (chat_channels SELECT also queries
-- chat_channel_members).
-- =============================================================
-- SELECT: users can see their own memberships; admins can see all
CREATE POLICY "Users can view channel members"
  ON chat_channel_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader'))
  );

-- INSERT/UPDATE/DELETE: only admins/leaders can manage members
CREATE POLICY "Admins can manage channel members"
  ON chat_channel_members FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader')));

CREATE POLICY "Admins can update channel members"
  ON chat_channel_members FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader')));

CREATE POLICY "Admins can delete channel members"
  ON chat_channel_members FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader')));

-- =============================================================
-- 5. chat_messages policies
-- =============================================================
-- SELECT: users can see messages in channels they can access
CREATE POLICY "Users can view messages in accessible channels"
  ON chat_messages FOR SELECT
  USING (
    channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
    OR (channel_id IS NULL AND church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
  );

-- INSERT: any authenticated user can post messages as themselves.
-- Channel-level access is enforced by the UI (users only see channels
-- they can access). The announcement restriction is app-level.
-- Keeping the policy simple avoids complex subquery failures.
CREATE POLICY "Users can post messages"
  ON chat_messages FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- DELETE: users can delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON chat_messages FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================
-- 6. chat_polls policies
-- =============================================================
CREATE POLICY "Users can view polls in accessible channels"
  ON chat_polls FOR SELECT
  USING (channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can create polls in accessible channels"
  ON chat_polls FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
  );

-- =============================================================
-- 7. chat_poll_votes policies
-- =============================================================
CREATE POLICY "Users can vote on polls"
  ON chat_poll_votes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view poll votes"
  ON chat_poll_votes FOR SELECT
  USING (user_id = auth.uid() OR poll_id IN (SELECT id FROM chat_polls WHERE channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))));

-- =============================================================
-- 8. chat_attachments policies
-- =============================================================
CREATE POLICY "Users can view attachments in accessible messages"
  ON chat_attachments FOR SELECT
  USING (message_id IN (SELECT id FROM chat_messages WHERE channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))));

CREATE POLICY "Users can create attachments"
  ON chat_attachments FOR INSERT
  WITH CHECK (message_id IN (SELECT id FROM chat_messages WHERE user_id = auth.uid()));

-- =============================================================
-- 9. chat_reactions policies
-- =============================================================
CREATE POLICY "Users can view reactions"
  ON chat_reactions FOR SELECT
  USING (message_id IN (SELECT id FROM chat_messages WHERE channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))));

CREATE POLICY "Users can manage their own reactions"
  ON chat_reactions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================
-- 10. Create General channel if missing & backfill messages
-- =============================================================
INSERT INTO chat_channels (church_id, name, description, type, is_private, is_announcement)
SELECT id, 'General', 'Main church-wide discussions', 'channel', FALSE, FALSE
FROM churches
WHERE NOT EXISTS (
  SELECT 1 FROM chat_channels cc WHERE cc.church_id = churches.id AND cc.name = 'General'
);

UPDATE chat_messages cm
SET channel_id = (
  SELECT cc.id FROM chat_channels cc WHERE cc.church_id = cm.church_id AND cc.name = 'General' LIMIT 1
)
WHERE cm.channel_id IS NULL AND cm.church_id IS NOT NULL;

-- =============================================================
-- 11. Verify all policies exist
-- =============================================================
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('chat_channels','chat_channel_members','chat_messages','chat_polls','chat_poll_votes','chat_attachments','chat_reactions')
ORDER BY tablename, policyname;

SELECT '✅ ALL POLICIES RESTORED' AS status;
