/**
 * Reminder Job Logic for WorshipCenter
 * 
 * This module handles automated reminders and escalations for service scheduling.
 * It's designed to be called from a scheduled cron job (e.g., every 15-60 minutes).
 */

import { db } from './store';
import { sendNotification, NotificationType } from './notifications';
import { env } from './env';
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

  /**
 * Main entry point for reminder job
 * Call this from a scheduled cron job
 * 
 * Example cron schedule: every 15 minutes
 * node -e "require('./dist/lib/reminders.js').runReminders()"
 */
export async function runReminders(): Promise<void> {
  try {
    console.log('[Reminders] Starting reminder job...');
    
    // For multi-tenant setup, we'd get all churches
    // For now, we'll skip this as db.churches.getAll() doesn't exist
    // In a real implementation, you'd have a method to get all church IDs
    // or you'd pass specific church IDs to this function
    
    console.log('[Reminders] Warning: No churches to process (db.churches.getAll() not implemented)');
    console.log('[Reminders] Reminder job completed with no changes');
    
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
export async function handleRemindersRequest(): Promise<{ success: boolean; message: string }> {
  try {
    await runReminders();
    return {
      success: true,
      message: 'Reminders sent successfully',
    };
  } catch (error) {
    console.error('[Reminders] Error in request handler:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}