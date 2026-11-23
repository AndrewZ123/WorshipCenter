import { z } from 'zod';
import type { TeamMember, UserRole } from './types';
import { EmailSchema } from './validation';

/**
 * Guided setup for a brand-new church: first service, team invitations, and
 * the first song. The wizard is intentionally separate from the profile setup
 * wizard so the two never render at the same time.
 */

export const CHURCH_SETUP_STEPS = ['service', 'team', 'songs'] as const;
export type ChurchSetupStep = (typeof CHURCH_SETUP_STEPS)[number];

/** Custom events used to coordinate the wizard with the dashboard and tour. */
export const CHURCH_SETUP_OPEN_EVENT = 'wc:church-setup-open';
export const PROFILE_SETUP_COMPLETED_EVENT = 'wc:profile-setup-completed';

export interface ChurchSetupOpenDetail {
  step?: ChurchSetupStep;
  /** Wait until the post-profile tour closes before opening the wizard. */
  deferForTour?: boolean;
}

export interface ProfileSetupCompletedDetail {
  deferForTour?: boolean;
}

export function churchSetupStorageKey(churchId: string): string {
  return `church_setup_completed_${churchId}`;
}

export function profileSetupStorageKey(userId: string): string {
  return `profile_setup_completed_${userId}`;
}

export interface ChurchSetupData {
  hasService: boolean;
  hasSong: boolean;
  hasTeamMemberBeyondCreator: boolean;
}

export interface ChurchSetupState extends ChurchSetupData {
  role: UserRole | string | null | undefined;
  /** The church setup wizard was skipped, dismissed, or finished before. */
  setupCompleted: boolean;
  /** The personal profile wizard was skipped or finished first. */
  profileSetupCompleted: boolean;
}

/**
 * Only admins get the guided church setup. Leaders can plan services/songs in
 * the RBAC matrix, but the team invitation page (and the invitation UI this
 * wizard mirrors) is admin-only, so showing them a step they cannot finish
 * would be worse than leaving the wizard hidden.
 */
export function canRunChurchSetup(role: UserRole | string | null | undefined): boolean {
  return role === 'admin';
}

export function isChurchSetupComplete(data: ChurchSetupData): boolean {
  return Boolean(
    data.hasService && data.hasSong && data.hasTeamMemberBeyondCreator
  );
}

/**
 * Decide whether the church wizard should open automatically.
 *
 * The profile wizard always wins when both would open. A persisted skip or a
 * church that already has a service, a real teammate, and a song stays closed.
 * Manual re-opens from the dashboard bypass this helper (they are explicit).
 */
export function shouldOpenChurchSetup(state: ChurchSetupState): boolean {
  if (!canRunChurchSetup(state.role)) return false;
  if (!state.profileSetupCompleted) return false;
  if (state.setupCompleted) return false;
  return !isChurchSetupComplete(state);
}

type SetupTeamMember = Pick<TeamMember, 'id' | 'email'> & {
  user_id?: string | null;
};

/**
 * The church creator is stored as a team member, so `team.length > 0` is not
 * proof that anyone else was invited. Exclude the creator by team member id,
 * linked user id, or email (whichever identifiers are available).
 */
export function hasTeamMemberBeyondCreator(
  members: SetupTeamMember[],
  creator: {
    teamMemberId?: string | null;
    userId?: string | null;
    email?: string | null;
  }
): boolean {
  const creatorEmail = (creator.email || '').trim().toLowerCase();

  return members.some((member) => {
    if (creator.teamMemberId && member.id === creator.teamMemberId) return false;
    if (creator.userId && member.user_id === creator.userId) return false;
    if (
      creatorEmail &&
      (member.email || '').trim().toLowerCase() === creatorEmail
    ) {
      return false;
    }
    return true;
  });
}

const SERVICE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SERVICE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Strict YYYY-MM-DD check (rejects rolled-over dates like 2026-02-31). */
export function isValidSetupDate(value: string): boolean {
  if (!SERVICE_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const ChurchSetupServiceSchema = z.object({
  title: z.string().trim().min(1, 'Title required').max(200, 'Title too long'),
  date: z
    .string()
    .trim()
    .refine(isValidSetupDate, 'Choose a valid date'),
  time: z
    .string()
    .trim()
    .regex(SERVICE_TIME_PATTERN, 'Choose a valid time')
    .default('09:00'),
});

export const ChurchSetupTeamMemberSchema = z.object({
  name: z.string().trim().min(2, 'Name required').max(100, 'Name too long'),
  email: EmailSchema,
  role: z.string().trim().max(50, 'Role too long').optional().default(''),
});

export const ChurchSetupSongSchema = z.object({
  title: z.string().trim().min(1, 'Title required').max(200, 'Title too long'),
  artist: z.string().trim().max(100, 'Artist too long').optional().default(''),
  key: z
    .enum([
      'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
    ])
    .optional(),
});

export type ChurchSetupServiceInput = z.input<typeof ChurchSetupServiceSchema>;
export type ChurchSetupTeamMemberInput = z.input<typeof ChurchSetupTeamMemberSchema>;
export type ChurchSetupSongInput = z.input<typeof ChurchSetupSongSchema>;

export function validateChurchSetupService(input: unknown) {
  return ChurchSetupServiceSchema.safeParse(input);
}

export function validateChurchSetupTeamMember(input: unknown) {
  return ChurchSetupTeamMemberSchema.safeParse(input);
}

export function validateChurchSetupSong(input: unknown) {
  return ChurchSetupSongSchema.safeParse(input);
}

/** Open the wizard from the dashboard checklist or the Setup guide link. */
export function openChurchSetup(
  step: ChurchSetupStep = 'service',
  options: { deferForTour?: boolean } = {}
): void {
  if (typeof window === 'undefined') return;
  const detail: ChurchSetupOpenDetail = {
    step,
    ...(options.deferForTour ? { deferForTour: true } : {}),
  };
  window.dispatchEvent(new CustomEvent(CHURCH_SETUP_OPEN_EVENT, { detail }));
}

/** Tell the church wizard that the profile step is done. */
export function notifyProfileSetupCompleted(
  options: { deferForTour?: boolean } = {}
): void {
  if (typeof window === 'undefined') return;
  const detail: ProfileSetupCompletedDetail = {
    ...(options.deferForTour ? { deferForTour: true } : {}),
  };
  window.dispatchEvent(
    new CustomEvent(PROFILE_SETUP_COMPLETED_EVENT, { detail })
  );
}
