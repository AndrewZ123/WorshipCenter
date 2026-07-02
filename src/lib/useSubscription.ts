/**
 * useSubscription Hook
 *
 * Thin wrapper around SubscriptionProvider context.
 * All state is owned by SubscriptionProvider (mounted once in the (app)
 * layout), so navigating between routes no longer triggers a fresh fetch.
 */

'use client';

import { useSubscriptionContext } from '@/components/providers/SubscriptionProvider';

export type { UseSubscriptionReturn } from '@/components/providers/SubscriptionProvider';

export function useSubscription() {
  return useSubscriptionContext();
}