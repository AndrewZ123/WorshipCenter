-- Account Deletion and Content Reporting Support
-- Required for App Store compliance (Guidelines 5.1.1 and 1.2)

-- ============================================
-- 1. Account Deletion Function
-- ============================================
-- This function safely deletes a user's account and associated data.
-- It is called by the server-side admin API (using service_role key).
CREATE OR REPLACE FUNCTION delete_user_account(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Delete in order of dependencies to avoid FK violations
  DELETE FROM service_chat_messages WHERE user_id = delete_user_account.user_id;
  DELETE FROM service_debriefs WHERE user_id = delete_user_account.user_id;
  DELETE FROM notifications WHERE user_id = delete_user_account.user_id;
  DELETE FROM team_members WHERE user_id = delete_user_account.user_id;
  DELETE FROM users WHERE id = delete_user_account.user_id;
  -- auth.users deletion must be done via the Supabase admin API (not raw SQL)
END;
$$;

-- ============================================
-- 2. Chat Reports Table (UGC moderation)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_reports_church ON chat_reports(church_id);
CREATE INDEX IF NOT EXISTS idx_chat_reports_status ON chat_reports(status);
CREATE INDEX IF NOT EXISTS idx_chat_reports_message ON chat_reports(message_id);

ALTER TABLE chat_reports ENABLE ROW LEVEL SECURITY;

-- Users can view reports for their church
DROP POLICY IF EXISTS "Users can view reports for their church" ON chat_reports;
CREATE POLICY "Users can view reports for their church"
  ON chat_reports FOR SELECT
  USING (church_id = get_user_church_id());

-- Users can create reports (insert)
DROP POLICY IF EXISTS "Users can report messages" ON chat_reports;
CREATE POLICY "Users can report messages"
  ON chat_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    church_id = get_user_church_id()
    AND reported_by = auth.uid()
  );

-- Admins and leaders can update report status
DROP POLICY IF EXISTS "Admins and leaders can resolve reports" ON chat_reports;
CREATE POLICY "Admins and leaders can resolve reports"
  ON chat_reports FOR UPDATE
  USING (
    church_id = get_user_church_id()
    AND is_admin_or_leader()
  );

-- ============================================
-- 3. Service Chat Reports Table
-- ============================================
CREATE TABLE IF NOT EXISTS service_chat_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES service_chat_messages(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_service_chat_reports_church ON service_chat_reports(church_id);
CREATE INDEX IF NOT EXISTS idx_service_chat_reports_status ON service_chat_reports(status);

ALTER TABLE service_chat_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view service chat reports for their church" ON service_chat_reports;
CREATE POLICY "Users can view service chat reports for their church"
  ON service_chat_reports FOR SELECT
  USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS "Users can report service chat messages" ON service_chat_reports;
CREATE POLICY "Users can report service chat messages"
  ON service_chat_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    church_id = get_user_church_id()
    AND reported_by = auth.uid()
  );

DROP POLICY IF EXISTS "Admins and leaders can resolve service chat reports" ON service_chat_reports;
CREATE POLICY "Admins and leaders can resolve service chat reports"
  ON service_chat_reports FOR UPDATE
  USING (
    church_id = get_user_church_id()
    AND is_admin_or_leader()
  );

-- ============================================
-- 4. Add platform field to users table (optional but helpful)
-- ============================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE churches
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
