'use client';

import { useEffect } from 'react';
import { initMobile } from '@/lib/mobile';
import { isCapacitorNative } from '@/lib/api-base';

export function MobileBootstrap() {
  useEffect(() => {
    initMobile();
  }, []);

  useEffect(() => {
    if (!isCapacitorNative()) return;

    // Intercept RSC navigation fetches to prevent Next.js from falling back
    // to browser navigation on static export (Capacitor), where there's no
    // server to serve RSC payloads for dynamic routes.
    //
    // We intercept GET requests to dynamic route patterns that would otherwise
    // fail (no pre-rendered RSC payload) and return 204 to keep the router in
    // SPA mode, so the page component renders and loads data from Supabase.
    const DYNAMIC_ROUTE_PREFIXES = ['/services/', '/songs/', '/team/', '/templates/'];

    const originalFetch = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const req = init || {};
      const url: string =
        typeof input === 'string'
          ? input
          : 'url' in input
            ? (input as Request).url
            : String(input);

      // Only intercept GET requests to the local Capacitor origin
      if ((req.method || 'GET').toUpperCase() !== 'GET') {
        return originalFetch(input, init);
      }

      try {
        const parsed = new URL(url);

        // Only intercept requests to the app's own origin
        const isLocalOrigin =
          parsed.protocol === 'capacitor:' ||
          parsed.hostname === 'localhost' ||
          parsed.hostname === 'worshipcenter.app';

        if (!isLocalOrigin) {
          return originalFetch(input, init);
        }

        const path = parsed.pathname;

        // Skip static files (have file extensions) and pre-rendered fallback paths
        if (path.includes('.')) {
          return originalFetch(input, init);
        }
        if (path.includes('__fallback__') || path.includes('_next')) {
          return originalFetch(input, init);
        }

        // Skip list pages (2 path segments: /services/, /songs/)
        const segments = path.split('/').filter(Boolean);
        if (segments.length <= 2) {
          return originalFetch(input, init);
        }

        // Check if this is a dynamic route request
        const isDynamic =
          DYNAMIC_ROUTE_PREFIXES.some((p) => path.startsWith(p));

        if (isDynamic) {
          return Promise.resolve(new Response(null, { status: 204 }));
        }
      } catch {
        // URL parsing failed — let the fetch go through
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
