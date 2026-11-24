/**
 * Volunteer attendance / serve-frequency helpers for the reports page.
 *
 * Pure and framework-free: callers pass services, assignments and members that
 * are already scoped to one church and date range. No contact details are
 * exposed here — only member names.
 */

export interface AttendanceService {
  id: string;
  /** Service date as `YYYY-MM-DD`. */
  date: string;
}

export interface AttendanceAssignment {
  service_id: string;
  team_member_id?: string | null;
  status?: string | null;
}

export interface AttendanceMember {
  id: string;
  name: string;
}

export interface AttendanceOptions {
  /**
   * Only confirmed assignments on or before this day count as "served".
   * Future confirmed assignments still count in the assignment tallies, but
   * they cannot inflate serve-frequency or gap numbers.
   */
  asOf?: Date;
}

export interface MemberAttendance {
  memberId: string;
  name: string;
  assignments: number;
  confirmed: number;
  declined: number;
  pending: number;
  /** 0–100, rounded like the existing reports summary cards. */
  confirmationRate: number;
  /** Distinct service dates with a confirmed assignment (on or before asOf). */
  servedDateCount: number;
  servedDates: string[];
  /** Distinct service dates in the range, for "served 8 of 12" text. */
  totalServiceDates: number;
  /** Average days between served dates, rounded; null with fewer than two. */
  averageGapDays: number | null;
}

export type AttendanceSortKey =
  | 'name'
  | 'assignments'
  | 'confirmed'
  | 'declined'
  | 'pending'
  | 'confirmationRate'
  | 'servedDateCount'
  | 'averageGapDays';

export type SortDirection = 'asc' | 'desc';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse a date-only value into a UTC day index, or null when invalid. */
function toDayIndex(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const date = new Date(utc);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return Math.floor(utc / DAY_MS);
}

function toDateKey(value: string): string | null {
  if (toDayIndex(value) === null) return null;
  return value.slice(0, 10);
}

function averageGapDays(dates: readonly string[]): number | null {
  if (dates.length < 2) return null;

  let total = 0;
  for (let i = 1; i < dates.length; i++) {
    const previous = toDayIndex(dates[i - 1]);
    const current = toDayIndex(dates[i]);
    if (previous === null || current === null) return null;
    total += current - previous;
  }

  return Math.round(total / (dates.length - 1));
}

interface MemberAccumulator {
  assignments: number;
  confirmed: number;
  declined: number;
  pending: number;
  servedDates: Set<string>;
}

/**
 * Build one row per team member who had at least one assignment in the range.
 * Anything that is not confirmed/declined is treated as pending, matching the
 * rest of the reports page.
 */
export function buildAttendanceReport(
  services: readonly AttendanceService[],
  assignments: readonly AttendanceAssignment[],
  members: readonly AttendanceMember[],
  options: AttendanceOptions = {}
): MemberAttendance[] {
  const serviceDateById = new Map<string, string>();
  const totalServiceDates = new Set<string>();
  const asOfDay = options.asOf
    ? toDayIndex(options.asOf.toISOString().slice(0, 10))
    : null;

  for (const service of services) {
    const date = toDateKey(service.date);
    if (!date) continue;

    serviceDateById.set(service.id, date);
    const day = toDayIndex(date);
    if (asOfDay === null || (day !== null && day <= asOfDay)) {
      totalServiceDates.add(date);
    }
  }

  const byMember = new Map<string, MemberAccumulator>();

  for (const assignment of assignments) {
    const memberId = assignment.team_member_id;
    if (!memberId) continue;

    const serviceDate = serviceDateById.get(assignment.service_id);
    if (!serviceDate) continue;

    let accumulator = byMember.get(memberId);
    if (!accumulator) {
      accumulator = {
        assignments: 0,
        confirmed: 0,
        declined: 0,
        pending: 0,
        servedDates: new Set<string>(),
      };
      byMember.set(memberId, accumulator);
    }

    accumulator.assignments++;

    if (assignment.status === 'confirmed') {
      accumulator.confirmed++;
      const day = toDayIndex(serviceDate);
      if (asOfDay === null || (day !== null && day <= asOfDay)) {
        accumulator.servedDates.add(serviceDate);
      }
    } else if (assignment.status === 'declined') {
      accumulator.declined++;
    } else {
      accumulator.pending++;
    }
  }

  const rows: MemberAttendance[] = [];

  for (const member of members) {
    const accumulator = byMember.get(member.id);
    if (!accumulator) continue;

    const servedDates = Array.from(accumulator.servedDates).sort();

    rows.push({
      memberId: member.id,
      name: member.name,
      assignments: accumulator.assignments,
      confirmed: accumulator.confirmed,
      declined: accumulator.declined,
      pending: accumulator.pending,
      confirmationRate:
        accumulator.assignments > 0
          ? Math.round((accumulator.confirmed / accumulator.assignments) * 100)
          : 0,
      servedDateCount: servedDates.length,
      servedDates,
      totalServiceDates: totalServiceDates.size,
      averageGapDays: averageGapDays(servedDates),
    });
  }

  return sortAttendanceRows(rows, 'servedDateCount', 'desc');
}

/**
 * Sort attendance rows without mutating the input. Missing values (such as an
 * average gap with fewer than two served dates) always sort last.
 */
export function sortAttendanceRows(
  rows: readonly MemberAttendance[],
  key: AttendanceSortKey = 'servedDateCount',
  direction: SortDirection = 'desc'
): MemberAttendance[] {
  return [...rows].sort((a, b) => {
    if (key === 'name') {
      const byName = a.name.localeCompare(b.name);
      return direction === 'asc' ? byName : -byName;
    }

    const aValue = a[key];
    const bValue = b[key];

    if (aValue === null && bValue === null) {
      return a.name.localeCompare(b.name);
    }
    if (aValue === null) return 1;
    if (bValue === null) return -1;

    const difference = aValue - bValue;
    if (difference !== 0) {
      return direction === 'asc' ? difference : -difference;
    }

    return a.name.localeCompare(b.name);
  });
}

/** Understandable frequency line, e.g. "Served 8 of 12 service dates". */
export function formatServedFrequency(
  row: Pick<MemberAttendance, 'servedDateCount' | 'totalServiceDates'>
): string {
  if (row.totalServiceDates === 0) return 'No service dates in range';

  const noun = row.totalServiceDates === 1 ? 'service date' : 'service dates';
  return `Served ${row.servedDateCount} of ${row.totalServiceDates} ${noun}`;
}
