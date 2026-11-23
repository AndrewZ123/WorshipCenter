import { getCalendarDayIndex } from './formatDate';

export interface SongUsageDateSummary {
  /** Most recent usage dated today or in the past. */
  lastUsed: string | null;
  /** Nearest scheduled usage dated after today. */
  nextScheduled: string | null;
}

/**
 * Split song-usage dates into “last used” (today/past) and “next scheduled”
 * (future). A future service date must never be labelled as a past usage.
 */
export function summarizeSongUsageDates(
  dates: Array<string | Date>,
  now: Date = new Date()
): SongUsageDateSummary {
  const today = getCalendarDayIndex(now);
  let lastUsed: string | null = null;
  let lastUsedDay = -Infinity;
  let nextScheduled: string | null = null;
  let nextScheduledDay = Infinity;

  for (const date of dates) {
    const day = getCalendarDayIndex(date);
    if (day === null || today === null) continue;
    const display = typeof date === 'string' ? date : date.toISOString();

    if (day > today) {
      if (day < nextScheduledDay) {
        nextScheduledDay = day;
        nextScheduled = display;
      }
    } else if (day > lastUsedDay) {
      lastUsedDay = day;
      lastUsed = display;
    }
  }

  return { lastUsed, nextScheduled };
}
