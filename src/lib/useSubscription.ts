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
      // Try to load from cache first
      const cacheKey = `wc_subscription_${user.church_id}`;
      try {
        const cachedSubscription = localStorage.getItem(cacheKey);
        if (cachedSubscription) {
          const parsed = JSON.parse(cachedSubscription);
          console.log('[Subscription] Loading from cache:', parsed);
          setSubscription(parsed);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[Subscription] Failed to load from cache:', err);
      }

      // Fetch fresh data in background
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('church_id', user.church_id)
        .maybeSingle(); // Use maybeSingle() to handle no results gracefully

      if (error) throw error;
      
      console.log('[Subscription] Fetched from database:', data);
      console.log('[Subscription] Status:', data?.status);
      console.log('[Subscription] Trial end:', data?.trial_end);
      
      setSubscription(data);
      
      // Cache the subscription data
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (err) {
        console.warn('[Subscription] Failed to cache:', err);
      }
    } catch (error) {
      console.error('[Subscription] Error:', error);
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