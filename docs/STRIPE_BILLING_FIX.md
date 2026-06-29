# Stripe Billing — Diagnosis & Fix

Billing "not working" has **two layers**: (1) the local environment is missing
the keys required to make billing work at all, and (2) the code had several
bugs that would break billing *even once the keys are set*. Both are addressed
below.

---

## 1. Primary Root Cause: `.env.local` is missing required variables

`grep` of `.env.local` shows **only 3 keys set**:

```
NEXT_PUBLIC_APP_URL=<set>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<set>
NEXT_PUBLIC_SUPABASE_URL=<set>
```

**Missing (all required for billing to function):**

| Variable | Why it's needed |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin access. Without it, `supabaseAdmin` falls back to a **dummy client** (`https://placeholder.supabase.co`) — every auth check + subscription lookup in the billing routes silently fails. |
| `STRIPE_SECRET_KEY` | Required by `isStripeConfigured()`. If absent, every billing route returns `503 Payment system is not configured.` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification. Without it the webhook returns `503`. |
| `STRIPE_MONTHLY_PRICE_ID` | Needed to create checkout sessions for the monthly plan. |
| `STRIPE_YEARLY_PRICE_ID` | Needed to create checkout sessions for the yearly plan. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side Stripe (optional for the current flow, but expected). |

### Fix — add these to `.env.local`

```bash
# Supabase (REQUIRED — get from Supabase Dashboard → Settings → API)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...your_service_role_key...

# Stripe (REQUIRED — get from Stripe Dashboard → Developers → API keys)
STRIPE_SECRET_KEY=sk_test_...      # use sk_live_... in production
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Prices (Stripe Dashboard → Products → click each price → copy "price_..." ID)
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_YEARLY_PRICE_ID=price_...

# Stripe Webhook Secret (from Stripe CLI or Dashboard → Developers → Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_...
```

> ⚠️ **Restart `next dev` after editing `.env.local`** — Next.js does not hot-reload env vars.

---

## 2. Code Bugs Found & Fixed

These were latent bugs that would surface once the keys were set. All are
already patched in this branch.

### 2a. Webhook `mapStripeStatus()` returned an invalid status → DB CHECK violation

**File:** `src/app/api/billing/webhook/route.ts`

The DB `subscriptions.status` column has a `CHECK` constraint allowing only:
`'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'`.

The old `mapStripeStatus()` returned the **raw Stripe status** for unknown
values (e.g. `'paused'`), which violated the constraint and caused the webhook
`UPDATE` to throw — so subscription updates from Stripe were silently dropped.

**Fix:** Explicitly map every known Stripe status and default unknown ones to
`'canceled'` (the safest non-active status) with a warning log.

### 2b. Checkout & Portal routes passed placeholder customer IDs to Stripe

**Files:** `create-checkout-session/route.ts`, `create-portal-session/route.ts`

Migration `019_fix_subscription_duplicate_key.sql` historically inserted
**fake placeholder values** like `cus_pending_<uuid>` into
`subscriptions.stripe_customer_id`. When a user tried to open the portal (or
re-checkout), the route passed `cus_pending_...` to Stripe, which rejected it
with a `400 No such customer` error.

**Fix:**
- Added `isValidStripeCustomerId()` helper to both routes — rejects anything
  matching `cus_pending_*`.
- Portal now returns a clear `400 No billing account found. Please subscribe first.`
  instead of crashing.
- Checkout detects a stale/placeholder customer and **creates a fresh Stripe
  customer** instead of reusing the invalid one.
- Migration `020_cleanup_placeholder_stripe_customers.sql` nulls out existing
  placeholder rows in the DB.

### 2c. Portal route created a new billing-portal config on every request

**File:** `create-portal-session/route.ts`

Each portal open called `stripe.billingPortal.configurations.create(...)`,
which (a) clutters the Stripe account with dozens of configs and (b) risks
**rate-limit errors** on Stripe's side.

**Fix:** Reuse an existing default configuration (via `list({ is_default: true })`),
only creating one on the very first call as a fallback.

---

## 3. How to verify billing works end-to-end (local)

After adding the env vars and restarting `next dev`:

### 3a. Test mode webhooks

In a separate terminal, forward Stripe test events to your local server:

```bash
stripe listen --forward-to http://localhost:3000/api/billing/webhook
```

Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET` and restart `next dev`.

### 3b. Debug endpoint

The app already has a debug route to inspect the current subscription state:

```
GET /api/debug/subscription
```

Use it to confirm the DB row's `stripe_customer_id` is a real `cus_...` (or
NULL), not a `cus_pending_...` placeholder.

### 3c. Full checkout flow

1. Sign in as a church admin.
2. Go to **Settings → Billing**.
3. Click **Upgrade** → choose monthly/yearly.
4. Complete the Stripe Checkout (use card `4242 4242 4242 4242` in test mode).
5. You should be redirected back to `/settings/billing` showing `active`.
6. The `stripe listen` terminal should log `checkout.session.completed`.
7. **Manage Subscription** (portal) should open without error.

---

## 4. Production checklist (Vercel)

Set the same variables in **Vercel → Project → Settings → Environment Variables**.
Production additionally requires:

- `STRIPE_SECRET_KEY` = `sk_live_...`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_live_...`
- `STRIPE_WEBHOOK_SECRET` = the secret from your **production webhook endpoint**
  (Stripe Dashboard → Developers → Webhooks → add endpoint
  `https://yourdomain.com/api/billing/webhook`).
- `SUPABASE_SERVICE_ROLE_KEY` (same value as local).

Redeploy after setting them.