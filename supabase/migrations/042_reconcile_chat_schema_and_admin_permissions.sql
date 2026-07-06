-- 042_reconcile_chat_schema_and_admin_permissions.sql
-- ============================================================
-- 1. Ensure chat_channels and chat_channel_members exist
--    (migration 024 may not have been applied yet)
-- 2. Reconcile chat_messages schema: add channel_id to existing
--    table (initial schema has church_id but not channel_id)
-- 3. Fix broken RLS from migration 024 that referenced
--    team_members.role (doesn't exist — team_members has roles[])
-- 4. Create admin_permissions table for granular admin scopes
-- 5. Auto-create "General" channel per church
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Ensure chat_channels and chat_channel_members exist
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'channel' CHECK (type IN ('channel', 'group')),
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_channel_members (
    channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_channels_church_id ON chat_channels(church_id);
CREATE INDEX IF NOT EXISTS idx_chat_channel_members_channel_id ON chat_channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_channel_members_user_id ON chat_channel_members(user_id);

ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 2. Chat schema reconciliation
-- ─────────────────────────────────────────────────────────────
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES chat_channels(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id_v2 ON chat_messages(channel_id);

-- Drop broken RLS policies from migration 024 that reference
-- team_members.role (the team_members table only has roles[])
DROP POLICY IF EXISTS "Admins/leaders can create channels" ON chat_channels;
DROP POLICY IF EXISTS "Admins/leaders can update channels" ON chat_channels;
DROP POLICY IF EXISTS "Admins/leaders can delete channels" ON chat_channels;
DROP POLICY IF EXISTS "Admins/leaders can manage channel members" ON chat_channel_members;

-- Channel INSERT: any church member can create channels (privacy/visibility
-- is enforced by SELECT/DELETE/UPDATE policies). This is required so that
-- team members can auto-create the "General" channel on first visit.
CREATE POLICY "Church members can create channels"
  ON chat_channels FOR INSERT
  WITH CHECK (
    church_id IN (SELECT church_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admins/leaders can update channels"
  ON chat_channels FOR UPDATE
  USING (
    church_id IN (SELECT church_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader'))
  );

CREATE POLICY "Admins/leaders can delete channels"
  ON chat_channels FOR DELETE
  USING (
    church_id IN (SELECT church_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader'))
  );

CREATE POLICY "Admins/leaders can manage channel members"
  ON chat_channel_members FOR ALL
  USING (
    channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (
      SELECT church_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader')
    ))
  )
  WITH CHECK (
    channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (
      SELECT church_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader')
    ))
  );

-- Fix existing chat_messages RLS to handle both channel_id and
-- church_id (for legacy messages with NULL channel_id).
-- Drop ALL variants first (both old 024 names and any already-created
-- 042/043 names) so this migration is idempotent regardless of run order.
DROP POLICY IF EXISTS "Users can view messages in accessible channels" ON chat_messages;
DROP POLICY IF EXISTS "Users can post messages to accessible channels" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can post messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can view messages in accessible channels (1)" ON chat_messages;

CREATE POLICY "Users can view messages in accessible channels"
  ON chat_messages FOR SELECT
  USING (
    channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
    OR (channel_id IS NULL AND church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
  );

CREATE POLICY "Users can post messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      channel_id IS NULL
      OR channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
    )
  );

CREATE POLICY "Users can delete their own messages"
  ON chat_messages FOR DELETE
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 3. Admin permissions table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_permissions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    manage_services BOOLEAN NOT NULL DEFAULT TRUE,
    manage_songs BOOLEAN NOT NULL DEFAULT TRUE,
    manage_team BOOLEAN NOT NULL DEFAULT TRUE,
    manage_templates BOOLEAN NOT NULL DEFAULT TRUE,
    manage_settings BOOLEAN NOT NULL DEFAULT TRUE,
    manage_billing BOOLEAN NOT NULL DEFAULT TRUE,
    manage_chat BOOLEAN NOT NULL DEFAULT TRUE,
    manage_admins BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id)
);

ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own admin permissions"
  ON admin_permissions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view church admin permissions"
  ON admin_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage admin permissions"
  ON admin_permissions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-create admin_permissions row when user is promoted to admin
CREATE OR REPLACE FUNCTION auto_create_admin_permissions()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'admin' AND (OLD.role IS NULL OR OLD.role IS DISTINCT FROM 'admin') THEN
        INSERT INTO admin_permissions (user_id, church_id)
        VALUES (NEW.id, NEW.church_id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_create_admin_permissions_trigger
    AFTER INSERT OR UPDATE OF role ON users
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_admin_permissions();

-- Seed admin_permissions for existing admins
INSERT INTO admin_permissions (user_id, church_id)
SELECT id, church_id FROM users WHERE role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 4. Auto-create "General" channel per church
-- ─────────────────────────────────────────────────────────────
INSERT INTO chat_channels (church_id, name, description, type, is_private, created_by)
SELECT c.id, 'General', 'Main church-wide announcements and discussion', 'channel', FALSE, NULL
FROM churches c
WHERE NOT EXISTS (
  SELECT 1 FROM chat_channels cc WHERE cc.church_id = c.id AND cc.name = 'General'
);

-- Backfill: assign existing legacy messages to General channel
UPDATE chat_messages cm
SET channel_id = (
  SELECT cc.id FROM chat_channels cc WHERE cc.church_id = cm.church_id AND cc.name = 'General' LIMIT 1
)
WHERE cm.channel_id IS NULL AND cm.church_id IS NOT NULL;
