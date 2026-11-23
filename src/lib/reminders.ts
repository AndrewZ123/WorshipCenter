/**
 * Reminder Job Logic for WorshipCenter
 *
 * This module handles automated reminders and escalations for service scheduling.
 * It's designed to be called from a scheduled cron job (e.g., once a day).
 */

import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase';
import { sendEmail, isEmailConfigured } from './email';
import {
  serviceReminderEmail,
  upcomingServiceReminderEmail,
  leaderEscalationEmail,
} from './email-templates';
import {
  appBaseUrl,
  buildResponseUrls,
  createResponseTokenWithRetry,
} from './assignment-response-tokens';

interface ReminderSettings {
  initialReminderHours: number;
  preRehearsalReminderHours: number;
  preServiceReminderHours: number;
  escalationHours: number;
}

/**
 * Get reminder settings with sensible defaults
 */
function getReminderSettings(): ReminderSettings {
  // These could be stored in database for per-org customization
  // For now, we use constants with safe defaults
  return {
    initialReminderHours: 48, // Send initial reminder 48h after assignment if still pending
    preRehearsalReminderHours: 24, // Send reminder 24h before rehearsal
    preServiceReminderHours: 48, // Send reminder 48h before service
    escalationHours: 24, // Escalate to leaders 24h before service for pending assignments
  };
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface ReminderKindCounts {
  checked: number;
  sent: number;
  skipped: number;
  failed: number;
}

export interface PreServiceReminderCounts {
  preService: ReminderKindCounts;
  preRehearsal: ReminderKindCounts;
}

export interface EscalationReminderCounts {
  /** Services inside the escalation window that still have pending assignments. */
  services: number;
  /** Escalation emails successfully sent (one per leader/recipient). */
  sent: number;
  /** Services skipped because every pending assignment was already escalated,
   * no leader had an email, or email is not configured. */
  skipped: number;
  /** Email or ledger failures (retried on the next run). */
  failed: number;
}

export interface ReminderRunCounts extends UnconfirmedReminderCounts {
  unconfirmed: UnconfirmedReminderCounts;
  initial: ReminderKindCounts;
  preService: ReminderKindCounts;
  preRehearsal: ReminderKindCounts;
  escalation: EscalationReminderCounts;
}

interface ReminderServiceRow {
  id: string;
  title: string;
  date: string;
  time: string | null;
  church_id: string;
  status?: string | null;
  rehearsal_time?: string | null;
  created_by?: string | null;
}

interface ReminderAssignmentRow {
  id: string;
  service_id: string;
  team_member_id: string;
  role: string;
  status: string;
  created_at?: string | null;
}

interface ReminderMemberRow {
  id: string;
  name: string;
  email: string | null;
}

interface ReminderChurchRow {
  id: string;
  name: string;
}

interface ReminderUserRow {
  id: string;
  name: string;
  email: string | null;
  role: string;
  church_id?: string | null;
}

function emptyKindCounts(): ReminderKindCounts {
  return { checked: 0, sent: 0, skipped: 0, failed: 0 };
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateKeyMs(value: string | null | undefined): number | null {
  const key = (value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const parsed = Date.parse(`${key}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTimeParts(value: string | null | undefined): { hours: number; minutes: number } | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/** Service start in UTC. Falls back to the start of the service date. */
function serviceDateTimeMs(service: ReminderServiceRow): number | null {
  const dateMs = parseDateKeyMs(service.date);
  if (dateMs === null) return null;
  const time = parseTimeParts(service.time);
  if (!time) return dateMs;
  return dateMs + time.hours * HOUR_MS + time.minutes * 60 * 1000;
}

/** Rehearsal start in UTC, or null when the time is missing/unparseable. */
function rehearsalDateTimeMs(service: ReminderServiceRow): number | null {
  const value = service.rehearsal_time;
  if (typeof value !== 'string' || !value.trim()) return null;

  // Accept either a time of day (the usual shape) or a full timestamp.
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(value)) {
    const parsed = Date.parse(value.includes('T') ? value : value.replace(' ', 'T'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  const dateMs = parseDateKeyMs(service.date);
  const time = parseTimeParts(value);
  if (dateMs === null || !time) return null;
  return dateMs + time.hours * HOUR_MS + time.minutes * 60 * 1000;
}

function isWithinWindow(targetMs: number, now: Date, hours: number): boolean {
  const diff = targetMs - now.getTime();
  return diff > 0 && diff <= hours * HOUR_MS;
}

function isCompleted(service: ReminderServiceRow): boolean {
  return service.status === 'completed';
}

async function loadUpcomingServices(now: Date): Promise<ReminderServiceRow[] | null> {
  const { data, error } = await supabaseAdmin
    .from('services')
    .select('*')
    .gte('date', utcDateKey(now))
    .neq('status', 'completed')
    .order('date', { ascending: true });

  if (error) {
    console.error('[Reminders] Failed to load upcoming services:', error.message);
    return null;
  }

  return ((data || []) as ReminderServiceRow[]).filter(
    (service) => Boolean(service?.id) && !isCompleted(service)
  );
}

async function loadReminderLedger(
  assignmentIds: string[]
): Promise<{ sent: Set<string>; error: unknown }> {
  if (assignmentIds.length === 0) {
    return { sent: new Set(), error: null };
  }

  const { data, error } = await supabaseAdmin
    .from('assignment_reminders_sent')
    .select('assignment_id, kind')
    .in('assignment_id', assignmentIds);

  if (error) {
    return { sent: new Set(), error };
  }

  const sent = new Set(
    ((data || []) as Array<{ assignment_id: string; kind: string }>).map(
      (row) => `${row.assignment_id}:${row.kind}`
    )
  );
  return { sent, error: null };
}

async function loadMembers(teamMemberIds: string[]): Promise<Map<string, ReminderMemberRow>> {
  if (teamMemberIds.length === 0) return new Map();
  const { data } = await supabaseAdmin
    .from('team_members')
    .select('id, name, email')
    .in('id', [...new Set(teamMemberIds)]);

  return new Map(
    ((data || []) as ReminderMemberRow[]).map((member) => [member.id, member])
  );
}

async function loadChurches(churchIds: string[]): Promise<Map<string, ReminderChurchRow>> {
  if (churchIds.length === 0) return new Map();
  const { data } = await supabaseAdmin
    .from('churches')
    .select('id, name')
    .in('id', [...new Set(churchIds)]);

  return new Map(
    ((data || []) as ReminderChurchRow[]).map((church) => [church.id, church])
  );
}

/**
 * Record a successful send. Unique violations mean another run already
 * recorded this (assignment, kind) pair; they must not break the job.
 */
async function recordReminderSent(
  assignmentId: string,
  kind: '3d' | '1d' | 'initial' | 'pre_rehearsal' | 'pre_service' | 'escalation'
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('assignment_reminders_sent')
    .insert({ assignment_id: assignmentId, kind });

  if (!error) return;

  if ((error as { code?: string }).code === '23505') {
    console.warn(
      `[Reminders] Reminder already recorded for assignment ${assignmentId} (${kind})`
    );
    return;
  }

  console.error(
    `[Reminders] Failed to record ${kind} reminder for assignment ${assignmentId}:`,
    error.message
  );
}

/**
 * Send an initial confirmation reminder to volunteers whose assignment has
 * been pending for at least `initialReminderHours`, as long as the service is
 * still far enough out that the 3-day / 1-day reminders have not taken over.
 */
export async function sendInitialReminders(
  now: Date = new Date()
): Promise<ReminderKindCounts> {
  const counts = emptyKindCounts();
  if (!isSupabaseAdminConfigured()) return counts;

  const settings = getReminderSettings();
  const services = await loadUpcomingServices(now);
  if (services === null) {
    counts.failed += 1;
    return counts;
  }
  if (services.length === 0) return counts;

  const serviceById = new Map(services.map((service) => [service.id, service]));

  const { data: assignmentRows, error: assignmentsError } = await supabaseAdmin
    .from('service_assignments')
    .select('*')
    .in('service_id', [...serviceById.keys()])
    .eq('status', 'pending');

  if (assignmentsError) {
    console.error('[Reminders] Failed to load pending assignments:', assignmentsError.message);
    counts.failed += 1;
    return counts;
  }

  const pending = ((assignmentRows || []) as ReminderAssignmentRow[]).filter((assignment) => {
    if (assignment.status !== 'pending') return false;
    const service = serviceById.get(assignment.service_id);
    if (!service) return false;
    const serviceMs = serviceDateTimeMs(service);
    return serviceMs !== null && serviceMs > now.getTime();
  });

  counts.checked = pending.length;
  if (pending.length === 0) return counts;

  const ledger = await loadReminderLedger(pending.map((assignment) => assignment.id));
  if (ledger.error) {
    console.error('[Reminders] Failed to load sent reminder ledger:', ledger.error);
    counts.failed += 1;
    return counts;
  }

  const { threeDay } = reminderTargetDates(now);
  const cutoffMs = now.getTime() - settings.initialReminderHours * HOUR_MS;

  const candidates: ReminderAssignmentRow[] = [];
  for (const assignment of pending) {
    const service = serviceById.get(assignment.service_id);
    if (!service) {
      counts.skipped += 1;
      continue;
    }

    const createdAtMs = assignment.created_at ? Date.parse(assignment.created_at) : NaN;
    if (!Number.isFinite(createdAtMs) || createdAtMs > cutoffMs) {
      counts.skipped += 1;
      continue;
    }

    // The 3-day / 1-day unconfirmed reminders cover these services.
    const serviceDateKey = (service.date || '').slice(0, 10);
    if (serviceDateKey <= threeDay) {
      counts.skipped += 1;
      continue;
    }

    if (
      ledger.sent.has(`${assignment.id}:initial`) ||
      ledger.sent.has(`${assignment.id}:3d`) ||
      ledger.sent.has(`${assignment.id}:1d`)
    ) {
      counts.skipped += 1;
      continue;
    }

    candidates.push(assignment);
  }

  if (candidates.length === 0) return counts;

  if (!(await isEmailConfigured())) {
    counts.skipped += candidates.length;
    return counts;
  }

  const memberById = await loadMembers(
    candidates.map((assignment) => assignment.team_member_id)
  );
  const churchById = await loadChurches(
    candidates.map((assignment) => serviceById.get(assignment.service_id)!.church_id)
  );

  for (const assignment of candidates) {
    const service = serviceById.get(assignment.service_id);
    if (!service) {
      counts.skipped += 1;
      continue;
    }

    const member = memberById.get(assignment.team_member_id);
    if (!member?.email) {
      counts.skipped += 1;
      continue;
    }

    const church = churchById.get(service.church_id);
    if (!church) {
      counts.skipped += 1;
      continue;
    }

    try {
      const rawToken = await createResponseTokenWithRetry(
        assignment.id,
        service.church_id,
        service.date,
        now
      );
      const { confirmUrl, declineUrl } = buildResponseUrls(rawToken);

      const { html, text } = serviceReminderEmail({
        memberName: member.name,
        churchName: church.name,
        serviceTitle: service.title,
        serviceDate: service.date,
        serviceTime: service.time || '',
        role: assignment.role,
        acceptUrl: confirmUrl,
        declineUrl,
      });

      const result = await sendEmail({
        to: member.email,
        subject: `Reminder: Please respond for ${service.title}`,
        html,
        text,
      });

      if (!result.success) {
        counts.failed += 1;
        continue;
      }

      await recordReminderSent(assignment.id, 'initial');
      counts.sent += 1;
    } catch (error) {
      console.error(`[Reminders] Failed to send initial reminder for ${assignment.id}:`, error);
      counts.failed += 1;
    }
  }

  return counts;
}

/**
 * Send pre-service and pre-rehearsal reminders to confirmed and pending
 * volunteers. Confirmed volunteers get an informational email; pending
 * volunteers also get fresh single-use accept/decline links.
 */
export async function sendPreServiceReminders(
  now: Date = new Date()
): Promise<PreServiceReminderCounts> {
  const counts: PreServiceReminderCounts = {
    preService: emptyKindCounts(),
    preRehearsal: emptyKindCounts(),
  };

  if (!isSupabaseAdminConfigured()) return counts;

  const settings = getReminderSettings();
  const services = await loadUpcomingServices(now);
  if (services === null) {
    counts.preService.failed += 1;
    counts.preRehearsal.failed += 1;
    return counts;
  }
  if (services.length === 0) return counts;

  const serviceById = new Map(services.map((service) => [service.id, service]));
  const kindsByService = new Map<string, Array<'pre_service' | 'pre_rehearsal'>>();

  for (const service of services) {
    const kinds: Array<'pre_service' | 'pre_rehearsal'> = [];

    const serviceMs = serviceDateTimeMs(service);
    if (serviceMs !== null && isWithinWindow(serviceMs, now, settings.preServiceReminderHours)) {
      kinds.push('pre_service');
    }

    const rehearsalMs = rehearsalDateTimeMs(service);
    if (
      rehearsalMs !== null &&
      isWithinWindow(rehearsalMs, now, settings.preRehearsalReminderHours)
    ) {
      kinds.push('pre_rehearsal');
    }

    if (kinds.length > 0) kindsByService.set(service.id, kinds);
  }

  if (kindsByService.size === 0) return counts;

  const { data: assignmentRows, error: assignmentsError } = await supabaseAdmin
    .from('service_assignments')
    .select('*')
    .in('service_id', [...kindsByService.keys()])
    .in('status', ['confirmed', 'pending']);

  if (assignmentsError) {
    console.error('[Reminders] Failed to load upcoming assignments:', assignmentsError.message);
    counts.preService.failed += 1;
    counts.preRehearsal.failed += 1;
    return counts;
  }

  const assignments = ((assignmentRows || []) as ReminderAssignmentRow[]).filter(
    (assignment) =>
      (assignment.status === 'confirmed' || assignment.status === 'pending') &&
      kindsByService.has(assignment.service_id)
  );

  const ledger = await loadReminderLedger(assignments.map((assignment) => assignment.id));
  if (ledger.error) {
    console.error('[Reminders] Failed to load sent reminder ledger:', ledger.error);
    counts.preService.failed += 1;
    counts.preRehearsal.failed += 1;
    return counts;
  }

  type Candidate = {
    assignment: ReminderAssignmentRow;
    service: ReminderServiceRow;
    kind: 'pre_service' | 'pre_rehearsal';
  };
  const candidates: Candidate[] = [];

  for (const assignment of assignments) {
    const service = serviceById.get(assignment.service_id);
    if (!service) continue;
    const kinds = kindsByService.get(assignment.service_id) || [];

    for (const kind of kinds) {
      const kindCounts =
        kind === 'pre_service' ? counts.preService : counts.preRehearsal;
      kindCounts.checked += 1;

      if (ledger.sent.has(`${assignment.id}:${kind}`)) {
        kindCounts.skipped += 1;
        continue;
      }

      candidates.push({ assignment, service, kind });
    }
  }

  if (candidates.length === 0) return counts;

  if (!(await isEmailConfigured())) {
    for (const candidate of candidates) {
      const kindCounts =
        candidate.kind === 'pre_service' ? counts.preService : counts.preRehearsal;
      kindCounts.skipped += 1;
    }
    return counts;
  }

  const memberById = await loadMembers(
    candidates.map((candidate) => candidate.assignment.team_member_id)
  );
  const churchById = await loadChurches(
    candidates.map((candidate) => candidate.service.church_id)
  );

  for (const candidate of candidates) {
    const { assignment, service, kind } = candidate;
    const kindCounts = kind === 'pre_service' ? counts.preService : counts.preRehearsal;

    const member = memberById.get(assignment.team_member_id);
    if (!member?.email) {
      kindCounts.skipped += 1;
      continue;
    }

    const church = churchById.get(service.church_id);
    if (!church) {
      kindCounts.skipped += 1;
      continue;
    }

    try {
      const needsResponse = assignment.status === 'pending';
      let acceptUrl: string | undefined;
      let declineUrl: string | undefined;

      if (needsResponse) {
        const rawToken = await createResponseTokenWithRetry(
          assignment.id,
          service.church_id,
          service.date,
          now
        );
        ({ confirmUrl: acceptUrl, declineUrl } = buildResponseUrls(rawToken));
      }

      const { html, text } = upcomingServiceReminderEmail({
        memberName: member.name,
        churchName: church.name,
        serviceTitle: service.title,
        serviceDate: service.date,
        serviceTime: service.time || '',
        role: assignment.role,
        kind: kind === 'pre_rehearsal' ? 'rehearsal' : 'service',
        rehearsalTime: service.rehearsal_time || undefined,
        acceptUrl,
        declineUrl,
      });

      const subject =
        kind === 'pre_rehearsal'
          ? `${needsResponse ? 'Please respond' : "You're on"}: rehearsal for ${service.title}`
          : `${needsResponse ? 'Please respond' : "You're on"}: ${service.title} is coming up`;

      const result = await sendEmail({
        to: member.email,
        subject,
        html,
        text,
      });

      if (!result.success) {
        kindCounts.failed += 1;
        continue;
      }

      await recordReminderSent(assignment.id, kind);
      kindCounts.sent += 1;
    } catch (error) {
      console.error(
        `[Reminders] Failed to send ${kind} reminder for ${assignment.id}:`,
        error
      );
      kindCounts.failed += 1;
    }
  }

  return counts;
}

/** Convenience wrapper for tests/callers that only want rehearsal reminders. */
export async function sendPreRehearsalReminders(
  now: Date = new Date()
): Promise<ReminderKindCounts> {
  const counts = await sendPreServiceReminders(now);
  return counts.preRehearsal;
}

/**
 * Escalate still-pending assignments to church admins/leaders shortly before
 * the service. The ledger records one `escalation` row per pending assignment
 * included in a successfully sent email, so a newly pending assignment
 * triggers a fresh escalation while old ones stay quiet.
 */
export async function sendEscalations(
  now: Date = new Date()
): Promise<EscalationReminderCounts> {
  const counts: EscalationReminderCounts = {
    services: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  if (!isSupabaseAdminConfigured()) return counts;

  const settings = getReminderSettings();
  const services = await loadUpcomingServices(now);
  if (services === null) {
    counts.failed += 1;
    return counts;
  }
  if (services.length === 0) return counts;

  const inWindow = services.filter((service) => {
    const serviceMs = serviceDateTimeMs(service);
    return serviceMs !== null && isWithinWindow(serviceMs, now, settings.escalationHours);
  });
  if (inWindow.length === 0) return counts;

  const serviceById = new Map(inWindow.map((service) => [service.id, service]));

  const { data: assignmentRows, error: assignmentsError } = await supabaseAdmin
    .from('service_assignments')
    .select('*')
    .in('service_id', [...serviceById.keys()])
    .eq('status', 'pending');

  if (assignmentsError) {
    console.error('[Reminders] Failed to load pending assignments:', assignmentsError.message);
    counts.failed += 1;
    return counts;
  }

  const pendingByService = new Map<string, ReminderAssignmentRow[]>();
  for (const assignment of (assignmentRows || []) as ReminderAssignmentRow[]) {
    if (assignment.status !== 'pending') continue;
    if (!serviceById.has(assignment.service_id)) continue;
    const list = pendingByService.get(assignment.service_id) || [];
    list.push(assignment);
    pendingByService.set(assignment.service_id, list);
  }

  const servicesWithPending = inWindow.filter(
    (service) => (pendingByService.get(service.id) || []).length > 0
  );
  counts.services = servicesWithPending.length;
  if (servicesWithPending.length === 0) return counts;

  const allPending = servicesWithPending.flatMap(
    (service) => pendingByService.get(service.id) || []
  );

  const ledger = await loadReminderLedger(allPending.map((assignment) => assignment.id));
  if (ledger.error) {
    console.error('[Reminders] Failed to load sent reminder ledger:', ledger.error);
    counts.failed += 1;
    return counts;
  }

  if (!(await isEmailConfigured())) {
    counts.skipped += servicesWithPending.length;
    return counts;
  }

  const memberById = await loadMembers(
    allPending.map((assignment) => assignment.team_member_id)
  );
  const churchById = await loadChurches(
    servicesWithPending.map((service) => service.church_id)
  );

  const { data: churchUserRows } = await supabaseAdmin
    .from('users')
    .select('id, name, email, role, church_id')
    .in('church_id', [...new Set(servicesWithPending.map((service) => service.church_id))]);

  const allUsers = [...((churchUserRows || []) as ReminderUserRow[])];

  // Fetch any service creator who was not returned by the church user query so
  // that creators who are admins or leaders still count. They are subject to
  // the same role, church, and email checks below; merely creating a service
  // never makes someone an escalation recipient.
  const knownUserIds = new Set(allUsers.map((user) => user.id));
  const missingCreatorIds = [
    ...new Set(
      servicesWithPending
        .map((service) => service.created_by)
        .filter((id): id is string => Boolean(id) && !knownUserIds.has(id!))
    ),
  ];

  if (missingCreatorIds.length > 0) {
    const { data: creatorRows } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, church_id')
      .in('id', missingCreatorIds);
    allUsers.push(...((creatorRows || []) as ReminderUserRow[]));
  }

  for (const service of servicesWithPending) {
    const pending = pendingByService.get(service.id) || [];
    const unmarked = pending.filter(
      (assignment) => !ledger.sent.has(`${assignment.id}:escalation`)
    );

    if (unmarked.length === 0) {
      counts.skipped += 1;
      continue;
    }

    const church = churchById.get(service.church_id);
    if (!church) {
      counts.skipped += 1;
      continue;
    }

    const leadersById = new Map<string, ReminderUserRow>();
    for (const user of allUsers) {
      if (
        user.church_id === service.church_id &&
        (user.role === 'admin' || user.role === 'leader') &&
        user.email
      ) {
        leadersById.set(user.id, user);
      }
    }

    if (leadersById.size === 0) {
      // Leave the ledger untouched so a later run can retry once a leader is
      // given an email address.
      counts.skipped += 1;
      continue;
    }

    const pendingForEmail = pending.map((assignment) => {
      const member = memberById.get(assignment.team_member_id);
      return {
        assignment,
        name: member?.name || 'Team member',
        role: assignment.role,
      };
    });

    const scheduleUrl = `${appBaseUrl()}/services/${service.id}?tab=schedule`;
    let emailed = false;
    let failed = false;

    for (const leader of leadersById.values()) {
      try {
        const { html, text } = leaderEscalationEmail({
          churchName: church.name,
          serviceTitle: service.title,
          serviceDate: service.date,
          serviceTime: service.time || undefined,
          pendingAssignments: pendingForEmail.map((item) => ({
            name: item.name,
            role: item.role,
          })),
          scheduleUrl,
        });

        const result = await sendEmail({
          to: leader.email!,
          subject: `Unconfirmed team members for ${service.title}`,
          html,
          text,
        });

        if (result.success) {
          counts.sent += 1;
          emailed = true;
        } else {
          counts.failed += 1;
          failed = true;
        }
      } catch (error) {
        console.error(
          `[Reminders] Failed to send escalation for service ${service.id}:`,
          error
        );
        counts.failed += 1;
        failed = true;
      }
    }

    if (!emailed) {
      // Never mark assignments when no escalation email was accepted.
      if (!failed) counts.skipped += 1;
      continue;
    }

    for (const item of pendingForEmail) {
      if (ledger.sent.has(`${item.assignment.id}:escalation`)) continue;
      await recordReminderSent(item.assignment.id, 'escalation');
      ledger.sent.add(`${item.assignment.id}:escalation`);
    }
  }

  return counts;
}

// ── Unconfirmed 3-day / 1-day response reminders ─────────────────────
//
// Volunteers who have not yet responded get a reminder exactly 3 days and
// exactly 1 day before the service. Dates are compared in UTC calendar terms
// (`YYYY-MM-DD` derived from `toISOString()`), which matches how the rest of
// the reminder job reasons about service dates.

export interface UnconfirmedReminderCounts {
  /** Pending assignments on a 3-day or 1-day service that were considered. */
  checked: number;
  /** Reminder emails successfully sent. */
  sent: number;
  /** Already reminded, missing email, or missing church. */
  skipped: number;
  /** Token creation or email send failures (retried on the next run). */
  failed: number;
  /** Successful 3-day reminders. */
  threeDay: number;
  /** Successful 1-day reminders. */
  oneDay: number;
}

/** UTC dates that are exactly 3 days and 1 day from `now`. */
export function reminderTargetDates(now: Date = new Date()): {
  threeDay: string;
  oneDay: string;
} {
  const today = Date.parse(`${utcDateKey(now)}T00:00:00.000Z`);
  return {
    threeDay: utcDateKey(new Date(today + 3 * DAY_MS)),
    oneDay: utcDateKey(new Date(today + 1 * DAY_MS)),
  };
}

/** Which reminder kind a service date triggers today, if any. */
export function reminderKindForServiceDate(
  serviceDate: string,
  now: Date = new Date()
): '3d' | '1d' | null {
  const key = (serviceDate || '').slice(0, 10);
  const targets = reminderTargetDates(now);
  if (key === targets.threeDay) return '3d';
  if (key === targets.oneDay) return '1d';
  return null;
}

/**
 * Send tokenized confirm/decline reminders to volunteers whose assignment is
 * still pending exactly 3 days and 1 day before the service.
 *
 * - Only `pending` assignments are considered (the status check constraint
 *   allows pending / confirmed / declined; there is no separate "unconfirmed").
 * - `assignment_reminders_sent` makes the pass idempotent per (assignment, kind).
 * - Each email contains fresh single-use links and never exposes other
 *   volunteers' information.
 */
export async function sendUnconfirmedResponseReminders(
  now: Date = new Date()
): Promise<UnconfirmedReminderCounts> {
  const counts: UnconfirmedReminderCounts = {
    checked: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    threeDay: 0,
    oneDay: 0,
  };

  if (!isSupabaseAdminConfigured()) {
    return counts;
  }

  const { threeDay, oneDay } = reminderTargetDates(now);

  const { data: services, error: servicesError } = await supabaseAdmin
    .from('services')
    .select('id, title, date, time, church_id')
    .in('date', [threeDay, oneDay]);

  if (servicesError) {
    console.error('[Reminders] Failed to load reminder services:', servicesError.message);
    counts.failed += 1;
    return counts;
  }

  const serviceRows = (services || []) as ReminderServiceRow[];
  if (serviceRows.length === 0) return counts;

  const serviceById = new Map(serviceRows.map((service) => [service.id, service]));

  const { data: assignments, error: assignmentsError } = await supabaseAdmin
    .from('service_assignments')
    .select('id, service_id, team_member_id, role, status')
    .in('service_id', [...serviceById.keys()])
    .eq('status', 'pending');

  if (assignmentsError) {
    console.error('[Reminders] Failed to load pending assignments:', assignmentsError.message);
    counts.failed += 1;
    return counts;
  }

  const pending = ((assignments || []) as ReminderAssignmentRow[]).filter((assignment) => {
    if (assignment.status !== 'pending') return false;
    const service = serviceById.get(assignment.service_id);
    return Boolean(service && reminderKindForServiceDate(service.date, now));
  });

  counts.checked = pending.length;
  if (pending.length === 0) return counts;

  const ledger = await loadReminderLedger(pending.map((assignment) => assignment.id));
  if (ledger.error) {
    console.error('[Reminders] Failed to load sent reminder ledger:', ledger.error);
    counts.failed += 1;
    return counts;
  }
  const alreadySent = ledger.sent;

  const memberById = await loadMembers(
    pending.map((assignment) => assignment.team_member_id)
  );
  const churchById = await loadChurches(
    serviceRows.map((service) => service.church_id)
  );

  if (!(await isEmailConfigured())) {
    counts.skipped += pending.length;
    return counts;
  }

  for (const assignment of pending) {
    const service = serviceById.get(assignment.service_id);
    if (!service) {
      counts.skipped += 1;
      continue;
    }

    const kind = reminderKindForServiceDate(service.date, now);
    if (!kind) continue;

    if (alreadySent.has(`${assignment.id}:${kind}`)) {
      counts.skipped += 1;
      continue;
    }

    const member = memberById.get(assignment.team_member_id);
    if (!member?.email) {
      // No email address: skip silently instead of failing the whole run.
      counts.skipped += 1;
      continue;
    }

    const church = churchById.get(service.church_id);
    if (!church) {
      counts.skipped += 1;
      continue;
    }

    try {
      const rawToken = await createResponseTokenWithRetry(
        assignment.id,
        service.church_id,
        service.date,
        now
      );
      const { confirmUrl, declineUrl } = buildResponseUrls(rawToken);

      const { html, text } = serviceReminderEmail({
        memberName: member.name,
        churchName: church.name,
        serviceTitle: service.title,
        serviceDate: service.date,
        serviceTime: service.time || '',
        role: assignment.role,
        acceptUrl: confirmUrl,
        declineUrl,
      });

      const result = await sendEmail({
        to: member.email,
        subject: `Reminder: Please respond for ${service.title}`,
        html,
        text,
      });

      if (!result.success) {
        counts.failed += 1;
        continue;
      }

      // Record only after the email is accepted so a transient failure is
      // retried on the next run.
      await recordReminderSent(assignment.id, kind);

      counts.sent += 1;
      if (kind === '3d') counts.threeDay += 1;
      else counts.oneDay += 1;
    } catch (error) {
      console.error(
        `[Reminders] Failed to remind assignment ${assignment.id}:`,
        error instanceof Error ? error.message : 'unknown error'
      );
      counts.failed += 1;
    }
  }

  return counts;
}

/**
 * Run every reminder kind once. Exported with a `now` parameter so tests can
 * freeze time; `runReminders` uses the real clock.
 */
export async function runAllReminderKinds(
  now: Date = new Date()
): Promise<ReminderRunCounts> {
  const unconfirmed = await sendUnconfirmedResponseReminders(now);
  const initial = await sendInitialReminders(now);
  const preService = await sendPreServiceReminders(now);
  const escalation = await sendEscalations(now);

  return {
    ...unconfirmed,
    unconfirmed,
    initial,
    preService: preService.preService,
    preRehearsal: preService.preRehearsal,
    escalation,
  };
}

/**
 * Main entry point for reminder job
 * Call this from a scheduled cron job
 *
 * Example cron schedule: once a day at 13:00 UTC
 * node -e "require('./dist/lib/reminders.js').runReminders()"
 */
export async function runReminders(now: Date = new Date()): Promise<ReminderRunCounts> {
  try {
    console.log('[Reminders] Starting reminder job...');

    const reminders = await runAllReminderKinds(now);

    console.log(
      `[Reminders] Unconfirmed: ${reminders.unconfirmed.sent} sent, ${reminders.unconfirmed.skipped} skipped, ${reminders.unconfirmed.failed} failed`
    );
    console.log(
      `[Reminders] Initial: ${reminders.initial.sent} sent, ${reminders.initial.skipped} skipped`
    );
    console.log(
      `[Reminders] Pre-service: ${reminders.preService.sent} sent, pre-rehearsal: ${reminders.preRehearsal.sent} sent`
    );
    console.log(
      `[Reminders] Escalations: ${reminders.escalation.sent} sent across ${reminders.escalation.services} services`
    );

    return reminders;
  } catch (error) {
    console.error('[Reminders] Fatal error in reminder job:', error);
    throw error;
  }
}

/**
 * API route handler wrapper
 * This allows calling the reminder job via HTTP (useful for cron services)
 */
export async function handleRemindersRequest(): Promise<{
  success: boolean;
  message: string;
  reminders?: ReminderRunCounts;
}> {
  try {
    const reminders = await runReminders();
    return {
      success: true,
      message: 'Reminders sent successfully',
      reminders,
    };
  } catch (error) {
    console.error('[Reminders] Error in request handler:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
