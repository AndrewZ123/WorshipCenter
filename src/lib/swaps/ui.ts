/**
 * Client-safe swap UI helpers. These only decide whether a swap action should
 * be shown; the API still owns every permission and state rule.
 */

import type { AssignmentSwapStatus } from '@/lib/types';
import { isServiceInFuture } from './eligibility';

export interface SwapRequestAssignment {
  team_member_id?: string | null;
  team_member_user_id?: string | null;
  status?: string | null;
}

export interface SwapRequestVisibilityContext {
  currentUserId?: string | null;
  currentTeamMemberId?: string | null;
  serviceDate: string;
  serviceTime?: string | null;
  activeSwapStatus?: AssignmentSwapStatus | null;
  now?: Date;
}

export function isOwnAssignment(
  assignment: SwapRequestAssignment,
  currentUserId?: string | null,
  currentTeamMemberId?: string | null,
): boolean {
  if (!currentUserId && !currentTeamMemberId) return false;

  if (
    assignment.team_member_user_id &&
    currentUserId &&
    assignment.team_member_user_id === currentUserId
  ) {
    return true;
  }

  return Boolean(
    assignment.team_member_id &&
      currentTeamMemberId &&
      assignment.team_member_id === currentTeamMemberId,
  );
}

export function hasActiveSwap(status?: AssignmentSwapStatus | null): boolean {
  return status === 'open' || status === 'claimed';
}

/**
 * Show "Request swap" only for the volunteer's own, still-upcoming assignment
 * that has not been declined and does not already have an open/claimed swap.
 */
export function shouldShowSwapRequest(
  assignment: SwapRequestAssignment,
  context: SwapRequestVisibilityContext,
): boolean {
  if (
    !isOwnAssignment(
      assignment,
      context.currentUserId,
      context.currentTeamMemberId,
    )
  ) {
    return false;
  }

  if (assignment.status === 'declined') return false;
  if (hasActiveSwap(context.activeSwapStatus)) return false;

  return isServiceInFuture(
    context.serviceDate,
    context.serviceTime,
    context.now ?? new Date(),
  );
}

export function findActiveSwapForAssignment<
  T extends { assignment_id: string; status: AssignmentSwapStatus },
>(swaps: T[], assignmentId: string): T | undefined {
  return swaps.find(
    (swap) =>
      swap.assignment_id === assignmentId && hasActiveSwap(swap.status),
  );
}
