/**
 * Pure swap-claim qualification rules.
 *
 * A teammate may claim a swap only when they are in the same church, hold the
 * assignment's role, are not blocked out on the service date, and are not
 * already serving that service or another service that same date.
 *
 * No database access here so the rules stay easy to test and reuse.
 */

export interface SwapCandidate {
  id: string;
  church_id: string;
  roles?: string[] | null;
}

export interface SwapBlockout {
  team_member_id: string;
  start_date: string;
  end_date: string;
}

export interface SwapConflictAssignment {
  id?: string;
  service_id: string;
  team_member_id: string;
  /** ISO date (YYYY-MM-DD) of the assignment's service, when available. */
  service_date?: string | null;
  /** Declined assignments do not occupy the volunteer. */
  status?: string | null;
}

export interface SwapEligibilityContext {
  churchId: string;
  assignmentId: string;
  assignmentTeamMemberId: string;
  role: string;
  serviceId: string;
  /** ISO date (YYYY-MM-DD) of the service being swapped. */
  serviceDate: string;
  blockouts?: SwapBlockout[];
  /** Assignments on the same date (may include the assignment itself). */
  sameDateAssignments?: SwapConflictAssignment[];
}

export type SwapIneligibilityReason =
  | 'not_same_church'
  | 'missing_role'
  | 'is_requester'
  | 'blocked'
  | 'already_serving_service'
  | 'already_serving_date';

export interface SwapEligibilityResult {
  eligible: boolean;
  reasons: SwapIneligibilityReason[];
}

/** True when a service date/time is still in the future. */
export function isServiceInFuture(
  serviceDate: string,
  serviceTime?: string | null,
  now: Date = new Date()
): boolean {
  if (!serviceDate) return false;
  const time =
    serviceTime && /^\d{2}:\d{2}/.test(serviceTime)
      ? serviceTime.slice(0, 5)
      : '23:59';
  const parsed = Date.parse(`${serviceDate.slice(0, 10)}T${time}:00Z`);
  if (!Number.isFinite(parsed)) return false;
  return parsed > now.getTime();
}

/** True when an ISO date falls inside an inclusive blockout range. */
export function isDateBlocked(
  date: string,
  blockouts: SwapBlockout[] | undefined,
  teamMemberId: string
): boolean {
  if (!date || !blockouts?.length) return false;
  return blockouts.some(
    (blockout) =>
      blockout.team_member_id === teamMemberId &&
      blockout.start_date <= date &&
      blockout.end_date >= date
  );
}

function isActiveAssignment(assignment: SwapConflictAssignment): boolean {
  return assignment.status !== 'declined';
}

/**
 * Return every reason the candidate cannot claim. An empty list means the
 * candidate is qualified.
 */
export function getSwapIneligibilityReasons(
  candidate: SwapCandidate,
  context: SwapEligibilityContext
): SwapIneligibilityReason[] {
  const reasons: SwapIneligibilityReason[] = [];

  if (!candidate.church_id || candidate.church_id !== context.churchId) {
    reasons.push('not_same_church');
  }

  if (candidate.id === context.assignmentTeamMemberId) {
    reasons.push('is_requester');
  }

  const roles = Array.isArray(candidate.roles) ? candidate.roles : [];
  if (!roles.includes(context.role)) {
    reasons.push('missing_role');
  }

  if (isDateBlocked(context.serviceDate, context.blockouts, candidate.id)) {
    reasons.push('blocked');
  }

  const conflicts = (context.sameDateAssignments ?? []).filter(
    (assignment) =>
      assignment.team_member_id === candidate.id &&
      assignment.id !== context.assignmentId &&
      isActiveAssignment(assignment)
  );

  if (conflicts.some((assignment) => assignment.service_id === context.serviceId)) {
    reasons.push('already_serving_service');
  } else if (
    conflicts.some(
      (assignment) =>
        assignment.service_date && assignment.service_date === context.serviceDate
    )
  ) {
    reasons.push('already_serving_date');
  }

  return reasons;
}

export function isSwapEligible(
  candidate: SwapCandidate,
  context: SwapEligibilityContext
): boolean {
  return getSwapIneligibilityReasons(candidate, context).length === 0;
}
