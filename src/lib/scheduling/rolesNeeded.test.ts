import { describe, expect, it } from 'vitest';
import {
  clampRoleCount,
  deriveRoleNeededPrefill,
  deriveRoleOptions,
  findMatchingTemplate,
  getFillRolesHint,
  getFillRolesState,
  normalizeRoleName,
  roleLabel,
} from './rolesNeeded';

describe('rolesNeeded helpers', () => {
  it('normalizes roles to snake_case keys', () => {
    expect(normalizeRoleName('  Worship Leader ')).toBe('worship_leader');
    expect(normalizeRoleName('worship__leader')).toBe('worship_leader');
    expect(normalizeRoleName('')).toBe('');
  });

  it('formats role labels for display', () => {
    expect(roleLabel('worship_leader')).toBe('Worship Leader');
  });

  it('clamps headcounts to the 1–20 editor range', () => {
    expect(clampRoleCount(0)).toBe(1);
    expect(clampRoleCount(7.8)).toBe(7);
    expect(clampRoleCount(42)).toBe(20);
    expect(clampRoleCount(Number.NaN)).toBe(1);
  });

  it('prefills from assignment counts and adds template-only roles once', () => {
    expect(
      deriveRoleNeededPrefill({
        assignmentRoles: ['vocals', 'Vocals', 'drums', null],
        templateRoles: ['vocals', 'worship_leader'],
      }),
    ).toEqual([
      { role: 'vocals', max_volunteers: 2 },
      { role: 'drums', max_volunteers: 1 },
      { role: 'worship_leader', max_volunteers: 1 },
    ]);
  });

  it('dedupes and sorts role options across all sources', () => {
    expect(
      deriveRoleOptions({
        teamMemberRoles: ['Vocals', 'keys'],
        assignmentRoles: ['drums', 'vocals'],
        templateRoles: ['Worship Leader'],
      }),
    ).toEqual(['drums', 'keys', 'vocals', 'worship_leader']);
  });

  it('matches a service to its template by title, weekday and time', () => {
    const templates = [
      { id: 'sunday', title: 'Sunday Worship', time: '10:00', day_of_week: 0, roles: ['vocals'] },
      { id: 'midweek', title: 'Midweek', time: '19:00', day_of_week: 3, roles: ['keys'] },
    ];
    // 2026-11-22 is a Sunday.
    expect(
      findMatchingTemplate(templates, { title: 'Sunday Worship', time: '10:00', date: '2026-11-22' }),
    ).toBe(templates[0]);
    expect(
      findMatchingTemplate(templates, { title: 'Sunday Worship', time: '11:00', date: '2026-11-22' }),
    ).toBeNull();
    expect(findMatchingTemplate(templates, { title: 'Midweek', date: '2026-11-25' })).toBe(
      templates[1],
    );
  });

  it('reports whether fill open roles can run', () => {
    const positions = [{ role: 'vocals', max_volunteers: 2 }];

    expect(getFillRolesState([], [])).toBe('no_roles');
    expect(getFillRolesHint('no_roles')).toBe('Add roles needed first');

    expect(getFillRolesState(positions, [{ role: 'vocals' }])).toBe('open');
    expect(getFillRolesHint('open')).toBeNull();

    expect(getFillRolesState(positions, [{ role: 'vocals' }, { role: 'vocals' }])).toBe(
      'all_filled',
    );
    expect(getFillRolesHint('all_filled')).toBe('All roles filled');
  });
});
