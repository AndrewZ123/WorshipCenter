/**
 * Reminder Job Logic for WorshipCenter
 * 
 * This module handles automated reminders and escalations for service scheduling.
 * It's designed to be called from a scheduled cron job (e.g., every 15-60 minutes).
 */

import { db } from './store';
import { sendNotification, NotificationType } from './notifications';
import { env } from './env';
import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase';
import { sendEmail, isEmailConfigured } from './email';
import { serviceReminderEmail } from './email-templates';
import { buildResponseUrls, createResponseToken } from './assignment-response-tokens';
import type { ServiceAssignment } from './types';

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

/**
 * Find assignments that need initial confirmation reminders
 * 
 * Criteria:
 * - Status is 'pending'
 * - Created more than initialReminderHours ago
 * - No previous reminder has been sent (tracked via notification type)
 */
async function findInitialReminderAssignments(churchId: string, settings: ReminderSettings): Promise<ServiceAssignment[]> {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - settings.initialReminderHours);

  // Get all services for this church, then get their assignments
  const services = await db.services.getByChurch(churchId);
  const allAssignments: ServiceAssignment[] = [];
  
  for (const service of services) {
    const assignments = await db.assignments.getByService(service.id, churchId);
    allAssignments.push(...assignments);
  }
  
  return allAssignments.filter(assignment => {
    if (!assignment.created_at) return false;
    const createdAt = new Date(assignment.created_at);
    return (
      assignment.status === 'pending' &&
      createdAt < cutoffDate
    );
  });
}

/**
 * Find upcoming services that need pre-rehearsal or pre-service reminders
 */
async function findUpcomingServices(churchId: string, settings: ReminderSettings): Promise<any[]> {
  const services = await db.services.getByChurch(churchId);
  const now = new Date();
  
  return services.filter(service => {
    const serviceDate = new Date(service.date);
    const hoursUntilService = (serviceDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // Return services in the next 72 hours (3 days)
    return hoursUntilService > 0 && hoursUntilService < 72;
  });
}

/**
 * Send initial confirmation reminder for pending assignments
 */
async function sendInitialReminders(churchId: string): Promise<void> {
  const settings = getReminderSettings();
  const assignments = await findInitialReminderAssignments(churchId, settings);
  
  for (const assignment of assignments) {
    // Get service and member details first
    const service = await db.services.getById(assignment.service_id, churchId);
    const member = await db.teamMembers.getById(assignment.team_member_id, churchId);
    
    if (!service || !member || !member.user_id) continue;
    
    // Check if we've already sent a reminder for this assignment
    // We'll check user's notifications
    const userNotifications = await db.notifications.getByUser(member.user_id);
    const alreadySent = userNotifications.some(n => 
      n.type === 'initial_reminder' && n.assignment_id === assignment.id
    );
    
    if (alreadySent) continue;
    
    // Build notification
    const roleLabel = assignment.role.split('_').map((w: string) => 
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');
    
    const linkUrl = `${env.appUrl}/services/${service.id}/schedule?assignmentId=${assignment.id}`;
    
    await sendNotification({
      userId: member.user_id,
      type: NotificationType.ASSIGNMENT_REMINDER,
      subject: 'Reminder: Please confirm your schedule',
      body: `You're scheduled for ${roleLabel} at ${service.title} on ${service.date}. Please confirm or decline your availability.`,
      linkUrl,
      organizationId: churchId,
      metadata: { assignmentId: assignment.id },
    });
    
    console.log(`[Reminders] Sent initial reminder for assignment ${assignment.id}`);
  }
}

/**
 * Send pre-rehearsal and pre-service reminders
 */
async function sendPreServiceReminders(churchId: string): Promise<void> {
  const settings = getReminderSettings();
  const upcomingServices = await findUpcomingServices(churchId, settings);
  
  for (const service of upcomingServices) {
    const serviceDate = new Date(service.date);
    const now = new Date();
    const hoursUntilService = (serviceDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // Get all assignments for this service
    const assignments = await db.assignments.getByService(service.id, churchId);
    const confirmedAndPending = assignments.filter(a => a.status === 'confirmed' || a.status === 'pending');
    
    // Pre-rehearsal reminder (if there's a rehearsal time)
    if (service.rehearsal_time && typeof service.rehearsal_time === 'string') {
      const rehearsalDate = new Date(`${service.date}T${service.rehearsal_time}`);
      const hoursUntilRehearsal = (rehearsalDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      // Check if we should send pre-rehearsal reminder (within the reminder window)
      if (hoursUntilRehearsal > 0 && hoursUntilRehearsal <= settings.preRehearsalReminderHours + 1) {
        // Check if we've already sent by checking all users' notifications
        const allSent = await Promise.all(
          confirmedAndPending.map(async (assignment) => {
            const member = await db.teamMembers.getById(assignment.team_member_id, churchId);
            if (!member?.user_id) return true;
            
            const userNotifications = await db.notifications.getByUser(member.user_id);
            return userNotifications.some(n => 
              n.type === 'pre_rehearsal_reminder' && n.service_id === service.id
            );
          })
        );
        
        if (allSent.every(sent => sent)) continue;
        
        for (const assignment of confirmedAndPending) {
          const member = await db.teamMembers.getById(assignment.team_member_id, churchId);
          if (!member || !member.user_id) continue;
          
          const roleLabel = assignment.role.split('_').map((w: string) => 
            w.charAt(0).toUpperCase() + w.slice(1)
          ).join(' ');
          
          await sendNotification({
            userId: member.user_id,
            type: NotificationType.REHEARSAL_REMINDER,
            subject: `Rehearsal tomorrow: ${service.title}`,
            body: `Rehearsal is at ${service.rehearsal_time} on ${service.date}. You're scheduled for ${roleLabel}.`,
            linkUrl: `${env.appUrl}/services/${service.id}`,
            organizationId: churchId,
            metadata: { serviceId: service.id },
          });
        }
        
        console.log(`[Reminders] Sent pre-rehearsal reminder for service ${service.id}`);
      }
    }
    
    // Pre-service reminder
    if (hoursUntilService > 0 && hoursUntilService <= settings.preServiceReminderHours + 1) {
      // Check if we've already sent
      const allSent = await Promise.all(
        confirmedAndPending.map(async (assignment) => {
          const member = await db.teamMembers.getById(assignment.team_member_id, churchId);
          if (!member?.user_id) return true;
          
          const userNotifications = await db.notifications.getByUser(member.user_id);
          return userNotifications.some(n => 
            n.type === 'pre_service_reminder' && n.service_id === service.id
          );
        })
      );
      
      if (allSent.every(sent => sent)) continue;
      
      for (const assignment of confirmedAndPending) {
        const member = await db.teamMembers.getById(assignment.team_member_id, churchId);
        if (!member || !member.user_id) continue;
        
        const roleLabel = assignment.role.split('_').map((w: string) => 
          w.charAt(0).toUpperCase() + w.slice(1)
        ).join(' ');
        
        await sendNotification({
          userId: member.user_id,
          type: NotificationType.SERVICE_REMINDER,
          subject: `Service this weekend: ${service.title}`,
          body: `Service is at ${service.time} on ${service.date}. You're scheduled for ${roleLabel}.`,
          linkUrl: `${env.appUrl}/services/${service.id}`,
          organizationId: churchId,
          metadata: { serviceId: service.id },
        });
      }
      
      console.log(`[Reminders] Sent pre-service reminder for service ${service.id}`);
    }
  }
}

/**
 * Send escalation notifications to leaders for unconfirmed assignments
 */
async function sendEscalations(churchId: string): Promise<void> {
  const settings = getReminderSettings();
  const upcomingServices = await findUpcomingServices(churchId, settings);
  
  for (const service of upcomingServices) {
    const serviceDate = new Date(service.date);
    const now = new Date();
    const hoursUntilService = (serviceDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // Only escalate within escalation window
    if (hoursUntilService <= 0 || hoursUntilService > settings.escalationHours) {
      continue;
    }
    
    // Check if we've already escalated
    // We'll need to check all admin/worship leader users in the church
    const users = await db.users.getByChurch(churchId);
    const escalationCheck = await Promise.all(
      users.map(async (user) => {
        const userNotifications = await db.notifications.getByUser(user.id);
        return userNotifications.some(n => 
          n.type === 'escalation' && n.service_id === service.id
        );
      })
    );
    
    if (escalationCheck.every(escalated => escalated)) continue;
    
    // Find pending assignments
    const assignments = await db.assignments.getByService(service.id, churchId);
    const pendingAssignments = assignments.filter(a => a.status === 'pending');
    
    if (pendingAssignments.length === 0) continue;
    
    // Build list of pending team members
    const pendingMembers: string[] = [];
    for (const assignment of pendingAssignments) {
      const member = await db.teamMembers.getById(assignment.team_member_id, churchId);
      if (member) {
        const roleLabel = assignment.role.split('_').map((w: string) => 
          w.charAt(0).toUpperCase() + w.slice(1)
        ).join(' ');
        pendingMembers.push(`${member.name} (${roleLabel})`);
      }
    }
    
    // Notify worship leader/admin
    // In a real implementation, you'd find the worship leader or admin for this church
    // For now, we'll log this information
    console.log(`[Reminders] Escalation needed for ${pendingMembers.length} pending assignments on ${service.date}`);
    console.log(`[Reminders] Pending: ${pendingMembers.join(', ')}`);
    
    // TODO: Get worship leader user and send notification
    // const worshipLeader = await getWorshipLeader(churchId);
    // if (worshipLeader) {
    //   await sendNotification({
    //     userId: worshipLeader.id,
    //     type: NotificationType.ESCALATION,
    //     subject: `Unconfirmed team members for ${service.title}`,
    //     body: `The following team members haven't confirmed yet:\n${pendingMembers.join('\n')}`,
    //     linkUrl: `${env.appUrl}/services/${service.id}/schedule`,
    //     organizationId: churchId,
    //     metadata: { serviceId: service.id },
    //   });
    // }
  }
}

// ── Unconfirmed 3-day / 1-day response reminders ─────────────────────
//
// Volunteers who have not yet responded get a reminder exactly 3 days and
// exactly 1 day before the service. Dates are compared in UTC calendar terms
// (`YYYY-MM-DD` derived from `toISOString()`), which matches how the rest of
// the reminder job reasons about service dates.

const DAY_MS = 24 * 60 * 60 * 1000;

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

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
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

interface ReminderServiceRow {
  id: string;
  title: string;
  date: string;
  time: string | null;
  church_id: string;
}

interface ReminderAssignmentRow {
  id: string;
  service_id: string;
  team_member_id: string;
  role: string;
  status: string;
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

  const { data: sentRows } = await supabaseAdmin
    .from('assignment_reminders_sent')
    .select('assignment_id, kind')
    .in('assignment_id', pending.map((assignment) => assignment.id));

  const alreadySent = new Set(
    ((sentRows || []) as Array<{ assignment_id: string; kind: string }>).map(
      (row) => `${row.assignment_id}:${row.kind}`
    )
  );

  const { data: members } = await supabaseAdmin
    .from('team_members')
    .select('id, name, email')
    .in('id', [...new Set(pending.map((assignment) => assignment.team_member_id))]);

  const memberById = new Map(
    ((members || []) as ReminderMemberRow[]).map((member) => [member.id, member])
  );

  const { data: churches } = await supabaseAdmin
    .from('churches')
    .select('id, name')
    .in('id', [...new Set(serviceRows.map((service) => service.church_id))]);

  const churchById = new Map(
    ((churches || []) as ReminderChurchRow[]).map((church) => [church.id, church])
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
      const rawToken = await createResponseToken(assignment.id, service.church_id, service.date);
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
      const { error: markError } = await supabaseAdmin
        .from('assignment_reminders_sent')
        .insert({ assignment_id: assignment.id, kind });

      if (markError) {
        console.error(
          `[Reminders] Failed to record reminder for assignment ${assignment.id}:`,
          markError.message
        );
      }

      counts.sent += 1;
      if (kind === '3d') counts.threeDay += 1;
      else counts.oneDay += 1;
    } catch (error) {
      console.error(`[Reminders] Failed to remind assignment ${assignment.id}:`, error);
      counts.failed += 1;
    }
  }

  return counts;
}

  /**
 * Main entry point for reminder job
 * Call this from a scheduled cron job
 * 
 * Example cron schedule: every 15 minutes
 * node -e "require('./dist/lib/reminders.js').runReminders()"
 */
export async function runReminders(): Promise<UnconfirmedReminderCounts> {
  try {
    console.log('[Reminders] Starting reminder job...');

    const unconfirmed = await sendUnconfirmedResponseReminders();

    // For multi-tenant setup, we'd get all churches
    // For now, we'll skip this as db.churches.getAll() doesn't exist
    // In a real implementation, you'd have a method to get all church IDs
    // or you'd pass specific church IDs to this function

    console.log(
      `[Reminders] Unconfirmed reminders: ${unconfirmed.sent} sent, ${unconfirmed.skipped} skipped, ${unconfirmed.failed} failed`
    );
    return unconfirmed;

    // Example implementation for single church or specific church:
    // const churchId = 'your-church-id';
    // await sendInitialReminders(churchId);
    // await sendPreServiceReminders(churchId);
    // await sendEscalations(churchId);
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
  reminders?: UnconfirmedReminderCounts;
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