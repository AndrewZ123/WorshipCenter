-- Create rehearsal_logs table for musician practice tracking
-- Each row represents a musician's rehearsal status for one song in one service

CREATE TABLE IF NOT EXISTS rehearsal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  rehearsed BOOLEAN NOT NULL DEFAULT false,
  rehearsed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_id, team_member_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_rehearsal_logs_service ON rehearsal_logs(service_id);
CREATE INDEX IF NOT EXISTS idx_rehearsal_logs_team_member ON rehearsal_logs(team_member_id);
CREATE INDEX IF NOT EXISTS idx_rehearsal_logs_church ON rehearsal_logs(church_id);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE rehearsal_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: church-scoped (all members of a church can view)
DROP POLICY IF EXISTS "Rehearsal logs scoped to church" ON rehearsal_logs;
CREATE POLICY "Rehearsal logs scoped to church"
  ON rehearsal_logs FOR SELECT
  USING (church_id = get_user_church_id());

-- INSERT: only assigned team members can create their own logs
DROP POLICY IF EXISTS "Rehearsal logs insert for assigned members" ON rehearsal_logs;
CREATE POLICY "Rehearsal logs insert for assigned members"
  ON rehearsal_logs FOR INSERT
  WITH CHECK (
    church_id = get_user_church_id()
    AND team_member_id IN (
      SELECT tm.id FROM team_members tm
      WHERE tm.user_id = auth.uid()
    )
    AND team_member_id IN (
      SELECT sa.team_member_id FROM service_assignments sa
      WHERE sa.service_id = service_id
    )
  );

-- UPDATE: same restrictions as INSERT
DROP POLICY IF EXISTS "Rehearsal logs update for assigned members" ON rehearsal_logs;
CREATE POLICY "Rehearsal logs update for assigned members"
  ON rehearsal_logs FOR UPDATE
  USING (
    church_id = get_user_church_id()
    AND team_member_id IN (
      SELECT tm.id FROM team_members tm
      WHERE tm.user_id = auth.uid()
    )
    AND team_member_id IN (
      SELECT sa.team_member_id FROM service_assignments sa
      WHERE sa.service_id = service_id
    )
  );

-- DELETE: church-scoped, admin/leader only
DROP POLICY IF EXISTS "Rehearsal logs delete for admin/leader" ON rehearsal_logs;
CREATE POLICY "Rehearsal logs delete for admin/leader"
  ON rehearsal_logs FOR DELETE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());
