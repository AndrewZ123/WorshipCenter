// Unified Notification Service
// Handles multi-channel notifications (in-app, email, SMS)

import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { sendSMS, isSMSAvailable, formatPhoneNumber } from '@/lib/sms';
import { env } from '@/lib/env';

/**
 * Notification types
 */
export enum NotificationType {
  ASSIGNMENT_CREATED = 'ASSIGNMENT_CREATED',
  ASSIGNMENT_REMINDER = 'ASSIGNMENT_REMINDER',
  ASSIGNMENT_CHANGED = 'ASSIGNMENT_CHANGED',
  ASSIGNMENT_CONFIRMED = 'ASSIGNMENT_CONFIRMED',
  ASSIGNMENT_DECLINED = 'ASSIGNMENT_DECLINED',
  SERVICE_REMINDER = 'SERVICE_REMINDER',
  REHEARSAL_REMINDER = 'REHEARSAL_REMINDER',
  ESCALATION_PENDING = 'ESCALATION_PENDING',
}

/**
 * Notification channels
 */
export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
}

/**
 * Send options for notifications
 */
export interface SendNotificationOptions {
  userId: string;
  type: NotificationType;
  subject: string;
  body: string;
  linkUrl?: string;
  channels?: NotificationChannel[];
  organizationId: string;
  // Optional metadata for tracking
  metadata?: Record<string, any>;
}

/**
 * Notification result
 */
export interface NotificationResult {
  success: boolean;
  channelsSent: NotificationChannel[];
  errors: Array<{ channel: NotificationChannel; error: string }>;
}

/**
 * Main notification sender function
 * Sends notifications through multiple channels based on availability
 * @param options - Notification options
 * @returns Promise with success status and per-channel results
 */
export async function sendNotification(options: SendNotificationOptions): Promise<NotificationResult> {
  const {
    userId,
    type,
    subject,
    body,
    linkUrl,
    channels = [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
    organizationId,
    metadata = {},
  } = options;

  // Get user details
  const { data: user, error: userError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, phone, name, organization_id')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    console.error('[Notification] User not found:', userId, userError);
    return {
      success: false,
      channelsSent: [],
      errors: [{ channel: NotificationChannel.IN_APP, error: 'User not found' }],
    };
  }

  // Verify user belongs to organization
  if (user.organization_id !== organizationId) {
    console.error('[Notification] User does not belong to organization:', userId, organizationId);
    return {
      success: false,
      channelsSent: [],
      errors: [{ channel: NotificationChannel.IN_APP, error: 'Organization mismatch' }],
    };
  }

  const results: NotificationResult = {
    success: true,
    channelsSent: [],
    errors: [],
  };

  // Store notification in database (always for in-app)
  if (channels.includes(NotificationChannel.IN_APP)) {
    try {
      const { error: insertError } = await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type,
        subject,
        body,
        link_url: linkUrl,
        sent_at: new Date().toISOString(),
        channel_in_app: true,
        channel_email: channels.includes(NotificationChannel.EMAIL),
        channel_sms: channels.includes(NotificationChannel.SMS),
        metadata,
      });

      if (insertError) {
        throw insertError;
      }

      results.channelsSent.push(NotificationChannel.IN_APP);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Notification] Failed to store in-app notification:', errorMessage);
      results.errors.push({ channel: NotificationChannel.IN_APP, error: errorMessage });
      results.success = false;
    }
  }

  // Send email
  if (channels.includes(NotificationChannel.EMAIL) && await isEmailConfigured() && user.email) {
    try {
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${subject}</h2>
          <p>${body}</p>
          ${linkUrl ? `<p><a href="${env.appUrl()}${linkUrl}" style="background: #007AFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View in App</a></p>` : ''}
          <p style="color: #666; font-size: 14px; margin-top: 24px;">This is an automated message from WorshipCenter.</p>
        </div>
      `;

      const plainTextBody = `${subject}\n\n${body}\n\n${linkUrl ? `${env.appUrl()}${linkUrl}` : ''}\n\nThis is an automated message from WorshipCenter.`;

      await sendEmail({
        to: user.email,
        subject: subject,
        html: emailBody,
        text: plainTextBody,
      });

      results.channelsSent.push(NotificationChannel.EMAIL);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Notification] Failed to send email:', errorMessage);
      results.errors.push({ channel: NotificationChannel.EMAIL, error: errorMessage });
      // Don't mark as failed if other channels succeed
    }
  }

  // Send SMS
  if (channels.includes(NotificationChannel.SMS) && isSMSAvailable() && user.phone) {
    try {
      const smsBody = `${subject}\n\n${body}\n\n${linkUrl ? `${env.appUrl()}${linkUrl}` : ''}`;
      const formattedPhone = formatPhoneNumber(user.phone);

      await sendSMS({
        to: formattedPhone,
        body: smsBody,
      });

      results.channelsSent.push(NotificationChannel.SMS);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Notification] Failed to send SMS:', errorMessage);
      results.errors.push({ channel: NotificationChannel.SMS, error: errorMessage });
      // Don't mark as failed if other channels succeed
    }
  }

  return results;
}

/**
 * Create an assignment notification
 * Used when a user is scheduled for a service
 */
export async function sendAssignmentNotification(options: {
  userId: string;
  serviceId: string;
  serviceName: string;
  role: string;
  serviceDate: string;
  organizationId: string;
}): Promise<NotificationResult> {
  const { userId, serviceId, serviceName, role, serviceDate, organizationId } = options;
  const linkUrl = `/services/${serviceId}?assignmentId=`;

  return sendNotification({
    userId,
    type: NotificationType.ASSIGNMENT_CREATED,
    subject: `You're scheduled for ${role}`,
    body: `You've been scheduled as ${role} for ${serviceName} on ${serviceDate}. Please confirm your attendance.`,
    linkUrl,
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
    organizationId,
    metadata: {
      serviceId,
      role,
      serviceDate,
    },
  });
}

/**
 * Send reminder for pending assignment
 */
export async function sendAssignmentReminderNotification(options: {
  userId: string;
  serviceId: string;
  serviceName: string;
  role: string;
  serviceDate: string;
  organizationId: string;
}): Promise<NotificationResult> {
  const { userId, serviceId, serviceName, role, serviceDate, organizationId } = options;
  const linkUrl = `/services/${serviceId}`;

  return sendNotification({
    userId,
    type: NotificationType.ASSIGNMENT_REMINDER,
    subject: `Reminder: Please confirm your schedule for ${serviceName}`,
    body: `This is a reminder to confirm your ${role} role for ${serviceName} on ${serviceDate}.`,
    linkUrl,
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
    organizationId,
    metadata: {
      serviceId,
      role,
      serviceDate,
    },
  });
}

/**
 * Send pre-service or pre-rehearsal reminder
 */
export async function sendServiceReminderNotification(options: {
  userId: string;
  serviceId: string;
  serviceName: string;
  reminderType: 'rehearsal' | 'service';
  dateTime: string;
  organizationId: string;
}): Promise<NotificationResult> {
  const { userId, serviceId, serviceName, reminderType, dateTime, organizationId } = options;
  const subject = reminderType === 'rehearsal' ? `Rehearsal Reminder: ${serviceName}` : `Service Reminder: ${serviceName}`;
  const type = reminderType === 'rehearsal' ? NotificationType.REHEARSAL_REMINDER : NotificationType.SERVICE_REMINDER;
  const linkUrl = `/services/${serviceId}`;

  return sendNotification({
    userId,
    type,
    subject,
    body: `This is a reminder for your ${reminderType === 'rehearsal' ? 'rehearsal' : 'service'} for ${serviceName} at ${dateTime}.`,
    linkUrl,
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
    organizationId,
    metadata: {
      serviceId,
      reminderType,
      dateTime,
    },
  });
}

/**
 * Send escalation notification to leaders
 */
export async function sendEscalationNotification(options: {
  leaderId: string;
  serviceId: string;
  serviceName: string;
  pendingAssignments: Array<{ userName: string; role: string }>;
  serviceDate: string;
  organizationId: string;
}): Promise<NotificationResult> {
  const { leaderId, serviceId, serviceName, pendingAssignments, serviceDate, organizationId } = options;
  const linkUrl = `/services/${serviceId}?tab=schedule`;

  const pendingList = pendingAssignments.map(a => `${a.userName} (${a.role})`).join(', ');
  const body = `The following team members have not yet confirmed their schedules for ${serviceName} on ${serviceDate}:\n\n${pendingList}`;

  return sendNotification({
    userId: leaderId,
    type: NotificationType.ESCALATION_PENDING,
    subject: `Unconfirmed team members for ${serviceName}`,
    body,
    linkUrl,
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    organizationId,
    metadata: {
      serviceId,
      pendingAssignments,
      serviceDate,
    },
  });
}

/**
 * Send notification when team member confirms
 */
export async function sendConfirmationNotification(options: {
  leaderId: string;
  serviceId: string;
  serviceName: string;
  userName: string;
  role: string;
  serviceDate: string;
  organizationId: string;
}): Promise<NotificationResult> {
  const { leaderId, serviceId, serviceName, userName, role, serviceDate, organizationId } = options;
  const linkUrl = `/services/${serviceId}?tab=schedule`;

  return sendNotification({
    userId: leaderId,
    type: NotificationType.ASSIGNMENT_CONFIRMED,
    subject: `${userName} confirmed for ${serviceName}`,
    body: `${userName} has confirmed their ${role} role for ${serviceName} on ${serviceDate}.`,
    linkUrl,
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    organizationId,
    metadata: {
      serviceId,
      userName,
      role,
      serviceDate,
    },
  });
}

/**
 * Send notification when team member declines
 */
export async function sendDeclinationNotification(options: {
  leaderId: string;
  serviceId: string;
  serviceName: string;
  userName: string;
  role: string;
  serviceDate: string;
  organizationId: string;
}): Promise<NotificationResult> {
  const { leaderId, serviceId, serviceName, userName, role, serviceDate, organizationId } = options;
  const linkUrl = `/services/${serviceId}?tab=schedule`;

  return sendNotification({
    userId: leaderId,
    type: NotificationType.ASSIGNMENT_DECLINED,
    subject: `${userName} declined for ${serviceName}`,
    body: `${userName} has declined their ${role} role for ${serviceName} on ${serviceDate}. You may need to find a replacement.`,
    linkUrl,
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    organizationId,
    metadata: {
      serviceId,
      userName,
      role,
      serviceDate,
    },
  });
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(userId: string, limit: number = 50) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Notification] Failed to fetch notifications:', error);
    return [];
  }

  return data;
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string, userId: string) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    console.error('[Notification] Failed to mark notification as read:', error);
    return false;
  }

  return true;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    console.error('[Notification] Failed to mark all notifications as read:', error);
    return false;
  }

  return true;
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    console.error('[Notification] Failed to get unread count:', error);
    return 0;
  }

  return count || 0;
}