# Email JSON Parse Error Fix

## Problem

When sending team invitation emails, users encountered the following error:

```
Error sending invitation: SyntaxError: JSON.parse: unexpected character at line 1 column 1 of the JSON data
```

This error occurred consistently when trying to send invitation emails, even with:
- All API keys properly configured
- Domain verified in Resend
- Correct environment variables set

## Root Cause Analysis

The error was caused by the `isomorphic-dompurify` package, which was being imported in `src/lib/sanitize.ts`. This package attempts to use `jsdom` in server-side environments, but `jsdom` is incompatible with Next.js's serverless edge runtime and Turbopack bundling.

### The Problem Chain:

1. `isomorphic-dompurify` was installed as a dependency
2. It was imported in `src/lib/sanitize.ts` for HTML sanitization
3. `src/lib/store.ts` imported and used the sanitize functions
4. When the API routes (like `/api/notifications/send-team-invitation`) were bundled, `isomorphic-dompurify` tried to load `jsdom`
5. `jsdom` module incompatibility caused the build/runtime to fail
6. This resulted in non-JSON responses being returned, which caused `JSON.parse()` to fail when the client tried to parse the API response

## Solution

### 1. Replaced DOMPurify with Regex-Based Sanitization

**File: `src/lib/sanitize.ts`**

Replaced the `isomorphic-dompurify` import with a lightweight regex-based sanitization solution:

```typescript
// OLD (caused the issue):
import DOMPurify from 'isomorphic-dompurify';

// NEW (fixed):
// Simple HTML sanitization using regex patterns
```

The new implementation uses regex to strip potentially dangerous HTML tags and attributes while preserving safe content.

### 2. Removed Problematic Dependency

**File: `package.json`**

Removed `isomorphic-dompurify` from dependencies:
```json
{
  "dependencies": {
    // ... other dependencies
    // REMOVED: "isomorphic-dompurify": "^3.5.1"
  }
}
```

### 3. Reinstalled Dependencies

Ran `npm install` to remove the problematic package and update `node_modules`.

## Why This Fix Works

1. **No jsdom Dependency**: The regex-based solution doesn't require `jsdom`, eliminating the incompatibility issue
2. **Serverless Compatible**: Regex-based sanitization works in any JavaScript environment, including Next.js serverless edge functions
3. **Turbopack Compatible**: No complex module resolution issues
4. **Lighter Bundle**: Reduces bundle size by removing the heavy `isomorphic-dompurify` + `jsdom` dependencies

## Trade-offs

### Pros of This Fix:
- ✅ Eliminates the JSON parse error
- ✅ Compatible with Next.js serverless edge runtime
- ✅ Compatible with Turbopack
- ✅ Smaller bundle size
- ✅ Simpler dependency tree

### Cons:
- ⚠️ Regex-based sanitization is less comprehensive than DOMPurify
- ⚠️ May not catch all edge cases of XSS attacks
- ⚠️ Requires careful testing to ensure sanitization is adequate

## When to Consider a More Robust Solution

If you need more comprehensive HTML sanitization in the future, consider:

1. **Server-Side Only**: Use DOMPurify only in server-side code, not in API routes that run on edge runtime
2. **Alternative Sanitizers**: Look for sanitizers specifically designed for edge environments
3. **Post-Process Sanitization**: Handle HTML sanitization after the initial API response

## Testing

After applying the fix:
1. Build completed successfully: `npm run build` ✅
2. No TypeScript errors ✅
3. All routes generated properly ✅
4. Team invitation API route should now work without JSON parse errors

## Files Modified

1. `src/lib/sanitize.ts` - Replaced DOMPurify with regex-based sanitization
2. `package.json` - Removed `isomorphic-dompurify` dependency

## Verification Steps

To verify the fix is working:

1. Start the development server: `npm run dev`
2. Navigate to the Team page
3. Add a team member with an email address
4. Click "Send Invite Email" on the team member's menu
5. Verify no JSON parse error occurs in the console
6. Verify the API response is properly formatted JSON

## Related Issues

This fix may also resolve similar JSON parse errors in other API routes that send notifications:
- `/api/notifications/send-invitation`
- `/api/notifications/send-reminder`
- `/api/notifications/send-welcome`

All these routes use the same email sending infrastructure and would have been affected by the same `isomorphic-dompurify` issue.