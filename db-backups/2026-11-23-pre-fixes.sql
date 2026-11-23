-- WorshipCenter production schema snapshot (rollback)
-- Taken 2026-11-23 before applying 051-058 on project aqxuovrlmkbxtpxaidtp.
-- No table row data. Contains function definitions, grants, policies, and
-- the tasks_with_dependencies view as they existed before the fixes.
--
-- To roll back 051 security changes, run sections 1-3.
-- To also undo 052-058 objects, run section 4.

BEGIN;

-- =============================================================================
-- 1. Churches and team_members policies (pre-051)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their own church" ON public.churches;
DROP POLICY IF EXISTS "Allow church creation during signup" ON public.churches;
DROP POLICY IF EXISTS "Authenticated users can create a church" ON public.churches;
DROP POLICY IF EXISTS "Churches are publicly viewable" ON public.churches;

CREATE POLICY "Allow church creation during signup"
  ON public.churches FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated users can create a church"
  ON public.churches FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Churches are publicly viewable"
  ON public.churches FOR SELECT TO anon, authenticated
  USING (true);

-- "Admins can update their church" was left unchanged by 051.

DROP POLICY IF EXISTS "Team members viewable by church members" ON public.team_members;
DROP POLICY IF EXISTS "Team members are publicly viewable" ON public.team_members;

CREATE POLICY "Team members are publicly viewable"
  ON public.team_members FOR SELECT TO anon, authenticated
  USING (true);

-- =============================================================================
-- 2. Function definitions and grants (pre-051)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_user_account(user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Delete in order of dependencies to avoid FK violations
  DELETE FROM service_chat_messages WHERE user_id = delete_user_account.user_id;
  DELETE FROM service_debriefs WHERE user_id = delete_user_account.user_id;
  DELETE FROM notifications WHERE user_id = delete_user_account.user_id;
  DELETE FROM team_members WHERE user_id = delete_user_account.user_id;
  DELETE FROM users WHERE id = delete_user_account.user_id;
  -- auth.users deletion must be done via the Supabase admin API (not raw SQL)
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO PUBLIC, postgres, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.backfill_worship_leaders()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
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

  RETURN jsonb_build_object(
    'success', true,
    'leaders_added', v_count
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.backfill_worship_leaders() TO PUBLIC, postgres, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.signup_church(p_church_name text, p_user_name text, p_user_email text, p_auth_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_church_id UUID;
  v_success BOOLEAN := false;
  v_error_message TEXT;
BEGIN
  INSERT INTO churches (id, name) VALUES (gen_random_uuid(), p_church_name) RETURNING id INTO v_church_id;

  INSERT INTO subscriptions (id, church_id, stripe_customer_id, stripe_subscription_id,
    status, trial_start, trial_end, current_period_start, current_period_end,
    cancel_at_period_end, price_type, canceled_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_church_id, NULL, NULL, 'trialing', NOW(), NOW() + INTERVAL '14 days',
    NULL, NULL, false, NULL, NULL, NOW(), NOW())
  ON CONFLICT (church_id) DO NOTHING;

  INSERT INTO users (id, church_id, name, email, role) VALUES (p_auth_user_id, v_church_id, p_user_name, p_user_email, 'admin');

  INSERT INTO team_members (id, church_id, name, email, phone, roles, user_id, avatar_url, created_at)
  VALUES (gen_random_uuid(), v_church_id, p_user_name, p_user_email, '', ARRAY['Worship Leader'], p_auth_user_id, NULL, NOW());

  v_success := true;
  RETURN json_build_object('success', v_success, 'church_id', v_church_id, 'error', NULL);

  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'church_id', NULL, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.signup_church(text, text, text, uuid) TO PUBLIC, postgres, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_complete_task(task_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  incomplete_deps INTEGER;
BEGIN
  SELECT COUNT(*) INTO incomplete_deps
  FROM task_dependencies td
  JOIN service_tasks st ON td.depends_on_task_id = st.id
  WHERE td.task_id = task_uuid
    AND st.status != 'done';
  RETURN incomplete_deps = 0;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.can_complete_task(uuid) TO PUBLIC, postgres, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_task_dependencies(task_uuid uuid)
 RETURNS TABLE(task_id uuid, depends_on_id uuid, dependency_type text, lag_minutes integer, depends_on_title text, depends_on_status text, depends_on_assigned_to text, is_blocking boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
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
$function$;

GRANT EXECUTE ON FUNCTION public.get_task_dependencies(uuid) TO PUBLIC, postgres, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_task_from_template(template_item_uuid uuid, service_uuid uuid, assigned_member_uuid uuid DEFAULT NULL::uuid, assigned_role_param text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  new_task_id UUID;
  v_church_id UUID;
  v_template_id UUID;
  v_title TEXT;
  v_default_notes TEXT;
  v_position INT;
  v_priority TEXT;
  v_estimated_duration_minutes INTEGER;
BEGIN
  SELECT tt.church_id, tti.template_id, tti.title,
         COALESCE(tti.default_notes, ''), tti.position,
         COALESCE(tti.priority, 'medium'), COALESCE(tti.estimated_duration_minutes, 0)
  INTO v_church_id, v_template_id, v_title,
       v_default_notes, v_position,
       v_priority, v_estimated_duration_minutes
  FROM task_template_items tti
  JOIN task_templates tt ON tti.template_id = tt.id
  WHERE tti.id = template_item_uuid;

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
$function$;

GRANT EXECUTE ON FUNCTION public.create_task_from_template(uuid, uuid, uuid, text) TO PUBLIC, postgres, anon, authenticated, service_role;

ALTER FUNCTION public.auto_add_channel_creator() RESET search_path;
ALTER FUNCTION public.create_church_subscription() RESET search_path;
ALTER FUNCTION public.log_task_completion() RESET search_path;
ALTER FUNCTION public.get_user_church_id() RESET search_path;
ALTER FUNCTION public.is_admin_or_leader() RESET search_path;

-- =============================================================================
-- 3. View (pre-051 had no security_invoker option, i.e. SECURITY DEFINER)
-- =============================================================================

ALTER VIEW public.tasks_with_dependencies SET (security_invoker = false);

-- =============================================================================
-- 4. Optional: drop objects added by 052-058 (run only to fully undo)
-- =============================================================================
-- DROP TRIGGER IF EXISTS on_assignment_status_updated ON public.service_assignments;
-- DROP FUNCTION IF EXISTS public.update_assignment_timestamps();
-- ALTER TABLE public.service_assignments DROP COLUMN IF EXISTS confirmed_at;
-- ALTER TABLE public.service_assignments DROP COLUMN IF EXISTS declined_at;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS phone;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS phone_verified;
-- ALTER TABLE public.service_chat_messages DROP COLUMN IF EXISTS read_at;
-- DROP TABLE IF EXISTS public.team_member_notes CASCADE;
-- DROP TABLE IF EXISTS public.member_group_members CASCADE;
-- DROP TABLE IF EXISTS public.member_groups CASCADE;
-- DROP TRIGGER IF EXISTS songs_search_vector_update ON public.songs;
-- ALTER TABLE public.songs DROP COLUMN IF EXISTS search_vector;
-- DROP TABLE IF EXISTS public.song_history CASCADE;
-- DROP TABLE IF EXISTS public.song_arrangements CASCADE;
-- DROP TABLE IF EXISTS public.song_versions CASCADE;
-- 057 also adds song_files columns; dropping those is not included here
-- because it may fail if later rows depend on them. Inspect before dropping.

COMMIT;
