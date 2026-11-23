-- 054_create_member_notes.sql
-- 023, with RLS policies patched to use public.users.role
-- (the same pattern as 050/053). The original 023 policies referenced
-- team_members.role, which does not exist and would fail to apply.

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

ALTER TABLE team_member_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins/leaders can view notes on their church's members" ON team_member_notes;
CREATE POLICY "Admins/leaders can view notes on their church's members"
    ON team_member_notes FOR SELECT
    USING (
        team_member_id IN (
            SELECT id FROM team_members
            WHERE church_id IN (
                SELECT church_id FROM public.users
                WHERE id = auth.uid() AND role IN ('admin', 'leader')
            )
        )
    );

DROP POLICY IF EXISTS "Admins/leaders can create notes on their church's members" ON team_member_notes;
CREATE POLICY "Admins/leaders can create notes on their church's members"
    ON team_member_notes FOR INSERT
    WITH CHECK (
        team_member_id IN (
            SELECT id FROM team_members
            WHERE church_id IN (
                SELECT church_id FROM public.users
                WHERE id = auth.uid() AND role IN ('admin', 'leader')
            )
        )
    );

DROP POLICY IF EXISTS "Authors and admins can update notes" ON team_member_notes;
CREATE POLICY "Authors and admins can update notes"
    ON team_member_notes FOR UPDATE
    USING (
        author_user_id = auth.uid()
        OR team_member_id IN (
            SELECT id FROM team_members
            WHERE church_id IN (
                SELECT church_id FROM public.users
                WHERE id = auth.uid() AND role IN ('admin', 'leader')
            )
        )
    );

DROP POLICY IF EXISTS "Admins/leaders can delete notes" ON team_member_notes;
CREATE POLICY "Admins/leaders can delete notes"
    ON team_member_notes FOR DELETE
    USING (
        author_user_id = auth.uid()
        OR team_member_id IN (
            SELECT id FROM team_members
            WHERE church_id IN (
                SELECT church_id FROM public.users
                WHERE id = auth.uid() AND role IN ('admin', 'leader')
            )
        )
    );

CREATE OR REPLACE FUNCTION update_team_member_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS team_member_notes_updated_at ON team_member_notes;
CREATE TRIGGER team_member_notes_updated_at
    BEFORE UPDATE ON team_member_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_team_member_notes_updated_at();
