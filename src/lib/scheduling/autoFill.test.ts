import { describe, it, expect } from 'vitest';
import {
  autoFillOpenRoles,
  deriveOpenSlots,
  getSlotCandidates,
  type AutoFillHistoryAssignment,
  type AutoFillInput,
  type AutoFillTeamMember,
} from './autoFill';

const SERVICE_DATE = '2026-06-15';
const CURRENT_SERVICE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_SERVICE_ID = '22222222-2222-4222-8222-222222222222';

function member(id: string, name: string, roles: string[]): AutoFillTeamMember {
  return { id, name, roles };
}

function history(
  teamMemberId: string,
  date: string,
  serviceId = OTHER_SERVICE_ID,
): AutoFillHistoryAssignment {
  return { team_member_id: teamMemberId, service_id: serviceId, date };
}

function input(overrides: Partial<AutoFillInput> = {}): AutoFillInput {
  return {
    serviceId: CURRENT_SERVICE_ID,
    serviceDate: SERVICE_DATE,
    openSlots: [{ role: 'vocals', count: 1 }],
    teamMembers: [],
    blockouts: [],
    recentAssignments: [],
    existingAssignments: [],
    options: { maxPerMonth: 2, lookbackDays: 90 },
    ...overrides,
  };
}

describe('autoFillOpenRoles', () => {
  it('only proposes members who have the requested role', () => {
    const result = autoFillOpenRoles(
      input({
        teamMembers: [
          member('alice', 'Alice Anderson', ['vocals']),
          member('bob', 'Bob Brown', ['drums']),
        ],
      }),
    );

    expect(result.assignments).toEqual([
      { role: 'vocals', teamMemberId: 'alice', reason: 'Never served' },
    ]);
    expect(result.unfilled).toEqual([]);
  });

  it('matches role spellings across underscores and spaces', () => {
    const result = autoFillOpenRoles(
      input({
        openSlots: [{ role: 'worship_leader', count: 1 }],
        teamMembers: [member('alice', 'Alice Anderson', ['Worship Leader'])],
      }),
    );

    expect(result.assignments[0]?.teamMemberId).toBe('alice');
  });

  it('skips a member who is blocked out on the service date', () => {
    const result = autoFillOpenRoles(
      input({
        teamMembers: [
          member('alice', 'Alice Anderson', ['vocals']),
          member('bob', 'Bob Brown', ['vocals']),
        ],
        blockouts: [
          {
            team_member_id: 'alice',
            start_date: '2026-06-14',
            end_date: '2026-06-16',
            reason: 'Vacation',
          },
        ],
      }),
    );

    expect(result.assignments[0]?.teamMemberId).toBe('bob');
  });

  it('reports blocked-out members in the unfilled reason', () => {
    const result = autoFillOpenRoles(
      input({
        teamMembers: [member('alice', 'Alice Anderson', ['vocals'])],
        blockouts: [
          {
            team_member_id: 'alice',
            start_date: '2026-06-14',
            end_date: '2026-06-16',
          },
        ],
      }),
    );

    expect(result.assignments).toEqual([]);
    expect(result.unfilled).toHaveLength(1);
    expect(result.unfilled[0].role).toBe('vocals');
    expect(result.unfilled[0].reason).toContain('blocked out');
  });

  it('skips a member already assigned to another service on the same date', () => {
    const result = autoFillOpenRoles(
      input({
        teamMembers: [
          member('alice', 'Alice Anderson', ['vocals']),
          member('bob', 'Bob Brown', ['vocals']),
        ],
        recentAssignments: [history('alice', SERVICE_DATE)],
      }),
    );

    expect(result.assignments[0]?.teamMemberId).toBe('bob');
  });

  it('skips a member already assigned on this service', () => {
    const result = autoFillOpenRoles(
      input({
        teamMembers: [
          member('alice', 'Alice Anderson', ['vocals']),
          member('bob', 'Bob Brown', ['vocals']),
        ],
        existingAssignments: [
          {
            team_member_id: 'alice',
            role: 'drums',
            service_id: CURRENT_SERVICE_ID,
          },
        ],
      }),
    );

    expect(result.assignments[0]?.teamMemberId).toBe('bob');
  });

  it('never assigns the same person to two roles in one fill', () => {
    const result = autoFillOpenRoles(
      input({
        openSlots: [
          { role: 'vocals', count: 1 },
          { role: 'acoustic', count: 1 },
        ],
        teamMembers: [member('alice', 'Alice Anderson', ['vocals', 'acoustic'])],
      }),
    );

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].role).toBe('vocals');
    expect(result.unfilled).toHaveLength(1);
    expect(result.unfilled[0].reason).toContain('already picked for another role');
  });

  it('respects the default max per month frequency cap', () => {
    const result = autoFillOpenRoles(
      input({
        teamMembers: [
          member('alice', 'Alice Anderson', ['vocals']),
          member('bob', 'Bob Brown', ['vocals']),
        ],
        recentAssignments: [
          history('alice', '2026-05-25'),
          history('alice', '2026-06-05'),
        ],
      }),
    );

    expect(result.assignments[0]?.teamMemberId).toBe('bob');
  });

  it('uses a member preference as the frequency cap', () => {
    const result = autoFillOpenRoles(
      input({
        teamMembers: [member('alice', 'Alice Anderson', ['vocals'])],
        recentAssignments: [history('alice', '2026-06-05')],
        preferences: [{ team_member_id: 'alice', max_weekly_frequency: 1 }],
      }),
    );

    expect(result.assignments).toEqual([]);
    expect(result.unfilled[0]?.reason).toContain('frequency limit');
  });

  it('does not count assignments outside the 30-day frequency window', () => {
    const result = autoFillOpenRoles(
      input({
        teamMembers: [member('alice', 'Alice Anderson', ['vocals'])],
        recentAssignments: [history('alice', '2026-04-15')],
        options: { maxPerMonth: 1, lookbackDays: 90 },
      }),
    );

    expect(result.assignments[0]?.teamMemberId).toBe('alice');
  });

  it('counts a nearby future assignment toward the frequency cap', () => {
    const result = autoFillOpenRoles(
      input({
        teamMembers: [
          member('alice', 'Alice Anderson', ['vocals']),
          member('bob', 'Bob Brown', ['vocals']),
        ],
        recentAssignments: [history('alice', '2026-07-01')],
        options: { maxPerMonth: 1 },
      }),
    );

    expect(result.assignments[0]?.teamMemberId).toBe('bob');
  });

  it('ranks never-served first, then least recently served', () => {
    const result = autoFillOpenRoles(
      input({
        openSlots: [{ role: 'vocals', count: 3 }],
        teamMembers: [
          member('alice', 'Alice Anderson', ['vocals']),
          member('bob', 'Bob Brown', ['vocals']),
          member('charlie', 'Charlie Clark', ['vocals']),
        ],
        recentAssignments: [
          history('alice', '2026-05-01'),
          history('bob', '2026-06-01'),
        ],
      }),
    );

    expect(result.assignments.map((a) => a.teamMemberId)).toEqual([
      'charlie',
      'alice',
      'bob',
    ]);
    expect(result.assignments[1].reason).toBe('Last served 6 weeks ago');
  });

  it('breaks a last-served tie by fewest assignments in the lookback window', () => {
    const result = autoFillOpenRoles(
      input({
        openSlots: [{ role: 'vocals', count: 2 }],
        teamMembers: [
          member('dave', 'Dave Davis', ['vocals']),
          member('eve', 'Eve Evans', ['vocals']),
        ],
        recentAssignments: [
          history('dave', '2026-06-01'),
          history('eve', '2026-04-01'),
          history('eve', '2026-06-01'),
        ],
        options: { maxPerMonth: 5, lookbackDays: 90 },
      }),
    );

    expect(result.assignments.map((a) => a.teamMemberId)).toEqual(['dave', 'eve']);
  });

  it('breaks ties by name and is deterministic', () => {
    const sameInput = input({
      openSlots: [{ role: 'vocals', count: 2 }],
      teamMembers: [
        member('zoe-id', 'Zoe Zimmerman', ['vocals']),
        member('amy-id', 'Amy Adams', ['vocals']),
      ],
    });

    const first = autoFillOpenRoles(sameInput);
    const second = autoFillOpenRoles(sameInput);

    expect(first.assignments.map((a) => a.teamMemberId)).toEqual([
      'amy-id',
      'zoe-id',
    ]);
    expect(second).toEqual(first);
  });

  it('explains when nobody has the role', () => {
    const result = autoFillOpenRoles(
      input({ teamMembers: [member('bob', 'Bob Brown', ['drums'])] }),
    );

    expect(result.unfilled[0].reason).toContain('No team members have the "vocals" role');
  });

  it('explains when every role member is already on the service', () => {
    const result = autoFillOpenRoles(
      input({
        teamMembers: [member('alice', 'Alice Anderson', ['vocals'])],
        existingAssignments: [
          {
            team_member_id: 'alice',
            role: 'vocals',
            service_id: CURRENT_SERVICE_ID,
          },
        ],
      }),
    );

    expect(result.unfilled[0].reason).toContain('already on this service');
  });

  it('explains when every role member is serving elsewhere that day', () => {
    const result = autoFillOpenRoles(
      input({
        teamMembers: [member('alice', 'Alice Anderson', ['vocals'])],
        recentAssignments: [history('alice', SERVICE_DATE)],
      }),
    );

    expect(result.unfilled[0].reason).toContain('already serving another service');
  });

  it('returns one unfilled entry per slot that could not be filled', () => {
    const result = autoFillOpenRoles(
      input({
        openSlots: [{ role: 'vocals', count: 2 }],
        teamMembers: [member('alice', 'Alice Anderson', ['vocals'])],
      }),
    );

    expect(result.assignments).toHaveLength(1);
    expect(result.unfilled).toHaveLength(1);
    expect(result.unfilled[0].reason).toContain('already picked for another role');
  });

  it('does not save or mutate the input arrays', () => {
    const teamMembers = [member('alice', 'Alice Anderson', ['vocals'])];
    const openSlots = [{ role: 'vocals', count: 1 }];
    const original = input({ teamMembers, openSlots });

    autoFillOpenRoles(original);

    expect(original.teamMembers).toBe(teamMembers);
    expect(original.openSlots).toBe(openSlots);
    expect(openSlots[0].count).toBe(1);
  });
});

describe('getSlotCandidates', () => {
  it('excludes members reserved by another preview row', () => {
    const candidates = getSlotCandidates(
      input({
        teamMembers: [
          member('alice', 'Alice Anderson', ['vocals']),
          member('bob', 'Bob Brown', ['vocals']),
        ],
      }),
      'vocals',
      ['alice'],
    );

    expect(candidates.map((c) => c.teamMemberId)).toEqual(['bob']);
  });
});

describe('deriveOpenSlots', () => {
  it('subtracts existing role assignments from configured positions', () => {
    const slots = deriveOpenSlots(
      [
        { role: 'vocals', max_volunteers: 2 },
        { role: 'drums', max_volunteers: 1 },
      ],
      [{ role: 'Vocals' }],
    );

    expect(slots).toEqual([
      { role: 'vocals', count: 1 },
      { role: 'drums', count: 1 },
    ]);
  });

  it('normalizes role spelling when counting filled slots', () => {
    const slots = deriveOpenSlots(
      [{ role: 'worship_leader', max_volunteers: 1 }],
      [{ role: 'Worship Leader' }],
    );

    expect(slots).toEqual([]);
  });
});
