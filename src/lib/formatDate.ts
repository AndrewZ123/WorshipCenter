/**
 * Global date/time formatting utilities
 * All dates in the app should use these formatters
 */

/**
 * Convert a date (or `YYYY-MM-DD` string) to a timezone-safe calendar-day
 * index. Date-only strings are read as calendar dates instead of UTC
 * instants, so a service on `2026-11-29` never shifts to the previous day.
 *
 * Returns null for invalid input.
 */
export function getCalendarDayIndex(date: Date | string): number | null {
  if (typeof date === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (dateOnly) {
      return Date.UTC(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3])
      ) / (1000 * 60 * 60 * 24);
    }
  }

  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;

  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) /
    (1000 * 60 * 60 * 24);
}

/** True when the date is strictly after today (calendar-day comparison). */
export function isFutureCalendarDate(
  date: Date | string,
  now: Date = new Date()
): boolean {
  const day = getCalendarDayIndex(date);
  const today = getCalendarDayIndex(now);
  return day !== null && today !== null && day > today;
}

/** True when the date is today or later (calendar-day comparison). */
export function isTodayOrFutureCalendarDate(
  date: Date | string,
  now: Date = new Date()
): boolean {
  const day = getCalendarDayIndex(date);
  const today = getCalendarDayIndex(now);
  return day !== null && today !== null && day >= today;
}

/**
 * Format a service date with day of week and time
 * Output: "Sunday, March 23 · 9:00 AM"
 */
export function formatServiceDate(date: Date | string, time?: string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  
  const dateStr = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  
  if (time) {
    // Parse time string (e.g., "09:00") and format it
    const [hours, minutes] = time.split(':').map(Number);
    const timeDate = new Date();
    timeDate.setHours(hours, minutes || 0);
    const timeStr = timeDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateStr} · ${timeStr}`;
  }
  
  return dateStr;
}

/**
 * Format a relative date
 * Output: "Today", "Tomorrow", "in 6 days", "Yesterday", "3 days ago",
 * "2 weeks ago"
 */
export function formatRelativeDate(
  date: Date | string,
  now: Date = new Date()
): string {
  const day = getCalendarDayIndex(date);
  const today = getCalendarDayIndex(now);
  if (day === null || today === null) {
    return typeof date === 'string' ? date : '';
  }

  // Positive when the date is in the past.
  const diffDays = today - day;

  if (diffDays === 0) return 'Today';

  if (diffDays > 0) {
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return '1 week ago';
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    if (diffDays < 60) return '1 month ago';
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }

    const years = Math.floor(diffDays / 365);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  }

  // Future dates: never render "-6 days ago".
  const futureDays = Math.abs(diffDays);
  if (futureDays === 1) return 'Tomorrow';
  if (futureDays < 7) return `in ${futureDays} days`;
  if (futureDays < 14) return 'in 1 week';
  if (futureDays < 30) {
    const weeks = Math.floor(futureDays / 7);
    return `in ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  if (futureDays < 60) return 'in 1 month';
  if (futureDays < 365) {
    const months = Math.floor(futureDays / 30);
    return `in ${months} ${months === 1 ? 'month' : 'months'}`;
  }

  const years = Math.floor(futureDays / 365);
  return `in ${years} ${years === 1 ? 'year' : 'years'}`;
}

/**
 * Format a short date
 * Output: "Mar 23"
 */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time only (no seconds)
 * Output: "9:00 AM"
 */
export function formatTime(time: string): string {
  if (!time) return '';
  
  const [hours, minutes] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(hours, minutes || 0);
  
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get time-based greeting
 * Output: "Good morning", "Good afternoon", "Good evening"
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Format full date with day of week
 * Output: "Monday, March 16"
 */
export function formatFullDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format date for display in compact cards
 * Output: "Sun, Mar 23"
 */
export function formatCompactDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}