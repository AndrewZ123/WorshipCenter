-- Service Live Sessions table
-- Tracks the active live state of a service for real-time sync between
-- the controller device (desktop/iPad running ServiceMode) and viewer
-- devices (phones showing the companion view).
-- Rows are cleaned up when the controller ends the session.

CREATE TABLE IF NOT EXISTS service_live_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  church_id       UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  current_item_id UUID REFERENCES service_items(id) ON DELETE SET NULL,
  current_index   INTEGER NOT NULL DEFAULT 0,
  elapsed_ms      BIGINT NOT NULL DEFAULT 0,
  is_paused       BOOLEAN NOT NULL DEFAULT TRUE,
  is_live         BOOLEAN NOT NULL DEFAULT FALSE,
  controlled_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_live_sessions_service  ON service_live_sessions(service_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_church   ON service_live_sessions(church_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_live     ON service_live_sessions(is_live) WHERE is_live = TRUE;

-- Row Level Security
ALTER TABLE service_live_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read sessions for their church
CREATE POLICY "Users can view live sessions for their church"
  ON service_live_sessions FOR SELECT
  USING (church_id IN (
    SELECT church_id FROM users WHERE id = auth.uid()
  ));

-- Users can insert sessions for their church
CREATE POLICY "Users can start live sessions for their church"
  ON service_live_sessions FOR INSERT
  WITH CHECK (
    church_id IN (SELECT church_id FROM users WHERE id = auth.uid())
    AND controlled_by = auth.uid()
  );

-- Users can update sessions in their church
CREATE POLICY "Users can update live sessions for their church"
  ON service_live_sessions FOR UPDATE
  USING (church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
  WITH CHECK (church_id IN (SELECT church_id FROM users WHERE id = auth.uid()));

-- Users can delete sessions in their church
CREATE POLICY "Users can delete live sessions for their church"
  ON service_live_sessions FOR DELETE
  USING (church_id IN (SELECT church_id FROM users WHERE id = auth.uid()));

-- Enable Realtime for postgres_changes subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE service_live_sessions;
