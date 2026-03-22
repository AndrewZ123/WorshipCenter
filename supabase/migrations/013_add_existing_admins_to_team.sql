-- Add existing worship leaders (admin users) to team_members table
-- This migration fixes the issue where worship leaders who created churches
-- don't appear in the team roster and can't assign themselves to services

-- Insert admin users into team_members table with a link to their user account
INSERT INTO team_members (id, church_id, name, email, phone, roles, user_id, avatar_url, created_at)
SELECT 
  gen_random_uuid() as id,
  u.church_id,
  u.name,
  u.email,
  '' as phone,
  ARRAY['Worship Leader'] as roles,
  u.id as user_id,
  u.avatar_url,
  u.created_at
FROM users u
WHERE 
  u.role = 'admin'
  AND NOT EXISTS (
    -- Only insert if they don't already have a team_member entry with this user_id
    SELECT 1 FROM team_members tm WHERE tm.user_id = u.id
  );

-- Update avatar_url for any team_members linked to users
UPDATE team_members tm
SET avatar_url = u.avatar_url
FROM users u
WHERE tm.user_id = u.id
  AND (tm.avatar_url IS NULL OR tm.avatar_url <> u.avatar_url);

-- Add comment
COMMENT ON TABLE team_members IS 'Team members including worship leaders and invited team members';