-- Fix: Resolve duplicate key error on subscriptions.church_id during signup
-- 
-- Problem: When creating a new church, triggers on the churches and/or 
-- users tables both try to create a subscription for the same church_id.
--
-- Solution: 
-- 1. Drop ALL existing triggers on churches/users that insert into subscriptions
-- 2. Replace with idempotent versions using ON CONFLICT (church_id) DO NOTHING
-- 3. Update signup_church() to not reference non-existent slug column

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
-- ============================================================

DO $$
DECLARE
  trig_name TEXT;
  trig_table TEXT;
BEGIN
  -- Drop all triggers on churches and users tables
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
-- Step 4: Update the signup_church function (fix slug column error)
--         churches table only has: id, name, created_at
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
  v_success BOOLEAN := false;
  v_error_message TEXT;
BEGIN
  -- Create the church (trigger will auto-create subscription with ON CONFLICT DO NOTHING)
  INSERT INTO churches (id, name)
  VALUES (gen_random_uuid(), p_church_name)
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
-- Step 5: Grant permissions
-- ============================================================

GRANT EXECUTE ON FUNCTION create_subscription_for_church TO authenticated;
GRANT EXECUTE ON FUNCTION create_subscription_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION signup_church TO authenticated;

COMMENT ON FUNCTION create_subscription_for_church IS 'Auto-creates a 14-day trial subscription when a new church is created. Uses ON CONFLICT to prevent duplicate key errors.';
COMMENT ON FUNCTION create_subscription_for_user IS 'Safety net: ensures a trial subscription exists for the users church. Uses ON CONFLICT to prevent duplicate key errors.';
COMMENT ON FUNCTION signup_church IS 'Creates a church, user profile, team member entry, and ensures subscription exists. No slug column - churches table only has id, name, created_at.';