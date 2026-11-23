import { describe, expect, it } from 'vitest';
import {
  canMarkServiceCompleted,
  classifyServiceStatus,
  countServiceStatuses,
  getServiceBadgeStatus,
  getServiceEditorStatus,
  getServiceStatusLabel,
} from './service-status';

const now = new Date('2026-06-15T12:00:00.000Z');

describe('classifyServiceStatus', () => {
  it('never buckets a future completed service as completed', () => {
    expect(
      classifyServiceStatus({ status: 'completed', date: '2026-07-01' }, now)
    ).toBe('upcomingPlanned');
    expect(
      getServiceBadgeStatus({ status: 'completed', date: '2026-07-01' }, now)
    ).toBe('draft');
  });

  it('treats a service dated today as upcoming, not completed', () => {
    expect(
      classifyServiceStatus({ status: 'completed', date: '2026-06-15' }, now)
    ).toBe('upcomingPlanned');
    expect(
      classifyServiceStatus({ status: 'finalized', date: '2026-06-15' }, now)
    ).toBe('upcomingFinalized');
  });

  it('counts future draft services as upcoming planned and past drafts as past', () => {
    expect(
      classifyServiceStatus({ status: 'draft', date: '2026-07-01' }, now)
    ).toBe('upcomingPlanned');
    expect(
      classifyServiceStatus({ status: 'draft', date: '2026-05-01' }, now)
    ).toBe('past');
  });

  it('counts future finalized services as upcoming finalized', () => {
    expect(
      classifyServiceStatus({ status: 'finalized', date: '2026-07-01' }, now)
    ).toBe('upcomingFinalized');
    expect(
      getServiceBadgeStatus({ status: 'finalized', date: '2026-07-01' }, now)
    ).toBe('finalized');
  });

  it('only marks past services completed when their status is completed', () => {
    expect(
      classifyServiceStatus({ status: 'completed', date: '2026-05-01' }, now)
    ).toBe('completed');
    expect(
      getServiceBadgeStatus({ status: 'completed', date: '2026-05-01' }, now)
    ).toBe('completed');
    expect(
      classifyServiceStatus({ status: 'finalized', date: '2026-05-01' }, now)
    ).toBe('past');
  });

  it('compares date-only strings as calendar dates, not UTC instants', () => {
    // A late-evening local `now` must not push tomorrow's service into the past.
    const lateNow = new Date(2026, 5, 15, 23, 30, 0);
    expect(
      classifyServiceStatus({ status: 'completed', date: '2026-06-16' }, lateNow)
    ).toBe('upcomingPlanned');
  });
});

describe('getServiceEditorStatus', () => {
  it('opens a future completed service as Draft', () => {
    expect(
      getServiceEditorStatus({ status: 'completed', date: '2026-07-01' }, now)
    ).toBe('draft');
  });

  it('opens a service dated today as Draft when its row says completed', () => {
    expect(
      getServiceEditorStatus({ status: 'completed', date: '2026-06-15' }, now)
    ).toBe('draft');
  });

  it('keeps finalized and past completed statuses', () => {
    expect(
      getServiceEditorStatus({ status: 'finalized', date: '2026-07-01' }, now)
    ).toBe('finalized');
    expect(
      getServiceEditorStatus({ status: 'completed', date: '2026-05-01' }, now)
    ).toBe('completed');
  });
});

describe('canMarkServiceCompleted', () => {
  it('only allows Completed for services before today', () => {
    expect(canMarkServiceCompleted('2026-06-14', now)).toBe(true);
    expect(canMarkServiceCompleted('2026-06-15', now)).toBe(false);
    expect(canMarkServiceCompleted('2026-06-16', now)).toBe(false);
  });
});

describe('getServiceStatusLabel', () => {
  it('uses the same label for app and public share pages', () => {
    expect(getServiceStatusLabel(getServiceBadgeStatus(
      { status: 'completed', date: '2026-07-01' },
      now
    ))).toBe('Draft');
    expect(getServiceStatusLabel('finalized')).toBe('Finalized');
    expect(getServiceStatusLabel('completed')).toBe('Completed');
  });
});

describe('countServiceStatuses', () => {
  it('keeps a single future draft service planned so the report totals add up', () => {
    const counts = countServiceStatuses(
      [{ status: 'completed', date: '2026-06-21' }],
      now
    );

    expect(counts).toEqual({
      completed: 0,
      past: 0,
      upcomingPlanned: 1,
      upcomingFinalized: 0,
    });
  });

  it('does not put future completed services in the completed or past buckets', () => {
    const counts = countServiceStatuses(
      [
        { status: 'completed', date: '2026-07-01' },
        { status: 'draft', date: '2026-07-02' },
        { status: 'finalized', date: '2026-07-03' },
        { status: 'finalized', date: '2026-01-01' },
        { status: 'completed', date: '2026-02-01' },
      ],
      now
    );

    expect(counts).toEqual({
      completed: 1,
      past: 1,
      upcomingPlanned: 2,
      upcomingFinalized: 1,
    });
  });
});
