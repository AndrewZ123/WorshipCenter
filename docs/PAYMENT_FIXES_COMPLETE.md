# Payment System Fixes - Complete Summary

## Issues Identified

### 1. Persistent Payment Confirmation Errors
**Error:** HTTP 400 when confirming payment intents
**Cause:** Webhook handler was calling `stripe.subscriptions.update()` without required `items` parameter when handling subscription updates.

### 2. Subscription Status Not Updating
**Cause:** 
- Payment intent confirmation wasn't properly updating subscription status
- Missing checks for existing subscriptions before allowing new purchases
- Delay between Stripe webhook processing and database updates

### 3. Users Could Purchase Plans While Already Subscribed
**Cause:** No validation to prevent duplicate subscriptions for the same customer.

### 4. Missing Permission Checks
**Cause:** Billing operations were accessible to all users regardless of their role.

## Fixes Implemented

### Phase 1: Webhook Handler Fixes

**File:** `src/app/api/billing/webhook/route.ts`

**Changes:**
1. **Fixed Subscription Update Handler:**
   - Removed problematic `stripe.subscriptions.update()` call that was causing errors
   - Added proper logging for debugging
   - Only update subscription status in database based on Stripe webhook events

2. **Added Support for All Stripe Events:**
   - `customer.subscription.created` - Creates subscription in database
   - `customer.subscription.updated` - Updates subscription details
   - `customer.subscription.deleted` - Cancels subscription
   - `invoice.payment_succeeded` - Confirms payment and updates status
   - `invoice.payment_failed` - Marks subscription as past_due

### Phase 2: Enhanced Subscription Validation

**File:** `src/app/api/billing/create-payment-intent/route.ts`

**Changes:**
1. **Prevented Duplicate Subscriptions:**
   ```typescript
   // Check for existing active subscriptions
   const { data: activeSubscription } = await supabase
     .from('subscriptions')
     .select('*')
     .eq('church_id', userData.church_id)
     .in('status', ['active', 'trialing', 'past_due'])
     .single();

   if (activeSubscription) {
     return NextResponse.json({
       error: 'You already have an active subscription',
       currentStatus: activeSubscription.status,
       currentPriceId: activeSubscription.stripe_price_id,
     }, { status: 400 });
   }
   ```

2. **Added Permission Checks:**
   - Only admins can create payment intents
   - Returns 403 Forbidden for non-admin users

### Phase 3: Improved Payment Confirmation

**File:** `src/app/api/billing/confirm-payment/route.ts`

**Changes:**
1. **Enhanced Customer ID Handling:**
   - Properly waits for customer creation before confirming payment
   - Returns pending customer ID if creation is in progress

2. **Better Error Handling:**
   - Clear error messages for different failure scenarios
   - Logs detailed error information for debugging

### Phase 4: Subscription Synchronization Tool

**New File:** `src/app/api/billing/sync-subscription/route.ts`

**Purpose:** Manual tool to sync subscription status from Stripe

**Features:**
1. **Fetches Real Subscription Data:**
   - Queries Stripe API for the actual subscription status
   - Compares with database records
   - Updates database if mismatch found

2. **Handles Multiple Subscription States:**
   - Active subscriptions
   - Trial subscriptions
   - Past due subscriptions
   - Canceled subscriptions

3. **Permission Protected:**
   - Only admins can sync subscriptions
   - Returns 403 for non-admin users

**Usage:**
```bash
curl -X POST http://localhost:3000/api/billing/sync-subscription \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Phase 5: UI Components

**New File:** `src/components/billing/SyncSubscriptionButton.tsx`

**Purpose:** Provides UI button for manual subscription sync

**Features:**
- Shows loading state during sync
- Displays success/error messages
- Auto-refreshes subscription data after sync

**Usage in Billing Page:**
```tsx
<SyncSubscriptionButton onSyncComplete={refetch} />
```

**File:** `src/app/(app)/settings/billing/page.tsx`

**Changes:**
1. **Added Permission Checks:**
   - Uses `usePermissions()` hook
   - Only shows pricing cards to admins
   - Non-admins see "Contact Admin" message

2. **Enhanced Error Messages:**
   - Different messages based on user permissions
   - Clear guidance for non-admin users

## Testing Recommendations

### 1. Test Payment Flow
1. Start with a new church account (trialing status)
2. Attempt to subscribe to monthly plan
3. Complete payment using Stripe test card: `4242 4242 4242 4242`
4. Verify status updates to "active"
5. Check webhook logs for successful processing

### 2. Test Duplicate Prevention
1. Subscribe to a plan
2. Try to subscribe again (should fail with "already have active subscription" error)
3. Verify error message is clear

### 3. Test Subscription Sync
1. Manually update subscription status in Stripe Dashboard
2. Click "Sync Subscription" button in billing page
3. Verify status updates in database
4. Check webhook logs for sync activity

### 4. Test Permission Checks
1. Login as non-admin user
2. Attempt to create payment intent (should fail with 403)
3. Verify pricing cards show "Contact Admin" instead of subscribe buttons
4. Attempt to sync subscription (should fail with 403)

### 5. Test Webhook Processing
1. Create a test subscription in Stripe
2. Wait for webhook to process
3. Check database for new subscription record
4. Verify all fields are populated correctly

## Monitoring and Debugging

### Webhook Logs
Check your Stripe Dashboard webhook logs to see:
- Which events are being received
- Response status codes
- Error messages if any

### Database Queries
```sql
-- Check subscription status
SELECT * FROM subscriptions WHERE church_id = YOUR_CHURCH_ID;

-- Check for duplicate subscriptions
SELECT church_id, COUNT(*) as count
FROM subscriptions
WHERE status IN ('active', 'trialing', 'past_due')
GROUP BY church_id
HAVING count > 1;
```

### Stripe Dashboard Queries
1. Go to Dashboard → Subscriptions
2. Search by customer email or customer ID
3. View subscription status and payment history

## Common Issues and Solutions

### Issue: "Missing required param: items" Error
**Solution:** This is now fixed in webhook handler. Ensure you're using the updated version.

### Issue: Payment succeeds but status doesn't update
**Solution:** 
1. Check if webhook is properly configured in Stripe Dashboard
2. Verify webhook secret matches environment variable
3. Use the "Sync Subscription" button to manually update

### Issue: Can still purchase when already subscribed
**Solution:** 
1. Check `create-payment-intent` route has the duplicate subscription check
2. Verify subscription status in database is correct
3. Use sync tool if status is out of sync

### Issue: Non-admin users can see pricing cards
**Solution:** 
1. Ensure `usePermissions()` hook is imported and used
2. Check `canManageBilling` is being used to conditionally render pricing cards
3. Verify role-based access control is working

## Deployment Checklist

- [ ] Update environment variables with new webhook secret if changed
- [ ] Deploy all modified API routes
- [ ] Deploy updated UI components
- [ ] Test webhook endpoint is reachable from Stripe
- [ ] Verify webhook signature verification works
- [ ] Test payment flow in production
- [ ] Monitor webhook logs for first few transactions
- [ ] Set up alerts for webhook failures

## Stripe Test Cards

Use these for testing:

- **Success:** `4242 4242 4242 4242` (any expiry in future, any CVC)
- **Insufficient Funds:** `4000 0000 0000 9995`
- **Card Declined:** `4000 0000 0000 0002`
- **Expired Card:** `4000 0000 0000 0069`
- **Processing Error:** `4000 0000 0000 0119`

## Support and Troubleshooting

If issues persist after these fixes:

1. Check browser console for JavaScript errors
2. Check server logs for API errors
3. Verify Stripe webhook delivery in Stripe Dashboard
4. Use the sync subscription tool as a temporary fix
5. Check database for orphaned payment intents or subscriptions
6. Review webhook error logs in Stripe Dashboard

## Additional Resources

- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
- [Stripe Test Cards](https://stripe.com/docs/testing)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)