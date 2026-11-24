'use client';

import { useEffect, useRef } from 'react';

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
