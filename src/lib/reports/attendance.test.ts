import { describe, expect, it } from 'vitest';
import {
  buildAttendanceReport,
  formatServedFrequency,
  sortAttendanceRows,
  type AttendanceAssignment,
  type AttendanceMember,
  type AttendanceService,
  type MemberAttendance,
} from './attendance';

const members: AttendanceMember[] = [
  { id: 'm1', name: 'Ada Example' },
  { id: 'm2', name: 'Grace Example' },
  { id: 'm3', name: 'Unassigned Example' },
];

const services: AttendanceService[] = [
  { id: 's1', date: '2026-11-01' },
  { id: 's2', date: '2026-11-08' },
  { id: 's3', date: '2026-11-15' },
  { id: 's4', date: '2026-11-22' },
  { id: 's4b', date: '2026-11-22' },
  { id: 'future', date: '2026-12-06' },
];

const assignments: AttendanceAssignment[] = [
  { service_id: 's1', team_member_id: 'm1', status: 'confirmed' },
  { service_id: 's2', team_member_id: 'm1', status: 'confirmed' },
  { service_id: 's3', team_member_id: 'm1', status: 'declined' },
  { service_id: 's4', team_member_id: 'm1', status: 'confirmed' },
  { service_id: 's4b', team_member_id: 'm1', status: 'confirmed' },
  { service_id: 'future', team_member_id: 'm1', status: 'confirmed' },
  { service_id: 's1', team_member_id: 'm2', status: 'pending' },
  { service_id: 's2', team_member_id: 'm2', status: 'confirmed' },
  { service_id: 's3', team_member_id: 'm2', status: 'confirmed' },
  { service_id: 's1', team_member_id: null, status: 'confirmed' },
];

function rowFor(rows: MemberAttendance[], name: string): MemberAttendance {
  const row = rows.find((candidate) => candidate.name === name);
  if (!row) throw new Error(`Missing attendance row for ${name}`);
  return row;
}

describe('buildAttendanceReport', () => {
  const asOf = new Date('2026-11-24T12:00:00Z');
  const rows = buildAttendanceReport(services, assignments, members, { asOf });

  it('tallies statuses per member and ignores unassigned rows', () => {
    const ada = rowFor(rows, 'Ada Example');
    expect(ada.assignments).toBe(6);
    expect(ada.confirmed).toBe(5);
    expect(ada.declined).toBe(1);
    expect(ada.pending).toBe(0);
    expect(ada.confirmationRate).toBe(83);

    const grace = rowFor(rows, 'Grace Example');
    expect(grace.assignments).toBe(3);
    expect(grace.confirmed).toBe(2);
    expect(grace.declined).toBe(0);
    expect(grace.pending).toBe(1);
    expect(grace.confirmationRate).toBe(67);

    expect(rows.map((row) => row.name)).not.toContain('Unassigned Example');
  });

  it('counts distinct served dates, not assignment rows', () => {
    const ada = rowFor(rows, 'Ada Example');
    // Two services on 2026-11-22 count once; the future service is not served.
    expect(ada.servedDates).toEqual([
      '2026-11-01',
      '2026-11-08',
      '2026-11-22',
    ]);
    expect(ada.servedDateCount).toBe(3);
    expect(ada.totalServiceDates).toBe(4);
  });

  it('computes a rounded average gap between served dates', () => {
    const ada = rowFor(rows, 'Ada Example');
    // 7 days + 14 days across two gaps = 10.5, rounded to 11.
    expect(ada.averageGapDays).toBe(11);

    const grace = rowFor(rows, 'Grace Example');
    expect(grace.averageGapDays).toBe(7);
  });

  it('returns null for gap and averages when fewer than two dates were served', () => {
    const report = buildAttendanceReport(
      services,
      [{ service_id: 's1', team_member_id: 'm1', status: 'confirmed' }],
      members,
      { asOf }
    );

    expect(rowFor(report, 'Ada Example').averageGapDays).toBeNull();
  });

  it('can count future confirmed dates when no asOf is supplied', () => {
    const allRows = buildAttendanceReport(services, assignments, members);
    const ada = rowFor(allRows, 'Ada Example');

    expect(ada.servedDateCount).toBe(4);
    expect(ada.totalServiceDates).toBe(5);
    expect(formatServedFrequency(ada)).toBe('Served 4 of 5 service dates');
  });

  it('formats a clear served-of-total line', () => {
    expect(formatServedFrequency({ servedDateCount: 8, totalServiceDates: 12 }))
      .toBe('Served 8 of 12 service dates');
    expect(formatServedFrequency({ servedDateCount: 1, totalServiceDates: 1 }))
      .toBe('Served 1 of 1 service date');
    expect(formatServedFrequency({ servedDateCount: 0, totalServiceDates: 0 }))
      .toBe('No service dates in range');
  });
});

describe('sortAttendanceRows', () => {
  const base: MemberAttendance = {
    memberId: 'base',
    name: 'Base Example',
    assignments: 1,
    confirmed: 1,
    declined: 0,
    pending: 0,
    confirmationRate: 100,
    servedDateCount: 1,
    servedDates: ['2026-11-01'],
    totalServiceDates: 4,
    averageGapDays: null,
  };

  const rows: MemberAttendance[] = [
    { ...base, memberId: 'a', name: 'Ada Example', servedDateCount: 3, averageGapDays: 11 },
    { ...base, memberId: 'b', name: 'Grace Example', servedDateCount: 1, averageGapDays: 7 },
    { ...base, memberId: 'c', name: 'Ruth Example', servedDateCount: 2, averageGapDays: null },
  ];

  it('sorts numeric columns and keeps nulls last in both directions', () => {
    expect(sortAttendanceRows(rows, 'servedDateCount', 'desc').map((r) => r.name))
      .toEqual(['Ada Example', 'Ruth Example', 'Grace Example']);
    expect(sortAttendanceRows(rows, 'averageGapDays', 'asc').map((r) => r.name))
      .toEqual(['Grace Example', 'Ada Example', 'Ruth Example']);
    expect(sortAttendanceRows(rows, 'averageGapDays', 'desc').map((r) => r.name))
      .toEqual(['Ada Example', 'Grace Example', 'Ruth Example']);
  });

  it('sorts by name and does not mutate the input', () => {
    const original = [...rows];
    expect(sortAttendanceRows(rows, 'name', 'asc').map((r) => r.name))
      .toEqual(['Ada Example', 'Grace Example', 'Ruth Example']);
    expect(rows).toEqual(original);
  });
});
