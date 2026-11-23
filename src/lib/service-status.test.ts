import { describe, expect, it } from 'vitest';
import { classifyServiceStatus, countServiceStatuses } from './service-status';

const now = new Date('2026-06-15T12:00:00.000Z');

describe('classifyServiceStatus', () => {
  it('counts a future-dated completed service as completed, not planned', () => {
    expect(
      classifyServiceStatus({ status: 'completed', date: '2026-07-01' }, now)
    ).toBe('completed');
  });

  it('counts only future draft services as upcoming planned', () => {
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
  });
});

describe('countServiceStatuses', () => {
  it('does not put future completed services in an upcoming bucket', () => {
    const counts = countServiceStatuses(
      [
        { status: 'completed', date: '2026-07-01' },
        { status: 'draft', date: '2026-07-02' },
        { status: 'finalized', date: '2026-07-03' },
        { status: 'finalized', date: '2026-01-01' },
      ],
      now
    );

    expect(counts).toEqual({
      completed: 1,
      past: 1,
      upcomingPlanned: 1,
      upcomingFinalized: 1,
    });
  });
});
