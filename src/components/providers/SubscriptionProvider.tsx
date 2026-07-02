'use client';

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Subscription } from '@/lib/types';

export interface UseSubscriptionReturn {
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

const SubscriptionContext = createContext<UseSubscriptionReturn | null>(null);

const STALE_MS = 5 * 60 * 1000; // refetch at most every 5 minutes

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const fetchSubscription = useCallback(async () => {
    // Deduplicate: if a fetch is already in-flight, piggyback on it
    if (inFlightRef.current) return inFlightRef.current;

    // Throttle: don't refetch more than once per STALE_MS window
    const now = Date.now();
    if (lastFetchRef.current && now - lastFetchRef.current < STALE_MS && subscription !== null) {
      return;
    }

    const promise = (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setError('Not authenticated');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('church_id')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile?.church_id) {
          setError('Church not found');
          return;
        }

        const { data: sub, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('church_id', profile.church_id)
          .maybeSingle();

        if (subError) {
          setError(subError.message || 'Failed to load subscription');
          return;
        }

        setSubscription((sub as Subscription) ?? null);
        lastFetchRef.current = Date.now();
      } catch (err: any) {
        console.error('[SubscriptionProvider] Error:', err);
        setError(err.message || 'Failed to load subscription');
      } finally {
        setLoading(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = promise;
    return promise;
  }, [subscription]);

  // Fetch once on mount
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const isActive = subscription?.status === 'active';
  const isTrialing = subscription?.status === 'trialing';
  const isCanceled = subscription?.status === 'canceled';
  const isPastDue = subscription?.status === 'past_due';
  const isFreeTrial = isTrialing || !isActive;

  const daysRemaining = (() => {
    if (!subscription?.trial_end) return 0;
    const trialEnd = new Date(subscription.trial_end);
    const now = new Date();
    const diff = trialEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  const value: UseSubscriptionReturn = {
    subscription,
    isActive,
    isTrialing,
    isCanceled,
    isPastDue,
    isFreeTrial,
    daysRemaining,
    loading,
    error,
    refresh: fetchSubscription,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscriptionContext must be used within SubscriptionProvider');
  }
  return ctx;
}