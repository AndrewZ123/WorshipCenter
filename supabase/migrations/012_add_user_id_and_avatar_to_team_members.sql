-- Add user_id and avatar_url columns to team_members table
-- This allows linking team members to users and syncing profile pictures

-- Add user_id column (nullable for existing team members without accounts)
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add avatar_url column
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- Add comment to explain the user_id field
COMMENT ON COLUMN team_members.user_id IS 'Optional link to auth.users - if set, this team member is also a user and can login';
COMMENT ON COLUMN team_members.avatar_url IS 'Profile picture URL - synced from users table when user_id is set';