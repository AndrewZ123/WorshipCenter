-- 060_assignment_response_tokens.sql
--
-- Tokenized accept/decline links for volunteers, plus an idempotency ledger
-- for the 3-day / 1-day unconfirmed reminders.
--
-- Both tables are touched ONLY by the server-side service-role client through
-- /api/assignments/respond and the reminder job. They deliberately have no
-- anon/authenticated policies: RLS is enabled and every client role is denied.

CREATE TABLE IF NOT EXISTS assignment_response_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES service_assignments(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_action TEXT CHECK (used_action IN ('confirmed', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_response_tokens_assignment
  ON assignment_response_tokens(assignment_id);

-- Service-role only. No anon/authenticated policies are created on purpose;
-- enabling RLS without policies denies every client-role read/write.
ALTER TABLE assignment_response_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE assignment_response_tokens IS
  'Single-use accept/decline links emailed to volunteers. Only the SHA-256 hash of the raw token is stored. Service-role access only (RLS enabled, no client policies).';
COMMENT ON COLUMN assignment_response_tokens.token_hash IS
  'SHA-256 hex digest of the raw token. The raw token is never persisted.';

-- Idempotency ledger for unconfirmed-reminder emails. One row per
-- (assignment, kind) prevents duplicate 3-day / 1-day reminders.
CREATE TABLE IF NOT EXISTS assignment_reminders_sent (
  assignment_id UUID NOT NULL REFERENCES service_assignments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('3d', '1d')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (assignment_id, kind)
);

-- Service-role only. No client policies by design.
ALTER TABLE assignment_reminders_sent ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE assignment_reminders_sent IS
  'Idempotency ledger for 3-day and 1-day unconfirmed assignment reminders. Service-role access only (RLS enabled, no client policies).';

-- Add service_assignments to the Realtime publication so leaders see
-- confirm/decline updates without reloading. Guarded so the migration is a
-- no-op when the table is already published or the publication does not exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'service_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_assignments;
  END IF;
END
$$;
