# Worship Leader Team Member Fix

## Problem
The worship leader (the user who creates the church during signup) was not appearing in the team members list, which prevented them from being assigned to services.

## Solution
We've created a comprehensive fix that ensures:

1. **New worship leaders** are automatically added to the team roster during signup
2. **Existing worship leaders** are migrated to the team members table
3. **Profile changes** in settings sync to the team member profile
4. **Avatar updates** in settings sync to the team member profile

## Changes Made

### 1. Database Migrations

#### Migration 012: Add user_id and avatar_url to team_members
Adds `user_id` and `avatar_url` columns to the `team_members` table to link team members to user accounts and store avatar images.

#### Migration 013: Add existing worship leaders to team
Creates a migration script that adds all existing admin users (worship leaders) to the team_members table with proper user_id linkage.

#### Migration 014: Create signup_church function
Creates a database function that automatically creates a team member entry for the worship leader during the signup process. This ensures all new worship leaders are immediately visible in the team roster.

### 2. Settings Page Updates (src/app/(app)/settings/page.tsx)
Updated the settings page to sync profile changes to the team member profile:
- When name is updated, updates the team member's name
- When avatar URL is updated, updates the team member's avatar_url

## How to Apply the Migrations

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/aqxuovrlmkbxtpxaidtp
2. Navigate to **SQL Editor**
3. Apply each migration in order:

**Migration 012:**
```sql
-- Copy and paste the contents of supabase/migrations/012_add_user_id_and_avatar_to_team_members.sql
```

**Migration 013:**
```sql
-- Copy and paste the contents of supabase/migrations/013_add_existing_admins_to_team.sql
```

**Migration 014:**
```sql
-- Copy and paste the contents of supabase/migrations/014_create_signup_church_function.sql
```

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed with proper access:

```bash
# Apply migration 012
npx supabase db push supabase/migrations/012_add_user_id_and_avatar_to_team_members.sql

# Apply migration 013
npx supabase db push supabase/migrations/013_add_existing_admins_to_team.sql

# Apply migration 014
npx supabase db push supabase/migrations/014_create_signup_church_function.sql
```

### Option 3: Using psql (if you have database credentials)

```bash
# Replace DB_URL with your actual database connection string
psql $DATABASE_URL -f supabase/migrations/012_add_user_id_and_avatar_to_team_members.sql
psql $DATABASE_URL -f supabase/migrations/013_add_existing_admins_to_team.sql
psql $DATABASE_URL -f supabase/migrations/014_create_signup_church_function.sql
```

## Verification

After applying the migrations, verify the fix:

1. **For existing worship leaders**: They should now appear in the team members list
2. **For new signups**: The worship leader should automatically appear in the team list
3. **Profile sync test**:
   - Go to Settings
   - Change your name
   - Go to Team page and verify the name updated
   - Change your avatar in Settings
   - Go to Team page and verify the avatar updated

## Important Notes

- Migration 013 will add all existing admin users to the team members table. This is a one-time operation.
- The signup_church function ensures all future worship leaders are automatically added to the team.
- The settings page sync ensures that any profile changes are reflected in the team member profile.
- The user_id field in team_members allows for proper linking between user accounts and team member profiles.

## Testing

1. Sign up as a new worship leader
2. Verify you appear in the team members list immediately
3. Go to Settings and change your name
4. Verify the name changed in the team members list
5. Upload a new avatar in Settings
6. Verify the avatar appears in the team members list

## Files Modified

- `supabase/migrations/012_add_user_id_and_avatar_to_team_members.sql` (new)
- `supabase/migrations/013_add_existing_admins_to_team.sql` (new)
- `supabase/migrations/014_create_signup_church_function.sql` (new)
- `src/app/(app)/settings/page.tsx` (updated profile sync logic)