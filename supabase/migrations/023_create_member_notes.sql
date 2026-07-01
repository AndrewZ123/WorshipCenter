-- 023_create_member_notes.sql
-- Phase 1.3: Member Private Notes
-- Admin/leader-only notes attached to team members (not visible to the member themselves)

CREATE TABLE IF NOT EXISTS team_member_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
    author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_member_notes_member_id ON team_member_notes(team_member_id);
CREATE INDEX IF NOT EXISTS idx_team_member_notes_author_id ON team_member_notes(author_user_id);

-- RLS: Only admins/leaders can view and create notes
ALTER TABLE team_member_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/leaders can view notes on their church's members"
    ON team_member_notes FOR SELECT
    USING (
        team_member_id IN (
            SELECT id FROM team_members
            WHERE church_id IN (
                SELECT church_id FROM team_members tm
                WHERE tm.user_id = auth.uid()
                  AND tm.role IN ('admin', 'leader')
                  AND tm.church_id IS NOT NULL
            )
        )
    );

CREATE POLICY "Admins/leaders can create notes on their church's members"
    ON team_member_notes FOR INSERT
    WITH CHECK (
        team_member_id IN (
            SELECT id FROM team_members
            WHERE church_id IN (
                SELECT church_id FROM team_members tm
                WHERE tm.user_id = auth.uid()
                  AND tm.role IN ('admin', 'leader')
                  AND tm.church_id IS NOT NULL
            )
        )
    );

CREATE POLICY "Authors and admins can update notes"
    ON team_member_notes FOR UPDATE
    USING (
        author_user_id = auth.uid()
        OR team_member_id IN (
            SELECT id FROM team_members
            WHERE church_id IN (
                SELECT church_id FROM team_members tm
                WHERE tm.user_id = auth.uid()
                  AND tm.role IN ('admin', 'leader')
                  AND tm.church_id IS NOT NULL
            )
        )
    );

CREATE POLICY "Admins/leaders can delete notes"
    ON team_member_notes FOR DELETE
    USING (
        author_user_id = auth.uid()
        OR team_member_id IN (
            SELECT id FROM team_members
            WHERE church_id IN (
                SELECT church_id FROM team_members tm
                WHERE tm.user_id = auth.uid()
                  AND tm.role IN ('admin', 'leader')
                  AND tm.church_id IS NOT NULL
            )
        )
    );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_team_member_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_member_notes_updated_at
    BEFORE UPDATE ON team_member_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_team_member_notes_updated_at();