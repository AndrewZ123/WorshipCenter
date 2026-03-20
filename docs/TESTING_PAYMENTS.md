# Testing Stripe Payments

This guide will help you test the embedded payment flow in your WorshipCenter app.

## Prerequisites

Before testing, make sure you have:
1. ✅ Applied all database migrations (including `009_add_subscription_to_signup.sql`)
2. ✅ Set up Stripe test keys in `.env.local`
3. ✅ Restarted your development server (important for CSP changes!)

## Restart Your Dev Server

After updating `next.config.ts` with the new CSP settings, you MUST restart your dev server:

```bash
# Stop the current server (Ctrl+C)
# Then restart it:
npm run dev
```

## Test Flow

### 1. Access Billing Page
- Navigate to `http://localhost:3000/settings/billing`
- You should see your subscription status and available plans

### 2. Click Subscribe
- Click either "Subscribe Monthly ($29/mo)" or "Subscribe Yearly ($290/yr)"
- A modal will open with the embedded payment form

### 3. Fill in Payment Form
Use Stripe's test card data:

```
Card Number: 4242 4242 4242 4242
Expiration: 12/34 (or any future date)
CVC: 123
ZIP: 12345
```

### 4. Complete Payment
- Click "Pay" or "Subscribe" button
- Watch for success message
- The modal should close automatically

### 5. Verify Success
- Check that your subscription status changes to "Active"
- Refresh the page to see updated billing info

## Common Issues & Solutions

### "Unable to initialize payment"
**Cause**: Stripe publishable key not set or incorrect

**Solution**:
```bash
# Check your .env.local file
cat .env.local

# Make sure you have:
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxx
```

### CSP Errors in Console
**Cause**: Content Security Policy blocking Stripe resources

**Solution**:
1. Make sure you've updated `next.config.ts` with the new CSP settings
2. **Restart your dev server** (Ctrl+C then `npm run dev`)
3. Clear browser cache and reload

### "Missing subscription record"
**Cause**: Your user doesn't have a subscription in the database

**Solution**:
```bash
# Run the script to add missing subscriptions
npm run tsx scripts/add-missing-subscriptions.ts
```

### Payment Form Doesn't Load
**Cause**: Stripe.js not loading due to CSP

**Solution**:
1. Check browser console for CSP errors
2. Verify CSP includes these domains:
   - `https://js.stripe.com`
   - `https://m.stripe.com`
   - `https://m.stripe.network`
   - `https://fonts.googleapis.com`
   - `https://fonts.gstatic.com`
3. Restart dev server

### Payment Fails
**Cause**: Various reasons (card declined, network issues, etc.)

**Solution**:
1. Check browser console for specific error
2. Check Stripe Dashboard → Payments for details
3. Verify you're using a valid test card
4. Check your Stripe webhook configuration

## Verifying in Stripe Dashboard

After a successful payment:

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Make sure you're in **Test Mode** (toggle in top-right)
3. Check **Payments** - you should see the test payment
4. Check **Subscriptions** - you should see the new subscription
5. Check **Customers** - verify the customer was created

## Test Card Scenarios

| Card Number | What to Test | Expected Result |
|-------------|--------------|-----------------|
| `4242 4242 4242 4242` | Normal payment | ✅ Success |
| `4000 0000 0000 0002` | Declined card | ❌ Card declined |
| `4000 0000 0000 9995` | Insufficient funds | ❌ Insufficient funds |
| `4000 0000 0000 0069` | Expired card | ❌ Expired card |
| `4000 0000 0000 0127` | Incorrect CVC | ❌ Incorrect CVC |

## Cleaning Up Test Data

To reset your test environment:

```bash
# Option 1: Delete test subscriptions in Stripe Dashboard
# Dashboard → Subscriptions → Filter by Test Mode → Delete

# Option 2: Delete from database directly (use Supabase Dashboard)
# DELETE FROM subscriptions WHERE church_id = 'your-church-id';

# Option 3: Start fresh with a new test user
# Sign up with a new email address
```

## Debugging Tips

### Enable Stripe Debug Mode

Add this to your `.env.local`:
```bash
NEXT_PUBLIC_STRIPE_DEBUG=true
```

### Check API Logs

```bash
# View server logs in your terminal where npm run dev is running
# Look for errors from /api/billing/* routes
```

### Check Database

```bash
# Using Supabase CLI
supabase db dump --data-only -f subscriptions.sql

# Or check in Supabase Dashboard
# Table Editor → subscriptions
```

### Monitor Webhooks

```bash
# Using Stripe CLI for local development
stripe listen --forward-to localhost:3000/api/billing/webhook

# This will show webhook events as they arrive
```

## Next Steps After Testing

Once everything works in test mode:

1. ✅ Create production products/prices in Stripe
2. ✅ Set up production webhook endpoint
3. ✅ Update environment variables with live keys
4. ✅ Make a small real payment test ($1)
5. ✅ Verify everything works end-to-end

## Need Help?

- **Stripe Docs**: https://stripe.com/docs/payments
- **Stripe Dashboard**: https://dashboard.stripe.com
- **Check the logs**: Your terminal and browser console are your best friends!