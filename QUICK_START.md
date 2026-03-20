# 🚀 WorshipCenter Deployment - Quick Start

Get your WorshipCenter app deployed in 15 minutes!

---

## 📋 Prerequisites

- [ ] Domain `worshipcenter.app` registered
- [ ] GitHub account with repository
- [ ] Vercel account (free)
- [ ] Supabase project created
- [ ] Stripe account set up

---

## 🎯 5-Minute Overview

1. **Configure code** (2 min) - Already done ✅
2. **Deploy marketing site** (3 min)
3. **Deploy app site** (5 min)
4. **Configure environment variables** (3 min)
5. **Set up Stripe webhooks** (2 min)

---

## Step 1: Deploy Marketing Site (worshipcenter.app)

### 1.1 Connect to Vercel

1. Go to [vercel.com](https://vercel.com) → Sign up/login with GitHub
2. Click "Add New Project"
3. Import your repository

### 1.2 Configure Project

- **Framework Preset**: Next.js
- **Root Directory**: `worshipcenter-web`
- Click "Deploy"

### 1.3 Add Custom Domain

1. Go to Settings → Domains
2. Add domain: `worshipcenter.app`
3. Add DNS record at your domain registrar:
   - **Type**: `CNAME`
   - **Name**: `@`
   - **Value**: `cname.vercel-dns.com`
4. Wait 5-30 minutes for DNS propagation

---

## Step 2: Deploy App Site (app.worshipcenter.app)

### 2.1 Create New Project

1. In Vercel, click "Add New Project"
2. Select the same repository
3. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (root)
4. Click "Deploy"

### 2.2 Add Custom Domain

1. Go to Settings → Domains
2. Add domain: `app.worshipcenter.app`
3. Add DNS record:
   - **Type**: `CNAME`
   - **Name**: `app`
   - **Value**: `cname.vercel-dns.com`

### 2.3 Add Environment Variables

Go to Settings → Environment Variables and add:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Stripe
STRIPE_SECRET_KEY=sk_live_your_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key
NEXT_PUBLIC_APP_URL=https://app.worshipcenter.app
```

**Where to get these values:**
- **Supabase**: Dashboard → Project → Settings → API
- **Stripe**: Dashboard → Developers → API keys (use Live mode for production)

### 2.4 Redeploy

After adding variables, Vercel will auto-redeploy.

---

## Step 3: Configure Stripe Webhooks

### 3.1 Create Webhook Endpoint

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter URL: `https://app.worshipcenter.app/api/billing/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Click "Add endpoint"

### 3.2 Get Webhook Secret

1. Click on the newly created webhook
2. Copy the "Signing Secret" (starts with `whsec_`)

### 3.3 Add to Vercel

1. Go back to your Vercel project
2. Settings → Environment Variables
3. Add: `STRIPE_WEBHOOK_SECRET=whsec_your_secret`
4. Vercel will auto-redeploy

---

## Step 4: Test Your Deployments

### Test Marketing Site
```bash
# Visit https://worshipcenter.app
# ✅ Home page loads
# ✅ Navigation works
# ✅ Links to app work
```

### Test App Site
```bash
# Visit https://app.worshipcenter.app
# ✅ Loads without errors
# ✅ Sign up page works
# ✅ Login page works
# ✅ Demo page loads
```

### Test API Routes
```bash
# Test auth endpoint
curl https://app.worshipcenter.app/api/auth/verify
```

---

## ✅ You're Live!

Your deployment is complete! Here's what you now have:

- ✅ **Marketing Site**: `https://worshipcenter.app`
- ✅ **App Site**: `https://app.worshipcenter.app`
- ✅ **Demo**: `https://app.worshipcenter.app/demo`
- ✅ **API Routes**: Working with Stripe & Supabase
- ✅ **Webhooks**: Configured and receiving events

---

## 🔄 Future Deployments

Any code changes you push to GitHub will automatically deploy:

```bash
git add .
git commit -m "Update feature"
git push origin main
# Vercel auto-deploys!
```

---

## 📱 Building Mobile Apps

Your existing Capacitor setup still works:

```bash
# Build for mobile (uses static export)
npm run cap:build

# Open iOS
npm run cap:ios

# Open Android
npm run cap:android
```

---

## 💰 Total Cost: $0/month

| Service | Cost |
|---------|------|
| Vercel (hosting) | $0 |
| Supabase (database) | $0 |
| Custom Domain | ~$10-15/year |
| **Total** | **$0/month** |

---

## 🆘 Troubleshooting

### Build Fails
- Check that environment variables are set correctly
- Ensure repository is public or Vercel has access

### Domain Not Working
- Wait up to 48 hours for DNS propagation
- Check DNS records match Vercel's instructions
- Use `dig worshipcenter.app` to verify

### Webhook Errors
- Verify webhook URL is exactly `https://app.worshipcenter.app/api/billing/webhook`
- Check `STRIPE_WEBHOOK_SECRET` matches exactly
- Test webhook in Stripe Dashboard

### API Routes 404
- Ensure `STATIC_EXPORT` is NOT set in Vercel environment variables
- Check that deployment succeeded

---

## 📚 Full Documentation

For detailed information, see:
- **Full Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Environment Variables**: [.env.vercel.example](./.env.vercel.example)
- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)

---

## 🎉 Success!

You've successfully deployed WorshipCenter for free using Vercel!

**What's Next?**
- Monitor usage in Vercel dashboard
- Set up error tracking (optional)
- Consider analytics (optional)
- Share with your team!

---

**Need Help?**
- Vercel Support: https://vercel.com/support
- Next.js GitHub: https://github.com/vercel/next.js