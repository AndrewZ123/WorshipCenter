# Stripe Setup Guide for WorshipCenter

This guide walks you through configuring Stripe for embedded payments in WorshipCenter.

## Step 1: Create Stripe Account

1. Go to [stripe.com](https://stripe.com) and sign up for an account
2. Complete the verification process (business details, bank account, etc.)
3. Enable your account (or use Test Mode for development)

## Step 2: Create Products and Prices

### Navigate to Products

1. Go to the Stripe Dashboard
2. Click **Products** in the left sidebar
3. Click **Add product**

### Create Monthly Plan

1. **Product Details**:
   - Name: `WorshipCenter Monthly`
   - Description: `Monthly subscription to WorshipCenter`

2. **Pricing**:
   - Price: `$29`
   - Currency: `USD`
   - Billing interval: `Monthly`

3. Click **Add product**

4. **Copy the Price ID** (looks like `price_xxxxxxxxxxxxx`)
   - This will be your `STRIPE_MONTHLY_PRICE_ID`

### Create Yearly Plan

1. Click **Add product** again

2. **Product Details**:
   - Name: `WorshipCenter Yearly`
   - Description: `Yearly subscription to WorshipCenter`

3. **Pricing**:
   - Price: `$290`
   - Currency: `USD`
   - Billing interval: `Yearly`

4. Click **Add product**

5. **Copy the Price ID** (looks like `price_xxxxxxxxxxxxx`)
   - This will be your `STRIPE_YEARLY_PRICE_ID`

## Step 3: Get API Keys

1. Go to **Developers** → **API keys** in the Stripe Dashboard
2. You'll see two sets of keys:
   - **Test keys** (for development)
   - **Live keys** (for production)

3. Copy the **Publishable key**:
   - Test: `pk_test_xxxxxxxxxxxxx`
   - Live: `pk_live_xxxxxxxxxxxxx`

4. Copy the **Secret key**:
   - Test: `sk_test_xxxxxxxxxxxxx`
   - Live: `sk_live_xxxxxxxxxxxxx`

⚠️ **Never commit secret keys to your repository!**

## Step 4: Configure Webhook

### Create Webhook Endpoint

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. **Endpoint URL**: `https://your-domain.com/api/billing/webhook`
   - For local development: Use the Stripe CLI (see below)
4. **Events to listen to**: Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

5. Click **Add endpoint**

6. **Copy the Webhook Secret** (starts with `whsec_`)
   - This will be your `STRIPE_WEBHOOK_SECRET`

### For Local Development (Stripe CLI)

1. Install Stripe CLI:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Linux
   curl -s https://packages.stripe.dev/api/security/patch-versions | \
     sudo bash -s install-stripe-cli

   # Windows
   scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli
   scoop install stripe
   ```

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/billing/webhook
   ```

4. Copy the webhook secret that appears (starts with `whsec_`)

## Step 5: Update Environment Variables

### Local Development (.env.local)

```bash
# Stripe Keys (Test Mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxx

# Stripe Price IDs
STRIPE_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxxx
STRIPE_YEARLY_PRICE_ID=price_xxxxxxxxxxxxxx

# Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxx
```

### Vercel Environment Variables

1. Go to your project in Vercel
2. Go to **Settings** → **Environment Variables**
3. Add the following variables (select the appropriate environments):

   **For Preview/Development**:
   ```
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxx
   STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxx
   STRIPE_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxxx
   STRIPE_YEARLY_PRICE_ID=price_xxxxxxxxxxxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxx
   ```

   **For Production** (once you're ready to go live):
   ```
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxx
   STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxx
   STRIPE_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxxx
   STRIPE_YEARLY_PRICE_ID=price_xxxxxxxxxxxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxx
   ```

4. Redeploy your Vercel project after adding variables

## Step 6: Test the Payment Flow

### Test Mode

1. Ensure you're using Test Mode keys (`pk_test_` / `sk_test_`)
2. Go to `/settings/billing` in your app
3. Click "Subscribe Monthly" or "Subscribe Yearly"
4. Fill in the payment form with Stripe test card:
   - Card number: `4242 4242 4242 4242`
   - Expiration: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits
5. Complete the payment

### Verify in Stripe Dashboard

1. Go to **Payments** - you should see the test payment
2. Go to **Subscriptions** - you should see the new subscription
3. Check your app - the user should now have an active subscription

## Step 7: Going Live

When you're ready to accept real payments:

1. **Activate your Stripe account**:
   - Complete all verification steps
   - Add your business bank account
   - Set up your tax information

2. **Switch to Live Mode**:
   - Update environment variables with Live keys
   - Update price IDs to your production price IDs
   - Update webhook endpoint to your production URL
   - Update webhook secret to the production secret

3. **Test live payments**:
   - Make a small test payment (e.g., $1)
   - Verify everything works correctly
   - Cancel the test subscription

## Troubleshooting

### "Unable to initialize payment"

- Check that `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set
- Verify the key format (should start with `pk_test_` or `pk_live_`)
- Check browser console for errors

### Webhook errors

- Verify webhook endpoint is accessible
- Check webhook signature matches
- Ensure webhook secret is correct

### Payment fails

- Check Stripe Dashboard for payment details
- Verify card details are valid
- Check for fraud blocks (in Test Mode, use test card numbers)

### Subscription not created

- Check webhook events in Stripe Dashboard
- Verify webhook handler is working
- Check server logs for errors

## Useful Stripe Test Cards

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Default card (succeeds) |
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0069` | Expired card |
| `4000 0000 0000 0127` | Incorrect CVC |

More test cards: [Stripe Test Cards](https://stripe.com/docs/testing#cards)

## Additional Resources

- [Stripe Payments Documentation](https://stripe.com/docs/payments)
- [Stripe Subscriptions Guide](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Webhooks Best Practices](https://stripe.com/docs/webhooks/best-practices)

## Troubleshooting: Missing Subscription Records

If you see errors like "Cannot coerce the result to a single JSON object" when accessing the billing page, it means your user's church doesn't have a subscription record. This can happen if you signed up before the subscription feature was added.

### Fix for Existing Users

Run this script to add trial subscriptions to any churches that don't have one:

```bash
# Make sure you have your Supabase credentials in .env.local
npm run tsx scripts/add-missing-subscriptions.ts
```

This will:
1. Find all churches in your database
2. Check which ones have subscriptions
3. Add a 14-day trial subscription to those missing one
4. Report the results

### New Signups

All new signups will automatically get a trial subscription thanks to the updated signup function in migration `009_add_subscription_to_signup.sql`. Make sure this migration has been applied to your database.

### Deploy the Migration

To apply the migration to your production database:

```bash
# Using Supabase CLI
supabase db push

# Or manually apply the migration via Supabase Dashboard
```
