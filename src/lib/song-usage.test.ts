import { describe, expect, it } from 'vitest';
import { summarizeSongUsageDates } from './song-usage';

describe('summarizeSongUsageDates', () => {
  const now = new Date(2026, 10, 23, 12, 0, 0); // Nov 23, 2026 local

  it('does not treat a future service usage as the last past usage', () => {
    expect(
      summarizeSongUsageDates(['2026-10-01', '2026-11-29'], now)
    ).toEqual({
      lastUsed: '2026-10-01',
      nextScheduled: '2026-11-29',
    });
  });

  it('keeps today as a past/today usage and finds the nearest upcoming date', () => {
    expect(
      summarizeSongUsageDates(
        ['2026-11-23', '2026-12-06', '2026-11-29'],
        now
      )
    ).toEqual({
      lastUsed: '2026-11-23',
      nextScheduled: '2026-11-29',
    });
  });

  it('returns empty values when there is no usage', () => {
    expect(summarizeSongUsageDates([], now)).toEqual({
      lastUsed: null,
      nextScheduled: null,
    });
  });
});
