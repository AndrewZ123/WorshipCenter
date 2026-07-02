'use client';

import { useEffect } from 'react';
import { initMobile } from '@/lib/mobile';

/**
 * Client component that initializes mobile-specific behavior.
 * No-op on web — initMobile() exits early when not in a Capacitor native shell.
 */
export function MobileBootstrap() {
  useEffect(() => {
    initMobile();
  }, []);

  return null;
}