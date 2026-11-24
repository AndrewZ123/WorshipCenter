import { describe, expect, it } from 'vitest';
import { summarizeSongUsage, type SongUsageEntry } from './songUsage';

const entries: SongUsageEntry[] = [
  {
    date: '2026-11-01',
    songId: 'song-1',
    title: 'Amazing Grace',
    artist: 'John Newton',
    ccliNumber: '4768151',
  },
  {
    date: '2026-11-08',
    songId: 'song-1',
    title: 'Amazing Grace',
    artist: 'John Newton',
    ccliNumber: '4768151',
  },
  {
    date: '2026-11-15',
    songId: 'song-2',
    title: 'Great Are You Lord',
    artist: 'All Sons & Daughters',
    ccliNumber: '6460227',
  },
  {
    date: '2026-11-15',
    songId: 'song-3',
    title: 'Same Day Twice',
    artist: '',
    ccliNumber: '',
  },
  {
    date: '2026-11-15',
    songId: 'song-3',
    title: 'Same Day Twice',
    artist: '',
    ccliNumber: '',
  },
];

describe('summarizeSongUsage', () => {
  it('aggregates by song and sorts most played first', () => {
    const rows = summarizeSongUsage(entries);

    expect(rows.map((row) => [row.title, row.timesPlayed])).toEqual([
      ['Amazing Grace', 2],
      ['Same Day Twice', 2],
      ['Great Are You Lord', 1],
    ]);
  });

  it('keeps distinct usage dates and reports the last use', () => {
    const grace = summarizeSongUsage(entries).find((row) => row.songId === 'song-1');
    expect(grace?.dates).toEqual(['2026-11-01', '2026-11-08']);
    expect(grace?.lastUsed).toBe('2026-11-08');
    expect(grace?.artist).toBe('John Newton');
    expect(grace?.ccliNumber).toBe('4768151');
  });

  it('deduplicates dates while keeping the play count', () => {
    const sameDay = summarizeSongUsage(entries).find((row) => row.songId === 'song-3');
    expect(sameDay?.timesPlayed).toBe(2);
    expect(sameDay?.dates).toEqual(['2026-11-15']);
    expect(sameDay?.lastUsed).toBe('2026-11-15');
  });

  it('merges id-less rows by title, artist and CCLI number', () => {
    const rows = summarizeSongUsage([
      { date: '2026-11-01', title: 'Amazing Grace', artist: 'John Newton', ccliNumber: '1' },
      { date: '2026-11-08', title: 'Amazing Grace', artist: 'John Newton', ccliNumber: '1' },
      { date: '2026-11-08', title: 'Amazing Grace', artist: 'Other Artist', ccliNumber: '1' },
      { date: '2026-11-08', title: '' },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.artist === 'John Newton')?.timesPlayed).toBe(2);
  });
});
