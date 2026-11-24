import { describe, expect, it } from 'vitest';
import {
  countAssignmentStatuses,
  getNextUpcomingService,
  getServicesForDate,
  getSundayFocusService,
  getTodaysServices,
  groupAssignmentsByRole,
  pickDefaultTodayService,
  sortServicesByTime,
} from './sunday';

const SUNDAY = '2026-11-29';

const services = [
  { id: 'late', title: 'Late Gathering', date: SUNDAY, time: '13:00' },
  { id: 'early', title: 'First Gathering', date: SUNDAY, time: '09:00' },
  { id: 'mid', title: 'Second Gathering', date: SUNDAY, time: '11:00' },
  { id: 'next-week', title: 'Next Sunday', date: '2026-12-06', time: '09:00' },
  { id: 'saturday', title: 'Saturday Service', date: '2026-11-28', time: '18:00' },
];

describe('Sunday morning service helpers', () => {
  it('matches services by calendar date without timezone shifts', () => {
    const matches = getServicesForDate(services, SUNDAY);
    expect(matches.map((service) => service.id)).toEqual(['late', 'early', 'mid']);
  });

  it('finds today using the UTC date key shared with reminders', () => {
    const now = new Date(`${SUNDAY}T10:30:00Z`);
    expect(getTodaysServices(services, now).map((service) => service.id)).toEqual([
      'late',
      'early',
      'mid',
    ]);
  });

  it('does not include yesterday or next week in today', () => {
    const now = new Date(`${SUNDAY}T10:30:00Z`);
    const ids = getTodaysServices(services, now).map((service) => service.id);
    expect(ids).not.toContain('saturday');
    expect(ids).not.toContain('next-week');
  });

  it('sorts services by time and puts missing times last', () => {
    const sorted = sortServicesByTime([
      { id: 'unknown', time: null },
      { id: 'afternoon', time: '15:00' },
      { id: 'morning', time: '09:00' },
    ]);
    expect(sorted.map((service) => service.id)).toEqual([
      'morning',
      'afternoon',
      'unknown',
    ]);
  });

  it('defaults to the next service time today', () => {
    const now = new Date(`${SUNDAY}T10:30:00Z`);
    expect(pickDefaultTodayService(services, now)?.id).toBe('mid');
  });

  it('falls back to the first service once every time has passed', () => {
    const now = new Date(`${SUNDAY}T14:30:00Z`);
    expect(pickDefaultTodayService(services, now)?.id).toBe('early');
  });

  it('returns null when there are no services to pick from', () => {
    expect(pickDefaultTodayService([], new Date(`${SUNDAY}T10:30:00Z`))).toBeNull();
  });

  it('finds the earliest upcoming service for the empty state', () => {
    const now = new Date(`${SUNDAY}T10:30:00Z`);
    expect(getNextUpcomingService(services, now)?.id).toBe('next-week');
  });

  it('focuses today’s default pick when there is a service today', () => {
    const now = new Date(`${SUNDAY}T10:30:00Z`);
    expect(getSundayFocusService(services, now)?.id).toBe('mid');
  });

  it('focuses the earliest upcoming service when today is empty', () => {
    const monday = new Date('2026-11-30T09:00:00Z');
    expect(getSundayFocusService(services, monday)?.id).toBe('next-week');
  });

  it('picks the nearest upcoming date before considering time', () => {
    const monday = new Date('2026-11-30T09:00:00Z');
    const schedule = [
      { id: 'later', title: 'Later Sunday', date: '2026-12-13', time: '09:00' },
      { id: 'sooner-late', title: 'Sooner Late', date: '2026-12-06', time: '17:00' },
      { id: 'sooner-early', title: 'Sooner Early', date: '2026-12-06', time: '08:00' },
    ];

    expect(getSundayFocusService(schedule, monday)?.id).toBe('sooner-early');
  });

  it('returns null when there is no service today or upcoming', () => {
    const monday = new Date('2026-11-30T09:00:00Z');
    expect(getSundayFocusService([], monday)).toBeNull();
    expect(
      getSundayFocusService(
        [{ id: 'past', title: 'Past Service', date: '2026-11-22', time: '09:00' }],
        monday
      )
    ).toBeNull();
  });

  it('counts confirmed, declined, and pending responses', () => {
    const counts = countAssignmentStatuses([
      { status: 'confirmed' },
      { status: 'confirmed' },
      { status: 'declined' },
      { status: 'pending' },
      { status: null },
    ]);

    expect(counts).toEqual({
      total: 5,
      confirmed: 2,
      declined: 1,
      pending: 2,
    });
  });

  it('groups assignments by role and formats role labels', () => {
    const groups = groupAssignmentsByRole([
      { name: 'Alex Example', role: 'worship_leader', status: 'confirmed' },
      { name: 'Jordan Sample', role: 'vocals', status: 'pending' },
      { name: 'Casey Placeholder', role: 'worship_leader', status: 'declined' },
      { name: 'Riley Fictional', role: '', status: 'pending' },
    ]);

    expect(groups.map((group) => group.label)).toEqual([
      'Unspecified',
      'Vocals',
      'Worship Leader',
    ]);

    const leaders = groups.find((group) => group.role === 'worship_leader');
    expect(leaders?.assignments.map((assignment) => assignment.name)).toEqual([
      'Alex Example',
      'Casey Placeholder',
    ]);

    const unspecified = groups.find((group) => group.role === 'Unspecified');
    expect(unspecified?.label).toBe('Unspecified');
  });

  it('returns an empty grouping for an empty schedule', () => {
    expect(groupAssignmentsByRole([])).toEqual([]);
  });
});
