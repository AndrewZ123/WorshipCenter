import { describe, expect, it } from 'vitest';
import {
  formatRelativeDate,
  formatServiceDate,
  formatTime,
  isFutureCalendarDate,
  isTodayOrFutureCalendarDate,
} from './formatDate';

const now = new Date(2026, 5, 15, 12, 0, 0); // June 15, 2026 local

describe('formatRelativeDate', () => {
  it('describes a date 6 days in the future', () => {
    expect(formatRelativeDate('2026-06-21', now)).toBe('in 6 days');
    expect(formatRelativeDate('2026-06-16', now)).toBe('Tomorrow');
    expect(formatRelativeDate('2026-06-22', now)).toBe('in 1 week');
  });

  it('describes a date 6 days in the past', () => {
    expect(formatRelativeDate('2026-06-09', now)).toBe('6 days ago');
    expect(formatRelativeDate('2026-06-14', now)).toBe('Yesterday');
    expect(formatRelativeDate('2026-06-08', now)).toBe('1 week ago');
  });

  it('handles today', () => {
    expect(formatRelativeDate('2026-06-15', now)).toBe('Today');
  });
});

describe('calendar date comparison', () => {
  it('compares date-only strings as calendar dates', () => {
    expect(isFutureCalendarDate('2026-06-16', now)).toBe(true);
    expect(isFutureCalendarDate('2026-06-15', now)).toBe(false);
    expect(isTodayOrFutureCalendarDate('2026-06-15', now)).toBe(true);
    expect(isTodayOrFutureCalendarDate('2026-06-14', now)).toBe(false);
  });
});

describe('formatTime', () => {
  it('strips seconds from service times', () => {
    expect(formatTime('09:00:00')).toBe('9:00 AM');
    expect(formatTime('09:00:00')).not.toContain(':00:00');
  });

  it('formats service dates with a stripped time', () => {
    expect(formatServiceDate('2026-11-29', '09:00:00')).toBe(
      'Sunday, November 29 · 9:00 AM'
    );
  });

  it('omits the time when none is given so cards can show it once', () => {
    expect(formatServiceDate('2026-11-29')).toBe('Sunday, November 29');
    expect(formatServiceDate('2026-11-29')).not.toContain('9:00');
  });
});
