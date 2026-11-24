import type { Song } from './types';

/**
 * Explicit PostgREST projection for songs.
 *
 * `select('*')` also returns `search_vector`, a tsvector column added later by
 * the song migrations that the client never reads. Keep this list in sync with
 * the Song model so responses stay small and stable.
 */
export const SONG_COLUMNS = [
  'id',
  'church_id',
  'title',
  'artist',
  'default_key',
  'ccli_number',
  'tags',
  'youtube_video_id',
  'created_at',
] as const satisfies readonly (keyof Song)[];

// Keep as a string literal so Supabase can infer the selected row shape.
export const SONG_SELECT =
  'id,church_id,title,artist,default_key,ccli_number,tags,youtube_video_id,created_at' as const;
