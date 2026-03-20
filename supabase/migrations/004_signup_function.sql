-- Signup function that bypasses RLS using SECURITY DEFINER
-- This allows creating church + user profile even when the auth session isn't fully established

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
BEGIN
  -- Create the church
  INSERT INTO public.churches (name)
  VALUES (p_church_name)
  RETURNING id INTO v_church_id;
  
  -- Create the user profile
  INSERT INTO public.users (id, church_id, name, email, role)
  VALUES (p_auth_user_id, v_church_id, p_user_name, p_user_email, 'admin');
  
  -- Return the new church ID
  RETURN jsonb_build_object(
    'success', true,
    'church_id', v_church_id
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