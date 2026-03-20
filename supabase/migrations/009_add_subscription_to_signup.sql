-- Update signup function to also create a subscription record with trial
-- This ensures every new church gets a trial subscription automatically

CREATE OR REPLACE FUNCTION public.signup_church(
  p_church_name TEXT,
  p_user_name TEXT,
  p_user_email TEXT,
  p_auth_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_church_id UUID;
  v_trial_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Create the church
  INSERT INTO public.churches (name)
  VALUES (p_church_name)
  RETURNING id INTO v_church_id;
  
  -- Create the user profile
  INSERT INTO public.users (id, church_id, name, email, role)
  VALUES (p_auth_user_id, v_church_id, p_user_name, p_user_email, 'admin');
  
  -- Calculate trial end date (14 days from now)
  v_trial_end := NOW() + INTERVAL '14 days';
  
  -- Create a trial subscription
  INSERT INTO public.subscriptions (
    church_id,
    stripe_customer_id,
    stripe_subscription_id,
    status,
    trial_start,
    trial_end,
    current_period_start,
    current_period_end
  )
  VALUES (
    v_church_id,
    'cus_pending_' || v_church_id::TEXT, -- Placeholder, will be updated on first payment
    NULL,
    'trialing',
    NOW(),
    v_trial_end,
    NOW(),
    v_trial_end
  );
  
  -- Return the new church ID
  RETURN jsonb_build_object(
    'success', true,
    'church_id', v_church_id,
    'trial_end', v_trial_end
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.signup_church(TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.signup_church(TEXT, TEXT, TEXT, UUID) TO anon;