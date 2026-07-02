-- Fix RLS policies for song_versions, song_arrangements, song_history
-- Replace tautological policies with proper church-scoped checks
-- Guard: skip if tables don't exist yet (e.g., migration 028 not applied)

-- ============================================
-- Fix song_versions RLS
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'song_versions') THEN
    DROP POLICY IF EXISTS "Users can view song versions for their church" ON song_versions;
    CREATE POLICY "Users can view song versions for their church" ON song_versions
      FOR SELECT
      USING (church_id = get_user_church_id());

    DROP POLICY IF EXISTS "Users can create song versions for their church" ON song_versions;
    CREATE POLICY "Users can create song versions for their church" ON song_versions
      FOR INSERT
      WITH CHECK (church_id = get_user_church_id());

    DROP POLICY IF EXISTS "Users can update song versions for their church" ON song_versions;
    CREATE POLICY "Users can update song versions for their church" ON song_versions
      FOR UPDATE
      USING (church_id = get_user_church_id());

    DROP POLICY IF EXISTS "Users can delete song versions for their church" ON song_versions;
    CREATE POLICY "Users can delete song versions for their church" ON song_versions
      FOR DELETE
      USING (church_id = get_user_church_id());
  END IF;
END $$;

-- ============================================
-- Fix song_arrangements RLS
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'song_arrangements') THEN
    DROP POLICY IF EXISTS "Users can view song arrangements for their church" ON song_arrangements;
    CREATE POLICY "Users can view song arrangements for their church" ON song_arrangements
      FOR SELECT
      USING (church_id = get_user_church_id());

    DROP POLICY IF EXISTS "Users can create song arrangements for their church" ON song_arrangements;
    CREATE POLICY "Users can create song arrangements for their church" ON song_arrangements
      FOR INSERT
      WITH CHECK (church_id = get_user_church_id());

    DROP POLICY IF EXISTS "Users can update song arrangements for their church" ON song_arrangements;
    CREATE POLICY "Users can update song arrangements for their church" ON song_arrangements
      FOR UPDATE
      USING (church_id = get_user_church_id());

    DROP POLICY IF EXISTS "Users can delete song arrangements for their church" ON song_arrangements;
    CREATE POLICY "Users can delete song arrangements for their church" ON song_arrangements
      FOR DELETE
      USING (church_id = get_user_church_id());
  END IF;
END $$;

-- ============================================
-- Fix song_history RLS
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'song_history') THEN
    DROP POLICY IF EXISTS "Users can view song history for their church" ON song_history;
    CREATE POLICY "Users can view song history for their church" ON song_history
      FOR SELECT
      USING (church_id = get_user_church_id());

    DROP POLICY IF EXISTS "Users can create song history entries" ON song_history;
    CREATE POLICY "Users can create song history entries" ON song_history
      FOR INSERT
      WITH CHECK (church_id = get_user_church_id());
  END IF;
END $$;

-- ============================================
-- Rewrite SECURITY DEFINER functions to SECURITY INVOKER with explicit auth checks
-- ============================================

-- Replace get_song_with_details: remove SECURITY DEFINER, add explicit church check
CREATE OR REPLACE FUNCTION get_song_with_details(song_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  user_church UUID;
BEGIN
  SELECT church_id INTO user_church FROM public.users WHERE id = auth.uid();
  IF user_church IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM songs WHERE id = song_uuid AND church_id = user_church) THEN
    RAISE EXCEPTION 'Song not found or access denied';
  END IF;

  SELECT jsonb_build_object(
    'song', s.*,
    'versions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', sv.id,
        'version_number', sv.version_number,
        'title', sv.title,
        'artist', sv.artist,
        'default_key', sv.default_key,
        'ccli_number', sv.ccli_number,
        'tags', sv.tags,
        'created_at', sv.created_at
      )), '[]'::jsonb)
      FROM song_versions sv
      WHERE sv.song_id = s.id
      ORDER BY sv.version_number DESC
    ),
    'arrangements', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', sa.id,
        'name', sa.name,
        'key', sa.key,
        'tempo', sa.tempo,
        'time_signature', sa.time_signature,
        'structure', sa.structure,
        'is_default', sa.is_default,
        'created_at', sa.created_at
      )), '[]'::jsonb)
      FROM song_arrangements sa
      WHERE sa.song_id = s.id
      ORDER BY sa.is_default DESC, sa.name ASC
    ),
    'files', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', sf.id,
        'file_url', sf.file_url,
        'file_name', sf.file_name,
        'file_type', sf.file_type,
        'file_size', sf.file_size,
        'is_primary', sf.is_primary,
        'created_at', sf.created_at
      )), '[]'::jsonb)
      FROM song_files sf
      WHERE sf.song_id = s.id
      ORDER BY sf.is_primary DESC, sf.created_at DESC
    )
  ) INTO result
  FROM songs s
  WHERE s.id = song_uuid;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER STABLE;

-- Replace restore_song_from_version: remove SECURITY DEFINER, add explicit church check
CREATE OR REPLACE FUNCTION restore_song_from_version(song_uuid UUID, version_num INTEGER)
RETURNS UUID AS $$
DECLARE
  version_id UUID;
  user_church UUID;
  song_church UUID;
BEGIN
  SELECT church_id INTO user_church FROM public.users WHERE id = auth.uid();
  IF user_church IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT church_id INTO song_church FROM songs WHERE id = song_uuid;
  IF song_church IS NULL OR song_church != user_church THEN
    RAISE EXCEPTION 'Song not found or access denied';
  END IF;

  SELECT id INTO version_id
  FROM song_versions
  WHERE song_id = song_uuid AND version_number = version_num;

  IF version_id IS NULL THEN
    RAISE EXCEPTION 'Version % not found for song %', version_num, song_uuid;
  END IF;

  UPDATE songs s
  SET
    title = sv.title,
    artist = sv.artist,
    default_key = sv.default_key,
    ccli_number = sv.ccli_number,
    tags = sv.tags,
    updated_at = NOW()
  FROM song_versions sv
  WHERE s.id = song_uuid AND sv.id = version_id;

  INSERT INTO song_history (
    song_id, action, changed_by, new_data, church_id
  )
  VALUES (
    song_uuid,
    'restored_from_version',
    auth.uid(),
    jsonb_build_object(
      'version_number', version_num,
      'restored_from', version_id
    ),
    user_church
  );

  RETURN song_uuid;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;