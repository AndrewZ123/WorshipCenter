-- Fix RLS policy for church creation during signup
-- The issue: after signUp, the user may not have a full session yet
-- Solution: Allow authenticated users to insert churches without additional checks

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Authenticated users can create a church" ON churches;

-- Create a more permissive policy for inserts
-- Any authenticated user can create a church (they'll be the admin)
CREATE POLICY "Authenticated users can create a church"
  ON churches FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also allow anon inserts during signup flow (Supabase creates auth user first)
-- This handles the edge case where signUp creates the user but session isn't fully established
CREATE POLICY "Allow church creation during signup"
  ON churches FOR INSERT
  TO anon
  WITH CHECK (true);