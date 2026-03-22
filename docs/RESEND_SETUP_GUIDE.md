# Resend Email Service Setup Guide

## Problem: "Email service not configured" Error

You're seeing this error because your application needs the Resend API key to send emails, but it hasn't been configured in Vercel yet.

## Quick Fix (5 minutes)

### Step 1: Get Your Resend API Key

1. Go to [resend.com](https://resend.com)
2. Sign up or log in to your account
3. Navigate to **API Keys** in the dashboard
4. Click **Create API Key**
5. Give it a name (e.g., "WorshipCenter Production")
6. Copy the generated API key (it starts with `re_`)

### Step 2: Add Environment Variables to Vercel

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Find your **WorshipCenter** project
3. Click **Settings** → **Environment Variables**
4. Add the following environment variable:

   **Name:** `RESEND_API_KEY`
   
   **Value:** `re_your_api_key_here` (paste your key from Step 1)
   
   **Environments:** Select **Production**, **Preview**, and **Development**

5. Click **Save**

### Step 3: Redeploy Your Application

After adding the environment variable, you need to redeploy:

1. Go to the **Deployments** tab in Vercel
2. Click the **...** menu next to your latest deployment
3. Click **Redeploy**
4. Confirm by clicking **Redeploy**

Or, if you prefer to deploy from your terminal:
```bash
git push origin main
```

### Step 4: Verify It's Working

1. Once deployment is complete, go to your app
2. Navigate to the **Team** page
3. Try adding a new team member with an email address
4. You should see a success message: "Invitation sent!" instead of the error

## How Email Sending Works Now

Your application has two ways to invite team members:

### Option 1: Send Invite Email (Recommended)
- Sends an email invitation directly to the team member
- Requires Resend to be configured (you just did this!)
- More professional and user-friendly

### Option 2: Copy Invite Link (Always Works)
- Copies a unique invitation link to your clipboard
- Works even if email isn't configured
- Useful as a backup or for manual sharing

Both options are now available in the team member menu (click the three dots on any team member).

## Environment Variables Reference

Make sure you have these environment variables set in Vercel:

| Variable | Description | Example |
|----------|-------------|---------|
| `RESEND_API_KEY` | Your Resend API key | `re_1234567890abcdef` |
| `NEXT_PUBLIC_SITE_URL` | Your app's public URL | `https://app.worshipcenter.app` |

## Troubleshooting

### Still seeing "Email service not configured"?

1. **Check the environment variables:**
   - Go to Vercel → Settings → Environment Variables
   - Make sure `RESEND_API_KEY` is set
   - Verify it's enabled for all environments (Production, Preview, Development)

2. **Redeploy manually:**
   ```bash
   git commit --allow-empty -m "Trigger redeploy"
   git push origin main
   ```

3. **Check the logs:**
   - Go to Vercel → Deployments
   - Click on your deployment
   - Click the **Functions** tab
   - Look for the `send-team-invitation` function
   - Check for error messages

4. **Verify API key is valid:**
   - Go to Resend dashboard
   - Check that your API key is active
   - Try generating a new API key and updating Vercel

### Emails not being received?

1. **Check spam folder:** Sometimes emails end up in spam
2. **Verify email address:** Make sure you're using a valid email
3. **Check Resend dashboard:**
   - Go to Resend → Emails
   - See if the email was sent successfully
   - Check for any bounce or delivery errors

### Want to test without sending real emails?

You can use Resend's test mode. In your email.ts file, the code already handles missing API keys gracefully and will show a warning message instead of crashing.

## Additional Resources

- [Resend Documentation](https://resend.com/docs)
- [Resend API Reference](https://resend.com/docs/api-reference)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)

## Need Help?

If you're still having issues after following these steps:

1. Check the Vercel deployment logs for error messages
2. Verify your Resend API key is active and has the right permissions
3. Make sure you've redeployed after adding environment variables

The email service is now fully integrated and ready to use once you configure the API key!