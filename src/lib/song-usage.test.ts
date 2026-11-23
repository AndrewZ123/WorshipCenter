import { describe, expect, it } from 'vitest';
import { getSongUsageDisplayLines, summarizeSongUsageDates } from './song-usage';

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

describe('getSongUsageDisplayLines', () => {
  it('shows only the Scheduled line when there is no past usage', () => {
    expect(
      getSongUsageDisplayLines({ lastUsed: null, nextScheduled: '2026-11-29' })
    ).toEqual([{ kind: 'scheduled', date: '2026-11-29' }]);
  });

  it('shows Last Used before Scheduled when both exist', () => {
    expect(
      getSongUsageDisplayLines({
        lastUsed: '2026-10-01',
        nextScheduled: '2026-11-29',
      })
    ).toEqual([
      { kind: 'lastUsed', date: '2026-10-01' },
      { kind: 'scheduled', date: '2026-11-29' },
    ]);
  });

  it('returns no lines when the song has never been used or scheduled', () => {
    expect(
      getSongUsageDisplayLines({ lastUsed: null, nextScheduled: null })
    ).toEqual([]);
  });
});
