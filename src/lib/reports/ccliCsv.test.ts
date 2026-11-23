import { describe, expect, it } from 'vitest';
import { buildCcliCsv } from './ccliCsv';
import type { CcliUsageRow } from './ccliCsv';

const HEADER = 'Song Title,Artist,CCLI Number,Times Used,First Used,Last Used,Service Dates';

const rows: CcliUsageRow[] = [
  {
    date: '2026-03-01',
    songId: 'song-1',
    title: 'Amazing Grace',
    artist: 'John Newton',
    ccliNumber: '4768151',
  },
  {
    date: '2026-01-15',
    songId: 'song-1',
    title: 'Amazing Grace',
    artist: 'John Newton',
    ccliNumber: '4768151',
  },
  {
    date: '2026-02-01',
    songId: 'song-2',
    title: 'No CCLI Song',
    artist: '',
    ccliNumber: '',
  },
];

describe('buildCcliCsv', () => {
  it('writes the expected header and aggregates usage per song', () => {
    const lines = buildCcliCsv(rows).split('\n');

    expect(lines[0]).toBe(HEADER);
    expect(lines).toContain(
      'Amazing Grace,John Newton,4768151,2,2026-01-15,2026-03-01,2026-01-15;2026-03-01'
    );
    // Songs without a CCLI number are still included with a blank cell.
    expect(lines).toContain(
      'No CCLI Song,,,1,2026-02-01,2026-02-01,2026-02-01'
    );
    expect(lines).toHaveLength(3);
  });

  it('filters rows by the requested date range', () => {
    const lines = buildCcliCsv(rows, {
      dateFrom: '2026-02-01',
      dateTo: '2026-03-31',
    }).split('\n');

    expect(lines).toContain(
      'Amazing Grace,John Newton,4768151,1,2026-03-01,2026-03-01,2026-03-01'
    );
    expect(lines).toContain(
      'No CCLI Song,,,1,2026-02-01,2026-02-01,2026-02-01'
    );
    expect(lines.join('\n')).not.toContain('2026-01-15');
  });

  it('deduplicates service dates but keeps the usage count', () => {
    const lines = buildCcliCsv([
      rows[0],
      { ...rows[0] },
    ]).split('\n');

    expect(lines[1]).toBe(
      'Amazing Grace,John Newton,4768151,2,2026-03-01,2026-03-01,2026-03-01'
    );
  });

  it('escapes commas, quotes and newlines', () => {
    const csv = buildCcliCsv([
      {
        date: '2026-04-05',
        songId: 'song-3',
        title: 'Grace, "Amazing"',
        artist: 'Line\nBreak',
        ccliNumber: '1234567',
      },
    ]);

    expect(csv).toContain('"Grace, ""Amazing"""');
    expect(csv).toContain('"Line\nBreak"');
  });

  it('guards cells that could be interpreted as spreadsheet formulas', () => {
    const csv = buildCcliCsv([
      { date: '2026-04-05', songId: 'a', title: '=HYPERLINK("x")', artist: '+A1', ccliNumber: '1' },
      { date: '2026-04-06', songId: 'b', title: '-2+3', artist: '@SUM(A1)', ccliNumber: '2' },
    ]);

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+A1");
    expect(csv).toContain("'-2+3");
    expect(csv).toContain("'@SUM(A1)");
  });

  it('supports song_id and ccli_number aliases', () => {
    const lines = buildCcliCsv([
      { date: '2026-05-01', song_id: 'song-9', songTitle: 'Alias Song', artist: 'Example', ccli_number: '999' },
      { date: '2026-06-01', song_id: 'song-9', songTitle: 'Alias Song', artist: 'Example', ccli_number: '999' },
    ]).split('\n');

    expect(lines[1]).toBe(
      'Alias Song,Example,999,2,2026-05-01,2026-06-01,2026-05-01;2026-06-01'
    );
  });

  it('returns only the header when nothing is in range', () => {
    expect(buildCcliCsv(rows, { dateFrom: '2027-01-01' })).toBe(HEADER);
  });
});
