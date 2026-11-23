import {
  addDays,
  daysBetween,
  findBlockout,
  memberHasRole,
  roleMatches,
} from './suggestions';

const DEFAULT_MAX_PER_MONTH = 2;
const DEFAULT_LOOKBACK_DAYS = 90;
const FREQUENCY_WINDOW_DAYS = 30;

export interface OpenRoleSlot {
  role: string;
  count: number;
}

export interface AutoFillTeamMember {
  id: string;
  name: string;
  roles: string[];
}

export interface AutoFillBlockout {
  team_member_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

export interface AutoFillHistoryAssignment {
  team_member_id: string;
  service_id: string;
  /** Service date in YYYY-MM-DD form. */
  date: string;
}

export interface AutoFillExistingAssignment {
  team_member_id: string;
  role: string;
  service_id?: string;
}

export interface AutoFillPreference {
  team_member_id: string;
  max_weekly_frequency: number | null;
}

export interface AutoFillOptions {
  /** Fallback cap when a member has no stored frequency preference. */
  maxPerMonth?: number;
  lookbackDays?: number;
}

export interface AutoFillInput {
  serviceId?: string;
  serviceDate: string;
  openSlots: OpenRoleSlot[];
  teamMembers: AutoFillTeamMember[];
  blockouts: AutoFillBlockout[];
  recentAssignments: AutoFillHistoryAssignment[];
  existingAssignments: AutoFillExistingAssignment[];
  preferences?: AutoFillPreference[];
  options?: AutoFillOptions;
}

export interface AutoFillAssignment {
  role: string;
  teamMemberId: string;
  reason: string;
}

export interface AutoFillUnfilled {
  role: string;
  reason: string;
}

export interface AutoFillResult {
  assignments: AutoFillAssignment[];
  unfilled: AutoFillUnfilled[];
}

export interface AutoFillCandidate {
  teamMemberId: string;
  name: string;
  reason: string;
  lastServed: string | null;
  recentCount: number;
}

export interface RolePositionLike {
  role: string;
  max_volunteers: number;
}

type ExclusionCode =
  | 'blocked'
  | 'thisService'
  | 'sameDay'
  | 'frequency'
  | 'reserved';

type ExclusionCounts = Record<ExclusionCode, number>;

interface AutoFillContext {
  serviceDate: string;
  currentServiceId?: string;
  frequencyStart: string;
  frequencyEnd: string;
  assignedThisService: Set<string>;
  sameDayOtherService: Set<string>;
  frequencyCounts: Map<string, number>;
  lastServed: Map<string, string>;
  recentCounts: Map<string, number>;
  maxPerMonth: number;
  preferenceCaps: Map<string, number>;
}

interface RoleEvaluation {
  roleMemberCount: number;
  candidates: AutoFillCandidate[];
  exclusions: ExclusionCounts;
}

function emptyExclusions(): ExclusionCounts {
  return {
    blocked: 0,
    thisService: 0,
    sameDay: 0,
    frequency: 0,
    reserved: 0,
  };
}

function validDate(value: string | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildContext(input: AutoFillInput): AutoFillContext {
  const serviceDate = input.serviceDate;
  const lookbackDays = input.options?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const maxPerMonth = input.options?.maxPerMonth ?? DEFAULT_MAX_PER_MONTH;

  // If the caller did not name the service explicitly, infer it from the
  // existing-assignment list (the UI always has at least one of the two).
  const currentServiceId =
    input.serviceId ??
    input.existingAssignments.find((a) => a.service_id)?.service_id;

  const assignedThisService = new Set(
    input.existingAssignments.map((a) => a.team_member_id),
  );

  const preferenceCaps = new Map<string, number>();
  for (const pref of input.preferences ?? []) {
    if (
      typeof pref.max_weekly_frequency === 'number' &&
      Number.isFinite(pref.max_weekly_frequency) &&
      pref.max_weekly_frequency > 0
    ) {
      preferenceCaps.set(pref.team_member_id, pref.max_weekly_frequency);
    }
  }

  const lookbackStart = addDays(serviceDate, -Math.abs(lookbackDays));
  // "Max per month" is enforced within 30 days either side of the service
  // date, so assignments already pencilled in for nearby weeks count too.
  const frequencyStart = addDays(serviceDate, -FREQUENCY_WINDOW_DAYS);
  const frequencyEnd = addDays(serviceDate, FREQUENCY_WINDOW_DAYS);

  const sameDayOtherService = new Set<string>();
  const frequencyCounts = new Map<string, number>();
  const lastServed = new Map<string, string>();
  const recentCounts = new Map<string, number>();

  for (const assignment of input.recentAssignments) {
    if (!validDate(assignment.date)) continue;

    if (
      assignment.date === serviceDate &&
      (!currentServiceId || assignment.service_id !== currentServiceId)
    ) {
      sameDayOtherService.add(assignment.team_member_id);
    }

    if (assignment.date >= frequencyStart && assignment.date <= frequencyEnd) {
      frequencyCounts.set(
        assignment.team_member_id,
        (frequencyCounts.get(assignment.team_member_id) ?? 0) + 1,
      );
    }

    if (assignment.date >= lookbackStart && assignment.date <= serviceDate) {
      recentCounts.set(
        assignment.team_member_id,
        (recentCounts.get(assignment.team_member_id) ?? 0) + 1,
      );
      const existing = lastServed.get(assignment.team_member_id);
      if (!existing || assignment.date > existing) {
        lastServed.set(assignment.team_member_id, assignment.date);
      }
    }
  }

  return {
    serviceDate,
    currentServiceId,
    frequencyStart,
    frequencyEnd,
    assignedThisService,
    sameDayOtherService,
    frequencyCounts,
    lastServed,
    recentCounts,
    maxPerMonth,
    preferenceCaps,
  };
}

export function describeLastServed(
  lastServed: string | null,
  serviceDate: string,
): string {
  if (!lastServed) return 'Never served';

  const days = daysBetween(serviceDate, lastServed);
  if (days <= 0) return 'Last served the same day';
  if (days === 1) return 'Last served yesterday';
  if (days < 7) return `Last served ${days} days ago`;

  const weeks = Math.max(1, Math.round(days / 7));
  return `Last served ${weeks} week${weeks === 1 ? '' : 's'} ago`;
}

function compareCandidates(a: AutoFillCandidate, b: AutoFillCandidate): number {
  const aNever = a.lastServed === null;
  const bNever = b.lastServed === null;
  if (aNever !== bNever) return aNever ? -1 : 1;

  if (a.lastServed !== null && b.lastServed !== null && a.lastServed !== b.lastServed) {
    return a.lastServed.localeCompare(b.lastServed);
  }

  if (a.recentCount !== b.recentCount) {
    return a.recentCount - b.recentCount;
  }

  const nameOrder = a.name.localeCompare(b.name, 'en');
  if (nameOrder !== 0) return nameOrder;
  return a.teamMemberId.localeCompare(b.teamMemberId);
}

function evaluateRole(
  input: AutoFillInput,
  context: AutoFillContext,
  role: string,
  reservedTeamMemberIds: Iterable<string>,
): RoleEvaluation {
  const reserved = new Set(reservedTeamMemberIds);
  const exclusions = emptyExclusions();
  const candidates: AutoFillCandidate[] = [];
  let roleMemberCount = 0;

  for (const member of input.teamMembers) {
    if (!memberHasRole(member, role)) continue;
    roleMemberCount += 1;

    let exclusion: ExclusionCode | null = null;
    if (reserved.has(member.id)) {
      exclusion = 'reserved';
    } else if (context.assignedThisService.has(member.id)) {
      exclusion = 'thisService';
    } else if (context.sameDayOtherService.has(member.id)) {
      exclusion = 'sameDay';
    } else if (findBlockout(input.blockouts, member.id, context.serviceDate)) {
      exclusion = 'blocked';
    } else {
      const cap =
        context.preferenceCaps.get(member.id) ?? context.maxPerMonth;
      const servedInWindow = context.frequencyCounts.get(member.id) ?? 0;
      if (servedInWindow >= cap) {
        exclusion = 'frequency';
      }
    }

    if (exclusion) {
      exclusions[exclusion] += 1;
      continue;
    }

    const last = context.lastServed.get(member.id) ?? null;
    candidates.push({
      teamMemberId: member.id,
      name: member.name,
      reason: describeLastServed(last, context.serviceDate),
      lastServed: last,
      recentCount: context.recentCounts.get(member.id) ?? 0,
    });
  }

  candidates.sort(compareCandidates);
  return { roleMemberCount, candidates, exclusions };
}

function describeUnfilled(
  role: string,
  roleMemberCount: number,
  exclusions: ExclusionCounts,
): string {
  if (roleMemberCount === 0) {
    return `No team members have the "${role}" role.`;
  }

  const parts: string[] = [];
  if (exclusions.blocked > 0) {
    parts.push(`${exclusions.blocked} blocked out`);
  }
  if (exclusions.thisService > 0) {
    parts.push(`${exclusions.thisService} already on this service`);
  }
  if (exclusions.sameDay > 0) {
    parts.push(`${exclusions.sameDay} already serving another service that day`);
  }
  if (exclusions.frequency > 0) {
    parts.push(`${exclusions.frequency} at their frequency limit`);
  }
  if (exclusions.reserved > 0) {
    parts.push(`${exclusions.reserved} already picked for another role`);
  }

  if (parts.length === 0) {
    return `No eligible team member is available for "${role}".`;
  }

  return `No eligible team member for "${role}" (${parts.join(', ')}).`;
}

/**
 * Return the ranked, eligible candidates for one role. The preview uses this
 * to build its swap dropdown; autoFillOpenRoles uses the same evaluator.
 */
export function getSlotCandidates(
  input: AutoFillInput,
  role: string,
  reservedTeamMemberIds: Iterable<string> = [],
): AutoFillCandidate[] {
  if (!validDate(input.serviceDate)) return [];
  const context = buildContext(input);
  return evaluateRole(input, context, role, reservedTeamMemberIds).candidates;
}

/**
 * Propose one volunteer per open role slot.
 *
 * A member must have the role, be free on the service date, not already be on
 * this service, not serve another service that day, and stay within their
 * monthly frequency cap. Candidates are ranked by least-recently-served
 * (never-served first), then fewest assignments in the lookback window, then
 * name (with id as a final deterministic tie-breaker).
 */
export function autoFillOpenRoles(input: AutoFillInput): AutoFillResult {
  if (!validDate(input.serviceDate)) {
    return {
      assignments: [],
      unfilled: input.openSlots.flatMap((slot) => {
        const count = Number.isFinite(slot.count)
          ? Math.max(0, Math.floor(slot.count))
          : 0;
        return Array.from({ length: count }, () => ({
          role: slot.role,
          reason: 'Service date is missing or invalid.',
        }));
      }),
    };
  }

  const context = buildContext(input);
  const picked = new Set<string>();
  const assignments: AutoFillAssignment[] = [];
  const unfilled: AutoFillUnfilled[] = [];

  for (const slot of input.openSlots) {
    const count = Number.isFinite(slot.count)
      ? Math.max(0, Math.floor(slot.count))
      : 0;

    for (let i = 0; i < count; i += 1) {
      const { roleMemberCount, candidates, exclusions } = evaluateRole(
        input,
        context,
        slot.role,
        picked,
      );

      const pick = candidates[0];
      if (!pick) {
        unfilled.push({
          role: slot.role,
          reason: describeUnfilled(slot.role, roleMemberCount, exclusions),
        });
        continue;
      }

      picked.add(pick.teamMemberId);
      assignments.push({
        role: slot.role,
        teamMemberId: pick.teamMemberId,
        reason: pick.reason,
      });
    }
  }

  return { assignments, unfilled };
}

/**
 * Compute unfilled slots from explicitly configured role positions. Positions
 * are the source of truth for staffing needs; existing assignments fill them.
 */
export function deriveOpenSlots(
  positions: RolePositionLike[],
  existingAssignments: Array<{ role: string }>,
): OpenRoleSlot[] {
  return positions
    .map((position) => {
      const filled = existingAssignments.filter((a) =>
        roleMatches(a.role, position.role),
      ).length;
      const max = Number.isFinite(position.max_volunteers)
        ? Math.max(0, Math.floor(position.max_volunteers))
        : 0;
      return {
        role: position.role,
        count: Math.max(0, max - filled),
      };
    })
    .filter((slot) => slot.count > 0);
}

/** Short alias for callers that prefer the feature name. */
export const autoFill = autoFillOpenRoles;
