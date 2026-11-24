import { describe, expect, it } from 'vitest';
import { groupMySwapRequests, RECENT_SWAP_MS } from './history';
import type { AssignmentSwapStatus } from '@/lib/types';

function swap(
  id: string,
  status: AssignmentSwapStatus,
  resolvedAt: string | null = null,
) {
  return {
    id,
    status,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: resolvedAt,
    resolved_at: resolvedAt,
  };
}

describe('groupMySwapRequests', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');
  const recent = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const old = new Date(now.getTime() - RECENT_SWAP_MS - 60_000).toISOString();

  it('keeps active requests in the current list', () => {
    const grouped = groupMySwapRequests(
      [swap('open', 'open'), swap('claimed', 'claimed')],
      now,
    );

    expect(grouped.current.map((item) => item.id)).toEqual(['open', 'claimed']);
    expect(grouped.history).toEqual([]);
  });

  it('keeps approved and declined requests from the last 7 days', () => {
    const grouped = groupMySwapRequests(
      [swap('approved', 'approved', recent), swap('declined', 'declined', recent)],
      now,
    );

    expect(grouped.current.map((item) => item.id)).toEqual(['approved', 'declined']);
    expect(grouped.history).toEqual([]);
  });

  it('moves cancellations and older resolved requests to history', () => {
    const grouped = groupMySwapRequests(
      [
        swap('cancelled', 'cancelled', recent),
        swap('old-approved', 'approved', old),
        swap('old-declined', 'declined', old),
      ],
      now,
    );

    expect(grouped.current).toEqual([]);
    expect(grouped.history.map((item) => item.id)).toEqual([
      'cancelled',
      'old-approved',
      'old-declined',
    ]);
  });

  it('falls back to created_at when a resolved timestamp is missing', () => {
    const grouped = groupMySwapRequests(
      [{ id: 'no-date', status: 'approved' }],
      new Date('2026-06-15T12:00:00.000Z'),
    );

    expect(grouped.current).toEqual([]);
    expect(grouped.history.map((item) => item.id)).toEqual(['no-date']);
  });
});
