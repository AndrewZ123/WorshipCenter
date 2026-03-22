-- Create or replace the signup_church function
-- This function creates a church, user profile, and automatically creates a team member entry
-- for the worship leader (admin user) so they appear in the team roster

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
  
  -- Create the church
  INSERT INTO churches (id, name, slug)
  VALUES (gen_random_uuid(), p_church_name, v_slug)
  RETURNING id INTO v_church_id;
  
  -- Create the user profile (admin/worship leader)
  INSERT INTO users (id, church_id, name, email, role)
  VALUES (p_auth_user_id, v_church_id, p_user_name, p_user_email, 'admin');
  
  -- Automatically create a team member entry for the worship leader
  -- This ensures they appear in the team roster and can be assigned to services
  INSERT INTO team_members (id, church_id, name, email, phone, roles, user_id, avatar_url, created_at)
  VALUES (
    gen_random_uuid(),
    v_church_id,
    p_user_name,
    p_user_email,
    '', -- Empty phone initially
    ARRAY['Worship Leader'], -- Default role
    p_auth_user_id, -- Link to the user account
    NULL, -- No avatar initially
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION signup_church TO authenticated;

-- Add comment
COMMENT ON FUNCTION signup_church IS 'Creates a church, user profile, and team member entry for the worship leader during signup';