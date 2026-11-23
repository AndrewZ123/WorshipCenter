-- 053_fix_member_groups_rls.sql
-- 050 as-is: church-scoped policies using public.users.role, not team_members.role.
-- Apply immediately after 052.

-- 050_fix_member_groups_rls_for_roles_array.sql
--
-- Migration 022's member_groups / member_group_members RLS policies reference
-- team_members.role, which does not exist (team_members only has roles TEXT[]).
-- Because the USING / WITH CHECK expressions can never evaluate true, admins
-- and leaders are blocked from creating or updating member groups.
--
-- This follows the migration 042 pattern: resolve church membership and the
-- admin/leader role from public.users instead of team_members.
--
-- ── member_groups ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their church's member groups" ON member_groups;
DROP POLICY IF EXISTS "Admins/leaders can manage their church's member groups" ON member_groups;

CREATE POLICY "Users can view their church's member groups"
  ON member_groups FOR SELECT
  USING (
    church_id IN (SELECT church_id FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "Admins/leaders can manage their church's member groups"
  ON member_groups FOR ALL
  USING (
    church_id IN (
      SELECT church_id FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  )
  WITH CHECK (
    church_id IN (
      SELECT church_id FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

-- ── member_group_members ───────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their church's group members" ON member_group_members;
DROP POLICY IF EXISTS "Admins/leaders can manage group memberships" ON member_group_members;

CREATE POLICY "Users can view their church's group members"
  ON member_group_members FOR SELECT
  USING (
    group_id IN (
      SELECT id FROM member_groups
      WHERE church_id IN (SELECT church_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins/leaders can manage group memberships"
  ON member_group_members FOR ALL
  USING (
    group_id IN (
      SELECT id FROM member_groups
      WHERE church_id IN (
        SELECT church_id FROM public.users
        WHERE id = auth.uid() AND role IN ('admin', 'leader')
      )
    )
  )
  WITH CHECK (
    group_id IN (
      SELECT id FROM member_groups
      WHERE church_id IN (
        SELECT church_id FROM public.users
        WHERE id = auth.uid() AND role IN ('admin', 'leader')
      )
    )
  );
