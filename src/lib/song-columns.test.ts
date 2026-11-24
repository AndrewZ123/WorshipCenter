import { describe, expect, it } from 'vitest';
import { SONG_COLUMNS, SONG_SELECT } from './song-columns';

describe('song select columns', () => {
  it('covers every field the Song model reads', () => {
    expect(SONG_COLUMNS).toEqual([
      'id',
      'church_id',
      'title',
      'artist',
      'default_key',
      'ccli_number',
      'tags',
      'youtube_video_id',
      'created_at',
    ]);
  });

  it('does not request the search_vector column with a wildcard', () => {
    expect(SONG_SELECT).not.toBe('*');
    expect(SONG_SELECT).not.toContain('search_vector');
    expect(SONG_SELECT).toBe(SONG_COLUMNS.join(','));
  });
});
