-- Service Debrief / Retrospective ("Post-game")
-- Adds actual_duration_seconds to service_items, creates service_debriefs table,
-- extends notification types, and configures RLS.

-- ============================================
-- 1. Add actual_duration_seconds to service_items
-- ============================================
ALTER TABLE service_items
  ADD COLUMN IF NOT EXISTS actual_duration_seconds INTEGER;

COMMENT ON COLUMN service_items.actual_duration_seconds
  IS 'Actual duration captured during Service Mode, used in debrief timing comparison';

CREATE INDEX IF NOT EXISTS idx_service_items_actual_duration
  ON service_items(actual_duration_seconds)
  WHERE actual_duration_seconds IS NOT NULL;

-- ============================================
-- 2. Create service_debriefs table
-- ============================================
CREATE TABLE IF NOT EXISTS service_debriefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  rating_engagement INTEGER NOT NULL CHECK (rating_engagement BETWEEN 1 AND 5),
  rating_flow INTEGER NOT NULL CHECK (rating_flow BETWEEN 1 AND 5),
  rating_tech INTEGER NOT NULL CHECK (rating_tech BETWEEN 1 AND 5),
  what_went_well TEXT NOT NULL DEFAULT '',
  what_broke TEXT NOT NULL DEFAULT '',
  what_to_change TEXT NOT NULL DEFAULT '',
  saw_god_working TEXT NOT NULL DEFAULT '',
  timing_data JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_id, user_id)
);

COMMENT ON TABLE service_debriefs
  IS 'Individual debrief entries per team member per service. Captures ratings, reflections, and timing comparisons.';
COMMENT ON COLUMN service_debriefs.rating_engagement
  IS '1-5 rating for how engaged the team/congregation felt during this service';
COMMENT ON COLUMN service_debriefs.rating_flow
  IS '1-5 rating for how smoothly the service ran';
COMMENT ON COLUMN service_debriefs.rating_tech
  IS '1-5 rating for technical execution (sound, media, staging)';
COMMENT ON COLUMN service_debriefs.timing_data
  IS 'JSON array of {item_id, title, planned_seconds, actual_seconds} for timing comparison';

-- ============================================
-- 3. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_service_debriefs_service
  ON service_debriefs(service_id);
CREATE INDEX IF NOT EXISTS idx_service_debriefs_church_user
  ON service_debriefs(church_id, user_id);
CREATE INDEX IF NOT EXISTS idx_service_debriefs_created
  ON service_debriefs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_debriefs_church_created
  ON service_debriefs(church_id, created_at DESC);

-- ============================================
-- 4. Row Level Security
-- ============================================
ALTER TABLE service_debriefs ENABLE ROW LEVEL SECURITY;

-- Users can view debriefs for their church
DROP POLICY IF EXISTS "Users can view debriefs for their church" ON service_debriefs;
CREATE POLICY "Users can view debriefs for their church"
  ON service_debriefs FOR SELECT
  USING (church_id = get_user_church_id());

-- Users can insert their own debrief entries
DROP POLICY IF EXISTS "Users can insert their own debriefs" ON service_debriefs;
CREATE POLICY "Users can insert their own debriefs"
  ON service_debriefs FOR INSERT
  TO authenticated
  WITH CHECK (
    church_id = get_user_church_id()
    AND user_id = auth.uid()
  );

-- Users can update their own debrief entries
DROP POLICY IF EXISTS "Users can update their own debriefs" ON service_debriefs;
CREATE POLICY "Users can update their own debriefs"
  ON service_debriefs FOR UPDATE
  USING (
    church_id = get_user_church_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    church_id = get_user_church_id()
    AND user_id = auth.uid()
  );

-- Admins and leaders can delete any debrief
DROP POLICY IF EXISTS "Admins and leaders can delete debriefs" ON service_debriefs;
CREATE POLICY "Admins and leaders can delete debriefs"
  ON service_debriefs FOR DELETE
  USING (
    church_id = get_user_church_id()
    AND is_admin_or_leader()
  );

-- ============================================
-- 5. Extend notification type constraint
-- ============================================
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'invitation',
    'status_change',
    'service_reminder',
    'general',
    'assignment_created',
    'assignment_reminder',
    'assignment_changed',
    'assignment_declined',
    'initial_reminder',
    'pre_rehearsal_reminder',
    'pre_service_reminder',
    'escalation',
    'debrief_request'
  ));

COMMENT ON COLUMN notifications.type IS 'Notification type — debrief_request added for post-service debrief prompts';
