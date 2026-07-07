'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { offlineCache } from './cache';
import { syncManager } from './sync';

interface OfflineState {
  isOnline: boolean;
  wasOffline: boolean;
  queueSize: number;
  cacheSize: number;
  lastSyncAt: number | null;
  isSyncing: boolean;
}

interface OfflineContextValue extends OfflineState {
  refreshQueueSize: () => Promise<void>;
  refreshCacheSize: () => Promise<void>;
  triggerSync: () => Promise<void>;
  clearAllCaches: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    return {
      isOnline: true,
      wasOffline: false,
      queueSize: 0,
      cacheSize: 0,
      lastSyncAt: null,
      isSyncing: false,
      refreshQueueSize: async () => {},
      refreshCacheSize: async () => {},
      triggerSync: async () => {},
      clearAllCaches: async () => {},
    };
  }
  return ctx;
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    queueSize: 0,
    cacheSize: 0,
    lastSyncAt: null,
    isSyncing: false,
  });

  const syncInProgress = useRef(false);

  const refreshQueueSize = useCallback(async () => {
    const size = await syncManager.getQueueSize();
    setState(prev => ({ ...prev, queueSize: size }));
  }, []);

  const refreshCacheSize = useCallback(async () => {
    const { total } = await offlineCache.getSize();
    setState(prev => ({ ...prev, cacheSize: total }));
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    setState(prev => ({ ...prev, isSyncing: true }));
    try {
      const { succeeded, failed } = await syncManager.processQueue();
      await refreshQueueSize();
      await refreshCacheSize();
      setState(prev => ({ ...prev, isSyncing: false, lastSyncAt: Date.now() }));
      if (failed > 0 && succeeded > 0) {
        // Some succeeded, some failed — partial sync
      } else if (failed > 0) {
        // All failed
      } else if (succeeded > 0) {
        // All succeeded
      }
    } catch {
      setState(prev => ({ ...prev, isSyncing: false }));
    } finally {
      syncInProgress.current = false;
    }
  }, [refreshQueueSize, refreshCacheSize]);

  const clearAllCaches = useCallback(async () => {
    await offlineCache.clear();
    await refreshCacheSize();
  }, [refreshCacheSize]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = async () => {
      setState(prev => ({ ...prev, isOnline: true, wasOffline: true }));
      const queueSize = await syncManager.getQueueSize();
      if (queueSize > 0) {
        await triggerSync();
      }
      setState(prev => ({ ...prev, wasOffline: false }));
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
    };

    const handleResume = () => {
      // Trigger sync on app resume (mobile)
      handleOnline();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('mobile-resume', handleResume);

    refreshQueueSize();
    refreshCacheSize();

    // Clear expired entries on mount
    offlineCache.clearExpired().catch(() => {});

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('mobile-resume', handleResume);
    };
  }, [triggerSync, refreshQueueSize, refreshCacheSize]);

  return (
    <OfflineContext.Provider value={{ ...state, refreshQueueSize, refreshCacheSize, triggerSync, clearAllCaches }}>
      {children}
    </OfflineContext.Provider>
  );
}
