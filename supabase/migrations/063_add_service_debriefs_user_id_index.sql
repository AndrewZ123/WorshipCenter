-- 059 added indexes for most foreign keys but missed service_debriefs.user_id.
-- 036 has a composite (church_id, user_id) index, but queries that filter only
-- by user_id (e.g. "my debriefs") cannot use it. Add the dedicated index.
CREATE INDEX IF NOT EXISTS idx_service_debriefs_user_id
  ON service_debriefs(user_id);
