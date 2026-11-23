-- 051_security_hardening.sql
--
-- Lock down exposed SECURITY DEFINER RPCs, fix mutable search_path on
-- SECURITY DEFINER functions, make tasks_with_dependencies SECURITY INVOKER,
-- and replace the open churches / team_members policies.
--
-- App call sites checked 2026-11-23:
--   * delete_user_account is unused. Account deletion goes through
--     POST /api/auth/delete-account using the service-role client.
--   * backfill_worship_leaders is unused in app code.
--   * signup_church is unused. Signup goes through POST /api/auth/signup
--     using the service-role client. The RPC is kept for authenticated
--     callers only, and requires auth.uid() = p_auth_user_id.
--   * Share pages and signup already use the service-role client, so
--     tightening churches / team_members RLS does not break them.
--   * /join previously read churches and team_members as the anon role.
--     The app now validates invites and completes join through
--     /api/auth/validate-invite and /api/auth/complete-join (service role).
--   * Notification routes that used the anon db helper for church/member
--     reads were switched to the service-role client.

-- ---------------------------------------------------------------------------
-- 1. delete_user_account: qualify tables so search_path = '' is valid,
--    then revoke EXECUTE from PUBLIC / anon / authenticated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user_account(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.service_chat_messages WHERE user_id = delete_user_account.user_id;
  DELETE FROM public.service_debriefs WHERE user_id = delete_user_account.user_id;
  DELETE FROM public.notifications WHERE user_id = delete_user_account.user_id;
  DELETE FROM public.team_members WHERE user_id = delete_user_account.user_id;
  DELETE FROM public.users WHERE id = delete_user_account.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. backfill_worship_leaders: service_role only, with an explicit check.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backfill_worship_leaders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO team_members (id, church_id, name, email, user_id, avatar_url, roles, phone, created_at)
  SELECT
    gen_random_uuid(),
    u.church_id,
    u.name,
    u.email,
    u.id,
    u.avatar_url,
    ARRAY['Worship Leader']::TEXT[],
    ''::TEXT,
    u.created_at
  FROM users u
  WHERE u.role = 'admin'
    AND NOT EXISTS (
      SELECT 1 FROM team_members tm WHERE tm.user_id = u.id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'leaders_added', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_worship_leaders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_worship_leaders() TO service_role;

-- ---------------------------------------------------------------------------
-- 3. signup_church: require auth.uid() = p_auth_user_id; drop anon/PUBLIC.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.signup_church(
  p_church_name text,
  p_user_name text,
  p_user_email text,
  p_auth_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_auth_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO churches (id, name)
  VALUES (gen_random_uuid(), p_church_name)
  RETURNING id INTO v_church_id;

  INSERT INTO subscriptions (
    id, church_id, stripe_customer_id, stripe_subscription_id,
    status, trial_start, trial_end, current_period_start, current_period_end,
    cancel_at_period_end, price_type, canceled_at, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(), v_church_id, NULL, NULL, 'trialing',
    NOW(), NOW() + INTERVAL '14 days',
    NULL, NULL, false, NULL, NULL, NOW(), NOW()
  )
  ON CONFLICT (church_id) DO NOTHING;

  INSERT INTO users (id, church_id, name, email, role)
  VALUES (p_auth_user_id, v_church_id, p_user_name, p_user_email, 'admin');

  INSERT INTO team_members (id, church_id, name, email, phone, roles, user_id, avatar_url, created_at)
  VALUES (
    gen_random_uuid(), v_church_id, p_user_name, p_user_email, '',
    ARRAY['Worship Leader'], p_auth_user_id, NULL, NOW()
  );

  RETURN json_build_object('success', true, 'church_id', v_church_id, 'error', NULL);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'church_id', NULL, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.signup_church(text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signup_church(text, text, text, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Fix search_path on remaining SECURITY DEFINER functions.
--    Trigger functions keep EXECUTE for authenticated so inserts still fire.
--    RPC helpers used by the app keep authenticated EXECUTE but gain
--    church-membership checks.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.auto_add_channel_creator() SET search_path = public;
ALTER FUNCTION public.create_church_subscription() SET search_path = public;
ALTER FUNCTION public.log_task_completion() SET search_path = public;
ALTER FUNCTION public.get_user_church_id() SET search_path = public;
ALTER FUNCTION public.is_admin_or_leader() SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_complete_task(task_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  incomplete_deps INTEGER;
  task_church UUID;
  user_church UUID;
BEGIN
  SELECT church_id INTO user_church FROM public.users WHERE id = auth.uid();
  SELECT church_id INTO task_church FROM public.service_tasks WHERE id = task_uuid;
  IF user_church IS NULL OR task_church IS NULL OR task_church IS DISTINCT FROM user_church THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO incomplete_deps
  FROM task_dependencies td
  JOIN service_tasks st ON td.depends_on_task_id = st.id
  WHERE td.task_id = task_uuid
    AND st.status != 'done';
  RETURN incomplete_deps = 0;
END;
$$;

REVOKE ALL ON FUNCTION public.can_complete_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_complete_task(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_task_dependencies(task_uuid uuid)
RETURNS TABLE(
  task_id uuid,
  depends_on_id uuid,
  dependency_type text,
  lag_minutes integer,
  depends_on_title text,
  depends_on_status text,
  depends_on_assigned_to text,
  is_blocking boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_church UUID;
  user_church UUID;
BEGIN
  SELECT church_id INTO user_church FROM public.users WHERE id = auth.uid();
  SELECT church_id INTO task_church FROM public.service_tasks WHERE id = task_uuid;
  IF user_church IS NULL OR task_church IS NULL OR task_church IS DISTINCT FROM user_church THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    td.task_id,
    td.depends_on_task_id,
    td.dependency_type,
    td.lag_minutes,
    st.title,
    st.status,
    tm.name,
    td.task_id IN (
      SELECT td2.task_id
      FROM task_dependencies td2
      WHERE td2.depends_on_task_id = td.task_id
    ) OR st.is_blocking
  FROM task_dependencies td
  JOIN service_tasks st ON td.depends_on_task_id = st.id
  LEFT JOIN team_members tm ON st.assigned_team_member_id = tm.id
  WHERE td.task_id = task_uuid
  ORDER BY st.is_blocking DESC, st.priority DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_task_dependencies(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_task_dependencies(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_task_from_template(
  template_item_uuid uuid,
  service_uuid uuid,
  assigned_member_uuid uuid DEFAULT NULL,
  assigned_role_param text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_task_id UUID;
  v_church_id UUID;
  v_template_id UUID;
  v_title TEXT;
  v_default_notes TEXT;
  v_position INT;
  v_priority TEXT;
  v_estimated_duration_minutes INTEGER;
  user_church UUID;
BEGIN
  SELECT church_id INTO user_church FROM public.users WHERE id = auth.uid();

  SELECT tt.church_id, tti.template_id, tti.title,
         COALESCE(tti.default_notes, ''), tti.position,
         COALESCE(tti.priority, 'medium'), COALESCE(tti.estimated_duration_minutes, 0)
  INTO v_church_id, v_template_id, v_title,
       v_default_notes, v_position,
       v_priority, v_estimated_duration_minutes
  FROM task_template_items tti
  JOIN task_templates tt ON tti.template_id = tt.id
  WHERE tti.id = template_item_uuid;

  IF user_church IS NULL OR v_church_id IS NULL OR v_church_id IS DISTINCT FROM user_church THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO service_tasks (
    service_id, church_id, template_id, title, notes,
    assigned_team_member_id, assigned_role, position, status,
    priority, estimated_duration_minutes
  )
  VALUES (
    service_uuid, v_church_id, v_template_id,
    v_title, v_default_notes,
    assigned_member_uuid, assigned_role_param, v_position, 'pending',
    v_priority, v_estimated_duration_minutes
  )
  RETURNING id INTO new_task_id;

  RETURN new_task_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_task_from_template(uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_task_from_template(uuid, uuid, uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. View must use the caller's RLS, not the view owner's.
-- ---------------------------------------------------------------------------
ALTER VIEW public.tasks_with_dependencies SET (security_invoker = true);

-- ---------------------------------------------------------------------------
-- 6. team_members: drop USING (true) public read; keep church-scoped access.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Team members are publicly viewable" ON public.team_members;

DROP POLICY IF EXISTS "Team members viewable by church members" ON public.team_members;
CREATE POLICY "Team members viewable by church members"
  ON public.team_members
  FOR SELECT
  USING (church_id = get_user_church_id());

-- ---------------------------------------------------------------------------
-- 7. churches: drop public read and open insert. Members can view their
--    own church. Signup / share / invite go through service role.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Churches are publicly viewable" ON public.churches;
DROP POLICY IF EXISTS "Allow church creation during signup" ON public.churches;
DROP POLICY IF EXISTS "Authenticated users can create a church" ON public.churches;

DROP POLICY IF EXISTS "Users can view their own church" ON public.churches;
CREATE POLICY "Users can view their own church"
  ON public.churches
  FOR SELECT
  USING (id = get_user_church_id());
