-- 059_add_foreign_key_indexes.sql
--
-- NOT APPLIED. Andrew must apply this migration manually after review.
--
-- Most foreign keys in the schema were created without a supporting index.
-- Postgres does not index FK columns automatically, so deletes/updates on the
-- parent row and RLS subqueries that join on these columns can fall back to a
-- sequential scan. The slowest live paths were Create Group / group delete,
-- #General chat (members + messages), and church-scoped reads.
--
-- The migration is intentionally additive and uses IF NOT EXISTS so it is
-- safe to run against the live project without touching data or RLS.
-- Do not run this through the Supabase API/CLI from the coding agent.

-- Services / plan / assignments ------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_service_items_song_id
  ON service_items(song_id);

-- Supports getByTeamMember and team-member deletion/CASCADE checks.
CREATE INDEX IF NOT EXISTS idx_service_assignments_team_member_service
  ON service_assignments(team_member_id, service_id);

CREATE INDEX IF NOT EXISTS idx_song_usage_service_id
  ON song_usage(service_id);

CREATE INDEX IF NOT EXISTS idx_song_usage_song_id
  ON song_usage(song_id);

CREATE INDEX IF NOT EXISTS idx_notifications_service_id
  ON notifications(service_id);

-- Tasks -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_service_tasks_template_id
  ON service_tasks(template_id);

CREATE INDEX IF NOT EXISTS idx_service_tasks_completed_by
  ON service_tasks(completed_by);

CREATE INDEX IF NOT EXISTS idx_task_completion_log_completed_by
  ON task_completion_log(completed_by);

-- Songs / files / history -----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_song_files_arrangement_id
  ON song_files(arrangement_id);

CREATE INDEX IF NOT EXISTS idx_song_files_version_id
  ON song_files(version_id);

CREATE INDEX IF NOT EXISTS idx_song_files_uploaded_by
  ON song_files(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_song_versions_created_by
  ON song_versions(created_by);

CREATE INDEX IF NOT EXISTS idx_song_arrangements_created_by
  ON song_arrangements(created_by);

CREATE INDEX IF NOT EXISTS idx_song_history_changed_by
  ON song_history(changed_by);

CREATE INDEX IF NOT EXISTS idx_rehearsal_logs_song_id
  ON rehearsal_logs(song_id);

-- Chat ------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id
  ON chat_messages(user_id);

-- Messages are always fetched per channel, newest first.
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_created
  ON chat_messages(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_channels_created_by
  ON chat_channels(created_by);

CREATE INDEX IF NOT EXISTS idx_chat_polls_user_id
  ON chat_polls(user_id);

-- chat_poll_votes PK starts with poll_id; this covers the user side.
CREATE INDEX IF NOT EXISTS idx_chat_poll_votes_user_id
  ON chat_poll_votes(user_id);

-- chat_reactions PK starts with message_id; this covers the user side.
CREATE INDEX IF NOT EXISTS idx_chat_reactions_user_id
  ON chat_reactions(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_reports_reported_by
  ON chat_reports(reported_by);

CREATE INDEX IF NOT EXISTS idx_chat_reports_resolved_by
  ON chat_reports(resolved_by);

CREATE INDEX IF NOT EXISTS idx_service_chat_reports_message_id
  ON service_chat_reports(message_id);

CREATE INDEX IF NOT EXISTS idx_service_chat_reports_reported_by
  ON service_chat_reports(reported_by);

CREATE INDEX IF NOT EXISTS idx_service_chat_reports_resolved_by
  ON service_chat_reports(resolved_by);

-- Live service sessions -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_live_sessions_current_item_id
  ON service_live_sessions(current_item_id);

CREATE INDEX IF NOT EXISTS idx_live_sessions_controlled_by
  ON service_live_sessions(controlled_by);

-- Church-scoped admin lookups -------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_admin_permissions_church_id
  ON admin_permissions(church_id);
