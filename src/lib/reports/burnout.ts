/**
 * Burnout / heavy-schedule flags for the reports page.
 *
 * A volunteer is flagged when they have at least one confirmed assignment in
 * `threshold` consecutive Monday–Sunday UTC weeks. This deliberately uses the
 * same UTC calendar convention as the reminder job and the Sunday "today" view,
 * so a `YYYY-MM-DD` service date never shifts because of a local timezone.
 *
 * The language here is intentionally calm: these are scheduling nudges, not a
 * medical diagnosis.
 */

export interface BurnoutService {
  id: string;
  /** Service date as `YYYY-MM-DD`. */
  date: string;
}

export interface BurnoutAssignment {
  service_id: string;
  team_member_id?: string | null;
  status?: string | null;
}

export interface BurnoutMember {
  id: string;
  name: string;
}

export interface BurnoutOptions {
  /** Consecutive weeks needed before a volunteer is flagged. */
  threshold?: number;
  /** Reference day for "current" weeks. Defaults to today. */
  asOf?: Date | string;
}

export interface BurnoutFlag {
  memberId: string;
  name: string;
  /** Number of consecutive weeks in the current streak. */
  streakWeeks: number;
  /** Monday keys (`YYYY-MM-DD`) for each week in the streak. */
  weekStarts: string[];
  /** Confirmed service dates inside the streak, ascending. */
  dates: string[];
}

/** Default number of consecutive weeks that triggers a calm heads-up. */
export const DEFAULT_BURNOUT_STREAK_WEEKS = 4;

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC day index for a date-only string, or a Date's UTC calendar day. */
function toUtcDayIndex(value: string | Date): number | null {
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime())
        ? null
        : Math.floor(parsed.getTime() / DAY_MS);
    }

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

  if (Number.isNaN(value.getTime())) return null;
  return Math.floor(value.getTime() / DAY_MS);
}

function dayIndexToKey(dayIndex: number): string {
  return new Date(dayIndex * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Monday (`YYYY-MM-DD`, UTC) for the week containing `date`.
 * Returns null for invalid input.
 */
export function getUtcWeekStart(date: string | Date): string | null {
  const dayIndex = toUtcDayIndex(date);
  if (dayIndex === null) return null;

  // getUTCDay: Sunday = 0 … Saturday = 6. Shift so Monday starts the week.
  const dayOfWeek = new Date(dayIndex * DAY_MS).getUTCDay();
  const mondayOffset = (dayOfWeek + 6) % 7;
  return dayIndexToKey(dayIndex - mondayOffset);
}

function asOfDateKey(asOf: Date | string): string | null {
  if (typeof asOf === 'string') {
    const dayIndex = toUtcDayIndex(asOf);
    return dayIndex === null ? null : dayIndexToKey(dayIndex);
  }

  if (Number.isNaN(asOf.getTime())) return null;
  return asOf.toISOString().slice(0, 10);
}

/**
 * Find volunteers whose current streak reaches the threshold. Future services
 * are ignored because they have not been served yet.
 */
export function computeBurnoutFlags(
  services: readonly BurnoutService[],
  assignments: readonly BurnoutAssignment[],
  members: readonly BurnoutMember[],
  options: BurnoutOptions = {}
): BurnoutFlag[] {
  const threshold =
    typeof options.threshold === 'number' && options.threshold > 0
      ? Math.floor(options.threshold)
      : DEFAULT_BURNOUT_STREAK_WEEKS;

  const reference = options.asOf ?? new Date();
  const asOfKey = asOfDateKey(reference);
  const asOfDay = asOfKey === null ? null : toUtcDayIndex(asOfKey);
  const currentWeek = asOfKey === null ? null : getUtcWeekStart(asOfKey);

  if (asOfDay === null || currentWeek === null) return [];

  const previousWeek = dayIndexToKey(toUtcDayIndex(currentWeek)! - 7);

  const serviceDateById = new Map<string, string>();
  for (const service of services) {
    const dayIndex = toUtcDayIndex(service.date);
    if (dayIndex === null) continue;
    serviceDateById.set(service.id, dayIndexToKey(dayIndex));
  }

  // Distinct confirmed service dates per member, limited to days already served.
  const datesByMember = new Map<string, Set<string>>();

  for (const assignment of assignments) {
    if (assignment.status !== 'confirmed') continue;

    const memberId = assignment.team_member_id;
    if (!memberId) continue;

    const serviceDate = serviceDateById.get(assignment.service_id);
    if (!serviceDate) continue;

    const serviceDay = toUtcDayIndex(serviceDate);
    if (serviceDay === null || serviceDay > asOfDay) continue;

    let dates = datesByMember.get(memberId);
    if (!dates) {
      dates = new Set<string>();
      datesByMember.set(memberId, dates);
    }
    dates.add(serviceDate);
  }

  const flags: BurnoutFlag[] = [];

  for (const member of members) {
    const servedDates = datesByMember.get(member.id);
    if (!servedDates || servedDates.size === 0) continue;

    const sortedDates = Array.from(servedDates).sort();
    const weekSet = new Set<string>();
    for (const date of sortedDates) {
      const week = getUtcWeekStart(date);
      if (week) weekSet.add(week);
    }

    const weeks = Array.from(weekSet).sort();
    const latestWeek = weeks[weeks.length - 1];

    // Only a streak that reaches the current or previous week is "current".
    // This keeps an old run from being flagged forever, while still allowing
    // a church that has not met yet this week.
    if (latestWeek !== currentWeek && latestWeek !== previousWeek) continue;

    let streakWeeks = 1;
    for (let i = weeks.length - 1; i > 0; i--) {
      const current = toUtcDayIndex(weeks[i]);
      const previous = toUtcDayIndex(weeks[i - 1]);
      if (current === null || previous === null) break;
      if (current - previous !== 7) break;
      streakWeeks++;
    }

    if (streakWeeks < threshold) continue;

    const streakWeekStarts = weeks.slice(weeks.length - streakWeeks);
    const streakWeekSet = new Set(streakWeekStarts);
    const streakDates = sortedDates.filter((date) => {
      const week = getUtcWeekStart(date);
      return week !== null && streakWeekSet.has(week);
    });

    flags.push({
      memberId: member.id,
      name: member.name,
      streakWeeks,
      weekStarts: streakWeekStarts,
      dates: streakDates,
    });
  }

  return flags.sort((a, b) => {
    if (b.streakWeeks !== a.streakWeeks) return b.streakWeeks - a.streakWeeks;
    return a.name.localeCompare(b.name);
  });
}

/** Calm one-line label, e.g. "Served 4 weeks in a row". */
export function formatBurnoutStreak(weeks: number): string {
  const count = Math.max(0, Math.round(weeks));
  return count === 1
    ? 'Served 1 week in a row'
    : `Served ${count} weeks in a row`;
}
