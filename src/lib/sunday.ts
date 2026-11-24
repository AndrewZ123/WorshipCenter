/**
 * Pure helpers for the Sunday-morning "today" view.
 *
 * Service dates are date-only `YYYY-MM-DD` strings. The reminder job compares
 * them with a UTC calendar key (`now.toISOString().slice(0, 10)`), so "today"
 * uses that same UTC convention here. That keeps this view and reminder emails
 * agreeing on which services are today, regardless of the viewer's local
 * timezone offset.
 */

export interface DateKeyed {
  date: string;
}

export interface Timed {
  time?: string | null;
}

export interface AssignmentStatusLike {
  status?: string | null;
}

export interface AssignmentStatusCounts {
  total: number;
  confirmed: number;
  declined: number;
  pending: number;
}

export interface RoleGroup<T> {
  role: string;
  label: string;
  assignments: T[];
}

const UNSPECIFIED_ROLE = 'Unspecified';

function dateKey(value: string | null | undefined): string {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

/** UTC calendar key for `now`, matching the reminder job. */
export function getTodayDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Services whose date matches `dateKey` (a `YYYY-MM-DD` string). */
export function getServicesForDate<T extends DateKeyed>(
  services: readonly T[],
  dateKeyValue: string
): T[] {
  const key = dateKey(dateKeyValue);
  if (!key) return [];
  return services.filter((service) => dateKey(service.date) === key);
}

/** Services dated today using the UTC convention shared with reminders. */
export function getTodaysServices<T extends DateKeyed>(
  services: readonly T[],
  now: Date = new Date()
): T[] {
  return getServicesForDate(services, getTodayDateKey(now));
}

/** Minutes after midnight for an `HH:mm` (or `HH:mm:ss`) time. */
export function getServiceTimeMinutes(
  time: string | null | undefined
): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec((time || '').trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/** Stable ascending sort by time; services without a usable time go last. */
export function sortServicesByTime<T extends Timed>(
  services: readonly T[]
): T[] {
  return [...services].sort((a, b) => {
    const aMinutes = getServiceTimeMinutes(a.time);
    const bMinutes = getServiceTimeMinutes(b.time);

    if (aMinutes === null && bMinutes === null) return 0;
    if (aMinutes === null) return 1;
    if (bMinutes === null) return -1;
    return aMinutes - bMinutes;
  });
}

/**
 * Pick the service to open by default: the next service time today, or the
 * first service when every time has already passed.
 */
export function pickDefaultTodayService<T extends DateKeyed & Timed>(
  services: readonly T[],
  now: Date = new Date()
): T | null {
  const sorted = sortServicesByTime(getTodaysServices(services, now));
  if (sorted.length === 0) return null;

  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const next = sorted.find((service) => {
    const minutes = getServiceTimeMinutes(service.time);
    return minutes !== null && minutes >= nowMinutes;
  });

  return next ?? sorted[0];
}

/** Earliest service strictly after today, used by the empty state. */
export function getNextUpcomingService<T extends DateKeyed & Timed>(
  services: readonly T[],
  now: Date = new Date()
): T | null {
  const today = getTodayDateKey(now);
  const upcoming = services.filter((service) => dateKey(service.date) > today);

  const sorted = [...upcoming].sort((a, b) => {
    const dateCompare = dateKey(a.date).localeCompare(dateKey(b.date));
    if (dateCompare !== 0) return dateCompare;

    const aMinutes = getServiceTimeMinutes(a.time);
    const bMinutes = getServiceTimeMinutes(b.time);
    if (aMinutes === null && bMinutes === null) return 0;
    if (aMinutes === null) return 1;
    if (bMinutes === null) return -1;
    return aMinutes - bMinutes;
  });

  return sorted[0] ?? null;
}

/** Count assignment responses. Anything not confirmed/declined is pending. */
export function countAssignmentStatuses(
  assignments: readonly AssignmentStatusLike[]
): AssignmentStatusCounts {
  const counts: AssignmentStatusCounts = {
    total: assignments.length,
    confirmed: 0,
    declined: 0,
    pending: 0,
  };

  for (const assignment of assignments) {
    if (assignment.status === 'confirmed') {
      counts.confirmed++;
    } else if (assignment.status === 'declined') {
      counts.declined++;
    } else {
      counts.pending++;
    }
  }

  return counts;
}

/** Human-readable label for a role slug such as `worship_leader`. */
export function formatRoleLabel(role: string): string {
  const trimmed = (role || '').trim();
  if (!trimmed) return UNSPECIFIED_ROLE;

  return trimmed
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Group assignments by role. Groups are sorted by label, while the order
 * inside a group is preserved so callers can sort people by name first.
 */
export function groupAssignmentsByRole<T extends AssignmentStatusLike & { role?: string | null }>(
  assignments: readonly T[]
): RoleGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const assignment of assignments) {
    const role = (assignment.role || '').trim() || UNSPECIFIED_ROLE;
    const list = groups.get(role);
    if (list) {
      list.push(assignment);
    } else {
      groups.set(role, [assignment]);
    }
  }

  return Array.from(groups.entries())
    .map(([role, list]) => ({
      role,
      label: formatRoleLabel(role),
      assignments: list,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
