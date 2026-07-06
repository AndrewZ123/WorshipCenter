-- 043_chat_message_features.sql
-- ============================================================
-- Rich message features: polls, attachments, reactions,
-- announcement channels, message pinning, realtime pub
-- ============================================================

-- Announcement flag on channels
ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS is_announcement BOOLEAN NOT NULL DEFAULT FALSE;

-- Pinned flag on messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────
-- Polls
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_multiple_choice BOOLEAN NOT NULL DEFAULT FALSE,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_poll_votes (
    poll_id UUID NOT NULL REFERENCES chat_polls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (poll_id, user_id, option_index)
);

-- ─────────────────────────────────────────────────────────────
-- Attachments
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- Reactions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_reactions (
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, emoji)
);

-- ─────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chat_polls_channel_id ON chat_polls(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_message_id ON chat_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message_id ON chat_reactions(message_id);

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE chat_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

-- Polls: viewable by any user in the church
DROP POLICY IF EXISTS "Users can view polls in accessible channels" ON chat_polls;
CREATE POLICY "Users can view polls in accessible channels"
  ON chat_polls FOR SELECT
  USING (channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid())));

-- Polls: users can create polls in channels they can access
DROP POLICY IF EXISTS "Users can create polls in accessible channels" ON chat_polls;
CREATE POLICY "Users can create polls in accessible channels"
  ON chat_polls FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
  );

-- Voting: users can vote
DROP POLICY IF EXISTS "Users can vote on polls" ON chat_poll_votes;
CREATE POLICY "Users can vote on polls"
  ON chat_poll_votes FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Voting: users can view poll votes
DROP POLICY IF EXISTS "Users can view poll votes" ON chat_poll_votes;
CREATE POLICY "Users can view poll votes"
  ON chat_poll_votes FOR SELECT
  USING (user_id = auth.uid() OR poll_id IN (SELECT id FROM chat_polls WHERE channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))));

-- Attachments: viewable by users who can access the message's channel
DROP POLICY IF EXISTS "Users can view attachments in accessible messages" ON chat_attachments;
CREATE POLICY "Users can view attachments in accessible messages"
  ON chat_attachments FOR SELECT
  USING (message_id IN (SELECT id FROM chat_messages WHERE channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))));

-- Attachments: message author can create
DROP POLICY IF EXISTS "Users can create attachments" ON chat_attachments;
CREATE POLICY "Users can create attachments"
  ON chat_attachments FOR INSERT
  WITH CHECK (message_id IN (SELECT id FROM chat_messages WHERE user_id = auth.uid()));

-- Reactions: viewable by users who can access the message's channel
DROP POLICY IF EXISTS "Users can view reactions" ON chat_reactions;
CREATE POLICY "Users can view reactions"
  ON chat_reactions FOR SELECT
  USING (message_id IN (SELECT id FROM chat_messages WHERE channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))));

-- Reactions: users can manage their own
DROP POLICY IF EXISTS "Users can manage their own reactions" ON chat_reactions;
CREATE POLICY "Users can manage their own reactions"
  ON chat_reactions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Announcement-channel message restriction
-- Only admins/leaders can post to announcement channels
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can post messages" ON chat_messages;
CREATE POLICY "Users can post messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
    AND (
      (SELECT is_announcement FROM chat_channels WHERE id = channel_id) = FALSE
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader'))
    )
  );

-- Enable realtime for new tables so subscriptions work
ALTER PUBLICATION supabase_realtime ADD TABLE chat_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_attachments;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_reactions;
