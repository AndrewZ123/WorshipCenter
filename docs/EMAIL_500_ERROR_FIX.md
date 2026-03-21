# Email Service 500 Error Fix

## Problem

When clicking "Send Invite Email" from the Team page, users encountered a 500 Internal Server Error with the message "Email service not configured".

## Root Cause

The issue was caused by the Resend package import failing during module initialization in production. When the `resend` package couldn't be loaded (possibly due to missing dependencies or build issues), it caused an unhandled exception that resulted in a 500 error.

Specific issues:

1. **Synchronous import at module level**: The `resend` package was imported at the top of `src/lib/email.ts`, which could fail during module loading
2. **Missing lazy loading**: No mechanism to handle import failures gracefully
3. **Non-async isEmailConfigured()**: The function was checking for environment variables but wasn't async, while the route was treating it as a Promise

## Solution

### 1. Implemented Lazy Loading in `src/lib/email.ts`

Changed from synchronous import to dynamic import with caching:

```typescript
let Resend: any = null;

async function loadResend() {
  if (Resend !== null) return Resend;
  
  try {
    const module = await import('resend');
    Resend = module.Resend;
    return Resend;
  } catch (error) {
    console.error('[Email] Failed to load Resend package:', error);
    return null;
  }
}
```

### 2. Made `isEmailConfigured()` Async

Changed the function signature to return a Promise:

```typescript
export async function isEmailConfigured(): Promise<boolean> {
  // ... implementation
}
```

### 3. Updated Route to Await Async Check

In `src/app/api/notifications/send-team-invitation/route.ts`:

```typescript
// Before
const emailConfigured = isEmailConfigured();

// After
const emailConfigured = await isEmailConfigured();
```

### 4. Enhanced Error Handling

Added comprehensive error handling at multiple levels:
- Module import failures
- Client initialization errors
- Email sending errors
- Graceful degradation when email service isn't configured

## Benefits

1. **No 500 Errors**: The application now handles missing or misconfigured email services gracefully
2. **Better User Experience**: Users see helpful error messages instead of server errors
3. **Improved Logging**: Detailed console logs help diagnose configuration issues
4. **Graceful Degradation**: The app continues to work even when email isn't configured
5. **Better Debugging**: Clear error messages indicate what's missing (API key, sender email, etc.)

## Files Changed

1. `src/lib/email.ts` - Implemented lazy loading and made functions async
2. `src/app/api/notifications/send-team-invitation/route.ts` - Added await to isEmailConfigured call

## Testing

To verify the fix works:

1. Test with email NOT configured:
   - Should see console warnings but no 500 error
   - API should return success with `emailSent: false`
   - Invite link should still be generated

2. Test with email configured:
   - Email should send successfully
   - API should return success with `emailSent: true`

## Environment Variables Required

For email to work, configure these in Vercel:

- `RESEND_API_KEY` - Get from https://resend.com/api-keys
- `EMAIL_FROM` - Verified sender email (e.g., no-reply@worshipcenter.app)

## Deployment

After these changes, deploy to Vercel:

```bash
git add .
git commit -m "fix: prevent 500 errors when email service not configured"
git push
```

The changes will automatically deploy to production.