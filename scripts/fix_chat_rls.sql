-- ─────────────────────────────────────────────────────────────
-- RECOVERY SCRIPT: Fix chat_channels RLS
-- Run this in the Supabase SQL editor (Project: aqxuovrlmkbxtpxaidtp)
-- ─────────────────────────────────────────────────────────────

-- 1. Drop ALL existing policies on chat_channels and chat_messages
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

-- 2. Ensure RLS is enabled
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;

-- 3. CREATE the correct policies

-- INSERT: any church member can create channels (needed for auto-creating General channel)
CREATE POLICY "Church members can create channels"
  ON chat_channels FOR INSERT
  WITH CHECK (
    church_id IN (SELECT church_id FROM users WHERE id = auth.uid())
  );

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

-- 4. Manually create the General channel for your church if it doesn't exist
INSERT INTO chat_channels (church_id, name, description, type, is_private, is_announcement)
SELECT id, 'General', 'Main church-wide discussions', 'channel', FALSE, FALSE
FROM churches
WHERE NOT EXISTS (
  SELECT 1 FROM chat_channels cc WHERE cc.church_id = churches.id AND cc.name = 'General'
);

-- 5. Backfill channel_id for existing messages
UPDATE chat_messages cm
SET channel_id = (
  SELECT cc.id FROM chat_channels cc WHERE cc.church_id = cm.church_id AND cc.name = 'General' LIMIT 1
)
WHERE cm.channel_id IS NULL AND cm.church_id IS NOT NULL;

-- 6. Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'chat_channels'
ORDER BY policyname;

SELECT '✅ DONE - Policies recreated.' AS status;
