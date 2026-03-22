# Email Configuration Guide

This document explains how to configure email sending for WorshipCenter using Resend.

## Overview

WorshipCenter uses [Resend](https://resend.com) to send emails for:
- Team member invitations
- Welcome emails for new users
- Password reset emails
- Service reminders

## Prerequisites

1. **Resend Account**: Sign up at https://resend.com
2. **Verified Domain**: Verify your domain in Resend dashboard
   - Go to Domains → Add domain
   - Add DNS records to your domain provider
   - Wait for verification (usually instant)

## Environment Variables

Configure these environment variables in Vercel or your local `.env.local`:

### RESEND_API_KEY

Get your API key from: https://resend.com/api-keys

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxx
```

### EMAIL_FROM

This is the sender email address. Must be from a verified domain in Resend.

**Example**:
```
EMAIL_FROM=hello@worshipcenter.app
```

**Important:** The domain must be verified in Resend dashboard at https://resend.com/domains

### EMAIL_FROM_NAME (Optional)

This is the sender name that will appear in recipients' inboxes. If not set, defaults to "WorshipCenter".

**Example**:
```
EMAIL_FROM_NAME=WorshipCenter
```

**Why use a separate variable?**
- Cleaner configuration without worrying about quote escaping
- Easy to customize for different environments
- Defaults to "WorshipCenter" if not set

**Alternative with your church name**:
```
EMAIL_FROM_NAME=Your Church Name
```

The sender
```

This endpoint returns the email configuration status and any missing variables.

## Troubleshooting

### Emails not sending

1. Check that `RESEND_API_KEY` is set in Vercel environment variables
2. Verify your domain is verified in Resend dashboard
3. Check the `/api/debug/email-config` endpoint for configuration status
4. Review Vercel deployment logs for errors

### Sender name showing as "hello"

This happens when `EMAIL_FROM` is set without a display name.

**Wrong**:
```
EMAIL_FROM=hello@worshipcenter.app
```

**Correct**:
```
EMAIL_FROM="WorshipCenter <hello@worshipcenter.app>"
```

### JSON parse errors in email sending

If you see "JSON.parse: unexpected character" errors:
1. Check that the email API route is returning valid JSON
2. Review the error handling in the email sending functions
3. Check Vercel logs for the full error message

## Email Templates

The application uses the following email templates:

### Team Invitation
- Subject: "You're invited to join the team"
- Content: Includes registration link

### Welcome Email
- Subject: "Welcome to WorshipCenter!"
- Content: Welcome message and getting started tips

### Password Reset
- Subject: "Reset your password"
- Content: Secure password reset link

### Service Reminder
- Subject: "Upcoming service: [Date]"
- Content: Service details and assigned roles

## Best Practices

1. **Always use a display name** in `EMAIL_FROM` for professional appearance
2. **Keep domain verified** in Resend dashboard to ensure deliverability
3. **Monitor email deliverability** in Resend dashboard
4. **Use a consistent sender address** across all emails
5. **Test emails** before sending to your entire team

## Security Notes

- Never commit actual API keys to git
- Rotate API keys periodically
- Use separate API keys for development and production
- Keep email content appropriate and professional

## Additional Resources

- [Resend Documentation](https://resend.com/docs)
- [Resend API Reference](https://resend.com/docs/api-reference)
- [Email Best Practices](https://resend.com/docs/guides/email-best-practices)