-- Migration: Add volunteer self-signup for open positions
-- Enables volunteers to browse open positions and request signup

-- ==========================================
-- SERVICE ROLE POSITIONS
-- Defines open roles per service with signup settings
-- ==========================================

CREATE TABLE IF NOT EXISTS service_role_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  max_volunteers INTEGER NOT NULL DEFAULT 1,
  signup_enabled BOOLEAN NOT NULL DEFAULT false,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_id, role)
);

-- ==========================================
-- SIGNUP REQUESTS
-- Tracks volunteer requests to join a role
-- ==========================================

CREATE TABLE IF NOT EXISTS signup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_role_positions_service
  ON service_role_positions(service_id);
CREATE INDEX IF NOT EXISTS idx_role_positions_church
  ON service_role_positions(church_id);
CREATE INDEX IF NOT EXISTS idx_signup_requests_service
  ON signup_requests(service_id);
CREATE INDEX IF NOT EXISTS idx_signup_requests_church
  ON signup_requests(church_id);
CREATE INDEX IF NOT EXISTS idx_signup_requests_team_member
  ON signup_requests(team_member_id);
CREATE INDEX IF NOT EXISTS idx_signup_requests_status
  ON signup_requests(status);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE service_role_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_requests ENABLE ROW LEVEL SECURITY;

-- Service role positions: all church members can view
DROP POLICY IF EXISTS "Role positions viewable by church members" ON service_role_positions;
CREATE POLICY "Role positions viewable by church members"
  ON service_role_positions FOR SELECT
  USING (church_id = get_user_church_id());

-- Only admin/leader can INSERT/UPDATE/DELETE role positions
DROP POLICY IF EXISTS "Role positions insert for admin/leader" ON service_role_positions;
CREATE POLICY "Role positions insert for admin/leader"
  ON service_role_positions FOR INSERT
  WITH CHECK (church_id = get_user_church_id() AND is_admin_or_leader());

DROP POLICY IF EXISTS "Role positions update for admin/leader" ON service_role_positions;
CREATE POLICY "Role positions update for admin/leader"
  ON service_role_positions FOR UPDATE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

DROP POLICY IF EXISTS "Role positions delete for admin/leader" ON service_role_positions;
CREATE POLICY "Role positions delete for admin/leader"
  ON service_role_positions FOR DELETE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

-- Signup requests: church-scoped SELECT (all members can view)
DROP POLICY IF EXISTS "Signup requests viewable by church members" ON signup_requests;
CREATE POLICY "Signup requests viewable by church members"
  ON signup_requests FOR SELECT
  USING (church_id = get_user_church_id());

-- Any authenticated church member can create a signup request for themselves
DROP POLICY IF EXISTS "Signup requests insert for church members" ON signup_requests;
CREATE POLICY "Signup requests insert for church members"
  ON signup_requests FOR INSERT
  WITH CHECK (
    church_id = get_user_church_id()
    AND (
      -- If linked to a team member, must be the current user
      (team_member_id IS NOT NULL AND team_member_id IN (
        SELECT id FROM team_members WHERE user_id = auth.uid()
      ))
      OR
      -- If not linked (new member), allow with name+email
      (team_member_id IS NULL AND name IS NOT NULL AND email IS NOT NULL)
    )
  );

-- Admin/leader can update (approve/decline) signup requests
DROP POLICY IF EXISTS "Signup requests update for admin/leader" ON signup_requests;
CREATE POLICY "Signup requests update for admin/leader"
  ON signup_requests FOR UPDATE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

-- Admin/leader can delete signup requests
DROP POLICY IF EXISTS "Signup requests delete for admin/leader" ON signup_requests;
CREATE POLICY "Signup requests delete for admin/leader"
  ON signup_requests FOR DELETE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

-- ==========================================
-- COMMENTS
-- ==========================================

COMMENT ON TABLE service_role_positions IS 'Defines open role positions per service with signup controls';
COMMENT ON COLUMN service_role_positions.max_volunteers IS 'Maximum number of volunteers that can sign up for this role';
COMMENT ON COLUMN service_role_positions.signup_enabled IS 'Whether volunteers can self-signup for this position';
COMMENT ON TABLE signup_requests IS 'Tracks volunteer requests to sign up for open service positions';
COMMENT ON COLUMN signup_requests.status IS 'pending | approved | declined';
