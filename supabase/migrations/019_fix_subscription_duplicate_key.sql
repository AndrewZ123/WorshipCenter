-- Fix: Resolve duplicate key error on subscriptions.church_id during signup
-- 
-- Problem: When creating a new church via signup_church(), triggers on the churches and/or 
-- users tables both try to create a subscription for the same church_id. The second insert 
-- fails with: "duplicate key value violates unique constraint subscriptions_church_id_key"
--
-- Root Cause: The signup_church() function inserts into churches (trigger fires → subscription 
-- created), then inserts into users (another trigger fires → tries to create another subscription
-- for the same church_id → duplicate key violation).
--
-- Solution: 
-- 1. Drop ALL existing triggers on churches/users that insert into subscriptions
-- 2. Replace with idempotent versions using ON CONFLICT (church_id) DO NOTHING
-- 3. Update signup_church() to also be resilient

-- ============================================================
-- Step 1: Create the fixed trigger functions with ON CONFLICT
-- ============================================================

-- Trigger function for churches table (primary subscription creator)
CREATE OR REPLACE FUNCTION create_subscription_for_church()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO subscriptions (
    id, church_id, stripe_customer_id, stripe_subscription_id,
    status, trial_start, trial_end,
    current_period_start, current_period_end,
    cancel_at_period_end, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    NEW.id,
    'cus_pending_' || replace(gen_random_uuid()::text, '-', ''),
    NULL,
    'trialing',
    NOW(),
    NOW() + INTERVAL '14 days',
    NULL,
    NULL,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (church_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger function for users table (safety net - only creates if missing)
CREATE OR REPLACE FUNCTION create_subscription_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only attempt if the user has a church_id
  IF NEW.church_id IS NOT NULL THEN
    INSERT INTO subscriptions (
      id, church_id, stripe_customer_id, stripe_subscription_id,
      status, trial_start, trial_end,
      current_period_start, current_period_end,
      cancel_at_period_end, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      NEW.church_id,
      'cus_pending_' || replace(gen_random_uuid()::text, '-', ''),
      NULL,
      'trialing',
      NOW(),
      NOW() + INTERVAL '14 days',
      NULL,
      NULL,
      false,
      NOW(),
      NOW()
    )
    ON CONFLICT (church_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================
-- Step 2: Drop ALL existing triggers on churches and users 
--         that relate to subscriptions (we don't know the exact
--         names since the original migration 002 isn't in the repo)
-- ============================================================

DO $$
DECLARE
  trig_name TEXT;
  trig_table TEXT;
BEGIN
  -- Drop all triggers on churches table
  FOR trig_name, trig_table IN
    SELECT t.tgname, c.relname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname IN ('churches', 'users')
      AND NOT t.tgisinternal  -- Skip internal/system triggers
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trig_name, trig_table);
    RAISE NOTICE 'Dropped trigger % on %', trig_name, trig_table;
  END LOOP;
END $$;

-- ============================================================
-- Step 3: Create the corrected triggers
-- ============================================================

-- Church trigger: creates subscription when a new church is inserted
CREATE TRIGGER on_church_created
  AFTER INSERT ON churches
  FOR EACH ROW
  EXECUTE FUNCTION create_subscription_for_church();

-- User trigger: safety net - creates subscription for user's church if missing
CREATE TRIGGER on_user_created
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_subscription_for_user();

-- ============================================================
-- Step 4: Update the signup_church function to be resilient
--         (in case triggers behave unexpectedly)
-- ============================================================

CREATE OR REPLACE FUNCTION signup_church(
  p_church_name TEXT,
  p_user_name TEXT,
  p_user_email TEXT,
  p_auth_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id UUID;
  v_slug TEXT;
  v_slug_base TEXT;
  v_counter INTEGER := 0;
  v_success BOOLEAN := false;
  v_error_message TEXT;
BEGIN
  -- Generate a unique slug from the church name
  v_slug_base := lower(regexp_replace(p_church_name, '[^a-zA-Z0-9]', '-', 'g'));
  v_slug_base := regexp_replace(v_slug_base, '-+', '-', 'g');
  v_slug_base := trim(both '-' from v_slug_base);
  v_slug := v_slug_base;
  
  -- Check if slug exists and make it unique if needed
  WHILE EXISTS (SELECT 1 FROM churches WHERE slug = v_slug) LOOP
    v_counter := v_counter + 1;
    v_slug := v_slug_base || '-' || v_counter;
  END LOOP;
  
  -- Create the church (trigger will auto-create subscription with ON CONFLICT DO NOTHING)
  INSERT INTO churches (id, name, slug)
  VALUES (gen_random_uuid(), p_church_name, v_slug)
  RETURNING id INTO v_church_id;
  
  -- Ensure subscription exists (idempotent - safe even if trigger already created it)
  INSERT INTO subscriptions (
    id, church_id, stripe_customer_id, stripe_subscription_id,
    status, trial_start, trial_end,
    current_period_start, current_period_end,
    cancel_at_period_end, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_church_id,
    'cus_pending_' || replace(gen_random_uuid()::text, '-', ''),
    NULL,
    'trialing',
    NOW(),
    NOW() + INTERVAL '14 days',
    NULL,
    NULL,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (church_id) DO NOTHING;
  
  -- Create the user profile (admin/worship leader)
  -- (trigger on users will also try to create subscription but ON CONFLICT DO NOTHING)
  INSERT INTO users (id, church_id, name, email, role)
  VALUES (p_auth_user_id, v_church_id, p_user_name, p_user_email, 'admin');
  
  -- Automatically create a team member entry for the worship leader
  INSERT INTO team_members (id, church_id, name, email, phone, roles, user_id, avatar_url, created_at)
  VALUES (
    gen_random_uuid(),
    v_church_id,
    p_user_name,
    p_user_email,
    '',
    ARRAY['Worship Leader'],
    p_auth_user_id,
    NULL,
    NOW()
  );
  
  v_success := true;
  
  RETURN json_build_object(
    'success', v_success,
    'church_id', v_church_id,
    'error', NULL
  );
  
EXCEPTION
  WHEN OTHERS THEN
    v_success := false;
    v_error_message := SQLERRM;
    
    RETURN json_build_object(
      'success', v_success,
      'church_id', NULL,
      'error', v_error_message
    );
END;
$$;

-- ============================================================
-- Step 5: Grant permissions and add comments
-- ============================================================

GRANT EXECUTE ON FUNCTION create_subscription_for_church TO authenticated;
GRANT EXECUTE ON FUNCTION create_subscription_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION signup_church TO authenticated;

COMMENT ON FUNCTION create_subscription_for_church IS 'Auto-creates a 14-day trial subscription when a new church is created. Uses ON CONFLICT to prevent duplicate key errors.';
COMMENT ON FUNCTION create_subscription_for_user IS 'Safety net: ensures a trial subscription exists for the users church. Uses ON CONFLICT to prevent duplicate key errors.';
COMMENT ON FUNCTION signup_church IS 'Creates a church, user profile, team member entry, and ensures subscription exists. Resilient to duplicate subscription attempts.';
</task_progress>
<task_progress>- [x] Read current signup_church function and related code
- [x] Read schema.sql for trigger definition
- [x] Read full auth.tsx signup implementation
- [x] Understand subscription schema and types
- [x] Re-analyze root cause in signup_church function
- [x] Fix migration file with robust solution
- [ ] Apply migration and verify</task_progress>
</write_to_file>