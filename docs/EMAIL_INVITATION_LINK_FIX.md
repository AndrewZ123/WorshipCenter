# Email Invitation Link Parameter Fix

## Problem Analysis

### Issue Description
When sending team invitation emails, the invitation links contained incorrect URL parameters, causing them to fail when users clicked them. The error appeared as:
```
Error sending invitation: SyntaxError: JSON.parse: unexpected character at line 1 column 1 of the JSON data
```

### Root Cause
The API route `/api/notifications/send-team-invitation` was generating invitation links with parameter names that didn't match what the join page expected:

**Incorrect (in API route):**
```typescript
const inviteUrl = `${baseUrl}/join?church=${churchId}&email=${encodeURIComponent(teamMember.email)}`;
```

**Expected (by join page):**
```typescript
// From src/app/join/page.tsx
const email = searchParams.get('e');
const churchId = searchParams.get('c');
```

## The Fix

### Changes Made
**File:** `src/app/api/notifications/send-team-invitation/route.ts`

Changed line ~119 from:
```typescript
const inviteUrl = `${baseUrl}/join?church=${churchId}&email=${encodeURIComponent(teamMember.email)}`;
```

To:
```typescript
const inviteUrl = `${baseUrl}/join?e=${encodeURIComponent(teamMember.email)}&c=${churchId}`;
```

### Why This Matters

1. **Client-Side Consistency**: The team page (`src/app/(app)/team/page.tsx`) was already using the correct short parameter names when generating invite links:
   ```typescript
   const inviteLink = `${window.location.origin}/join?e=${encodeURIComponent(email)}&c=${churchId}`;
   ```

2. **Parameter Purpose**: The short parameters (`e` for email, `c` for church) are used for:
   - **Security**: Makes the URL less obvious and slightly harder to manipulate
   - **Brevity**: Shorter URLs are better for email clients that may truncate long URLs
   - **Privacy**: Email addresses in URLs can be visible in logs/referrers, so shorter params are preferred

## Verification

### Other Notification Routes Checked

1. **`/api/notifications/send-welcome`** - ✅ No invitation links (only dashboard link)
2. **`/api/notifications/send-reminder`** - ✅ No invitation links (only creates notifications)
3. **`/api/notifications/send-invitation`** - ✅ Different use case (service assignments, not team member onboarding)

### Join Page Parameters
The join page (`src/app/join/page.tsx`) expects these parameters:
- `e` - Email address of the team member
- `c` - Church ID

## Testing Recommendations

### 1. Test Team Invitation via Email
1. Go to Team page
2. Click "Add Member"
3. Fill in team member details with a valid email
4. Click "Add Member"
5. Click "Send Invite Email" from the team member's menu
6. Verify the email is received
7. Click the link in the email
8. Verify the join page loads correctly with the team member's email and church pre-filled

### 2. Test Team Invitation via Link Copy
1. Go to Team page
2. Click "Copy Invite Link" for a team member
3. Verify the link format: `?e=<email>&c=<churchId>`
4. Open the link in a new browser
5. Verify the join page loads correctly

### 3. Verify Email Configuration
Check that environment variables are set in Vercel:
- `RESEND_API_KEY` - Your Resend API key
- `EMAIL_FROM` - Verified sender email (e.g., `noreply@yourdomain.com`)
- `NEXT_PUBLIC_APP_URL` - Your app's public URL (e.g., `https://yourapp.com`)

You can verify email configuration by visiting: `/api/debug/email-config`

## Additional Improvements

The route now includes:
- ✅ Better error logging with detailed stack traces
- ✅ Graceful handling when email service isn't configured
- ✅ Returns the invite link in the response even if email fails
- ✅ Explicit JSON Content-Type headers to prevent parsing errors
- ✅ Detailed error messages in responses to help with debugging

## Prevention

To prevent similar issues in the future:

1. **Document URL parameters**: Keep a central document of all URL parameters used across the application
2. **Type-safe routing**: Consider using a URL parameter constant or utility function
3. **Integration tests**: Add tests that verify email links work end-to-end
4. **Code review**: When adding new pages with URL parameters, verify consistency

## Related Files

- `src/app/api/notifications/send-team-invitation/route.ts` - Fixed route
- `src/app/join/page.tsx` - Expects `e` and `c` parameters
- `src/app/(app)/team/page.tsx` - Generates correct `e` and `c` parameters (client-side)
- `src/lib/email.ts` - Email sending utility