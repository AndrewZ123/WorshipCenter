# Email Invitation Debug & Fix Documentation

## Problem Description

Users were experiencing a recurring error when trying to send team invitation emails:

```
Error sending invitation: SyntaxError: JSON.parse: unexpected character at line 1 column 1 of the JSON data
```

This error occurred when clicking "Send Invite Email" in the team management interface.

## Root Cause Analysis

### The Issue

The problem had TWO root causes working together:

#### 1. **API Response Validation Issue**
The client-side code was calling `response.json()` without checking if the response was actually valid JSON. When the API returned a non-JSON response (like an error page from a misconfigured server or an incomplete response), `JSON.parse()` would fail with the "unexpected character" error.

#### 2. **Insufficient Error Handling**
- The API route had basic error handling but wasn't providing detailed logging
- The client-side code wasn't validating responses before parsing
- No distinction was made between:
  - API errors (HTTP 4xx/5xx)
  - Email service errors (Resend API failures)
  - Configuration errors (missing API keys)

### What Was Happening

1. User clicks "Send Invite Email"
2. Client sends POST request to `/api/notifications/send-team-invitation`
3. API attempts to send email via Resend
4. If something fails (network error, API issue, config problem), the response might not be valid JSON
5. Client blindly calls `response.json()` → **CRASH**

## Solutions Implemented

### 1. Enhanced API Route Error Handling (`src/app/api/notifications/send-team-invitation/route.ts`)

**Added comprehensive logging:**
```typescript
console.log('[Send Team Invitation] Starting request');
console.log('[Send Team Invitation] Request body:', body);
console.log('[Send Team Invitation] Team member found:', teamMember.name);
console.log('[Send Team Invitation] Church found:', church.name);
console.log('[Send Team Invitation] Email service configured:', emailConfigured);
console.log('[Send Team Invitation] Email result:', emailResult);
```

**Added detailed error catching:**
```typescript
try {
  // Attempt to send email
} catch (emailError) {
  console.error('[Send Team Invitation] Error sending email:', emailError);
  console.error('[Send Team Invitation] Error stack:', emailError instanceof Error ? emailError.stack : 'No stack trace');
  console.error('[Send Team Invitation] Error details:', {
    message: emailError instanceof Error ? emailError.message : 'Unknown error',
    name: emailError instanceof Error ? emailError.name : 'Unknown',
    constructor: emailError instanceof Error ? emailError.constructor.name : 'Unknown'
  });
}
```

**Added early return for unconfigured email service:**
```typescript
if (!emailConfigured) {
  console.warn('[Send Team Invitation] Email service not configured');
  return NextResponse.json({ 
    success: true, 
    emailSent: false,
    emailError: 'Email service not configured (RESEND_API_KEY or EMAIL_FROM missing in environment variables)',
    inviteUrl,
    message: 'Invitation link generated (email not configured - please set RESEND_API_KEY and EMAIL_FROM in Vercel environment variables)',
  });
}
```

**Added comprehensive response structure:**
```typescript
return NextResponse.json({ 
  success: true, 
  emailSent: !!emailResult?.success,
  emailError: emailResult?.error,
  emailErrorType: 'type' in (emailResult || {}) ? (emailResult as any)?.type : undefined,
  inviteUrl,
  message: emailResult?.success 
    ? 'Invitation sent successfully' 
    : emailResult?.error 
      ? `Email failed: ${emailResult.error}`
      : 'Invitation link generated (email not configured - copy the link below)',
});
```

### 2. Robust Client-Side Response Handling (`src/app/(app)/team/page.tsx`)

**Added response validation before JSON parsing:**
```typescript
const response = await fetch('/api/notifications/send-team-invitation', {...});

console.log('[Team Page] Response status:', response.status);

let data;
try {
  data = await response.json();
  console.log('[Team Page] Response data:', data);
} catch (parseError) {
  console.error('[Team Page] Failed to parse response JSON:', parseError);
  console.error('[Team Page] Response text:', await response.text());
  toast({ 
    title: 'Email warning', 
    description: 'Team member added, but there was an issue sending the invitation email',
    status: 'warning',
    duration: 5000 
  });
  return; // Don't proceed further
}
```

**Added detailed user feedback:**
```typescript
if (data.success) {
  if (data.emailSent) {
    console.log('[Team Page] Email sent successfully to:', email);
    toast({ 
      title: 'Invitation sent!', 
      description: `Email sent to ${email}`, 
      status: 'success',
      duration: 3000 
    });
  } else {
    console.warn('[Team Page] Email not sent:', data.emailError);
    toast({ 
      title: 'Email service not configured', 
      description: data.emailError || 'Please copy the invite link manually',
      status: 'warning',
      duration: 5000 
    });
  }
}
```

**Applied to both functions:**
- `handleCreate()` - When adding a new team member
- `handleSendInvitation()` - When sending to an existing member

## How to Debug Email Issues Going Forward

### Step 1: Check Environment Variables

Verify these are set in Vercel:
- `RESEND_API_KEY` - Your Resend API key
- `EMAIL_FROM` - The email address to send from (must match your verified domain)

### Step 2: Check Server Logs

Look for these log prefixes in Vercel logs:
- `[Send Team Invitation]` - API route logs
- `[Team Page]` - Client-side logs

### Step 3: Use the Debug Endpoint

Visit `/api/debug/email-config` to check:
- If email service is configured
- What environment variables are set
- Domain verification status

### Step 4: Check Response Status

The API now returns:
```json
{
  "success": true,
  "emailSent": true|false,
  "emailError": "Error message if email failed",
  "emailErrorType": "Error type (e.g., 'TypeError', 'APIError')",
  "inviteUrl": "https://...",
  "message": "User-friendly message"
}
```

### Step 5: Use Copy Invite Link as Fallback

Even if email fails, the invite URL is always generated and can be copied manually.

## Common Issues & Solutions

### Issue: "Email service not configured"

**Cause:** `RESEND_API_KEY` or `EMAIL_FROM` not set in environment variables.

**Solution:**
1. Go to Vercel project settings
2. Add environment variables:
   - `RESEND_API_KEY=re_xxxxxxxxxxxxx`
   - `EMAIL_FROM=noreply@yourdomain.com`
3. Redeploy the application

### Issue: "Domain not verified" error

**Cause:** The `EMAIL_FROM` domain isn't verified in Resend.

**Solution:**
1. Go to Resend dashboard
2. Add and verify your domain
3. Use email from verified domain: `noreply@yourdomain.com`

### Issue: "Invalid API key" error

**Cause:** Wrong or expired `RESEND_API_KEY`.

**Solution:**
1. Regenerate API key in Resend dashboard
2. Update environment variable
3. Redeploy

### Issue: Rate limit errors

**Cause:** Too many emails sent in short period.

**Solution:**
1. Wait a few minutes
2. Consider upgrading Resend plan
3. Implement rate limiting in your app

## Testing the Fix

### 1. Add a New Team Member with Email

1. Go to Team page
2. Click "Add Member"
3. Fill in name and email
4. Click "Add Member"
5. Check browser console for `[Team Page]` logs
6. Check Vercel logs for `[Send Team Invitation]` logs

### 2. Send Invitation to Existing Member

1. Click menu (⋮) on a team member
2. Click "Send Invite Email"
3. Check browser console for detailed logs
4. Verify toast notification shows correct status

### 3. Test Email Failure Scenarios

1. Temporarily remove `RESEND_API_KEY` from environment
2. Try sending invitation
3. Should see: "Email service not configured" warning
4. Copy invite link should still work

## Prevention Checklist

- [x] Add response validation before JSON parsing
- [x] Add comprehensive error logging
- [x] Provide user-friendly error messages
- [x] Add fallback (copy invite link)
- [x] Document all error scenarios
- [x] Test with valid and invalid configurations

## Related Files

- `src/app/api/notifications/send-team-invitation/route.ts` - API route with enhanced error handling
- `src/app/(app)/team/page.tsx` - Client-side with response validation
- `src/lib/email.ts` - Email sending utility
- `docs/EMAIL_500_ERROR_FIX.md` - Previous email error documentation

## Summary

The JSON.parse error was caused by attempting to parse non-JSON responses without validation. The fix adds:

1. **API side:** Comprehensive logging, error catching, and structured responses
2. **Client side:** Response validation before parsing, detailed error feedback
3. **User experience:** Clear warnings and fallback options

With these changes, the error is now caught gracefully, logged in detail, and presented to the user in a helpful way.