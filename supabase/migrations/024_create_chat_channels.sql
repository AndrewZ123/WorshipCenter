-- 024_create_chat_channels.sql
-- Phase 1.4: Chat Channels
-- General (non-service) team communication channels, plus members for private channels.
-- Service chats remain in service_chats; this table powers the sidebar "channels" list.

CREATE TABLE IF NOT EXISTS chat_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'channel' CHECK (type IN ('channel', 'group')),
    -- For 'group' channels, restrict to specific member set; for 'channel', open to whole church
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Members of private/group channels
CREATE TABLE IF NOT EXISTS chat_channel_members (
    channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (channel_id, user_id)
);

-- Messages for general channels
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_channels_church_id ON chat_channels(church_id);
CREATE INDEX IF NOT EXISTS idx_chat_channel_members_channel_id ON chat_channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_channel_members_user_id ON chat_channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id ON chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- RLS
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Channels: users can view public channels in their church + private channels they're members of
CREATE POLICY "Users can view public channels in their church"
    ON chat_channels FOR SELECT
    USING (
        church_id IN (SELECT church_id FROM users WHERE id = auth.uid())
        AND (
            is_private = FALSE
            OR id IN (
                SELECT channel_id FROM chat_channel_members WHERE user_id = auth.uid()
            )
        )
    );

-- Channels: admins/leaders can create channels
CREATE POLICY "Admins/leaders can create channels"
    ON chat_channels FOR INSERT
    WITH CHECK (
        church_id IN (
            SELECT church_id FROM team_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'leader') AND church_id IS NOT NULL
        )
    );

-- Channels: creators/admins can update
CREATE POLICY "Admins/leaders can update channels"
    ON chat_channels FOR UPDATE
    USING (
        church_id IN (
            SELECT church_id FROM team_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'leader') AND church_id IS NOT NULL
        )
    );

-- Channels: admins can delete
CREATE POLICY "Admins/leaders can delete channels"
    ON chat_channels FOR DELETE
    USING (
        church_id IN (
            SELECT church_id FROM team_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'leader') AND church_id IS NOT NULL
        )
    );

-- Channel members: users can view membership for channels they can see
CREATE POLICY "Users can view channel membership"
    ON chat_channel_members FOR SELECT
    USING (
        channel_id IN (
            SELECT id FROM chat_channels
            WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid())
              AND (
                  is_private = FALSE
                  OR user_id = auth.uid()
                  OR channel_id IN (
                      SELECT channel_id FROM chat_channel_members cm WHERE cm.user_id = auth.uid()
                  )
              )
        )
    );

-- Channel members: admins can add members
CREATE POLICY "Admins/leaders can manage channel members"
    ON chat_channel_members FOR ALL
    USING (
        channel_id IN (
            SELECT id FROM chat_channels
            WHERE church_id IN (
                SELECT church_id FROM team_members
                WHERE user_id = auth.uid() AND role IN ('admin', 'leader') AND church_id IS NOT NULL
            )
        )
    )
    WITH CHECK (
        channel_id IN (
            SELECT id FROM chat_channels
            WHERE church_id IN (
                SELECT church_id FROM team_members
                WHERE user_id = auth.uid() AND role IN ('admin', 'leader') AND church_id IS NOT NULL
            )
        )
    );

-- Messages: users can view messages for channels they can access
CREATE POLICY "Users can view messages in accessible channels"
    ON chat_messages FOR SELECT
    USING (
        channel_id IN (
            SELECT id FROM chat_channels
            WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid())
              AND (
                  is_private = FALSE
                  OR id IN (SELECT channel_id FROM chat_channel_members WHERE user_id = auth.uid())
              )
        )
    );

-- Messages: users can post to channels they can access
CREATE POLICY "Users can post messages to accessible channels"
    ON chat_messages FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND channel_id IN (
            SELECT id FROM chat_channels
            WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid())
              AND (
                  is_private = FALSE
                  OR id IN (SELECT channel_id FROM chat_channel_members WHERE user_id = auth.uid())
              )
        )
    );

-- Messages: authors can delete their own messages
CREATE POLICY "Users can delete their own messages"
    ON chat_messages FOR DELETE
    USING (user_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_chat_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_channels_updated_at
    BEFORE UPDATE ON chat_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_channels_updated_at();