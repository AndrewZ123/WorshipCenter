# Environment Variable Issue Fix Summary

## Problem Identified

The WorshipCenter application was experiencing internal service errors when accessing services, songs, and team pages in production. After a comprehensive audit, the root cause was identified as **environment variable naming mismatches** between documentation and the actual code.

## Root Cause

### The Issue

The documentation in `docs/PRODUCTION.md` listed incorrect environment variable names:

**❌ Documentation said:**
- `NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY`
- `NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY`

**✅ But code in `src/lib/env.ts` expects:**
- `STRIPE_MONTHLY_PRICE_ID`
- `STRIPE_YEARLY_PRICE_ID`

### Impact

When you configured Vercel environment variables following the outdated documentation, you set:
- `NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY` = price_xxx
- `NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY` = price_yyy

But the application was looking for:
- `STRIPE_MONTHLY_PRICE_ID` (not found → validation failed)
- `STRIPE_YEARLY_PRICE_ID` (not found → validation failed)

This caused:
1. Environment variable validation to fail at startup
2. Subsequent database and Stripe operations to fail
3. Internal service errors on pages that depend on these variables

## What Was Fixed

### 1. Updated `docs/PRODUCTION.md`

Fixed the environment variable documentation to match the actual code:

```diff
### Payment Processing (Stripe)
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (public)
+ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (public)
- `NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY` - Stripe price ID for monthly subscription (public)
- `NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY` - Stripe price ID for yearly subscription (public)
+ `STRIPE_MONTHLY_PRICE_ID` - Stripe price ID for monthly subscription (server-only)
+ `STRIPE_YEARLY_PRICE_ID` - Stripe price ID for yearly subscription (server-only)
```

### 2. Created `docs/VERCEL_SETUP.md`

A comprehensive deployment guide that:
- Lists all correct environment variable names
- Provides step-by-step Vercel setup instructions
- Includes troubleshooting for common issues
- Clearly distinguishes between public and server-only variables
- Warns about common mistakes

## What You Need to Do

### Immediate Action Required

Update your Vercel environment variables to fix the production errors:

1. **Remove or rename** these incorrect variables:
   - ❌ `NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY`
   - ❌ `NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY`

2. **Add** these correct variables with the same values:
   - ✅ `STRIPE_MONTHLY_PRICE_ID` = (your monthly price ID)
   - ✅ `STRIPE_YEARLY_PRICE_ID` = (your yearly price ID)

3. **Verify** other Stripe variables:
   - ✅ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (with NEXT_PUBLIC_ prefix)
   - ✅ `STRIPE_SECRET_KEY` (without NEXT_PUBLIC_ prefix)

### Step-by-Step Vercel Update

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Find `NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY`:
   - Copy the value
   - Delete the variable
   - Create new variable `STRIPE_MONTHLY_PRICE_ID` with the same value
3. Repeat for `NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY` → `STRIPE_YEARLY_PRICE_ID`
4. Redeploy to apply changes

```bash
# Redeploy to Vercel
vercel --prod
```

## Verification

After updating the variables, verify the fix:

1. **Check application loads** without errors
2. **Navigate to services page** - should load without internal service error
3. **Navigate to songs page** - should load without internal service error
4. **Navigate to team page** - should load without internal service error
5. **Test subscription flow** - checkout should work correctly

## Complete Environment Variable List

### ✅ Correct Configuration

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | All |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | Production |
| `NEXT_PUBLIC_SUPABASE_REDIRECT_URL` | Auth redirect URL | All |
| `NEXTAUTH_SECRET` | Generated secret | All |
| `NEXTAUTH_URL` | App URL | All |
| `STRIPE_SECRET_KEY` | Stripe secret key | Production |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | All |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | Production |
| `STRIPE_MONTHLY_PRICE_ID` | Monthly price ID | Production |
| `STRIPE_YEARLY_PRICE_ID` | Yearly price ID | Production |
| `RESEND_API_KEY` | Resend API key | Production |
| `NEXT_PUBLIC_APP_URL` | App URL | All |

### ❌ Common Mistakes to Avoid

- ❌ `NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY` (use `STRIPE_MONTHLY_PRICE_ID`)
- ❌ `NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY` (use `STRIPE_YEARLY_PRICE_ID`)
- ❌ `STRIPE_PUBLISHABLE_KEY` (use `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`)

## Prevention

To prevent this issue in the future:

1. **Always check `src/lib/env.ts`** for the definitive list of environment variables
2. **Refer to `docs/VERCEL_SETUP.md`** for deployment instructions
3. **Never rely on memory** when configuring production variables
4. **Double-check variable names** - they are case-sensitive and prefix-sensitive

## Related Documentation

- [Production Readiness Guide](PRODUCTION.md) - Updated with correct variable names
- [Vercel Setup Guide](VERCEL_SETUP.md) - Step-by-step deployment instructions
- [Stripe Setup Guide](STRIPE_SETUP.md) - Stripe-specific configuration

## Summary

This was a documentation bug that caused production configuration errors. The code itself was correct - only the documentation needed to be updated. After following the steps above to update your Vercel environment variables, your application should work correctly in production.

---

**Fixed On**: 2025-03-21
**Status**: ✅ Resolved - Documentation updated, guide created