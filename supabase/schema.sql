-- WorshipCenter Database Schema
-- Designed for Supabase (Postgres) with Row Level Security

-- ==========================================
-- TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'leader', 'team')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'completed')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT DEFAULT '',
  default_key TEXT DEFAULT 'C',
  ccli_number TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  youtube_video_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('song', 'segment')),
  position INTEGER NOT NULL DEFAULT 0,
  title TEXT DEFAULT '',
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  duration_minutes INTEGER,
  key TEXT
);

CREATE TABLE IF NOT EXISTS song_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'chord_chart' CHECK (type IN ('chord_chart')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  roles TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  UNIQUE(service_id, team_member_id, role)
);

CREATE TABLE IF NOT EXISTS song_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('invitation', 'status_change', 'service_reminder', 'general')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  time TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  roles TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'leader', 'team')),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_users_church ON users(church_id);
CREATE INDEX IF NOT EXISTS idx_services_church_date ON services(church_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_songs_church ON songs(church_id);
CREATE INDEX IF NOT EXISTS idx_service_items_service ON service_items(service_id, position);
CREATE INDEX IF NOT EXISTS idx_song_files_song ON song_files(song_id);
CREATE INDEX IF NOT EXISTS idx_team_members_church ON team_members(church_id);
CREATE INDEX IF NOT EXISTS idx_service_assignments_service ON service_assignments(service_id);
CREATE INDEX IF NOT EXISTS idx_song_usage_church_date ON song_usage(church_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_service_templates_church ON service_templates(church_id);
CREATE INDEX IF NOT EXISTS idx_invites_church ON invites(church_id);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's church_id
-- SECURITY DEFINER allows this function to bypass RLS on users table, breaking recursion.
CREATE OR REPLACE FUNCTION get_user_church_id()
RETURNS UUID AS $$
  SELECT church_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function: check if current user is admin or leader
CREATE OR REPLACE FUNCTION is_admin_or_leader()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'leader')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Churches: users can only see their own church
DROP POLICY IF EXISTS "Users can view own church" ON churches;
CREATE POLICY "Users can view own church"
  ON churches FOR SELECT
  USING (id = get_user_church_id());

DROP POLICY IF EXISTS "Authenticated users can create a church" ON churches;
CREATE POLICY "Authenticated users can create a church"
  ON churches FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update their church" ON churches;
CREATE POLICY "Admins can update their church"
  ON churches FOR UPDATE
  USING (id = get_user_church_id() AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Users: users can view members of their church
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can view church members" ON users;
CREATE POLICY "Users can view church members"
  ON users FOR SELECT
  USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
CREATE POLICY "Users can insert their own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON users;
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- Services: scoped to church (SELECT for all, INSERT/UPDATE/DELETE for admin/leader only)
DROP POLICY IF EXISTS "Services scoped to church" ON services;
CREATE POLICY "Services scoped to church" ON services
  FOR SELECT USING (church_id = get_user_church_id());

CREATE POLICY "Services insert for admin/leader"
  ON services FOR INSERT
  WITH CHECK (church_id = get_user_church_id() AND is_admin_or_leader());

CREATE POLICY "Services update for admin/leader"
  ON services FOR UPDATE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

CREATE POLICY "Services delete for admin/leader"
  ON services FOR DELETE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

-- Songs: scoped to church (SELECT for all, INSERT/UPDATE/DELETE for admin/leader only)
DROP POLICY IF EXISTS "Songs scoped to church" ON songs;
CREATE POLICY "Songs scoped to church" ON songs
  FOR SELECT USING (church_id = get_user_church_id());

CREATE POLICY "Songs insert for admin/leader"
  ON songs FOR INSERT
  WITH CHECK (church_id = get_user_church_id() AND is_admin_or_leader());

CREATE POLICY "Songs update for admin/leader"
  ON songs FOR UPDATE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

CREATE POLICY "Songs delete for admin/leader"
  ON songs FOR DELETE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

-- Service Items: accessible if service belongs to user's church
DROP POLICY IF EXISTS "Service items via service church" ON service_items;
CREATE POLICY "Service items via service church" ON service_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM services WHERE services.id = service_items.service_id
        AND services.church_id = get_user_church_id()
    )
  );

-- Song Files: accessible if song belongs to user's church
DROP POLICY IF EXISTS "Song files via song church" ON song_files;
CREATE POLICY "Song files via song church" ON song_files
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM songs WHERE songs.id = song_files.song_id
        AND songs.church_id = get_user_church_id()
    )
  );

-- Team Members: scoped to church
DROP POLICY IF EXISTS "Team members scoped to church" ON team_members;
CREATE POLICY "Team members scoped to church" ON team_members
  FOR ALL USING (church_id = get_user_church_id());

-- Service Assignments: accessible if service belongs to user's church
DROP POLICY IF EXISTS "Assignments via service church" ON service_assignments;
CREATE POLICY "Assignments via service church" ON service_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM services WHERE services.id = service_assignments.service_id
        AND services.church_id = get_user_church_id()
    )
  );

-- Song Usage: scoped to church
DROP POLICY IF EXISTS "Song usage scoped to church" ON song_usage;
CREATE POLICY "Song usage scoped to church" ON song_usage
  FOR ALL USING (church_id = get_user_church_id());

-- Notifications: scoped to specific user
DROP POLICY IF EXISTS "Notifications scoped to user" ON notifications;
CREATE POLICY "Notifications scoped to user" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- Templates: scoped to church
DROP POLICY IF EXISTS "Templates scoped to church" ON service_templates;
CREATE POLICY "Templates scoped to church" ON service_templates
  FOR SELECT USING (church_id = get_user_church_id());

CREATE POLICY "Templates insert for admin/leader"
  ON service_templates FOR INSERT
  WITH CHECK (church_id = get_user_church_id() AND is_admin_or_leader());

CREATE POLICY "Templates update for admin/leader"
  ON service_templates FOR UPDATE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

CREATE POLICY "Templates delete for admin/leader"
  ON service_templates FOR DELETE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

-- Invites: admins/leaders can create and view invites for their church
CREATE POLICY "Admins and leaders can create invites"
  ON invites
  FOR INSERT
  WITH CHECK (
    church_id = get_user_church_id() AND
    is_admin_or_leader()
  );

CREATE POLICY "Admins and leaders can view invites"
  ON invites
  FOR SELECT
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

CREATE POLICY "Admins and leaders can mark invites as used"
  ON invites
  FOR UPDATE
  USING (
    church_id = get_user_church_id() AND
    is_admin_or_leader()
  );

-- Invites: any authenticated user can view invite via token (for join page)
DROP POLICY IF EXISTS "Invites can view own church" ON invites;
CREATE POLICY "Invites can view own church"
  ON invites
  FOR SELECT
  USING (
    church_id = get_user_church_id() AND
    token = token
  );
