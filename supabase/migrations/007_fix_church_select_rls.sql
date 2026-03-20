-- Fix RLS policy for church SELECT during invite flow
-- The issue: invite links need to look up church info, but RLS blocks non-members
-- Solution: Allow anyone to view churches (church names/IDs are not sensitive)

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view own church" ON churches;

-- Create a permissive policy for SELECT - anyone can view any church
-- This is safe because church names are public info; sensitive data is in other tables
CREATE POLICY "Churches are publicly viewable"
  ON churches FOR SELECT
  TO anon, authenticated
  USING (true);