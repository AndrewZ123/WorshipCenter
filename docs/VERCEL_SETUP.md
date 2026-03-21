# Vercel Deployment Guide

This guide walks you through configuring WorshipCenter for deployment on Vercel.

## Critical: Environment Variable Naming

**IMPORTANT:** There was a bug in the production documentation that listed incorrect environment variable names. Ensure you use the names listed below, matching `src/lib/env.ts`.

### Correct Variable Names (Use These)

| Variable Name | Environment | Purpose | Example |
|--------------|-------------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | All | Supabase project URL | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Supabase anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Supabase service role key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `NEXT_PUBLIC_SUPABASE_REDIRECT_URL` | All | Auth redirect URL | `https://app.worshipcenter.io` |
| `NEXTAUTH_SECRET` | All | NextAuth secret | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | All | NextAuth URL | `https://app.worshipcenter.io` |
| `STRIPE_SECRET_KEY` | Production | Stripe secret key | `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | All | Stripe publishable key | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Production | Stripe webhook secret | `whsec_...` |
| `STRIPE_MONTHLY_PRICE_ID` | Production | Monthly price ID | `price_xxx` |
| `STRIPE_YEARLY_PRICE_ID` | Production | Yearly price ID | `price_yyy` |
| `RESEND_API_KEY` | Production | Resend API key | `re_...` |
| `NEXT_PUBLIC_APP_URL` | All | App URL | `https://app.worshipcenter.io` |

### ❌ Common Mistakes (Don't Use These)

- ❌ `NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY` (wrong - use `STRIPE_MONTHLY_PRICE_ID`)
- ❌ `NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY` (wrong - use `STRIPE_YEARLY_PRICE_ID`)
- ❌ `STRIPE_PUBLISHABLE_KEY` (missing NEXT_PUBLIC_ prefix)

## Step-by-Step Vercel Setup

### 1. Create Vercel Project

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Deploy your project
vercel
```

### 2. Configure Environment Variables

#### In Vercel Dashboard:

1. Go to your project in Vercel Dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable from the table above:
   - **Production**: Add for Production environment
   - **Preview**: Add for Preview deployments
   - **Development**: Add for Development environment

#### Or via Vercel CLI:

```bash
# Set environment variables for production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_REDIRECT_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production
vercel env add STRIPE_SECRET_KEY production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_MONTHLY_PRICE_ID production
vercel env add STRIPE_YEARLY_PRICE_ID production
vercel env add RESEND_API_KEY production
vercel env add NEXT_PUBLIC_APP_URL production
```

### 3. Generate Required Secrets

#### NextAuth Secret

```bash
# Generate a secure random string
openssl rand -base64 32

# Use this value for NEXTAUTH_SECRET
```

#### Stripe Webhook Secret

1. Go to Stripe Dashboard → Developers → Webhooks
2. Create a webhook pointing to: `https://your-domain.vercel.app/api/billing/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the **Signing Secret** (starts with `whsec_`)
5. Set this as `STRIPE_WEBHOOK_SECRET`

### 4. Deploy to Production

```bash
# Deploy to production
vercel --prod

# Or push to git and let Vercel auto-deploy
git push origin main
```

## Troubleshooting Environment Variables

### Variable Not Found Errors

If you see errors like:
```
❌ Missing required environment variable: STRIPE_MONTHLY_PRICE_ID
```

**Check:**
1. Variable name matches exactly (case-sensitive)
2. Variable is set in the correct environment (Production vs Preview)
3. No `NEXT_PUBLIC_` prefix on server-only variables (like `STRIPE_SECRET_KEY`)
4. Required `NEXT_PUBLIC_` prefix on client variables

### Webhook Signature Verification Failed

If Stripe webhooks fail:

1. Verify `STRIPE_WEBHOOK_SECRET` matches your webhook's signing secret
2. Ensure webhook URL is correct (including `/api/billing/webhook`)
3. Check that webhook is sending to the production domain, not localhost

### Stripe Price IDs Not Working

If Stripe checkout fails:

1. Verify price IDs are correct format (`price_...`)
2. Ensure `STRIPE_MONTHLY_PRICE_ID` and `STRIPE_YEARLY_PRICE_ID` are set
3. Check Stripe Dashboard → Products → Prices to confirm IDs
4. Ensure prices are **Active** (not archived)

### Supabase Connection Errors

If database operations fail:

1. Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
2. Check `SUPABASE_SERVICE_ROLE_KEY` for server operations
3. Ensure Supabase project is not paused
4. Verify RLS policies are enabled

## Environment Variable Reference

### Public Variables (Exposed to Client)

These start with `NEXT_PUBLIC_` and are safe to expose:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_REDIRECT_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

### Server-Only Variables (Never Exposed)

These MUST NOT have `NEXT_PUBLIC_` prefix:
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_MONTHLY_PRICE_ID`
- `STRIPE_YEARLY_PRICE_ID`
- `RESEND_API_KEY`

## Post-Deployment Checklist

After deployment, verify:

- [ ] All environment variables are set (check Vercel dashboard)
- [ ] Application loads without errors
- [ ] Authentication flow works (signup/login)
- [ ] Database operations work (create/read/update)
- [ ] Stripe checkout creates subscriptions
- [ ] Webhooks are being received (check Stripe dashboard)
- [ ] Email sending works (test password reset)
- [ ] Multi-tenant isolation works (test with multiple churches)

## Local Development Setup

To match production locally:

1. Copy `.env.vercel.example` to `.env.local`
2. Fill in the variables with your development values
3. Use test keys for Stripe (`sk_test_...`)

```bash
cp .env.vercel.example .env.local
# Edit .env.local with your values
```

## Support

If you encounter issues:

1. Check Vercel deployment logs
2. Verify environment variables in Vercel Dashboard
3. Review browser console for client errors
4. Check server logs for API errors
5. Ensure all variables match `src/lib/env.ts` exactly

---

**Last Updated**: 2025-03-21
**Related Docs**: 
- [Production Readiness Guide](PRODUCTION.md)
- [Stripe Setup Guide](STRIPE_SETUP.md)