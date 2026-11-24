/**
 * Pure helpers for the "Roles needed" editor on a service's Team tab.
 *
 * A role position is the staffing target for a service (role + how many people
 * are needed). Nothing in this file writes to the database; the editor keeps a
 * local draft until the leader saves it so prefilled suggestions are never
 * persisted automatically.
 */

import { deriveOpenSlots } from './autoFill';

export const ROLE_NEEDED_MIN = 1;
export const ROLE_NEEDED_MAX = 20;

export interface RoleNeededSuggestion {
  role: string;
  max_volunteers: number;
}

export interface TemplateLike {
  title: string;
  time: string;
  day_of_week: number;
  roles?: string[] | null;
}

/** Normalize a role to the stored snake_case style used across scheduling. */
export function normalizeRoleName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Human label for a stored role key. */
export function roleLabel(role: string): string {
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Keep a headcount inside the editor's allowed 1–20 range. */
export function clampRoleCount(value: number): number {
  if (!Number.isFinite(value)) return ROLE_NEEDED_MIN;
  return Math.max(ROLE_NEEDED_MIN, Math.min(ROLE_NEEDED_MAX, Math.trunc(value)));
}

/**
 * Suggest roles when a service has no saved positions yet. Current assignment
 * roles become the counts (so "2 vocals" suggests 2), then any template roles
 * that are not already covered are added at 1 each.
 */
export function deriveRoleNeededPrefill(input: {
  assignmentRoles?: Array<string | null | undefined>;
  templateRoles?: Array<string | null | undefined>;
}): RoleNeededSuggestion[] {
  const counts = new Map<string, number>();

  for (const raw of input.assignmentRoles ?? []) {
    const role = normalizeRoleName(raw || '');
    if (!role) continue;
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }

  for (const raw of input.templateRoles ?? []) {
    const role = normalizeRoleName(raw || '');
    if (!role || counts.has(role)) continue;
    counts.set(role, 1);
  }

  return Array.from(counts.entries()).map(([role, count]) => ({
    role,
    max_volunteers: clampRoleCount(count),
  }));
}

/** Unique, sorted role options for the add-role picker. */
export function deriveRoleOptions(input: {
  teamMemberRoles?: Array<string | null | undefined>;
  assignmentRoles?: Array<string | null | undefined>;
  templateRoles?: Array<string | null | undefined>;
}): string[] {
  const roles = new Set<string>();
  const groups = [
    input.teamMemberRoles ?? [],
    input.assignmentRoles ?? [],
    input.templateRoles ?? [],
  ];

  for (const group of groups) {
    for (const raw of group) {
      const role = normalizeRoleName(raw || '');
      if (role) roles.add(role);
    }
  }

  return Array.from(roles).sort((a, b) => roleLabel(a).localeCompare(roleLabel(b)));
}

/**
 * Match a service back to the template it was probably created from. Services
 * do not store a template id, but createServiceFromTemplate copies the title,
 * time and weekday, which is enough for a read-only prefill suggestion.
 */
export function findMatchingTemplate<T extends TemplateLike>(
  templates: T[],
  service: { title: string; time?: string | null; date: string },
): T | null {
  const date = service.date?.slice(0, 10);
  if (!date) return null;

  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  const title = service.title.trim().toLowerCase();
  const time = service.time ? service.time.slice(0, 5) : '';

  return (
    templates.find(
      (template) =>
        template.day_of_week === dayOfWeek &&
        template.title.trim().toLowerCase() === title &&
        (!time || template.time.slice(0, 5) === time),
    ) ?? null
  );
}

export type FillRolesState = 'no_roles' | 'all_filled' | 'open';

/** State used to enable/disable the "Fill open roles" action. */
export function getFillRolesState(
  positions: Array<{ role: string; max_volunteers: number }>,
  assignments: Array<{ role: string }>,
): FillRolesState {
  if (positions.length === 0) return 'no_roles';
  return deriveOpenSlots(positions, assignments).length === 0
    ? 'all_filled'
    : 'open';
}

/** Tooltip/hint shown when "Fill open roles" is disabled. */
export function getFillRolesHint(state: FillRolesState): string | null {
  if (state === 'no_roles') return 'Add roles needed first';
  if (state === 'all_filled') return 'All roles filled';
  return null;
}

export interface RoleFillBadge {
  role: string;
  label: string;
  /** Ready-to-render text such as "Keys 0/1" or "WL 1". */
  text: string;
  filled: number;
  needed: number | null;
  complete: boolean;
}

/**
 * Merge staffing targets with actual assignments for the Team tab badges.
 * Positions with a target show filled/needed; roles only present on an
 * assignment keep their filled count without a target.
 */
export function getRoleFillBadges(
  positions: Array<{ role: string; max_volunteers: number }>,
  assignments: Array<{ role?: string | null }>,
): RoleFillBadge[] {
  const filledByRole = new Map<string, number>();
  const displayRoleByKey = new Map<string, string>();

  for (const assignment of assignments) {
    const rawRole = (assignment.role || '').trim();
    const role = normalizeRoleName(rawRole);
    if (!role) continue;
    if (!displayRoleByKey.has(role)) displayRoleByKey.set(role, rawRole);
    filledByRole.set(role, (filledByRole.get(role) ?? 0) + 1);
  }

  const badges: RoleFillBadge[] = [];
  const seen = new Set<string>();

  for (const position of positions) {
    const role = normalizeRoleName(position.role || '');
    if (!role || seen.has(role)) continue;
    seen.add(role);

    const needed = Number.isFinite(position.max_volunteers)
      ? Math.max(0, Math.floor(position.max_volunteers))
      : 0;
    const filled = filledByRole.get(role) ?? 0;
    const label = roleLabel(position.role || role);

    badges.push({
      role,
      label,
      text: `${label} ${filled}/${needed}`,
      filled,
      needed,
      complete: filled >= needed,
    });
  }

  const extraRoles = Array.from(filledByRole.entries())
    .filter(([role]) => !seen.has(role))
    .sort(([a], [b]) =>
      roleLabel(displayRoleByKey.get(a) || a).localeCompare(
        roleLabel(displayRoleByKey.get(b) || b),
      ),
    );

  for (const [role, filled] of extraRoles) {
    const label = roleLabel(displayRoleByKey.get(role) || role);
    badges.push({
      role,
      label,
      text: `${label} ${filled}`,
      filled,
      needed: null,
      complete: filled > 0,
    });
  }

  return badges;
}
