# Service Chat, Notifications, and Reminders Guide

This document explains the new features for service chat, multi-channel notifications, one-tap confirm/decline, and smart reminders in WorshipCenter.

## Table of Contents

1. [Service Chat](#service-chat)
2. [Multi-Channel Notifications](#multi-channel-notifications)
3. [One-Tap Confirm/Decline](#one-tap-confirmdecline)
4. [Smart Reminders & Escalation](#smart-reminders--escalation)
5. [Security & Multi-Tenancy](#security--multi-tenancy)
6. [Configuration](#configuration)

---

## Service Chat

Service chat allows team members to communicate directly within each service context.

### Data Model

**ServiceChat** - One chat per service
- `id`: Unique identifier
- `service_id`: Foreign key to Service
- `church_id`: Church/organization identifier
- `created_at`: Timestamp

**ServiceChatMessage** - Individual messages
- `id`: Unique identifier
- `chat_id`: Foreign key to ServiceChat
- `user_id`: Sender's user ID
- `content`: Message text
- `created_at`: Timestamp

### Access Control

- Chat access is **implicit**: anyone with access to the service can participate
- Validated through existing auth and church membership
- Admins and leaders can see all chats
- Team members can see chats for services they're assigned to

### API Endpoints

**GET** `/api/services/[serviceId]/chat/messages`
- Fetch all messages for a service's chat
- Creates chat lazily on first access
- Returns messages with user details populated

**POST** `/api/services/[serviceId]/chat/messages`
- Send a new message to the service chat
- Validates user has access to the service
- Returns the created message

### UI Component

**Location**: `src/components/services/ServiceChat.tsx`

Features:
- Real-time message display (ordered by creation time)
- User avatars and names
- Relative timestamps (e.g., "2 minutes ago")
- Message input with send button
- Auto-scroll to latest messages
- Loading states and error handling

Integration:
- Used as a tab in `ServiceDetailClient.tsx`
- Tab label: "Chat"
- Reuses existing UI components (Button, Avatar, etc.)

---

## Multi-Channel Notifications

A unified notification system that sends messages through multiple channels.

### Data Model

**Notification**
- `id`: Unique identifier
- `church_id`: Church/organization identifier
- `user_id`: Recipient's user ID
- `type`: Notification type (see Types below)
- `title`: Short title (for email/app subject)
- `message`: Full message body
- `read`: Read status flag
- `service_id`: Optional service reference
- `assignment_id`: Optional assignment reference
- `link_url`: Deep link to relevant page
- `sent_at`: Timestamp when sent
- `channels_sent`: Object tracking which channels were used
- `created_at`: Creation timestamp

### Notification Types

| Type | Description | Typical Use Case |
|------|-------------|------------------|
| `assignment_created` | New assignment created | When a team member is scheduled |
| `assignment_reminder` | General assignment reminder | Custom reminders |
| `assignment_changed` | Assignment details changed | Role, time, or service modified |
| `assignment_declined` | Assignment was declined | Inform leaders of declines |
| `initial_reminder` | Initial confirmation reminder | 48h after assignment creation |
| `pre_rehearsal_reminder` | Before rehearsal | 24h before rehearsal time |
| `pre_service_reminder` | Before service | 48h before service |
| `escalation` | Escalation to leaders | Unconfirmed assignments near service |
| `invitation` | Team invitation | New team member invited |
| `status_change` | Status updates | General status changes |
| `service_reminder` | Service reminders | General service reminders |
| `general` | General notifications | Miscellaneous |

### Notification Service

**Location**: `src/lib/notifications.ts`

Core function: `sendNotification(payload)`

```typescript
interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl?: string;
  churchId: string;
  serviceId?: string;
  assignmentId?: string;
}
```

The service:
1. Persists notification to database
2. Sends in-app notification (stored and surfaced in UI)
3. Sends email via existing mailer (`src/lib/email.ts`)
4. Sends SMS via SMS service (`src/lib/sms.ts`)
5. Tracks which channels were successfully used

### Channel Configuration

**In-App**: Always sent and persisted

**Email**: Sent via Resend (configured in `src/lib/email.ts`)
- Uses `RESEND_API_KEY` environment variable
- Requires valid `FROM_EMAIL` setting

**SMS**: Sent via configured SMS provider
- Currently stubbed in `src/lib/sms.ts`
- Can be integrated with Twilio, AWS SNS, etc.
- Requires user's verified phone number

### API Endpoints

**GET** `/api/notifications`
- Fetch all notifications for current user
- Supports filtering by read status

**POST** `/api/notifications/[id]/read`
- Mark notification as read

### UI Integration

Notifications can be displayed in:
- Bell icon dropdown (global notifications)
- Dashboard notification panel
- Service-specific notification list

---

## One-Tap Confirm/Decline

Team members can confirm or decline assignments with a single click from email/SMS.

### Data Model

**ServiceAssignment** - Enhanced with status tracking
- `id`: Unique identifier
- `service_id`: Foreign key to Service
- `team_member_id`: Team member reference
- `role`: Role/position name
- `status`: `pending` | `confirmed` | `declined`
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp
- `confirmed_at`: Confirmation timestamp (optional)
- `declined_at`: Decline timestamp (optional)

### Deep Link Structure

```
/services/[serviceId]/schedule?assignmentId=[assignmentId]
```

When a user clicks a deep link:
1. Navigates to service schedule tab
2. Scrolls to/focuses the specified assignment
3. Highlights the assignment visually
4. Shows Confirm/Decline buttons if user owns it and status is pending

### API Endpoints

**POST** `/api/assignments/[assignmentId]/confirm`
- Updates assignment status to `confirmed`
- Sets `confirmed_at` timestamp
- Returns updated assignment

**POST** `/api/assignments/[assignmentId]/decline`
- Updates assignment status to `declined`
- Sets `declined_at` timestamp
- Sends notification to leaders about the decline
- Returns updated assignment

### UI Implementation

**Location**: `src/components/services/ServiceSchedule.tsx`

Features:
- Displays all assignments with team member photos
- Shows status badges (pending/confirmed/declined)
- When `assignmentId` query param present:
  - Highlights the assignment with subtle background
  - Shows large Confirm/Decline buttons
- Toast notifications on successful action
- Auto-refresh after status change

### Notification Flow

When an assignment is created:
1. System creates assignment with `status = 'pending'`
2. Sends notification via `sendNotification()`:
   - Type: `assignment_created`
   - Subject: "You're scheduled for [role] – [service name] on [date/time]"
   - Body: Brief explanation + action instructions
   - Link: Deep link to assignment confirm/decline

When an assignment is declined:
1. System updates status to `declined`
2. Sends notification to service leaders:
   - Type: `assignment_declined`
   - Subject: "[Team member] declined [role] for [service name]"
   - Body: Details about the decline
   - Link: Direct link to service schedule

---

## Smart Reminders & Escalation

Automated reminder system reduces manual chasing of team members.

### Settings

Default reminder timing (configurable):

| Setting | Default | Description |
|---------|---------|-------------|
| `initialReminderHours` | 48 | Hours after assignment creation to send initial reminder |
| `preRehearsalReminderHours` | 24 | Hours before rehearsal to send reminder |
| `preServiceReminderHours` | 48 | Hours before service to send reminder |
| `escalationHours` | 24 | Hours before service to escalate to leaders |

These can be made per-organization configurable by storing in `reminder_settings` table.

### Reminder Job

**Location**: `src/lib/reminders.ts`

**Entry Point**: `runReminders()`

**Schedule**: Every 15 minutes (via cron)

The job checks for and sends:

1. **Initial Confirmation Reminders**
   - Finds assignments with `status = 'pending'`
   - Created more than `initialReminderHours` ago
   - No previous initial reminder sent
   - Sends reminder notification

2. **Pre-Rehearsal Reminders**
   - For services with rehearsal time
   - `preRehearsalReminderHours` before rehearsal
   - Sends to confirmed and pending assignments
   - Includes rehearsal time and details

3. **Pre-Service Reminders**
   - `preServiceReminderHours` before service start
   - Sends to confirmed and pending assignments
   - Includes service time and details

4. **Leader Escalations**
   - Within `escalationHours` of service start
   - Finds still-pending assignments
   - Notifies service leaders/admins
   - Lists all pending team members

### Duplicate Prevention

The job prevents duplicate reminders by:
- Checking existing notifications of the same type
- Using `service_id` and `assignment_id` to track
- Only sending if no matching notification exists

### API Endpoint

**GET** `/api/reminders`
- Triggers reminder job via HTTP
- Used by Vercel Cron Jobs or external schedulers
- Returns success/failure status

**POST** `/api/reminders`
- Manual trigger for testing
- Same functionality as GET

### Cron Configuration

For Vercel deployment, add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/reminders",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

This runs the reminder job every 15 minutes.

---

## Security & Multi-Tenancy

All new features implement proper security and multi-tenant scoping.

### Authentication

- All API endpoints verify user authentication
- Uses existing auth middleware (`src/lib/auth-middleware.ts`)
- Session-based authentication via Supabase

### Organization Scoping

Every database query includes church/organization scoping:

```typescript
// Example: Service chat messages
const { data, error } = await supabase
  .from('service_chat_messages')
  .select(`
    *,
    user:users!inner (
      id,
      name,
      avatar_url,
      church_id
    )
  `)
  .eq('chat_id', chatId)
  .eq('user.church_id', churchId); // Enforce org scope
```

### Access Control

**Service Chat**:
- Users can only access chats for services in their church
- Team members can see chats for services they're assigned to
- Leaders/admins can see all chats

**Notifications**:
- Users can only see their own notifications
- Notifications are scoped to church_id
- Cross-church access is prevented

**Assignments**:
- Users can only confirm/decline their own assignments
- Assignment access validated against church membership
- Deep links include church context validation

**Reminders**:
- Processed per-church
- Only sends to users in the same church
- Escalations go to church leaders/admins

### RBAC Integration

Leverages existing role-based access control (`src/lib/rbac.ts`):
- `admin`: Full access to all features
- `leader`: Can view chats, see escalations
- `team`: Can participate in chats, confirm/decline

---

## Configuration

### Environment Variables

Required for notification functionality:

```bash
# Email (Resend)
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=noreply@yourchurch.com

# SMS (Future)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# App URL
NEXT_PUBLIC_APP_URL=https://your-app.com
```

### Database Setup

Run migrations in order:

1. `supabase/migrations/015_add_service_chat_tables.sql`
   - Adds service_chat and service_chat_messages tables
   - Creates indexes for performance

2. `supabase/migrations/016_enhance_notifications_table.sql`
   - Adds channels_sent column to notifications
   - Adds indexes for service_id and assignment_id

3. `supabase/migrations/017_add_reminder_settings_table.sql`
   - Creates reminder_settings table
   - Inserts default settings

4. `supabase/migrations/018_add_phone_and_assignment_status.sql`
   - Adds phone field to users table
   - Adds status, confirmed_at, declined_at to service_assignments
   - Backfills existing assignments with 'pending' status

### TypeScript Types

All new types are defined in `src/lib/types.ts`:
- `ServiceChat`, `ServiceChatMessage`
- `ServiceChatMessagePopulated`
- `Notification` (enhanced)
- `NotificationChannels`, `NotificationChannel`
- `ReminderSettings`

### Testing

To test the reminder job manually:

```bash
# Trigger reminders via API
curl -X POST https://your-app.com/api/reminders

# Or use Next.js dev server
curl -X POST http://localhost:3000/api/reminders
```

Monitor logs for:
- `[Reminders] Starting reminder job...`
- `[Reminders] Sent initial reminder for assignment...`
- `[Reminders] Sent pre-rehearsal reminder for service...`
- `[Reminders] Sent pre-service reminder for service...`
- `[Reminders] Escalation needed for...`

---

## Troubleshooting

### Notifications Not Sending

1. Check environment variables are set
2. Verify Resend API key is valid
3. Check Supabase logs for errors
4. Verify user has email/phone on record

### Reminders Not Running

1. Check cron job is configured (vercel.json)
2. Verify `/api/reminders` endpoint is accessible
3. Check Vercel Cron logs
4. Ensure reminder job completes without errors

### Chat Messages Not Appearing

1. Verify service chat exists (created on first access)
2. Check user has church access
3. Verify team member is assigned to service
4. Check browser console for errors

### Deep Links Not Working

1. Verify link format: `/services/[serviceId]/schedule?assignmentId=[assignmentId]`
2. Check assignment exists and belongs to user
3. Ensure assignment status is 'pending'
4. Verify user is authenticated

---

## Future Enhancements

Potential improvements for future iterations:

1. **Real-time Chat**
   - WebSocket integration for instant messaging
   - Typing indicators
   - Read receipts

2. **Notification Preferences**
   - Per-user channel preferences
   - Do-not-disturb hours
   - Notification categories

3. **Advanced Reminders**
   - Custom reminder schedules
   - Multi-stage escalation
   - Reminder templates

4. **Analytics**
   - Confirmation rate tracking
   - Response time metrics
   - Reminder effectiveness

5. **Bulk Actions**
   - Confirm multiple assignments
   - Bulk rescheduling
   - Quick assignment swaps

---

## Support

For issues or questions:
- Check the implementation plan: `implementation_plan.md`
- Review database migrations in `supabase/migrations/`
- Examine API routes in `src/app/api/`
- Consult UI components in `src/components/services/`