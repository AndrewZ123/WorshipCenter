-- Add missing price_type column to subscriptions table
-- This column is needed to track monthly vs yearly subscription types

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS price_type TEXT CHECK (price_type IN ('monthly', 'yearly'));
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

-- Update existing subscriptions to set a default price_type
-- This won't affect trialing subscriptions which have NULL price_type
UPDATE subscriptions SET price_type = NULL WHERE price_type IS NULL;

-- Update trigger functions to include price_type and canceled_at columns
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
    cancel_at_period_end, price_type, canceled_at, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NULL,
    NULL,
    'trialing',
    NOW(),
    NOW() + INTERVAL '14 days',
    NULL,
    NULL,
    false,
    NULL,
    NULL,
    NOW(),
    NOW()
  )
  ON CONFLICT (church_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION create_subscription_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.church_id IS NOT NULL THEN
    INSERT INTO subscriptions (
      id, church_id, stripe_customer_id, stripe_subscription_id,
      status, trial_start, trial_end,
      current_period_start, current_period_end,
      cancel_at_period_end, price_type, canceled_at, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      NEW.church_id,
      NULL,
      NULL,
      'trialing',
      NOW(),
      NOW() + INTERVAL '14 days',
      NULL,
      NULL,
      false,
      NULL,
      NULL,
      NOW(),
      NOW()
    )
    ON CONFLICT (church_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update signup_church function to include price_type and canceled_at
DROP FUNCTION IF EXISTS signup_church(TEXT, TEXT, TEXT, UUID);

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
  INSERT INTO churches (id, name)
  VALUES (gen_random_uuid(), p_church_name)
  RETURNING id INTO v_church_id;
  
  INSERT INTO subscriptions (
    id, church_id, stripe_customer_id, stripe_subscription_id,
    status, trial_start, trial_end,
    current_period_start, current_period_end,
    cancel_at_period_end, price_type, canceled_at, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_church_id,
    NULL,
    NULL,
    'trialing',
    NOW(),
    NOW() + INTERVAL '14 days',
    NULL,
    NULL,
    false,
    NULL,
    NULL,
    NOW(),
    NOW()
  )
  ON CONFLICT (church_id) DO NOTHING;
  
  INSERT INTO users (id, church_id, name, email, role)
  VALUES (p_auth_user_id, v_church_id, p_user_name, p_user_email, 'admin');
  
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

GRANT EXECUTE ON FUNCTION signup_church TO authenticated;