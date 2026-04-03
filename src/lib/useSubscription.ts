'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Subscription, BillingState } from '@/lib/types';

export function useSubscription() {
  const { user, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    // Don't fetch subscription until auth is complete and user is loaded
    if (authLoading || !user) {
      setLoading(true);
      return;
    }

    try {
      // Try to load from cache first (5-minute TTL)
      const cacheKey = `wc_subscription_${user.church_id}`;
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
      try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          const cacheAge = Date.now() - (cached._cachedAt || 0);
          if (cacheAge < CACHE_TTL) {
            setSubscription(cached.data || cached);
            setLoading(false);
          }
          // If cache is stale, we still fetch fresh data below
        }
      } catch (err) {
        // Silent cache load failure
      }

      // Fetch fresh data in background
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('church_id', user.church_id)
        .maybeSingle(); // Use maybeSingle() to handle no results gracefully

      if (error) throw error;
      
      setSubscription(data);
      
      // Cache the subscription data with timestamp
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          data,
          _cachedAt: Date.now(),
        }));
      } catch (err) {
        // Silent cache save failure
      }
    } catch (error) {
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Calculate trial end date and check if currently in trial
  const trialEndDate = subscription?.trial_end ? new Date(subscription.trial_end) : null;
  const isCurrentlyInTrial = Boolean(trialEndDate && trialEndDate > new Date());
  
  const billingState: BillingState = {
    isTrialing: !loading && subscription?.status === 'trialing' && isCurrentlyInTrial,
    daysRemaining: trialEndDate
      ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0,
    isActive: !loading && subscription?.status === 'active',
    isPastDue: !loading && subscription?.status === 'past_due',
    isCanceled: !loading && subscription?.status === 'canceled',
    subscription,
  };

  const hasAccess = billingState.isTrialing || billingState.isActive;

  return {
    subscription,
    billingState,
    hasAccess,
    loading,
    refetch: fetchSubscription,
  };
}