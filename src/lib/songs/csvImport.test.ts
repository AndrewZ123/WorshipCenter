import { describe, expect, it } from 'vitest';
import {
  SONG_CSV_MAX_BYTES,
  SONG_CSV_MAX_ROWS,
  SONG_CSV_TEMPLATE,
  buildSongImportPreview,
  normalizeSongMatchText,
  parseCsvRecords,
  parseSongsCsv,
  songTitleArtistKey,
  type ExistingSongForImport,
  type SongCsvParseSuccess,
} from './csvImport';

function parsedSuccess(csv: string): SongCsvParseSuccess {
  const parsed = parseSongsCsv(csv);
  if (!parsed.ok) throw new Error(`Expected a valid CSV, got: ${parsed.error}`);
  return parsed;
}

describe('parseCsvRecords', () => {
  it('handles quoted commas, escaped quotes, CRLF, and a BOM', () => {
    const records = parseCsvRecords(
      '\uFEFFTitle,Author\r\n"Morning, Light","Example, Artist"\r\n"Song ""One""",Other\r\n'
    );

    expect(records).toEqual([
      ['Title', 'Author'],
      ['Morning, Light', 'Example, Artist'],
      ['Song "One"', 'Other'],
    ]);
  });

  it('keeps newlines that appear inside quoted fields', () => {
    expect(parseCsvRecords('Title,Notes\n"Two\nLines",ok')).toEqual([
      ['Title', 'Notes'],
      ['Two\nLines', 'ok'],
    ]);
  });

  it('does not add a phantom row for a trailing newline', () => {
    expect(parseCsvRecords('Title,Artist\nSong,Example\n')).toEqual([
      ['Title', 'Artist'],
      ['Song', 'Example'],
    ]);
  });
});

describe('parseSongsCsv headers', () => {
  it('detects a Planning Center export with mixed-case aliases', () => {
    const parsed = parsedSuccess(
      [
        'Title,Authors,CCLI Number,Key,Themes,Copyright,Sort Title',
        '"Morning Light","Example Artist","CCLI 123456","G","praise, upbeat","© Example","morning light"',
      ].join('\n')
    );

    expect(parsed.totalRows).toBe(1);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toEqual({
      rowNumber: 2,
      title: 'Morning Light',
      artist: 'Example Artist',
      defaultKey: 'G',
      ccliNumber: '123456',
      tags: ['praise', 'upbeat'],
      copyright: '© Example',
    });
    expect(parsed.columns).toEqual({
      title: 'Title',
      artist: 'Authors',
      default_key: 'Key',
      ccli_number: 'CCLI Number',
      tags: 'Themes',
      copyright: 'Copyright',
    });
  });

  it('accepts the simple WorshipCenter header set with underscore aliases', () => {
    const parsed = parsedSuccess(
      [
        'title,artist,default_key,ccli_number,tags',
        'Quiet Waters,Example Band,D,0000002,communion|reflective',
        'Morning Light,Example Artist,G,,"praise,upbeat"',
      ].join('\n')
    );

    expect(parsed.rows.map((row) => row.title)).toEqual([
      'Quiet Waters',
      'Morning Light',
    ]);
    expect(parsed.rows[0].defaultKey).toBe('D');
    expect(parsed.rows[0].tags).toEqual(['communion', 'reflective']);
    expect(parsed.rows[1].ccliNumber).toBe('');
    // A comma inside an unquoted Tags cell still splits into two tags.
    expect(parsed.rows[1].tags).toEqual(['praise', 'upbeat']);
  });

  it('accepts CCLI# / default key / author column variants case-insensitively', () => {
    const parsed = parsedSuccess(
      [
        'SONG TITLE,AUTHOR,CCLI#,DEFAULT KEY,TAGS',
        'Morning Light,Example Artist,0000001,G,easter; hope',
      ].join('\n')
    );

    expect(parsed.rows[0].title).toBe('Morning Light');
    expect(parsed.rows[0].artist).toBe('Example Artist');
    expect(parsed.rows[0].ccliNumber).toBe('0000001');
    expect(parsed.rows[0].defaultKey).toBe('G');
    expect(parsed.rows[0].tags).toEqual(['easter', 'hope']);
  });

  it('handles BOM, CRLF, and quoted commas end-to-end', () => {
    const parsed = parsedSuccess(
      '\uFEFFTitle,Author,CCLI #,Default Key,Tags\r\n"Morning, Light","Example, Artist","CCLI 0000001","G","praise, upbeat"\r\n'
    );

    expect(parsed.rows[0]).toMatchObject({
      title: 'Morning, Light',
      artist: 'Example, Artist',
      ccliNumber: '0000001',
      defaultKey: 'G',
      tags: ['praise', 'upbeat'],
    });
  });

  it('ignores unknown columns instead of failing', () => {
    const parsed = parsedSuccess(
      [
        'Title,Unknown Column,Artist,Mood,Ccli',
        'Morning Light,ignored,Example Artist,happy,0000001',
      ].join('\n')
    );

    expect(parsed.rows[0]).toMatchObject({
      title: 'Morning Light',
      artist: 'Example Artist',
      ccliNumber: '0000001',
    });
  });
});

describe('parseSongsCsv validation', () => {
  it('rejects empty files', () => {
    expect(parseSongsCsv('')).toEqual({
      ok: false,
      error: 'The CSV file is empty.',
    });
    expect(parseSongsCsv('\uFEFF   \r\n')).toEqual({
      ok: false,
      error: 'The CSV file is empty.',
    });
  });

  it('rejects a file without a title column', () => {
    const parsed = parseSongsCsv('Artist,Key\nExample Artist,G');

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/Missing title column/);
  });

  it('collects row errors without aborting valid rows', () => {
    const parsed = parsedSuccess(
      ['Title,Artist', ',Example Artist', 'Morning Light,Example Artist'].join(
        '\n'
      )
    );

    expect(parsed.totalRows).toBe(2);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      rowNumber: 3,
      title: 'Morning Light',
    });
    expect(parsed.errors).toEqual([
      { rowNumber: 2, message: 'Title is required.' },
    ]);
  });

  it('reports rows with overlong titles or artists as row errors', () => {
    const parsed = parsedSuccess(
      [
        'Title,Artist',
        `${'T'.repeat(201)},Example Artist`,
        `Morning Light,${'A'.repeat(101)}`,
        'Quiet Waters,Example Band',
      ].join('\n')
    );

    expect(parsed.rows.map((row) => row.title)).toEqual(['Quiet Waters']);
    expect(parsed.errors.map((error) => error.rowNumber)).toEqual([2, 3]);
    expect(parsed.errors[0].message).toMatch(/Title is too long/);
    expect(parsed.errors[1].message).toMatch(/Artist is too long/);
  });

  it('skips blank rows while keeping spreadsheet row numbers', () => {
    const parsed = parsedSuccess(
      ['Title,Artist', '', 'Morning Light,Example Artist'].join('\n')
    );

    expect(parsed.totalRows).toBe(1);
    expect(parsed.rows[0].rowNumber).toBe(3);
  });

  it('normalizes CCLI input and leaves an empty key for the insert fallback', () => {
    const parsed = parsedSuccess(
      ['Title,CCLI,Key', 'Morning Light,"CCLI # 00123",'].join('\n')
    );

    expect(parsed.rows[0].ccliNumber).toBe('00123');
    expect(parsed.rows[0].defaultKey).toBe('');
  });

  it('deduplicates tags case-insensitively and caps their count', () => {
    const tags = Array.from({ length: 25 }, (_, index) => `tag-${index}`);
    const parsed = parsedSuccess(
      ['Title,Tags', `Morning Light,"praise|Praise,${tags.join('|')}"`].join(
        '\n'
      )
    );

    expect(parsed.rows[0].tags).toHaveLength(20);
    expect(parsed.rows[0].tags[0]).toBe('praise');
    expect(parsed.rows[0].tags[1]).toBe('tag-0');
  });

  it('rejects files above the row cap with a clear message', () => {
    const rows = Array.from(
      { length: SONG_CSV_MAX_ROWS + 1 },
      (_, index) => `Song ${index},Example Artist`
    );
    const parsed = parseSongsCsv(['Title,Artist', ...rows].join('\n'));

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/too many rows/i);
  });

  it('rejects files above the byte cap with a clear message', () => {
    const parsed = parseSongsCsv(
      `Title\n${'a'.repeat(SONG_CSV_MAX_BYTES + 1)}`
    );

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/too large/i);
  });
});

describe('song matching helpers', () => {
  it('trims, case-folds, and collapses whitespace', () => {
    expect(normalizeSongMatchText('  Morning   Light  ')).toBe('morning light');
    expect(songTitleArtistKey(' Morning  Light ', ' EXAMPLE  ARTIST ')).toBe(
      'morning light\u0000example artist'
    );
  });
});

describe('buildSongImportPreview', () => {
  const existing: ExistingSongForImport[] = [
    {
      id: 'song-1',
      title: '  Morning   Light ',
      artist: 'Example Artist',
      ccli_number: '0000001',
    },
    {
      id: 'song-2',
      title: 'Quiet Waters',
      artist: 'Example Band',
      ccli_number: '',
    },
  ];

  it('matches by normalized CCLI first', () => {
    const parsed = parsedSuccess(
      ['Title,Artist,CCLI', 'Different Title,Other Artist,0000001'].join('\n')
    );
    const preview = buildSongImportPreview(parsed, existing);

    expect(preview.rows[0]).toMatchObject({
      status: 'duplicate',
      matchedSongId: 'song-1',
      matchedTitle: '  Morning   Light ',
      matchSource: 'library',
    });
    expect(preview.summary).toEqual({
      totalRows: 1,
      newCount: 0,
      duplicateCount: 1,
      invalidCount: 0,
    });
  });

  it('matches title + artist only when the row has no CCLI', () => {
    const parsed = parsedSuccess(
      [
        'Title,Artist,CCLI',
        'morning light,EXAMPLE ARTIST,',
        'Quiet Waters,Example Band,0000999',
      ].join('\n')
    );
    const preview = buildSongImportPreview(parsed, existing);

    expect(preview.rows[0]).toMatchObject({
      status: 'duplicate',
      matchedSongId: 'song-1',
    });
    // CCLI present and unmatched: not a title/artist duplicate.
    expect(preview.rows[1]).toMatchObject({
      status: 'new',
      matchedSongId: null,
    });
  });

  it('marks repeats inside the same CSV as duplicates of the earlier row', () => {
    const parsed = parsedSuccess(
      [
        'Title,Artist,CCLI',
        'Brand New,Example Artist,',
        'brand   new,example artist,',
        'Another Song,Example Artist,0000777',
        'Another Song,Example Artist,0000777',
      ].join('\n')
    );
    const preview = buildSongImportPreview(parsed, []);

    expect(preview.rows.map((row) => row.status)).toEqual([
      'new',
      'duplicate',
      'new',
      'duplicate',
    ]);
    expect(preview.rows[1]).toMatchObject({
      matchedSongId: null,
      matchedTitle: 'Brand New',
      matchSource: 'file',
    });
    expect(preview.rows[3]).toMatchObject({
      matchSource: 'file',
      matchedTitle: 'Another Song',
    });
    expect(preview.summary).toMatchObject({
      newCount: 2,
      duplicateCount: 2,
    });
  });

  it('matches a later CCLI-less row to an earlier row that had a CCLI', () => {
    const parsed = parsedSuccess(
      [
        'Title,Artist,CCLI',
        'CCLI Only Song,Example Artist,0000888',
        'CCLI Only Song,Example Artist,',
      ].join('\n')
    );
    const preview = buildSongImportPreview(parsed, []);

    expect(preview.rows[0].status).toBe('new');
    expect(preview.rows[1]).toMatchObject({
      status: 'duplicate',
      matchSource: 'file',
      matchedTitle: 'CCLI Only Song',
    });
  });

  it('keeps invalid rows in the summary without losing valid rows', () => {
    const parsed = parsedSuccess(
      ['Title,Artist', ',Example Artist', 'New Song,Example Artist'].join('\n')
    );
    const preview = buildSongImportPreview(parsed, []);

    expect(preview.rows).toHaveLength(1);
    expect(preview.errors).toHaveLength(1);
    expect(preview.summary).toEqual({
      totalRows: 2,
      newCount: 1,
      duplicateCount: 0,
      invalidCount: 1,
    });
  });
});

describe('SONG_CSV_TEMPLATE', () => {
  it('uses fictional example data and PCO-compatible headers', () => {
    expect(SONG_CSV_TEMPLATE.split('\n')[0]).toBe(
      'Title,Author,CCLI #,Default Key,Tags'
    );
    expect(SONG_CSV_TEMPLATE).toContain('Example Artist');
    expect(SONG_CSV_TEMPLATE).not.toMatch(/amazing grace/i);
  });

  it('parses cleanly with the importer', () => {
    const parsed = parsedSuccess(SONG_CSV_TEMPLATE);

    expect(parsed.rows).toHaveLength(2);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows.every((row) => row.title && row.artist)).toBe(true);
  });
});
