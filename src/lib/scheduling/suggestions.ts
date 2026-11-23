import type {
  TeamMember,
  TeamMemberBlockoutDate,
  ServiceAssignmentPopulated,
  SuggestedAssignment,
  SchedulingConflict,
} from '@/lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Normalize a role for comparison. Existing data mixes "Worship Leader",
 * "worship_leader", and "worship-leader" spellings, so compare on a single
 * whitespace-separated lowercase form.
 */
export function normalizeRole(role: string): string {
  return role.trim().toLowerCase().replace(/[_\s-]+/g, ' ').trim();
}

/**
 * The app has historically treated a role match as either an exact match or a
 * substring match, e.g. "Background Vocals" satisfies a "vocals" slot.
 */
export function roleMatches(memberRole: string, role: string): boolean {
  const memberValue = normalizeRole(memberRole);
  const targetValue = normalizeRole(role);
  if (!memberValue || !targetValue) return false;
  return (
    memberValue === targetValue ||
    memberValue.includes(targetValue) ||
    targetValue.includes(memberValue)
  );
}

export function memberHasRole(
  member: Pick<TeamMember, 'roles'>,
  role: string,
): boolean {
  return Array.isArray(member.roles) && member.roles.some((r) => roleMatches(r, role));
}

/** Parse a YYYY-MM-DD string as UTC midnight so date math is timezone-safe. */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const parsed = parseDateOnly(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return formatDateOnly(parsed);
}

export function daysBetween(later: string, earlier: string): number {
  return Math.round(
    (parseDateOnly(later).getTime() - parseDateOnly(earlier).getTime()) / DAY_MS,
  );
}

export function findBlockout<T extends { team_member_id: string; start_date: string; end_date: string }>(
  blockoutDates: T[],
  teamMemberId: string,
  serviceDate: string,
): T | undefined {
  return blockoutDates.find(
    (b) =>
      b.team_member_id === teamMemberId &&
      b.start_date <= serviceDate &&
      b.end_date >= serviceDate,
  );
}

/**
 * Existing "Suggest" popover ranking. Extracted here so the single-role
 * suggestions and the multi-role auto-fill preview share one implementation.
 */
export function rankSuggestions(
  candidates: TeamMember[],
  existingAssignments: ServiceAssignmentPopulated[],
  blockoutDates: TeamMemberBlockoutDate[],
  serviceDate: string,
  role: string,
): SuggestedAssignment[] {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const recentAssignments = existingAssignments.filter((a) => {
    const assignmentDate = a.services?.date;
    if (!assignmentDate) return false;
    return new Date(assignmentDate) >= ninetyDaysAgo;
  });

  const assignmentCounts = new Map<string, number>();
  const lastServed = new Map<string, string>();
  for (const a of recentAssignments) {
    assignmentCounts.set(
      a.team_member_id,
      (assignmentCounts.get(a.team_member_id) || 0) + 1,
    );
    const assignmentDate = a.services?.date;
    if (assignmentDate) {
      const existing = lastServed.get(a.team_member_id);
      if (!existing || assignmentDate > existing) {
        lastServed.set(a.team_member_id, assignmentDate);
      }
    }
  }

  const assignedIds = new Set(existingAssignments.map((a) => a.team_member_id));

  const results: SuggestedAssignment[] = candidates
    .filter((m) => !assignedIds.has(m.id))
    .map((member) => {
      const conflicts: SchedulingConflict[] = [];
      const reasons: string[] = [];
      let score = 100;

      const isBlocked = findBlockout(blockoutDates, member.id, serviceDate);
      if (isBlocked) {
        score -= 100;
        conflicts.push({
          type: 'blockout',
          message: `Blocked out ${isBlocked.start_date} – ${isBlocked.end_date}${isBlocked.reason ? ` (${isBlocked.reason})` : ''}`,
          severity: 'error',
          blockoutDate: isBlocked,
        });
        reasons.push('Blocked out');
      }

      const sameDayAssignments = existingAssignments.filter(
        (a) => a.services?.date === serviceDate && a.team_member_id !== member.id,
      );
      if (sameDayAssignments.length > 0) {
        score -= 50;
        conflicts.push({
          type: 'double_booking',
          message: `Already assigned to ${sameDayAssignments.length} other service(s) on this date`,
          severity: 'warning',
        });
        reasons.push('Other assignment this date');
      }

      const count = assignmentCounts.get(member.id) || 0;
      score -= count * 10;
      if (count === 0) {
        reasons.push('No recent services');
      } else {
        reasons.push(`${count} service(s) in 90d`);
      }

      const hasRole = memberHasRole(member, role);
      if (hasRole) {
        score += 20;
        reasons.push('Has this role');
      }

      return {
        teamMemberId: member.id,
        name: member.name,
        avatar_url: member.avatar_url,
        role,
        score: Math.max(0, score),
        reasons,
        conflicts,
      };
    });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 5);
}
