# Team Member Email Functionality

## Overview

Team members are automatically sent invitation emails when they are added to the church team. Admins can also resend invitations at any time.

## How It Works

### Automatic Invitation on Add

When a team member is added with an email address:

1. The team member is created in the database
2. An invitation email is automatically sent via `/api/notifications/send-team-invitation`
3. A notification record is created in the system
4. The admin sees success toasts confirming the email was sent

### Resend Invitation

Admins can resend invitation emails to any team member who has an email address:

1. Navigate to the Team page (`/team`)
2. Click the menu icon (three dots) next to any team member
3. Select "Send Invite Email" from the menu
4. The email is resent immediately
5. A toast notification confirms the email was sent

### Copy Invite Link

Alternatively, admins can copy the invite link to share manually:

1. Click the menu icon next to a team member
2. Select "Copy Invite Link"
3. The link is copied to clipboard
4. Share via text, Slack, email, etc.

## API Endpoint

### POST `/api/notifications/send-team-invitation`

**Request Body:**
```json
{
  "teamMemberId": "uuid",
  "churchId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "notificationId": "uuid",
  "emailSent": true,
  "inviteUrl": "https://app.worshipcenter.io/join?e=user@example.com&c=church-id"
}
```

## Email Content

Currently, emails are logged to the console for development. In production, you would integrate with an email service like:

- Resend
- SendGrid
- Postmark
- AWS SES

**Sample Email:**
```
Subject: Join [Church Name] on WorshipCenter

Hi [Member Name],

You've been invited to join [Church Name] on WorshipCenter!

Click the link below to set up your account and get started:
https://app.worshipcenter.io/join?e=user@example.com&c=church-id

If you have any questions, feel free to reach out.

Thanks!
WorshipCenter Team
```

## Join Flow

When a team member clicks their invite link:

1. They're directed to `/join?e=email&c=churchId`
2. They can create their account
3. Their profile is automatically linked to the church
4. They can log in and access the app

## Error Handling

- If a team member has no email, the "Send Invite Email" option is disabled
- If email sending fails, a warning toast is shown but the member is still added
- Resend attempts show appropriate success/error messages

## Future Enhancements

- Track email send timestamps
- Show "Email sent X days ago" in the UI
- Bulk email sending to multiple team members
- Email templates customization per church
- Email delivery tracking and bounce handling