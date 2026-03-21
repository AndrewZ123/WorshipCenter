# Email Configuration Guide

## Current Status

Email functionality is **NOT configured**. The application has email sending capabilities for:
- Welcome emails when users sign up
- Team invitation emails
- Service reminder emails
- Password reset emails (handled by Supabase)

## Required Configuration

To enable email functionality, you need to configure an email service. The app uses **Resend** for email delivery.

### Option 1: Resend (Recommended)

1. **Create a Resend account**
   - Go to https://resend.com/signup
   - Sign up for a free account (up to 3,000 emails/month free)

2. **Get your API key**
   - Navigate to https://resend.com/api-keys
   - Click "Create API Key"
   - Copy the API key (starts with `re_`)

3. **Verify your domain**
   - Go to https://resend.com/domains
   - Add your domain (e.g., `worshipcenter.app`)
   - Add the DNS records provided by Resend
   - Wait for DNS verification (usually takes a few minutes)

4. **Configure environment variables**

Add these to your `.env.local` file (and Vercel environment variables):

```bash
# Email Configuration
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=no-reply@worshipcenter.app
```

**Important:**
- `RESEND_API_KEY`: Your Resend API key
- `EMAIL_FROM`: The sender email address (must be a verified domain)

### Option 2: Use Supabase Email (Alternative)

If you prefer to use Supabase's built-in email service instead of Resend:

1. **Configure Supabase Email**
   - Go to your Supabase Dashboard
   - Navigate to Authentication → Email Templates
   - Configure the email templates as needed
   - Enable email sending in your Supabase project settings

2. **Update email API routes**
   - Modify `src/app/api/notifications/send-*.ts` files
   - Replace Resend implementation with Supabase email calls

## Deployment Configuration

### For Local Development
Add to `.env.local`:
```bash
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=no-reply@worshipcenter.app
```

### For Vercel Production
Add these environment variables in Vercel Dashboard:
1. Go to your project in Vercel
2. Navigate to Settings → Environment Variables
3. Add the following variables:
   - `RESEND_API_KEY` (your Resend API key)
   - `EMAIL_FROM` (your verified email address)
4. Redeploy your application

## Testing Email Configuration

After setting up email configuration:

1. **Test welcome email**
   - Create a new user account
   - Check if welcome email is sent

2. **Test team invitation**
   - Invite a team member via the team page
   - Check if invitation email is sent

3. **Test service reminder**
   - Create a service
   - Set up a reminder
   - Check if reminder email is sent

## Troubleshooting

### Emails not sending
1. Check that `RESEND_API_KEY` is set correctly
2. Verify your domain is verified in Resend
3. Check server logs for error messages
4. Ensure `EMAIL_FROM` matches a verified domain

### Email marked as spam
1. Make sure your domain has proper SPF, DKIM, and DMARC records
2. Use a legitimate sender name (e.g., "WorshipCenter")
3. Avoid spam trigger words in email content

### Rate limiting
- Resend free tier: 3,000 emails/month
- If you exceed limits, upgrade your Resend plan

## Email Features

Once configured, these features will work:

1. **Welcome Email** - Sent automatically when a new church signs up
2. **Team Invitations** - Sent when inviting team members
3. **Service Reminders** - Scheduled reminders for upcoming services
4. **Password Reset** - Handled by Supabase (works without Resend)

## Security Notes

- **Never commit** API keys to git
- Use different API keys for development and production
- Rotate API keys periodically
- Monitor email usage for abuse
- Use environment-specific email addresses (e.g., `dev@worshipcenter.app` for testing)

## Email Templates

Email templates are located in:
- `src/app/api/notifications/send-welcome/route.ts` - Welcome email
- `src/app/api/notifications/send-team-invitation/route.ts` - Team invitation
- `src/app/api/notifications/send-reminder/route.ts` - Service reminders

You can customize the content, subject lines, and styling in these files.

## Next Steps

1. Sign up for Resend (or choose alternative)
2. Configure DNS records
3. Add environment variables
4. Test email functionality
5. Customize email templates if needed

For more information about Resend, visit: https://resend.com/docs