# Embedded Stripe Payments Guide

This guide explains how to properly configure and use embedded Stripe payments within your WorshipCenter application, keeping users on your website without redirects and allowing full customization to match your theme.

## Overview

The embedded payment implementation uses Stripe's **Payment Element** with **Payment Intents**, which allows you to:

- ✅ Keep users on your website (no redirects)
- ✅ Fully customize the payment UI to match your theme
- ✅ Support multiple payment methods (cards, Apple Pay, Google Pay, etc.)
- ✅ Handle complex payment flows (subscriptions, trials, etc.)
- ✅ Provide a seamless user experience

## Architecture

```
┌─────────────────┐
│   User clicks   │
│  "Subscribe"    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Opens Modal   │
│  with Embedded  │
│  Payment Form   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Frontend calls  │
│ /api/billing/  │
│create-payment-  │
│   intent API   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Backend API   │
│ creates Stripe  │
│ Payment Intent  │
│  & returns      │
│ clientSecret    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Stripe SDK    │
│  initializes &  │
│  renders card   │
│  payment UI     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User fills &   │
│  submits form   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Stripe confirms │
│  payment (no    │
│   redirect)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Frontend calls  │
│ /api/billing/  │
│confirm-payment  │
│   API           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Backend creates│
│  subscription & │
│  activates it  │
└─────────────────┘
```

## Files Created/Modified

### New Files

1. **`src/app/api/billing/create-payment-intent/route.ts`**
   - Creates a Stripe Payment Intent
   - Returns the `clientSecret` needed by Stripe SDK
   - Handles authentication and validation

2. **`src/app/api/billing/confirm-payment/route.ts`**
   - Confirms successful payment
   - Creates/activates subscription in Supabase
   - Returns success/error response

3. **`src/components/billing/EmbeddedPaymentForm.tsx`**
   - Main payment form component
   - Handles Stripe initialization
   - Manages payment flow and error handling
   - Custom styled to match Chakra UI theme

### Modified Files

1. **`src/app/(app)/settings/billing/page.tsx`**
   - Updated to use embedded payment modal
   - Removed redirect-based checkout
   - Added modal for payment form

## How It Works

### 1. User Initiates Payment

When a user clicks "Subscribe Monthly" or "Subscribe Yearly":

```typescript
const handleSubscribe = (priceType: 'monthly' | 'yearly') => {
  setSelectedPriceType(priceType);
  setShowPaymentForm(true);
};
```

This opens a modal containing the `EmbeddedPaymentForm` component.

### 2. Payment Intent Creation

The component immediately calls your API to create a Payment Intent:

```typescript
const response = await fetch('/api/billing/create-payment-intent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({ priceType }),
});
```

The backend API:

1. Validates the user is authenticated
2. Creates a Stripe Payment Intent
3. Returns the `clientSecret` to the frontend

### 3. Stripe Initialization

The frontend uses the `clientSecret` to initialize Stripe:

```typescript
const options = {
  clientSecret,
  appearance: {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#319795', // Teal.500
      colorText: '#2D3748', // gray.800
      // ... more customization
    },
  },
};

<Elements stripe={stripePromise} options={options}>
  <CheckoutForm />
</Elements>
```

### 4. User Fills Payment Form

The `PaymentElement` component renders a fully-featured payment form:

- Credit card entry (with real-time validation)
- Alternative payment methods (Apple Pay, Google Pay, etc.)
- Card number formatting
- Expiry date validation
- CVC validation

All styled to match your theme using the `appearance` configuration.

### 5. Payment Confirmation

When the user submits:

```typescript
const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
  elements,
  confirmParams: {
    return_url: `${window.location.origin}/settings/billing`,
  },
  redirect: 'if_required', // Key: only redirect if necessary
});
```

With `redirect: 'if-required'`, Stripe:
- Confirms the payment without redirect if possible
- Only redirects for 3D Secure or other required authentication
- Returns the `paymentIntent` object on success

### 6. Subscription Activation

After successful payment, the frontend calls the confirm API:

```typescript
const response = await fetch('/api/billing/confirm-payment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    paymentIntentId: paymentIntent?.id,
    priceType,
  }),
});
```

The backend:
1. Verifies the payment succeeded
2. Creates a subscription in Stripe
3. Saves subscription details to Supabase
4. Returns success

### 7. User Feedback

The modal closes and shows a success message:

```typescript
const handlePaymentSuccess = () => {
  setShowPaymentForm(false);
  setSuccess(true);
  refetch(); // Reload subscription data
};
```

## Customization

### Styling the Payment Element

The payment form is styled to match your Chakra UI theme:

```typescript
const appearance = {
  theme: 'stripe' as const,
  variables: {
    // Primary brand color
    colorPrimary: '#319795', // Teal.500
    
    // Text colors
    colorText: '#2D3748', // gray.800
    colorTextSecondary: '#718096', // gray.500
    
    // Background
    colorBackground: '#ffffff',
    
    // Status colors
    colorDanger: '#E53E3E', // red.500
    colorSuccess: '#48BB78', // green.500
    colorWarning: '#ECC94B', // yellow.400
    colorInfo: '#4299E1', // blue.400
    
    // Typography
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    fontSizeBase: '16px',
    
    // Spacing & borders
    spacingUnit: '4px',
    borderRadius: '8px',
  },
};
```

**To customize colors:**

1. Open `src/components/billing/EmbeddedPaymentForm.tsx`
2. Find the `appearance` object (line ~190)
3. Change the color values to match your theme

**Available variables:**
- `colorPrimary` - Main brand color
- `colorText` - Primary text color
- `colorTextSecondary` - Secondary text color
- `colorBackground` - Background color
- `colorDanger` - Error color
- `colorSuccess` - Success color
- `colorWarning` - Warning color
- `colorInfo` - Info color
- `fontFamily` - Font family
- `fontSizeBase` - Base font size
- `spacingUnit` - Spacing unit
- `borderRadius` - Border radius

### Customizing the Form Layout

You can change the payment element layout:

```typescript
<PaymentElement
  options={{
    layout: {
      type: 'tabs', // or 'accordion' or 'auto'
      defaultCollapsed: false,
      radios: true,
      spacedAccordionItems: false,
    },
  }}
/>
```

**Layout options:**
- `type: 'tabs'` - Show payment methods as tabs
- `type: 'accordion'` - Show as collapsible accordion
- `type: 'auto'` - Let Stripe decide

### Customizing the Modal

The modal styling is controlled by Chakra UI props in `src/app/(app)/settings/billing/page.tsx`:

```typescript
<Modal
  isOpen={showPaymentForm}
  onClose={handlePaymentCancel}
  size="lg" // sm, md, lg, xl, full
  isCentered
  closeOnOverlayClick={false}
>
  {/* Modal content */}
</Modal>
```

## Environment Variables

Ensure these are set in your `.env.local`:

```bash
# Stripe Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (optional if using dynamic pricing)
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID=price_...
```

## Testing

### Test Cards

Use these Stripe test cards to test different scenarios:

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0025 0000 3155` | Requires authentication |
| `4000 0000 0000 9995` | Card declined |
| `4000 0000 0000 0002` | Insufficient funds |
| `4242 4242 4242 4241` | Incorrect CVC |

**Test Expiry:** Any future date  
**Test CVC:** Any 3 digits

### Testing Flow

1. Start your development server: `npm run dev`
2. Navigate to `/settings/billing`
3. Click "Subscribe Monthly" or "Subscribe Yearly"
4. Fill in test card details: `4242 4242 4242 4242`
5. Use any future expiry and any CVC
6. Submit the form
7. Verify:
   - Payment processes without redirect
   - Success message appears
   - Subscription is active in database

## Troubleshooting

### Issue: "No publishable key configured"

**Solution:** Ensure `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set in `.env.local`

### Issue: "Failed to initialize payment"

**Solution:** Check the backend API logs for errors. Common issues:
- Missing or invalid Stripe secret key
- Invalid price ID
- Authentication failure

### Issue: Payment succeeds but subscription not activated

**Solution:** Check:
1. The `/api/billing/confirm-payment` endpoint is working
2. Supabase RLS policies allow inserting subscriptions
3. Stripe webhook is configured (if using)

### Issue: Payment form doesn't match theme

**Solution:** Update the `appearance` object in `EmbeddedPaymentForm.tsx` with your brand colors

### Issue: Redirect happens instead of staying on page

**Solution:** Ensure `redirect: 'if-required'` is set in `stripe.confirmPayment()`

## Security Best Practices

1. **Never expose secret keys** - Only use publishable keys on the frontend
2. **Validate on the backend** - Always verify payments server-side
3. **Use HTTPS** - Required for Stripe in production
4. **Implement webhook handlers** - To handle async events (payment failures, etc.)
5. **Sanitize user input** - Prevent injection attacks
6. **Use Supabase RLS** - Restrict database access
7. **Log errors** - Monitor for suspicious activity

## Advanced Features

### Supporting Multiple Payment Methods

The Payment Element automatically supports:
- Credit/Debit Cards
- Apple Pay (on supported devices)
- Google Pay (on supported devices)
- Link (instant payment)
- Other regional payment methods

To configure, set up payment methods in your Stripe Dashboard.

### Handling 3D Secure Authentication

If a card requires 3D Secure authentication, Stripe will automatically handle it with a redirect. After authentication, users return to your `return_url`.

### Implementing Discounts/Coupons

To support coupons:

1. Add a coupon input field to the form
2. Pass coupon ID to `create-payment-intent` API
3. Apply coupon on backend:

```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: amount,
  currency: 'usd',
  customer: customerId,
  payment_method_types: ['card'],
  metadata: {
    priceType,
    couponId: couponId, // Add coupon
  },
});
```

### Adding Address/Billing Details

To collect billing information:

```typescript
const options = {
  fields: {
    billingDetails: {
      name: 'auto',
      email: 'auto',
      phone: 'auto',
      address: {
        line1: 'auto',
        line2: 'auto',
        city: 'auto',
        state: 'auto',
        postalCode: 'auto',
        country: 'auto',
      },
    },
  },
};

<PaymentElement options={{...options}} />
```

## Migration from Redirect-Based Checkout

If you were previously using Stripe Checkout (redirect-based):

### Before (Checkout Session)

```typescript
// Old approach - redirects user
const response = await fetch('/api/billing/create-checkout-session', {
  method: 'POST',
  body: JSON.stringify({ priceType }),
});
const { url } = await response.json();
window.location.href = url; // User leaves your site
```

### After (Embedded Payments)

```typescript
// New approach - keeps user on site
const response = await fetch('/api/billing/create-payment-intent', {
  method: 'POST',
  body: JSON.stringify({ priceType }),
});
const { clientSecret } = await response.json();

// Show embedded form in modal
setShowPaymentForm(true);
setClientSecret(clientSecret);
```

**Benefits:**
- No page reloads
- Better user experience
- Full control over UI
- Higher conversion rates

## Resources

- [Stripe Payment Intents API](https://stripe.com/docs/api/payment_intents)
- [Stripe Payment Element](https://stripe.com/docs/js/elements/payment-element)
- [Stripe React SDK](https://stripe.com/docs/stripe-js/react)
- [Customizing Appearance](https://stripe.com/docs/js/appendix/appearance)
- [Stripe Test Cards](https://stripe.com/docs/testing)

## Support

If you encounter issues:

1. Check Stripe Dashboard logs: https://dashboard.stripe.com/test/logs
2. Review browser console for errors
3. Check backend API logs
4. Verify environment variables are set correctly
5. Ensure your Stripe account is in test mode (or has valid live keys)

## Summary

The embedded payment implementation provides:

✅ **No redirects** - Users stay on your website  
✅ **Full customization** - Match your exact brand and theme  
✅ **Multiple payment methods** - Cards, Apple Pay, Google Pay, etc.  
✅ **Seamless UX** - Modal-based, intuitive flow  
✅ **Secure** - Built on Stripe's secure infrastructure  
✅ **Maintainable** - Clean, modular code structure  

This approach significantly improves conversion rates compared to redirect-based checkout by providing a frictionless payment experience.