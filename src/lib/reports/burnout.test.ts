import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BURNOUT_STREAK_WEEKS,
  computeBurnoutFlags,
  formatBurnoutStreak,
  getUtcWeekStart,
  type BurnoutAssignment,
  type BurnoutMember,
  type BurnoutService,
} from './burnout';

const members: BurnoutMember[] = [
  { id: 'm1', name: 'Ada Example' },
  { id: 'm2', name: 'Grace Example' },
];

/** Four consecutive Sundays: Oct 26 – Nov 22, 2026 ISO weeks. */
const fourWeekServices: BurnoutService[] = [
  { id: 's1', date: '2026-11-01' },
  { id: 's2', date: '2026-11-08' },
  { id: 's3', date: '2026-11-15' },
  { id: 's4', date: '2026-11-22' },
];

function confirmedFor(
  memberId: string,
  services: readonly BurnoutService[]
): BurnoutAssignment[] {
  return services.map((service) => ({
    service_id: service.id,
    team_member_id: memberId,
    status: 'confirmed',
  }));
}

describe('getUtcWeekStart', () => {
  it('uses Monday–Sunday UTC weeks', () => {
    expect(getUtcWeekStart('2026-11-23')).toBe('2026-11-23'); // Monday
    expect(getUtcWeekStart('2026-11-25')).toBe('2026-11-23'); // Wednesday
    expect(getUtcWeekStart('2026-11-28')).toBe('2026-11-23'); // Saturday
    expect(getUtcWeekStart('2026-11-29')).toBe('2026-11-23'); // Sunday
    expect(getUtcWeekStart('2026-11-22')).toBe('2026-11-16'); // prior Sunday
  });

  it('rejects invalid dates', () => {
    expect(getUtcWeekStart('')).toBeNull();
    expect(getUtcWeekStart('not-a-date')).toBeNull();
    expect(getUtcWeekStart('2026-02-31')).toBeNull();
  });
});

describe('computeBurnoutFlags', () => {
  it('flags four consecutive weeks by default', () => {
    const flags = computeBurnoutFlags(
      fourWeekServices,
      confirmedFor('m1', fourWeekServices),
      members,
      { asOf: '2026-11-25' }
    );

    expect(DEFAULT_BURNOUT_STREAK_WEEKS).toBe(4);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({
      memberId: 'm1',
      name: 'Ada Example',
      streakWeeks: 4,
      weekStarts: [
        '2026-10-26',
        '2026-11-02',
        '2026-11-09',
        '2026-11-16',
      ],
      dates: [
        '2026-11-01',
        '2026-11-08',
        '2026-11-15',
        '2026-11-22',
      ],
    });
  });

  it('does not flag three weeks in a row', () => {
    const services = fourWeekServices.slice(0, 3);
    const flags = computeBurnoutFlags(
      services,
      confirmedFor('m1', services),
      members,
      { asOf: '2026-11-18' }
    );

    expect(flags).toEqual([]);
  });

  it('resets the streak after a gap week', () => {
    const services: BurnoutService[] = [
      { id: 'a', date: '2026-10-25' },
      { id: 'b', date: '2026-11-01' },
      // Week of Nov 2 skipped.
      { id: 'c', date: '2026-11-15' },
      { id: 'd', date: '2026-11-22' },
      { id: 'e', date: '2026-11-29' },
    ];
    const flags = computeBurnoutFlags(
      services,
      confirmedFor('m1', services),
      members,
      { asOf: '2026-11-29' }
    );

    expect(flags).toEqual([]);
  });

  it('only considers the current run, not an older long run', () => {
    const services: BurnoutService[] = [
      { id: 'old1', date: '2026-10-04' },
      { id: 'old2', date: '2026-10-11' },
      { id: 'old3', date: '2026-10-18' },
      { id: 'old4', date: '2026-10-25' },
      { id: 'now', date: '2026-11-29' },
    ];
    const flags = computeBurnoutFlags(
      services,
      confirmedFor('m1', services),
      members,
      { asOf: '2026-11-29' }
    );

    expect(flags).toEqual([]);
  });

  it('counts one week once even with several services', () => {
    const services: BurnoutService[] = [
      { id: 's1', date: '2026-11-04' },
      { id: 's2', date: '2026-11-08' },
      { id: 's3', date: '2026-11-11' },
      { id: 's4', date: '2026-11-15' },
      { id: 's5', date: '2026-11-18' },
      { id: 's6', date: '2026-11-22' },
    ];
    const flags = computeBurnoutFlags(
      services,
      confirmedFor('m1', services),
      members,
      { asOf: '2026-11-22', threshold: 3 }
    );

    expect(flags[0]?.streakWeeks).toBe(3);
    expect(flags[0]?.dates).toEqual([
      '2026-11-04',
      '2026-11-08',
      '2026-11-11',
      '2026-11-15',
      '2026-11-18',
      '2026-11-22',
    ]);
  });

  it('ignores declined and pending assignments', () => {
    const assignments: BurnoutAssignment[] = fourWeekServices.map((service, index) => ({
      service_id: service.id,
      team_member_id: 'm1',
      status: index === 2 ? 'declined' : 'confirmed',
    }));

    const flags = computeBurnoutFlags(fourWeekServices, assignments, members, {
      asOf: '2026-11-25',
    });

    expect(flags).toEqual([]);
  });

  it('does not count future services that have not been served yet', () => {
    const services: BurnoutService[] = [
      ...fourWeekServices,
      { id: 'upcoming', date: '2026-11-29' },
    ];
    const flags = computeBurnoutFlags(
      services,
      confirmedFor('m1', services),
      members,
      { asOf: '2026-11-25' }
    );

    expect(flags[0]?.streakWeeks).toBe(4);
    expect(flags[0]?.dates).not.toContain('2026-11-29');
  });

  it('counts the current week once its service has passed', () => {
    const services: BurnoutService[] = [
      ...fourWeekServices,
      { id: 'upcoming', date: '2026-11-29' },
    ];
    const flags = computeBurnoutFlags(
      services,
      confirmedFor('m1', services),
      members,
      { asOf: '2026-11-29' }
    );

    expect(flags[0]?.streakWeeks).toBe(5);
    expect(flags[0]?.weekStarts[4]).toBe('2026-11-23');
  });

  it('does not flag a stale streak from several weeks ago', () => {
    const flags = computeBurnoutFlags(
      fourWeekServices,
      confirmedFor('m1', fourWeekServices),
      members,
      { asOf: '2026-12-07' }
    );

    expect(flags).toEqual([]);
  });

  it('accepts a custom threshold and sorts longest streaks first', () => {
    const fiveWeeks: BurnoutService[] = [
      ...fourWeekServices,
      { id: 's5', date: '2026-11-29' },
    ];
    const flags = computeBurnoutFlags(
      fiveWeeks,
      [
        ...confirmedFor('m1', fourWeekServices),
        ...confirmedFor('m2', fiveWeeks),
      ],
      members,
      { asOf: '2026-11-29', threshold: 2 }
    );

    expect(flags.map((flag) => [flag.name, flag.streakWeeks])).toEqual([
      ['Grace Example', 5],
      ['Ada Example', 4],
    ]);
  });

  it('formats calm streak labels', () => {
    expect(formatBurnoutStreak(1)).toBe('Served 1 week in a row');
    expect(formatBurnoutStreak(4)).toBe('Served 4 weeks in a row');
  });
});
