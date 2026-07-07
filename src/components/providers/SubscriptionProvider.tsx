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
const CACHE_KEY = 'wc_subscription_cache';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

function readCachedSubscription(): { subscription: Subscription | null; fetchedAt: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCachedSubscription(subscription: Subscription | null): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ subscription, fetchedAt: Date.now() }));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(() => {
    // Initialise from cache on mount so offline users have immediate access
    const cached = readCachedSubscription();
    if (cached && Date.now() - cached.fetchedAt < CACHE_MAX_AGE_MS) {
      return cached.subscription;
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);

  // Keep ref in sync so fetchSubscription can read current state without
  // being recreated (which would retrigger the mount effect).
  useEffect(() => {
    subscriptionRef.current = subscription;
  }, [subscription]);

  const fetchSubscription = useCallback(async () => {
    // Deduplicate: if a fetch is already in-flight, piggyback on it
    if (inFlightRef.current) return inFlightRef.current;

    // Throttle: don't refetch more than once per STALE_MS window.
    const now = Date.now();
    if (lastFetchRef.current && now - lastFetchRef.current < STALE_MS && subscriptionRef.current !== null) {
      return;
    }

    const promise = (async () => {
      setLoading(true);
      setError(null);

      // Try Supabase fetch
      if (isOnline()) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) {
            setError('Not authenticated');
            setLoading(false);
            inFlightRef.current = null;
            return;
          }

          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('church_id')
            .eq('id', session.user.id)
            .single();

          if (profileError || !profile?.church_id) {
            setError('Church not found');
            setLoading(false);
            inFlightRef.current = null;
            return;
          }

          const { data: sub, error: subError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('church_id', profile.church_id)
            .maybeSingle();

          if (subError) {
            setError(subError.message || 'Failed to load subscription');
            setLoading(false);
            inFlightRef.current = null;
            return;
          }

          const subVal = (sub as Subscription) ?? null;
          setSubscription(prev => {
            try {
              return JSON.stringify(prev) === JSON.stringify(subVal) ? prev : subVal;
            } catch {
              return subVal;
            }
          });
          writeCachedSubscription(subVal);
          lastFetchRef.current = Date.now();
          setLoading(false);
          inFlightRef.current = null;
          return;
        } catch (err: any) {
          console.error('[SubscriptionProvider] Network error:', err);
        }
      }

      // Offline or fetch failed — fall back to cache
      const cached = readCachedSubscription();
      if (cached && Date.now() - cached.fetchedAt < CACHE_MAX_AGE_MS) {
        setSubscription(cached.subscription);
        setError(null);
      } else {
        setError(isOnline() ? 'Failed to load subscription' : 'No internet — subscription status unavailable');
      }
      setLoading(false);
      inFlightRef.current = null;
    })();

    inFlightRef.current = promise;
    return promise;
  }, []);

  // Fetch once on mount (stable callback → runs exactly once)
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const isActive = subscription?.status === 'active';
  const isTrialing = subscription?.status === 'trialing';
  const isCanceled = subscription?.status === 'canceled';
  const isPastDue = subscription?.status === 'past_due';
  const isFreeTrial = isTrialing;

  const daysRemaining = (() => {
    // For trialing subscriptions, show remaining trial days from trial_end.
    // For active/past_due/canceled subscriptions, show remaining billing
    // period days from current_period_end.
    const isSubscriptionActive = isActive || isPastDue || isCanceled;
    const dateField = isSubscriptionActive
      ? subscription?.current_period_end
      : subscription?.trial_end;

    if (!dateField) return 0;
    const end = new Date(dateField);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
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