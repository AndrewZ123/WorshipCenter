'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Tiny in-app signal so every mounted swap view refetches after a swap action.
 * The API remains the source of truth; this only avoids showing stale status
 * badges until the next full page reload.
 */
const listeners = new Set<() => void>();

export function notifySwapsChanged(): void {
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch (error) {
      console.error('[Swaps] Refresh listener failed:', error);
    }
  }
}

export function useSwapChanges(onChange: () => void): void {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const listener = () => onChangeRef.current();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}

/**
 * Live swap updates for a church: a Realtime subscription plus a refetch when
 * the tab regains focus or becomes visible again. Every channel and listener
 * is removed on unmount.
 */
export function useSwapRealtime(
  churchId: string | null | undefined,
  onChange: () => void,
): void {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!churchId) return;

    let active = true;
    const refresh = () => {
      if (active) onChangeRef.current();
    };

    const channel = supabase
      .channel(
        `swap-requests:${churchId}:${Math.random().toString(36).slice(2)}`
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assignment_swap_requests',
          filter: `church_id=eq.${churchId}`,
        },
        refresh
      )
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [churchId]);
}
