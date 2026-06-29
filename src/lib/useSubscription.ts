/**
 * useSubscription Hook
 *
 * Fetches and manages the subscription state for the current user's church.
 * Uses Supabase directly — no store dependency.
 *
 * Usage:
 *   const { subscription, isActive, isTrialing, loading, error, refresh } = useSubscription();
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Subscription } from '@/lib/types';

interface UseSubscriptionReturn {
  subscription: Subscription | null;
  isActive: boolean;
  isTrialing: boolean;
  isCanceled: boolean;
  isPastDue: boolean;
  isFreeTrial: boolean;
  daysRemaining: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      // Get church_id
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('church_id')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profile?.church_id) {
        setError('Church not found');
        setLoading(false);
        return;
      }

      // Get subscription.
      // IMPORTANT: use maybeSingle(), NOT single(). A church may legitimately
      // have NO subscription row yet (e.g. brand-new account that hasn't gone
      // through Stripe checkout). `.single()` throws PostgREST error PGRST116
      // (HTTP 406) when 0 rows match, which surfaced as "Unable to load
      // subscription" on the billing page and broke the upgrade flow.
      // `.maybeSingle()` returns `null` for 0 rows, which we treat as a valid
      // "no subscription yet" state rather than an error.
      const { data: sub, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('church_id', profile.church_id)
        .maybeSingle();

      if (subError) {
        // A real database / RLS error — surface it to the UI.
        setError(subError.message || 'Failed to load subscription');
        setLoading(false);
        return;
      }

      // `null` is a valid "no subscription yet" state — do NOT set an error.
      setSubscription((sub as Subscription) ?? null);
    } catch (err: any) {
      console.error('[useSubscription] Error:', err);
      setError(err.message || 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isActive = subscription?.status === 'active';
  const isTrialing = subscription?.status === 'trialing';
  const isCanceled = subscription?.status === 'canceled';
  const isPastDue = subscription?.status === 'past_due';
  const isFreeTrial = isTrialing || !isActive;

  // Calculate days remaining in trial
  const daysRemaining = (() => {
    if (!subscription?.trial_end) return 0;
    const trialEnd = new Date(subscription.trial_end);
    const now = new Date();
    const diff = trialEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  return {
    subscription,
    isActive,
    isTrialing,
    isCanceled,
    isPastDue,
    isFreeTrial,
    daysRemaining,
    loading,
    error,
    refresh,
  };
}