-- Migration: Add volunteer preferences and blockout dates
-- Enables team members to set max frequency preferences and date-range blockouts

-- ==========================================
-- TEAM MEMBER PREFERENCES (1:1 with team_members)
-- ==========================================

CREATE TABLE IF NOT EXISTS team_member_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  max_weekly_frequency INT CHECK (max_weekly_frequency IS NULL OR max_weekly_frequency BETWEEN 1 AND 7),
  availability_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_member_id)
);

-- ==========================================
-- TEAM MEMBER BLOCKOUT DATES
-- ==========================================

CREATE TABLE IF NOT EXISTS team_member_blockout_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_blockout_dates_member_dates
  ON team_member_blockout_dates(team_member_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_blockout_dates_church
  ON team_member_blockout_dates(church_id);
CREATE INDEX IF NOT EXISTS idx_preferences_team_member
  ON team_member_preferences(team_member_id);
CREATE INDEX IF NOT EXISTS idx_preferences_church
  ON team_member_preferences(church_id);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE team_member_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_blockout_dates ENABLE ROW LEVEL SECURITY;

-- Church-scoped SELECT (all church members can view)
DROP POLICY IF EXISTS "Preferences viewable by church members" ON team_member_preferences;
CREATE POLICY "Preferences viewable by church members"
  ON team_member_preferences FOR SELECT
  USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS "Blockout dates viewable by church members" ON team_member_blockout_dates;
CREATE POLICY "Blockout dates viewable by church members"
  ON team_member_blockout_dates FOR SELECT
  USING (church_id = get_user_church_id());

-- Only admin/leader can INSERT/UPDATE/DELETE preferences
DROP POLICY IF EXISTS "Preferences insert for admin/leader" ON team_member_preferences;
CREATE POLICY "Preferences insert for admin/leader"
  ON team_member_preferences FOR INSERT
  WITH CHECK (church_id = get_user_church_id() AND is_admin_or_leader());

DROP POLICY IF EXISTS "Preferences update for admin/leader" ON team_member_preferences;
CREATE POLICY "Preferences update for admin/leader"
  ON team_member_preferences FOR UPDATE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

DROP POLICY IF EXISTS "Preferences delete for admin/leader" ON team_member_preferences;
CREATE POLICY "Preferences delete for admin/leader"
  ON team_member_preferences FOR DELETE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

-- Only admin/leader can INSERT/UPDATE/DELETE blockout dates
DROP POLICY IF EXISTS "Blockout dates insert for admin/leader" ON team_member_blockout_dates;
CREATE POLICY "Blockout dates insert for admin/leader"
  ON team_member_blockout_dates FOR INSERT
  WITH CHECK (church_id = get_user_church_id() AND is_admin_or_leader());

DROP POLICY IF EXISTS "Blockout dates update for admin/leader" ON team_member_blockout_dates;
CREATE POLICY "Blockout dates update for admin/leader"
  ON team_member_blockout_dates FOR UPDATE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

DROP POLICY IF EXISTS "Blockout dates delete for admin/leader" ON team_member_blockout_dates;
CREATE POLICY "Blockout dates delete for admin/leader"
  ON team_member_blockout_dates FOR DELETE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

-- ==========================================
-- UPDATED AT TRIGGER FOR PREFERENCES
-- ==========================================

CREATE OR REPLACE FUNCTION update_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_preferences_updated ON team_member_preferences;
CREATE TRIGGER on_preferences_updated
  BEFORE UPDATE ON team_member_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_preferences_timestamp();

-- ==========================================
-- COMMENTS
-- ==========================================

COMMENT ON TABLE team_member_preferences IS 'Per-member preferences: max weekly frequency and availability notes';
COMMENT ON TABLE team_member_blockout_dates IS 'Date ranges when a team member is unavailable for service';
COMMENT ON COLUMN team_member_preferences.max_weekly_frequency IS 'Maximum number of services per week (1-7), null means no limit';
COMMENT ON COLUMN team_member_preferences.availability_notes IS 'Free-form notes about availability (e.g., available only for evening services)';
COMMENT ON COLUMN team_member_blockout_dates.start_date IS 'Start of the blockout period (inclusive)';
COMMENT ON COLUMN team_member_blockout_dates.end_date IS 'End of the blockout period (inclusive)';
COMMENT ON COLUMN team_member_blockout_dates.reason IS 'Optional reason for the blockout (e.g., vacation, medical)';
