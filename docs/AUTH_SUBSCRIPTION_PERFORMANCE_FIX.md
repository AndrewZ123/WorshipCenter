# Authentication & Subscription Performance Fixes

## Issues Fixed

### 1. Slow Authentication on Page Refresh
**Problem:** Every page refresh showed a "Checking authentication..." spinner before loading the dashboard, causing a noticeable delay.

**Solution:** Implemented localStorage caching for user and church profile data.
- User and church data are now cached after first load
- On refresh, data loads instantly from localStorage
- Fresh data is fetched in the background without blocking the UI
- Cache is automatically cleared on logout

### 2. Trial Banner Flashing on Refresh
**Problem:** An orange "Your trial has ended" banner briefly appeared on every page refresh, even for subscribed users, before the subscription status loaded.

**Solution:** Added loading checks to all subscription-related components.
- `TrialBanner` now waits for subscription data to load before rendering
- `TrialExpiredBanner` now waits for subscription data to load before rendering
- `useSubscription` hook's billing state now returns `false` for all status flags while loading
- This prevents banners from showing with stale/incorrect data during the loading phase

## Changes Made

### src/lib/auth.tsx
1. Modified `loadProfile()` function:
   - Added `useCache` parameter (defaults to `true`)
   - Checks localStorage for cached user/church data before making database queries
   - If cache hit, displays cached data immediately and refreshes in background
   - Saves user and church data to localStorage after successful database load

2. Modified `logout()` function:
   - Clears cached data from localStorage on logout
   - Prevents stale data from persisting after logout

### src/lib/useSubscription.ts
1. Modified `billingState` calculation:
   - All status flags (`isTrialing`, `isActive`, `isPastDue`, `isCanceled`) now check `!loading` first
   - This ensures `false` is returned during loading instead of showing incorrect status

### src/components/layout/TrialBanner.tsx
1. Modified `TrialBanner` component:
   - Added loading check: returns `null` if `loading` is true
   - Prevents banner from showing before subscription data is available

2. Modified `TrialExpiredBanner` component:
   - Added loading check: returns `null` if `loading` is true
   - Prevents orange banner flash on page refresh

## Performance Improvements

### Before
- Page refresh: ~1-2 seconds of loading spinner
- Subscription checks: Database query on every page load
- Banner flashing: Orange banner appeared briefly on every refresh

### After
- Page refresh: Near-instant (uses cached data)
- Subscription checks: Background refresh doesn't block UI
- Banner flashing: Eliminated (banners wait for data to load)

## Cache Keys Used
- `wc_user_[userId]` - Cached user profile
- `wc_church_[userId]` - Cached church profile

## Testing
To verify the fixes work correctly:
1. Log in to the application
2. Refresh the page - should load almost instantly
3. Verify the orange "trial ended" banner doesn't flash
4. Log out and verify cache is cleared
5. Log back in - should work normally

## Notes
- Cache is per-user (stored with user ID in key)
- Cache is automatically invalidated on logout
- Background refresh ensures data stays current
- No sensitive data is cached beyond what's already in localStorage from Supabase auth