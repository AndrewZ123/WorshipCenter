-- Song Library Enhancements Migration
-- This migration adds support for file attachments, versioning, arrangements, and advanced search

-- Enable pgvector for advanced search if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- SONG VERSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS song_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  artist TEXT,
  default_key TEXT,
  ccli_number TEXT,
  tags TEXT[],
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  
  UNIQUE(song_id, version_number)
);

-- Index for faster version lookups
CREATE INDEX IF NOT EXISTS idx_song_versions_song_id ON song_versions(song_id);
CREATE INDEX IF NOT EXISTS idx_song_versions_church_id ON song_versions(church_id);

-- ============================================
-- SONG ARRANGEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS song_arrangements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  tempo INTEGER, -- BPM
  time_signature TEXT DEFAULT '4/4',
  structure JSONB DEFAULT '[]', -- e.g., [{"section": "Verse 1", "duration": 30}, ...]
  notes TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE
);

-- Index for faster arrangement lookups
CREATE INDEX IF NOT EXISTS idx_song_arrangements_song_id ON song_arrangements(song_id);
CREATE INDEX IF NOT EXISTS idx_song_arrangements_church_id ON song_arrangements(church_id);

-- ============================================
-- ENHANCE SONG FILES TABLE
-- ============================================
-- Add columns to existing song_files table if they don't exist
ALTER TABLE song_files 
ADD COLUMN IF NOT EXISTS file_type TEXT NOT NULL DEFAULT 'chord_chart',
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS mime_type TEXT,
ADD COLUMN IF NOT EXISTS arrangement_id UUID REFERENCES song_arrangements(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES song_versions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);

-- Update the SongFileType enum constraint
ALTER TABLE song_files 
DROP CONSTRAINT IF EXISTS song_files_file_type_check;

ALTER TABLE song_files 
ADD CONSTRAINT song_files_file_type_check 
CHECK (file_type IN ('chord_chart', 'lyrics', 'lead_sheet', 'audio', 'pdf', 'image', 'other'));

-- ============================================
-- FULL-TEXT SEARCH SUPPORT
-- ============================================

-- Create a function to update song search vector
CREATE OR REPLACE FUNCTION update_song_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.title, '') || ' ' || 
    COALESCE(NEW.artist, '') || ' ' ||
    COALESCE(array_to_string(NEW.tags, ' '), '') || ' ' ||
    COALESCE(NEW.ccli_number, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add search vector column
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create index for full-text search
CREATE INDEX IF NOT EXISTS idx_songs_search_vector ON songs USING GIN(search_vector);

-- Create trigger for automatic search vector updates
DROP TRIGGER IF EXISTS songs_search_vector_update ON songs;
CREATE TRIGGER songs_search_vector_update
  BEFORE INSERT OR UPDATE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION update_song_search_vector();

-- Update existing songs with search vectors
UPDATE songs SET search_vector = to_tsvector('english', 
  COALESCE(title, '') || ' ' || 
  COALESCE(artist, '') || ' ' ||
  COALESCE(array_to_string(tags, ' '), '') || ' ' ||
  COALESCE(ccli_number, '')
);

-- ============================================
-- SONG HISTORY/AUDIT TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS song_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'version_created', 'arrangement_created'
  changed_by UUID REFERENCES auth.users(id),
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE
);

-- Index for history queries
CREATE INDEX IF NOT EXISTS idx_song_history_song_id ON song_history(song_id);
CREATE INDEX IF NOT EXISTS idx_song_history_church_id ON song_history(church_id);
CREATE INDEX IF NOT EXISTS idx_song_history_created_at ON song_history(created_at DESC);

-- ============================================
-- FUNCTION TO CREATE SONG VERSION AUTOMATICALLY
-- ============================================
CREATE OR REPLACE FUNCTION create_song_version()
RETURNS TRIGGER AS $$
DECLARE
  max_version INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Get the current max version number
    SELECT COALESCE(MAX(version_number), 0) INTO max_version
    FROM song_versions
    WHERE song_id = NEW.id;
    
    -- Create a new version with the old data
    INSERT INTO song_versions (
      song_id,
      version_number,
      title,
      artist,
      default_key,
      ccli_number,
      tags,
      notes,
      created_by,
      church_id
    )
    VALUES (
      NEW.id,
      max_version + 1,
      OLD.title,
      OLD.artist,
      OLD.default_key,
      OLD.ccli_number,
      OLD.tags,
      NULL, -- Notes are not versioned
      (SELECT auth.uid() WHERE EXISTS(SELECT 1 FROM auth.users WHERE id = auth.uid())),
      NEW.church_id
    );
    
    -- Record in history
    INSERT INTO song_history (
      song_id,
      action,
      changed_by,
      old_data,
      new_data,
      church_id
    )
    VALUES (
      NEW.id,
      'version_created',
      (SELECT auth.uid() WHERE EXISTS(SELECT 1 FROM auth.users WHERE id = auth.uid())),
      jsonb_build_object(
        'title', OLD.title,
        'artist', OLD.artist,
        'default_key', OLD.default_key,
        'ccli_number', OLD.ccli_number,
        'tags', OLD.tags
      ),
      jsonb_build_object(
        'title', NEW.title,
        'artist', NEW.artist,
        'default_key', NEW.default_key,
        'ccli_number', NEW.ccli_number,
        'tags', NEW.tags
      ),
      NEW.church_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic versioning
DROP TRIGGER IF EXISTS song_versioning_trigger ON songs;
CREATE TRIGGER song_versioning_trigger
  AFTER UPDATE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION create_song_version();

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Song Versions RLS
ALTER TABLE song_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view song versions for their church"
  ON song_versions FOR SELECT
  USING (church_id IN (SELECT church_id FROM churches WHERE id = church_id));

CREATE POLICY "Users can create song versions for their church"
  ON song_versions FOR INSERT
  WITH CHECK (church_id IN (SELECT church_id FROM churches WHERE id = church_id));

-- Song Arrangements RLS
ALTER TABLE song_arrangements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view song arrangements for their church"
  ON song_arrangements FOR SELECT
  USING (church_id IN (SELECT church_id FROM churches WHERE id = church_id));

CREATE POLICY "Users can create song arrangements for their church"
  ON song_arrangements FOR INSERT
  WITH CHECK (church_id IN (SELECT church_id FROM churches WHERE id = church_id));

CREATE POLICY "Users can update song arrangements for their church"
  ON song_arrangements FOR UPDATE
  USING (church_id IN (SELECT church_id FROM churches WHERE id = church_id));

CREATE POLICY "Users can delete song arrangements for their church"
  ON song_arrangements FOR DELETE
  USING (church_id IN (SELECT church_id FROM churches WHERE id = church_id));

-- Song History RLS
ALTER TABLE song_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view song history for their church"
  ON song_history FOR SELECT
  USING (church_id IN (SELECT church_id FROM churches WHERE id = church_id));

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get song with all related data
CREATE OR REPLACE FUNCTION get_song_with_details(song_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore song from version
CREATE OR REPLACE FUNCTION restore_song_from_version(song_uuid UUID, version_num INTEGER)
RETURNS UUID AS $$
DECLARE
  version_id UUID;
BEGIN
  -- Get the version to restore from
  SELECT id INTO version_id
  FROM song_versions
  WHERE song_id = song_uuid AND version_number = version_num;
  
  IF version_id IS NULL THEN
    RAISE EXCEPTION 'Version % not found for song %', version_num, song_uuid;
  END IF;
  
  -- Update the song with version data
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
  
  -- Record in history
  INSERT INTO song_history (
    song_id,
    action,
    changed_by,
    new_data,
    church_id
  )
  SELECT 
    song_uuid,
    'restored_from_version',
    (SELECT auth.uid() WHERE EXISTS(SELECT 1 FROM auth.users WHERE id = auth.uid())),
    jsonb_build_object(
      'version_number', version_num,
      'restored_from', version_id
    ),
    s.church_id
  FROM songs s
  WHERE s.id = song_uuid;
  
  RETURN song_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMPLETED
-- ============================================

-- Add comment for documentation
COMMENT ON TABLE song_versions IS 'Stores version history of songs for rollback capability';
COMMENT ON TABLE song_arrangements IS 'Alternative arrangements of songs (different keys, tempos, structures)';
COMMENT ON COLUMN songs.search_vector IS 'Full-text search vector for advanced song search';
COMMENT ON TABLE song_history IS 'Audit trail of all song changes';