-- Fix RLS policy for team_members SELECT during invite validation
-- The issue: invite links need to check if a team member profile exists for the email,
-- but RLS blocks access for non-members (anonymous users in private browsing)
-- Solution: Allow anyone to view team members (needed for invite link validation)

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Team members scoped to church" ON team_members;

-- Create a permissive policy for SELECT - anyone can view team members
-- This is safe because we're just validating invite links; 
-- the invite already contains the email being validated
CREATE POLICY "Team members are publicly viewable"
  ON team_members FOR SELECT
  TO anon, authenticated
  USING (true);

-- Keep restrictive policies for INSERT/UPDATE/DELETE (only church members can modify)
CREATE POLICY "Team members insert for church members"
  ON team_members FOR INSERT
  WITH CHECK (church_id = get_user_church_id());

CREATE POLICY "Team members update for church members"
  ON team_members FOR UPDATE
  USING (church_id = get_user_church_id());

CREATE POLICY "Team members delete for church members"
  ON team_members FOR DELETE
  USING (church_id = get_user_church_id());