# Payment Issues Fixed - Complete Resolution Guide

## Summary

Fixed critical issues causing Stripe payments to fail and subscription states to become out of sync between Stripe and the database.

## Problems Identified

### 1. **Webhook Not Clearing `trial_end` When Activating**
**Issue:** When a user completed payment and their subscription became `active`, the webhook handlers were not clearing the `trial_end` field in the database. This caused the UI to incorrectly show trial information for active subscribers.

**Root Cause:** 
- `checkout.session.completed` handler did not clear `trial_end`
- `customer.subscription.updated` handler did not clear `trial_end` when transitioning from `trialing` to `active`
- Missing `stripe_customer_id` and `stripe_price_id` updates
- No logging to debug webhook failures

### 2. **Silent Webhook Failures**
**Issue:** Webhook events would fail silently, making it impossible to debug payment issues.

**Root Cause:** No logging or error handling in webhook handlers.

### 3. **Database/Stripe State Mismatch**
**Issue:** Database would show `status: 'active'` but `trial_end` still had a date, causing confusion in the UI.

## Fixes Applied

### 1. Enhanced Webhook Handlers

#### `checkout.session.completed`
```typescript
// Now properly clears trial_end and updates all fields
await supabase
  .from('subscriptions')
  .update({
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    status: 'active',
    current_period_start: new Date(subData.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subData.current_period_end * 1000).toISOString(),
    trial_end: null, // ✅ NOW CLEARED
    stripe_price_id: subData.items?.data?.[0]?.price?.id || null,
  })
  .eq('church_id', churchId);
```

#### `customer.subscription.updated`
```typescript
// Now detects trial → active transition and clears trial_end
const shouldClearTrialEnd = sub.status === 'trialing' && subscription.status === 'active';

const updateData: any = {
  status: subscription.status,
  current_period_start: new Date(subData.current_period_start * 1000).toISOString(),
  current_period_end: new Date(subData.current_period_end * 1000).toISOString(),
  cancel_at_period_end: subscription.cancel_at_period_end,
  stripe_customer_id: subData.customer as string, // ✅ NOW UPDATED
  stripe_price_id: subData.items?.data?.[0]?.price?.id, // ✅ NOW UPDATED
};

if (shouldClearTrialEnd) {
  updateData.trial_end = null; // ✅ NOW CLEARED
}
```

### 2. Added Comprehensive Logging

All webhook handlers now log:
- Event received with key details
- Database update success/failure
- Subscription status transitions
- Error details with context

### 3. Existing Debug Tools

The following debug tools are already in place:

#### Debug Endpoint
`GET /api/debug/subscription` - Returns detailed subscription state

#### Sync Endpoint
`POST /api/billing/sync-subscription` - Manually sync subscription from Stripe to database

## Resolving Your Current Issue

If you have a subscription that's active in Stripe but showing trial in the UI:

### Option 1: Automatic Fix (Wait for Webhook)
1. The webhook will eventually fire and fix the database state
2. This may take a few minutes or hours depending on Stripe's event timing

### Option 2: Manual Fix (Immediate)
Use the sync endpoint to force update from Stripe:

```bash
# Get your auth token from browser localStorage
TOKEN=your_auth_token_here

curl -X POST \
  http://localhost:3000/api/billing/sync-subscription \
  -H "Authorization: Bearer $TOKEN"
```

Or visit the debug page:
```
http://localhost:3000/api/debug/subscription
```

### Option 3: Database Fix (Direct SQL)
If you have database access:

```sql
-- Update the subscription to clear trial_end
UPDATE subscriptions
SET 
  trial_end = NULL,
  stripe_customer_id = 'cus_...',  -- Get from Stripe
  stripe_price_id = 'price_...'    -- Get from Stripe
WHERE church_id = 'your_church_id';
```

## Testing the Fix

### 1. Test Payment Flow
1. Start a new trial account
2. Complete payment for a plan
3. Check the billing page - should show "Active" subscription
4. No trial banner should appear
5. Pricing cards should be hidden

### 2. Monitor Webhook Logs
Check your server logs for webhook events:
```bash
# Watch for webhook events
tail -f /path/to/logs | grep "checkout.session.completed"
tail -f /path/to/logs | grep "customer.subscription.updated"
```

You should see logs like:
```
checkout.session.completed received { churchId: 'xxx', subscriptionId: 'sub_...', customerId: 'cus_...' }
Successfully updated subscription for church: xxx
```

### 3. Verify Database State
```sql
SELECT 
  status,
  trial_end,
  stripe_customer_id,
  stripe_price_id,
  current_period_end
FROM subscriptions
WHERE church_id = 'your_church_id';
```

Expected for active subscription:
- `status`: `'active'`
- `trial_end`: `NULL`
- `stripe_customer_id`: Populated
- `stripe_price_id`: Populated

## Preventing Future Issues

### 1. Webhook Monitoring
Set up webhook failure alerts in Stripe Dashboard:
- Go to Stripe Dashboard → Developers → Webhooks
- Configure email alerts for failed webhooks

### 2. Regular State Checks
Periodically check for inconsistencies:
```sql
-- Find subscriptions with mismatched state
SELECT church_id, status, trial_end
FROM subscriptions
WHERE status = 'active' AND trial_end IS NOT NULL;
```

### 3. Automated Reconciliation
Consider adding a cron job to sync subscriptions daily:

```typescript
// scripts/sync-all-subscriptions.ts
// Runs daily to ensure database matches Stripe
```

## Files Changed

1. `src/app/api/billing/webhook/route.ts` - Enhanced webhook handlers with logging and proper state management

## Related Documentation

- `docs/BILLING_FIXES.md` - Previous billing fixes
- `docs/EMBEDDED_PAYMENTS.md` - Payment flow documentation
- `docs/STRIPE_SETUP.md` - Stripe configuration guide
- `docs/TESTING_PAYMENTS.md` - Testing payment flows

## Support

If issues persist:

1. Check browser console for errors
2. Check server logs for webhook events
3. Use `/api/debug/subscription` to inspect state
4. Verify Stripe webhook endpoint is configured correctly
5. Ensure webhook secret matches environment variable

## Git History

- `8d31649` - Fix webhook handlers to properly clear trial_end and add comprehensive logging
- Previous commits - Initial billing setup and debug tools

---

**Last Updated:** March 20, 2026