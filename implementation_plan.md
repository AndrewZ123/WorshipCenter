# Implementation Plan

## Overview

Implement service-tied chat, multi-channel notifications, one-tap assignment confirmation, and smart reminders for the WorshipCenter application using existing patterns and minimal refactoring.

This implementation extends the existing church management system with communication features that improve team coordination and reduce manual follow-up for service leaders. The approach integrates seamlessly with the current Supabase/Next.js architecture, reusing existing patterns for data access, authentication, and UI components.

## Types

Extend TypeScript type definitions in `src/lib/types.ts` with new interfaces for service chat, enhanced notifications, and reminder settings.

**New Type Definitions:**

```typescript
// Service Chat
export interface ServiceChat {
  id: string;
  service_id: string;
  church_id: string;
  created_at: string;
}

export interface ServiceChatMessage {
  id: string;
  chat_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface ServiceChatMessagePopulated extends ServiceChatMessage {
  user: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

// Enhanced Notification
export type NotificationType = 
  | 'invitation' 
  | 'status_change' 
  | 'service_reminder' 
  | 'general'
  | 'assignment_created'
  | 'assignment_reminder'
  | 'assignment_changed'
  | 'escalation';

export interface EnhancedNotification extends Notification {
  assignment_id?: string;
  link_url: string;
  sent_at: string;
  channels_sent?: {
    in_app: boolean;
    email: boolean;
    sms: boolean;
  };
}

// Reminder Settings
export interface ReminderSettings {
  initial_reminder_hours: number;      // Hours after assignment creation
  pre_rehearsal_reminder_hours: number; // Hours before rehearsal
  pre_service_reminder_hours: number;  // Hours before service
  escalation_hours: number;             // Hours before service for pending
}
```

## Files

Create new files and modify existing ones to implement the features while maintaining backward compatibility.

**New Files:**
- `supabase/migrations/015_add_service_chat_tables.sql` - Service chat tables
- `supabase/migrations/016_enhance_notifications_table.sql` - Add link_url, sent_at, channels_sent
- `supabase/migrations/017_add_reminder_settings_table.sql` - Reminder configuration
- `supabase/migrations/018_add_phone_to_users.sql` - Phone field for SMS
- `src/lib/sms.ts` - SMS service (Twilio abstraction)
- `src/lib/notifications.ts` - Unified notification service
- `src/lib/reminders.ts` - Reminder job logic
- `src/app/api/service-chat/[serviceId]/messages/route.ts` - Chat messages API
- `src/app/api/service-chat/[serviceId]/subscribe/route.ts` - Chat subscription
- `src/app/api/assignments/[assignmentId]/confirm/route.ts` - Confirm assignment
- `src/app/api/assignments/[assignmentId]/decline/route.ts` - Decline assignment
- `src/app/api/notifications/send-assignment/route.ts` - Send assignment notification
- `src/app/api/reminders/run/route.ts` - Reminder cron endpoint
- `src/components/services/ServiceChat.tsx` - Chat UI component
- `src/components/services/ServiceSchedule.tsx` - Schedule tab with confirm/decline
- `src/components/services/ServiceOverview.tsx` - Overview tab
- `src/components/services/ServicePlan.tsx` - Plan tab
- `src/components/services/ServiceTabs.tsx` - Tab navigation

**Modified Files:**
- `src/lib/types.ts` - Add new type definitions
- `src/lib/store.ts` - Add service chat methods, enhanced notification methods
- `src/app/(app)/services/[id]/ServiceDetailClient.tsx` - Convert to tabbed interface
- `src/app/api/notifications/send-reminder/route.ts` - Update to use new notification service
- `src/app/api/notifications/send-team-invitation/route.ts` - Update to use new notification service
- `.env.vercel.example` - Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
- `vercel.json` - Add cron job configuration (if not exists)

**Files to Delete:** None

## Functions

Implement new functions and update existing ones to support the features.

**New Functions:**

**In `src/lib/sms.ts`:**
- `isSmsConfigured(): boolean` - Check if SMS is set up
- `sendSms({ to, body }: { to: string; body: string }): Promise<{ success: boolean; error?: string }>` - Send SMS via Twilio

**In `src/lib/notifications.ts`:**
- `sendNotification(userId: string, type: NotificationType, payload: { title: string; message: string; linkUrl: string; assignmentId?: string; serviceId?: string }): Promise<void>` - Unified notification sender
- `sendAssignmentNotification(assignment: ServiceAssignment, service: Service, teamMember: TeamMember): Promise<void>` - Send assignment notifications
- `sendEscalationNotification(service: Service, pendingAssignments: ServiceAssignment[]): Promise<void>` - Send leader escalation

**In `src/lib/reminders.ts`:**
- `runReminderJobs(): Promise<void>` - Main reminder job runner
- `sendInitialReminders(): Promise<void>` - Assignment confirmation reminders
- `sendPreEventReminders(): Promise<void>` - Pre-rehearsal/service reminders
- `sendEscalationReminders(): Promise<void>` - Leader escalation for pending

**In `src/lib/store.ts`:**
- `serviceChats.getByService(serviceId: string, churchId: string): Promise<ServiceChat | null>`
- `serviceChats.getOrCreate(serviceId: string, churchId: string): Promise<ServiceChat>`
- `serviceChatMessages.getByChat(chatId: string, churchId: string): Promise<ServiceChatMessagePopulated[]>`
- `serviceChatMessages.create(message: Omit<ServiceChatMessage, 'id' | 'created_at'>): Promise<ServiceChatMessage>`
- `notifications.createEnhanced(n: Omit<EnhancedNotification, 'id' | 'created_at'>): Promise<EnhancedNotification>`
- `reminderSettings.getByChurch(churchId: string): Promise<ReminderSettings>`
- `reminderSettings.update(churchId: string, settings: Partial<ReminderSettings>): Promise<ReminderSettings>`

**Modified Functions:**

**In `src/lib/store.ts`:**
- Update `notifications.create` to support new fields
- Update `assignments.update` to handle status changes with timestamps
- Add `assignments.getById` for getting single assignment

**In API Routes:**
- Update existing notification routes to use unified notification service

## Classes

No new classes needed. The implementation follows the existing functional pattern used throughout the codebase (store functions, service modules).

## Dependencies

Add new packages for SMS and update existing configuration.

**New Dependencies:**
- `twilio` - SMS provider (Twilio)
- No other new dependencies required

**Configuration Changes:**
- Add environment variables to `.env.vercel.example`:
  - `TWILIO_ACCOUNT_SID` - Twilio account SID
  - `TWILIO_AUTH_TOKEN` - Twilio auth token
  - `TWILIO_PHONE_NUMBER` - Twilio phone number for sending

**Integration Requirements:**
- Update `vercel.json` to add cron job for reminders (runs every 30 minutes)
- Existing `resend` dependency already handles email

## Testing

Implement comprehensive testing for new features.

**Test Files to Create:**
- No separate test files initially (manual testing approach)
- Consider adding tests in future iterations

**Manual Testing Checklist:**
1. Service Chat:
   - Create chat message on service detail page
   - Verify real-time updates via Supabase subscription
   - Test church-level access control (can't see other churches' chats)

2. Notifications:
   - Create assignment and verify in-app notification appears
   - Verify email sent to user's email
   - Verify SMS sent to user's phone (if configured)
   - Test notification marking as read

3. Assignment Confirmation:
   - Click confirm link from notification
   - Verify assignment status updates to 'confirmed'
   - Verify leader receives confirmation notification
   - Test decline flow

4. Smart Reminders:
   - Manually trigger reminder job via API
   - Verify initial reminders sent after 48 hours
   - Verify pre-event reminders sent
   - Verify escalation notifications sent to leaders
   - Test duplicate prevention (no repeat reminders)

5. Security:
   - Verify users can only access their church's data
   - Verify team members can only see services they're scheduled for
   - Verify notification access control

## Implementation Order

Implement features in logical sequence to minimize conflicts and ensure successful integration.

1. **Database Schema Updates** - Add new tables and columns
2. **Type Definitions** - Extend TypeScript types
3. **SMS Service** - Create SMS abstraction layer
4. **Notification Service** - Build unified notification system
5. **Service Chat Backend** - Implement chat data access
6. **Service Chat UI** - Create chat component and tab
7. **Assignment Confirmation** - Build confirm/decline endpoints
8. **Schedule Tab UI** - Implement schedule tab with confirm/decline buttons
9. **Tabbed Service Interface** - Convert service detail to tabs
10. **Reminder Job Logic** - Implement reminder algorithms
11. **Reminder Cron Job** - Set up Vercel cron configuration
12. **Integration Testing** - Test end-to-end flows
13. **Documentation** - Add feature documentation