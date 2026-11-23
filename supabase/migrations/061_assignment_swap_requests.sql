-- 061_assignment_swap_requests.sql
--
-- Volunteer swap requests. A volunteer can ask teammates to take over their
-- own assignment; a qualified teammate claims it, then a leader approves (or
-- the church's auto-approve setting resolves it immediately on claim).
--
-- All writes go through /api/swaps using the service-role client, so the
-- client roles only get church-scoped SELECT access. RLS is enabled with no
-- client INSERT/UPDATE/DELETE policies, which fails closed for every rule the
-- API enforces server-side.

CREATE TABLE IF NOT EXISTS assignment_swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES service_assignments(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  claimed_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'claimed', 'approved', 'declined', 'cancelled')),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- One live request per assignment. Resolved rows are excluded so the same
-- assignment can be offered again after a decline/cancel.
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignment_swap_requests_live_assignment
  ON assignment_swap_requests(assignment_id)
  WHERE status IN ('open', 'claimed');

CREATE INDEX IF NOT EXISTS idx_assignment_swap_requests_church
  ON assignment_swap_requests(church_id);
CREATE INDEX IF NOT EXISTS idx_assignment_swap_requests_assignment
  ON assignment_swap_requests(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_swap_requests_requested_by
  ON assignment_swap_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_assignment_swap_requests_claimed_by
  ON assignment_swap_requests(claimed_by);

ALTER TABLE assignment_swap_requests ENABLE ROW LEVEL SECURITY;

-- Church members can read their church's swap requests. No client write
-- policies: the API (service role) owns every state transition.
DROP POLICY IF EXISTS "Swap requests viewable by church members" ON assignment_swap_requests;
CREATE POLICY "Swap requests viewable by church members"
  ON assignment_swap_requests FOR SELECT
  USING (church_id = get_user_church_id());

-- ---------------------------------------------------------------------------
-- Per-church settings. Kept in its own table: reminder_settings is about
-- automated reminder timing, and there is no other church settings table.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS church_settings (
  church_id UUID PRIMARY KEY REFERENCES churches(id) ON DELETE CASCADE,
  auto_approve_swaps BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE church_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Church settings viewable by church members" ON church_settings;
CREATE POLICY "Church settings viewable by church members"
  ON church_settings FOR SELECT
  USING (church_id = get_user_church_id());

DROP POLICY IF EXISTS "Admins/leaders can update church settings" ON church_settings;
CREATE POLICY "Admins/leaders can update church settings"
  ON church_settings FOR UPDATE
  USING (
    church_id IN (
      SELECT church_id FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  )
  WITH CHECK (
    church_id IN (
      SELECT church_id FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_assignment_swap_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS assignment_swap_requests_updated_at ON assignment_swap_requests;
CREATE TRIGGER assignment_swap_requests_updated_at
  BEFORE UPDATE ON assignment_swap_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_swap_requests_updated_at();

CREATE OR REPLACE FUNCTION update_church_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS church_settings_updated_at ON church_settings;
CREATE TRIGGER church_settings_updated_at
  BEFORE UPDATE ON church_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_church_settings_updated_at();

-- ---------------------------------------------------------------------------
-- approve_assignment_swap: atomically move the assignment to the claimer and
-- resolve the request. The status/claimer guards make concurrent approvals
-- race to a single winner. Service-role only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_assignment_swap(
  p_swap_id uuid,
  p_church_id uuid,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swap assignment_swap_requests%ROWTYPE;
  v_assignment service_assignments%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_swap
  FROM assignment_swap_requests
  WHERE id = p_swap_id AND church_id = p_church_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'swap_not_found';
  END IF;

  IF v_swap.status <> 'claimed' OR v_swap.claimed_by IS NULL THEN
    RAISE EXCEPTION 'swap_not_claimed';
  END IF;

  SELECT * INTO v_assignment
  FROM service_assignments
  WHERE id = v_swap.assignment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment_not_found';
  END IF;

  IF v_assignment.team_member_id <> v_swap.requested_by THEN
    RAISE EXCEPTION 'assignment_changed';
  END IF;

  UPDATE service_assignments
  SET team_member_id = v_swap.claimed_by,
      status = 'confirmed'
  WHERE id = v_assignment.id
    AND team_member_id = v_swap.requested_by;

  UPDATE assignment_swap_requests
  SET status = 'approved',
      resolved_at = NOW(),
      resolved_by = p_actor_user_id,
      updated_at = NOW()
  WHERE id = v_swap.id
    AND status = 'claimed';

  RETURN jsonb_build_object(
    'swap_id', v_swap.id,
    'assignment_id', v_assignment.id,
    'requested_by', v_swap.requested_by,
    'claimed_by', v_swap.claimed_by
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_assignment_swap(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_assignment_swap(uuid, uuid, uuid)
  TO service_role;

COMMENT ON TABLE assignment_swap_requests IS
  'Volunteer requests to hand off a service assignment to a qualified teammate. Service-role writes only.';
COMMENT ON TABLE church_settings IS
  'Per-church configuration. auto_approve_swaps resolves a claimed swap immediately.';
COMMENT ON FUNCTION public.approve_assignment_swap(uuid, uuid, uuid) IS
  'Atomically moves a claimed swap assignment to the claimer and marks the request approved.';
