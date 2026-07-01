-- 022_create_member_groups.sql
-- Phase 1.2: Member Groups / Bands
-- Allows worship leaders to save reusable groups of team members (e.g., "Sunday Morning Team")

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

-- Index for church-scoped queries
CREATE INDEX IF NOT EXISTS idx_member_groups_church_id ON member_groups(church_id);
CREATE INDEX IF NOT EXISTS idx_member_group_members_group_id ON member_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_member_group_members_member_id ON member_group_members(team_member_id);

-- RLS Policies
ALTER TABLE member_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_group_members ENABLE ROW LEVEL SECURITY;

-- Users can manage groups within their own church
CREATE POLICY "Users can view their church's member groups"
    ON member_groups FOR SELECT
    USING (
        church_id IN (
            SELECT church_id FROM team_members
            WHERE user_id = auth.uid() AND church_id IS NOT NULL
        )
    );

CREATE POLICY "Admins/leaders can manage their church's member groups"
    ON member_groups FOR ALL
    USING (
        church_id IN (
            SELECT church_id FROM team_members
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'leader')
              AND church_id IS NOT NULL
        )
    )
    WITH CHECK (
        church_id IN (
            SELECT church_id FROM team_members
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'leader')
              AND church_id IS NOT NULL
        )
    );

-- Group members inherit visibility from their group's church
CREATE POLICY "Users can view their church's group members"
    ON member_group_members FOR SELECT
    USING (
        group_id IN (
            SELECT mg.id FROM member_groups mg
            WHERE mg.church_id IN (
                SELECT church_id FROM team_members
                WHERE user_id = auth.uid() AND church_id IS NOT NULL
            )
        )
    );

CREATE POLICY "Admins/leaders can manage group memberships"
    ON member_group_members FOR ALL
    USING (
        group_id IN (
            SELECT mg.id FROM member_groups mg
            WHERE mg.church_id IN (
                SELECT church_id FROM team_members
                WHERE user_id = auth.uid()
                  AND role IN ('admin', 'leader')
                  AND church_id IS NOT NULL
            )
        )
    )
    WITH CHECK (
        group_id IN (
            SELECT mg.id FROM member_groups mg
            WHERE mg.church_id IN (
                SELECT church_id FROM team_members
                WHERE user_id = auth.uid()
                  AND role IN ('admin', 'leader')
                  AND church_id IS NOT NULL
            )
        )
    );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_member_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER member_groups_updated_at
    BEFORE UPDATE ON member_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_member_groups_updated_at();