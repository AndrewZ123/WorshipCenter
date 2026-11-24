/**
 * Server-only helpers for assignment swap requests.
 *
 * Church scope always comes from the database, never from request bodies. All
 * reads/writes use the service-role client; the API routes enforce every rule
 * and the migration denies client writes entirely.
 */

import { after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { assignmentSwapEmail } from '@/lib/email-templates';
import type { AssignmentSwapStatus } from '@/lib/types';
import {
  getSwapIneligibilityReasons,
  isSwapEligible,
  type SwapBlockout,
  type SwapCandidate,
  type SwapConflictAssignment,
  type SwapEligibilityContext,
} from './eligibility';

export const SWAP_NOTE_MAX_LENGTH = 500;
export const MAX_SWAP_NOTIFY_RECIPIENTS = 25;

export interface SwapUserContext {
  churchId: string;
  role: string;
}

export interface SwapTeamMember {
  id: string;
  church_id: string;
  name: string;
  email?: string | null;
  user_id?: string | null;
  avatar_url?: string | null;
  roles?: string[] | null;
}

export interface SwapService {
  id: string;
  title: string;
  date: string;
  time: string;
  church_id: string;
}

export interface SwapAssignment {
  id: string;
  service_id: string;
  team_member_id: string;
  role: string;
  status?: string | null;
  service: SwapService;
}

export interface SwapRow {
  id: string;
  church_id: string;
  assignment_id: string;
  requested_by: string;
  claimed_by: string | null;
  status: AssignmentSwapStatus;
  note: string | null;
  created_at: string;
  updated_at?: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface AssignmentWithServiceRow {
  id: string;
  service_id: string;
  team_member_id: string;
  role: string;
  status?: string | null;
  services?:
    | SwapService
    | SwapService[]
    | null;
}

function singleService(
  services: AssignmentWithServiceRow['services']
): SwapService | null {
  if (!services) return null;
  return Array.isArray(services) ? services[0] ?? null : services;
}

function asArray<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return [];
}

export function isLeaderRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'leader';
}

export function formatSwapRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function loadChurchName(churchId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('churches')
    .select('name')
    .eq('id', churchId)
    .maybeSingle();
  return data?.name || 'Your church';
}

export async function getUserSwapContext(
  userId: string
): Promise<SwapUserContext | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('church_id, role')
    .eq('id', userId)
    .single();

  if (error || !data?.church_id) return null;
  return { churchId: data.church_id, role: data.role };
}

export async function getTeamMemberForUser(
  userId: string,
  churchId: string
): Promise<SwapTeamMember | null> {
  const { data, error } = await supabaseAdmin
    .from('team_members')
    .select('id, church_id, name, email, user_id, avatar_url, roles')
    .eq('user_id', userId)
    .eq('church_id', churchId)
    .maybeSingle();

  if (error || !data) return null;
  return data as SwapTeamMember;
}

export async function loadSwap(
  swapId: string,
  churchId: string
): Promise<SwapRow | null> {
  const { data, error } = await supabaseAdmin
    .from('assignment_swap_requests')
    .select(
      'id, church_id, assignment_id, requested_by, claimed_by, status, note, created_at, updated_at, resolved_at, resolved_by'
    )
    .eq('id', swapId)
    .eq('church_id', churchId)
    .maybeSingle();

  if (error || !data) return null;
  return data as SwapRow;
}

export async function loadAssignmentForSwap(
  assignmentId: string
): Promise<SwapAssignment | null> {
  const { data, error } = await supabaseAdmin
    .from('service_assignments')
    .select(
      'id, service_id, team_member_id, role, status, services!inner(id, title, date, time, church_id)'
    )
    .eq('id', assignmentId)
    .single();

  if (error || !data) return null;

  const row = data as AssignmentWithServiceRow;
  const service = singleService(row.services);
  if (!service) return null;

  return {
    id: row.id,
    service_id: row.service_id,
    team_member_id: row.team_member_id,
    role: row.role,
    status: row.status ?? null,
    service,
  };
}

export async function loadBlockoutsForChurch(
  churchId: string
): Promise<SwapBlockout[]> {
  const { data, error } = await supabaseAdmin
    .from('team_member_blockout_dates')
    .select('team_member_id, start_date, end_date')
    .eq('church_id', churchId);

  if (error || !data) return [];
  return asArray(data as SwapBlockout[]);
}

/**
 * Assignments on the same service date, including the service being swapped.
 * Uses an embedded PostgREST filter so the church/date scope is enforced by
 * the query rather than by filtering rows after the fact.
 */
export async function loadAssignmentsForServiceDate(
  churchId: string,
  serviceDate: string
): Promise<SwapConflictAssignment[]> {
  const { data, error } = await supabaseAdmin
    .from('service_assignments')
    .select(
      'id, service_id, team_member_id, role, status, services!inner(id, date, church_id)'
    )
    .eq('services.church_id', churchId)
    .eq('services.date', serviceDate);

  if (error || !data) return [];

  return asArray(
    data as Array<
      SwapConflictAssignment & {
        services?: { id: string; date: string; church_id: string } | Array<{ id: string; date: string; church_id: string }>;
      }
    >
  ).map((row) => {
    const service = Array.isArray(row.services) ? row.services[0] : row.services;
    return {
      id: row.id,
      service_id: row.service_id,
      team_member_id: row.team_member_id,
      status: row.status ?? null,
      service_date: service?.date ?? null,
    };
  });
}

export async function loadChurchTeamMembers(
  churchId: string
): Promise<SwapTeamMember[]> {
  const { data, error } = await supabaseAdmin
    .from('team_members')
    .select('id, church_id, name, email, user_id, avatar_url, roles')
    .eq('church_id', churchId);

  if (error || !data) return [];
  return asArray(data as SwapTeamMember[]);
}

export async function loadChurchLeaders(
  churchId: string
): Promise<Array<{ id: string; name: string; email: string | null }>> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email')
    .eq('church_id', churchId)
    .in('role', ['admin', 'leader']);

  if (error || !data) return [];
  return asArray(data as Array<{ id: string; name: string; email: string | null }>);
}

export async function loadTeamMemberById(
  teamMemberId: string,
  churchId: string
): Promise<SwapTeamMember | null> {
  const { data, error } = await supabaseAdmin
    .from('team_members')
    .select('id, church_id, name, email, user_id, avatar_url, roles')
    .eq('id', teamMemberId)
    .eq('church_id', churchId)
    .maybeSingle();

  if (error || !data) return null;
  return data as SwapTeamMember;
}

export async function isAutoApproveSwapsEnabled(
  churchId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('church_settings')
    .select('auto_approve_swaps')
    .eq('church_id', churchId)
    .maybeSingle();

  if (error || !data) return false;
  return data.auto_approve_swaps === true;
}

export function buildSwapEligibilityContext(
  assignment: SwapAssignment,
  blockouts: SwapBlockout[],
  sameDateAssignments: SwapConflictAssignment[]
): SwapEligibilityContext {
  return {
    churchId: assignment.service.church_id,
    assignmentId: assignment.id,
    assignmentTeamMemberId: assignment.team_member_id,
    role: assignment.role,
    serviceId: assignment.service_id,
    serviceDate: assignment.service.date.slice(0, 10),
    blockouts,
    sameDateAssignments,
  };
}

export function candidateCanClaim(
  candidate: SwapCandidate,
  context: SwapEligibilityContext
): boolean {
  return isSwapEligible(candidate, context);
}

export function candidateRejectionReasons(
  candidate: SwapCandidate,
  context: SwapEligibilityContext
) {
  return getSwapIneligibilityReasons(candidate, context);
}

export { isServiceInFuture } from './eligibility';

export interface SwapNotifyRecipient {
  userId?: string | null;
  name: string;
  email?: string | null;
}

export interface SwapNotifyPayload {
  churchId: string;
  churchName: string;
  serviceId: string;
  assignmentId?: string | null;
  title: string;
  message: string;
  linkUrl: string;
  emailHeadline: string;
  emailMessage: string;
  serviceTitle: string;
  serviceDate: string;
  serviceTime?: string | null;
  role: string;
}

/**
 * Run notification work after the API response is sent. Next's after() keeps it
 * alive in production; direct route invocation (tests) has no request scope, so
 * fall back to a detached promise that still never blocks the response.
 */
export function scheduleAfterResponse(task: () => Promise<void>): void {
  const run = () => {
    Promise.resolve()
      .then(task)
      .catch((error) => {
        console.error('[Swaps] Background notification failed:', error);
      });
  };

  try {
    after(run);
  } catch {
    void Promise.resolve().then(run);
  }
}

/**
 * In-app notifications + email for one swap event. Missing user ids skip the
 * in-app row, missing emails skip delivery, and an unconfigured email provider
 * is skipped quietly. Failures are logged but never fail the API request.
 */
export async function sendSwapNotifications(
  recipients: SwapNotifyRecipient[],
  payload: SwapNotifyPayload
): Promise<void> {
  const seen = new Set<string>();
  const unique = recipients.filter((recipient) => {
    const key = recipient.userId || recipient.email;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) return;

  const emailConfigured = await isEmailConfigured().catch(() => false);
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || '';

  await Promise.all(
    unique.map(async (recipient) => {
      if (recipient.userId) {
        try {
          await supabaseAdmin.from('notifications').insert({
            church_id: payload.churchId,
            user_id: recipient.userId,
            type: 'general',
            title: payload.title,
            message: payload.message,
            service_id: payload.serviceId,
            assignment_id: payload.assignmentId || null,
            link_url: payload.linkUrl,
            read: false,
          });
        } catch (error) {
          console.error('[Swaps] In-app notification failed:', error);
        }
      }

      if (!emailConfigured || !recipient.email) return;

      try {
        const { html, text } = assignmentSwapEmail({
          memberName: recipient.name || 'Team Member',
          churchName: payload.churchName,
          serviceTitle: payload.serviceTitle,
          serviceDate: payload.serviceDate,
          serviceTime: payload.serviceTime || '',
          role: payload.role,
          headline: payload.emailHeadline,
          message: payload.emailMessage,
          linkUrl: `${appBaseUrl}${payload.linkUrl}`,
        });

        await sendEmail({
          to: recipient.email,
          subject: payload.title,
          html,
          text,
        });
      } catch (error) {
        console.error('[Swaps] Email notification failed:', error);
      }
    })
  );
}

export function toTeamMemberRecipient(
  member: SwapTeamMember | null | undefined
): SwapNotifyRecipient | null {
  if (!member) return null;
  return {
    userId: member.user_id || null,
    name: member.name,
    email: member.email || null,
  };
}
