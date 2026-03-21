# Email Service Debugging Guide

## Problem: "Email service not configured" Error

You're seeing a 500 error when trying to send team invitations with the message "Email service not configured" in the console.

## Root Cause Analysis

The error occurs when the email service is not properly configured in your Vercel environment. The API should gracefully handle this scenario, but there were several issues that caused it to fail with a 500 error instead.

### What Was Fixed

1. **Route Error Handling** (`src/app/api/notifications/send-team-invitation/route.ts`)
   - Added comprehensive try-catch blocks for all operations
   - Added proper TypeScript type imports
   - Improved logging at each step
   - Made the route return success even when email is not configured (returns invite URL instead)

2. **Email Service Error Handling** (`src/lib/email.ts`)
   - Wrapped Resend client initialization in try-catch
   - Added detailed logging for configuration checks
   - Prevented unhandled errors from crashing the API

3. **Graceful Degradation**
   - The API now returns a 200 status even when email is not configured
   - Returns the invite URL in the response so users can still copy it
   - Only throws 500 errors for actual failures (not missing configuration)

## What You Need to Do

### Step 1: Check Your Vercel Environment Variables

Go to your Vercel project dashboard:
1. Navigate to your project
2. Go to **Settings** → **Environment Variables**
3. Verify the following variables are configured:

```
RESEND_API_KEY=your_actual_resend_api_key
EMAIL_FROM=no-reply@your-domain.com
```

### Step 2: Get Your Resend API Key

If you don't have a Resend account:
1. Go to https://resend.com and sign up
2. Navigate to **API Keys** in the dashboard
3. Create a new API key
4. Copy the API key (starts with `re_`)

### Step 3: Verify Your Domain in Resend

Before sending emails:
1. In Resend, go to **Domains**
2. Add your domain (e.g., `worshipcenter.app`)
3. Verify the domain by adding DNS records (Resend will provide instructions)
4. Once verified, use `no-reply@your-domain.com` as your `EMAIL_FROM`

### Step 4: Update Vercel Environment Variables

Add the variables to Vercel:
1. In Vercel project settings → Environment Variables
2. Click "Add New"
3. Add `RESEND_API_KEY` with your actual API key
4. Add `EMAIL_FROM` with your verified email address
5. Save the variables
6. **Important:** Redeploy your application after adding the variables

## Testing the Fix

### Without Email Configuration (Temporary Solution)

The API now works without email configuration:
- The request will succeed with a 200 status
- The response will include an `inviteUrl` that users can copy
- Users can still be invited by sharing the link manually

### With Email Configuration (Recommended)

Once you add the environment variables:
- The API will send actual emails
- Users receive a professional invitation email
- The response will include `emailSent: true`

## Verifying the Fix

### Check Vercel Logs

After deploying the fix, check your Vercel logs:
1. Go to your project in Vercel
2. Navigate to **Logs**
3. Try sending a team invitation
4. Look for these log messages:
   - `[Send Team Invitation] Starting request`
   - `[Send Team Invitation] Email service configured: true/false`
   - `[Email] Email service not fully configured` (if not configured)

### Check Browser Console

Open your browser console and try sending an invitation. You should see:
- If email is NOT configured: A warning about email service
- If email IS configured: Success message or detailed error info

## Common Issues and Solutions

### Issue: "Email service not configured" still appears

**Solution:** 
1. Check that BOTH `RESEND_API_KEY` and `EMAIL_FROM` are set
2. Verify you deployed after adding the variables
3. Check Vercel logs for any initialization errors

### Issue: 500 Error persists

**Solution:**
1. Check Vercel function logs for the actual error
2. Verify your Resend API key is valid
3. Ensure your domain is verified in Resend

### Issue: Email not sending but API returns success

**Solution:**
1. Check Vercel logs for Resend API errors
2. Verify your `EMAIL_FROM` domain is verified in Resend
3. Check Resend dashboard for any delivery issues

## Environment Variable Checklist

Use this checklist to ensure everything is configured correctly:

- [ ] `RESEND_API_KEY` is set in Vercel (starts with `re_`)
- [ ] `EMAIL_FROM` is set in Vercel (e.g., `no-reply@worshipcenter.app`)
- [ ] Domain is verified in Resend dashboard
- [ ] Application redeployed after adding variables
- [ ] No errors in Vercel function logs
- [ ] Can successfully send invitations (with or without email)

## Alternative: Using Invite Links (No Email Configuration)

If you don't want to set up email service yet:

1. The "Send Invite Email" button will still work
2. The response will include an `inviteUrl`
3. You can implement a "Copy Invite Link" feature
4. Share the link manually with team members

## Deployment Steps

After making the code changes:

1. Commit the changes to git
2. Push to your repository
3. Vercel will automatically deploy
4. After deployment succeeds, test the invitation feature
5. Check Vercel logs to verify everything is working

## Support

If you continue to have issues:

1. Check Vercel function logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure your Resend account and domain are properly configured
4. Review the Resend API documentation: https://resend.com/docs

## Summary

The fix makes the invitation API more resilient:
- ✅ Works with or without email configuration
- ✅ Provides detailed logging for debugging
- ✅ Returns invite URLs as a fallback
- ✅ Gracefully handles all error scenarios
- ✅ Clear feedback about what's configured

Once you add the Resend environment variables and redeploy, emails will start working automatically.