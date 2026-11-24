/**
 * Client-safe grouping for "My swap requests".
 *
 * Active requests and recently resolved ones stay in the main list; cancelled
 * requests and anything resolved more than a week ago move under History.
 */

import type { AssignmentSwapStatus } from '@/lib/types';

export const RECENT_SWAP_MS = 7 * 24 * 60 * 60 * 1000;

export interface GroupableSwap {
  status: AssignmentSwapStatus;
  created_at?: string | null;
  updated_at?: string | null;
  resolved_at?: string | null;
}

export interface GroupedSwaps<T> {
  current: T[];
  history: T[];
}

function resolvedTimestamp(swap: GroupableSwap): number {
  const value = swap.resolved_at || swap.updated_at || swap.created_at;
  if (!value) return Number.NaN;
  return Date.parse(value);
}

export function groupMySwapRequests<T extends GroupableSwap>(
  swaps: T[],
  now: Date = new Date(),
): GroupedSwaps<T> {
  const cutoff = now.getTime() - RECENT_SWAP_MS;

  return swaps.reduce<GroupedSwaps<T>>(
    (groups, swap) => {
      if (swap.status === 'open' || swap.status === 'claimed') {
        groups.current.push(swap);
        return groups;
      }

      if (swap.status === 'cancelled') {
        groups.history.push(swap);
        return groups;
      }

      const resolvedAt = resolvedTimestamp(swap);
      if (Number.isFinite(resolvedAt) && resolvedAt >= cutoff) {
        groups.current.push(swap);
      } else {
        groups.history.push(swap);
      }

      return groups;
    },
    { current: [], history: [] },
  );
}
