-- 052_create_member_groups.sql
-- 022 minus the four CREATE POLICY statements.
-- Those policies referenced team_members.role, which does not exist
-- (team_members only has roles TEXT[]). Applying 022 as-is would fail
-- mid-transaction and roll back. Policies are added in 053 (from 050).

-- Member groups (bands)
CREATE TABLE IF NOT EXISTS member_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Junction table: members within groups
CREATE TABLE IF NOT EXISTS member_group_members (
    group_id UUID REFERENCES member_groups(id) ON DELETE CASCADE,
    team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
    role TEXT,
    joined_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (group_id, team_member_id)
);

CREATE INDEX IF NOT EXISTS idx_member_groups_church_id ON member_groups(church_id);
CREATE INDEX IF NOT EXISTS idx_member_group_members_group_id ON member_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_member_group_members_member_id ON member_group_members(team_member_id);

ALTER TABLE member_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_group_members ENABLE ROW LEVEL SECURITY;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_member_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS member_groups_updated_at ON member_groups;
CREATE TRIGGER member_groups_updated_at
    BEFORE UPDATE ON member_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_member_groups_updated_at();
