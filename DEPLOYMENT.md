# WorshipCenter Deployment Guide

Complete guide to deploying WorshipCenter to production using Vercel (free tier).

## Architecture Overview

- **Marketing Site**: `worshipcenter.app` - Landing pages, pricing, about
- **App Site**: `app.worshipcenter.app` - Full application with authentication, Stripe, Supabase

---

## Prerequisites

1. ✅ Domain `worshipcenter.app` registered
2. ✅ GitHub repository with both projects
3. ✅ Supabase project created
4. ✅ Stripe account set up
5. ✅ Vercel account (free)

---

## Phase 1: Prepare Your Codebase

### Main App Configuration (Already Done ✅)

Your `next.config.ts` has been updated to support both Vercel deployment and Capacitor builds:

- **Vercel Deployment**: Uses server-side rendering (API routes enabled)
- **Capacitor Builds**: Uses `STATIC_EXPORT=true` environment variable for static export

### Update Package Scripts (Already Done ✅)

The `cap:build` script now uses `STATIC_EXPORT=true` for proper mobile app builds.

---

## Phase 2: Deploy Marketing Site to Vercel

### Step 1: Connect GitHub to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click "Add New Project"
3. Import your GitHub repository

### Step 2: Configure Marketing Site

**Project Settings:**
- **Project Name**: `worshipcenter-web` (or your preference)
- **Framework Preset**: Next.js
- **Root Directory**: `worshipcenter-web`

**Environment Variables** (if needed):
```bash
NEXT_PUBLIC_APP_URL=https://app.worshipcenter.app
```

### Step 3: Deploy

1. Click "Deploy"
2. Wait for deployment to complete (~2-3 minutes)
3. Note the Vercel URL (e.g., `worshipcenter-web.vercel.app`)

### Step 4: Add Custom Domain

1. Go to project Settings → Domains
2. Click "Add Domain"
3. Enter `worshipcenter.app`
4. Follow Vercel's DNS instructions:
   - Add A record or CNAME record in your domain registrar
5. Wait for DNS propagation (5-30 minutes)

---

## Phase 3: Deploy App Site to Vercel

### Step 1: Add New Project

1. In Vercel dashboard, click "Add New Project"
2. Select the same repository
3. Set project name: `worshipcenter-app` (or your preference)

### Step 2: Configure App Site

**Project Settings:**
- **Framework Preset**: Next.js
- **Root Directory**: `./` (root directory)

**Environment Variables** (Required):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Optional
NEXT_PUBLIC_APP_URL=https://app.worshipcenter.app
```

**How to Get These Values:**

**Supabase:**
1. Go to your Supabase project → Settings → API
2. Copy Project URL and anon public key

**Stripe:**
1. Go to Stripe Dashboard → Developers → API keys
2. Copy Secret key (live mode) and Publishable key (live mode)
3. For webhook secret: See Phase 4

### Step 3: Deploy

1. Click "Deploy"
2. Wait for deployment to complete (~2-3 minutes)
3. Note the Vercel URL

### Step 4: Add Custom Domain

1. Go to project Settings → Domains
2. Click "Add Domain"
3. Enter `app.worshipcenter.app`
4. Follow DNS instructions (same as marketing site)
5. Wait for DNS propagation

---

## Phase 4: Configure Stripe Webhooks

### Step 1: Create Webhook Endpoint

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter URL: `https://app.worshipcenter.app/api/billing/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

### Step 2: Get Webhook Secret

1. After creating the webhook, click on it
2. Copy the "Signing Secret" (starts with `whsec_`)
3. Add this to your Vercel environment variables as `STRIPE_WEBHOOK_SECRET`
4. Redeploy the app (Vercel will auto-redeploy on env var change)

### Step 3: Test Webhook Locally (Optional)

For local testing, use the Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

---

## Phase 5: Update Marketing Site Links

Update links in `worshipcenter-web` to point to the correct URLs:

```typescript
// Example: Update navigation links
const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: 'https://app.worshipcenter.app/login', label: 'Login' }, // Updated
  { href: 'https://app.worshipcenter.app/signup', label: 'Sign Up' }, // Updated
];
```

Update demo links to point to:
- `https://app.worshipcenter.app/demo`

---

## Phase 6: Testing

### Test Marketing Site

1. Visit `https://worshipcenter.app`
2. ✅ Home page loads
3. ✅ Navigation works
4. ✅ Links to app redirect correctly

### Test App Site

1. Visit `https://app.worshipcenter.app`
2. ✅ Homepage redirects to login or shows demo
3. ✅ Sign up flow works
4. ✅ Login flow works
5. ✅ Dashboard loads
6. ✅ Stripe checkout works (test mode first)
7. ✅ Webhooks receive events

### Test API Routes

```bash
# Test auth verification
curl https://app.worshipcenter.app/api/auth/verify

# Test Stripe checkout (requires valid session)
# This will be tested through the UI
```

---

## Capacitor Mobile App Builds

To build mobile apps, use the updated script:

```bash
# Build for mobile (static export)
npm run cap:build

# Open iOS project
npm run cap:ios

# Open Android project
npm run cap:android
```

The `cap:build` script now automatically sets `STATIC_EXPORT=true` for proper static builds.

---

## Environment Variables Reference

### Main App (app.worshipcenter.app)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGci...` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `NEXT_PUBLIC_APP_URL` | App URL | `https://app.worshipcenter.app` |

### Marketing Site (worshipcenter.app)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | App URL for links | `https://app.worshipcenter.app` |

---

## Troubleshooting

### Build Fails

**Issue:** `Error: Export encountered errors`
- **Solution:** Ensure you're not using `output: "export"` for Vercel deployment. The config now uses `STATIC_EXPORT` env var.

### API Routes Not Working

**Issue:** 404 on API routes
- **Solution:** Check that `output` is not set to `"export"` in production. Ensure `STATIC_EXPORT` env var is not set in Vercel.

### Stripe Webhook Failing

**Issue:** Webhook signature verification fails
- **Solution:** Ensure `STRIPE_WEBHOOK_SECRET` matches exactly. Check that the webhook endpoint URL is correct.

### Domain Not Resolving

**Issue:** Custom domain shows error
- **Solution:** 
  1. Check DNS propagation (use `dig worshipcenter.app`)
  2. Verify DNS records match Vercel's instructions
  3. Wait up to 48 hours for full propagation

### Environment Variables Not Working

**Issue:** Features not working in production
- **Solution:** 
  1. Verify env vars are set in Vercel project settings
  2. Redeploy after adding env vars
  3. Check that variable names match exactly (case-sensitive)

---

## Vercel Free Tier Limits

Your free tier includes:
- ✅ Unlimited projects
- ✅ 100GB bandwidth/month
- ✅ 6GB bandwidth/hour
- ✅ 10,000 build minutes/month
- ✅ Serverless functions
- ✅ Automatic SSL
- ✅ Global CDN

**Monitoring:**
- Check usage in Vercel dashboard → Usage
- You'll receive alerts at 80% usage
- Upgrade to Pro ($20/month) if needed

---

## Security Checklist

- [x] All environment variables are set in Vercel (not committed to git)
- [x] API keys have appropriate restrictions
- [x] Stripe webhook secret is configured
- [x] CORS is properly configured in Supabase
- [x] RLS policies are enabled in Supabase
- [x] Security headers are configured in Next.js
- [x] HTTPS is enforced (automatic with Vercel)
- [x] Rate limiting is considered for API routes

---

## Deployment Workflow

### Future Updates

1. Make changes in your local repository
2. Commit and push to GitHub
3. Vercel automatically detects and deploys changes
4. Preview deployments available for pull requests

### Staging Environment (Optional)

For testing before production:

1. Create a new Vercel project connected to the same repo
2. Use a different branch (e.g., `staging`)
3. Deploy to a different domain (e.g., `staging.worshipcenter.app`)
4. Test thoroughly before merging to main

---

## Cost Summary

**Total Monthly Cost: $0** 💰

- Vercel Free Tier: $0
- Custom Domain: ~$10-15/year (domain registrar)
- Supabase Free Tier: $0
- Stripe: Pay-as-you-go (transaction fees apply)

---

## Next Steps

1. [ ] Register domain `worshipcenter.app` if not already
2. [ ] Push code to GitHub
3. [ ] Create Vercel account
4. [ ] Deploy marketing site
5. [ ] Deploy app site
6. [ ] Configure environment variables
7. [ ] Set up Stripe webhooks
8. [ ] Update links in marketing site
9. [ ] Test all functionality
10. [ ] Monitor initial traffic

---

## Support

If you encounter issues:

- **Vercel**: [vercel.com/docs](https://vercel.com/docs)
- **Next.js**: [nextjs.org/docs](https://nextjs.org/docs)
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)
- **Stripe**: [stripe.com/docs](https://stripe.com/docs)

---

## Quick Reference Commands

```bash
# Local development
npm run dev

# Production build (local test)
npm run build
npm start

# Mobile app build
npm run cap:build

# Deploy to Vercel
git push origin main  # Vercel auto-deploys
```

---

**Last Updated:** March 2026
**Deployment Platform:** Vercel (Free Tier)