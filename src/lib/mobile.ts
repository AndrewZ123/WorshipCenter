/**
 * Mobile bootstrap — runs only inside Capacitor native shells.
 *
 * Handles:
 *  - Status bar styling
 *  - Splash screen hide
 *  - Android hardware back button
 *  - Deep-link / universal-link routing
 *
 * Web builds short-circuit at the Capacitor check, so this is a no-op there.
 */

import { isCapacitorNative } from '@/lib/api-base';

let initialized = false;

export async function initMobile(): Promise<void> {
  if (initialized) return;
  if (!isCapacitorNative()) return;
  if (typeof window === 'undefined') return;

  initialized = true;

  // Dynamic imports so web bundles don't pull in native code
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  const { SplashScreen } = await import('@capacitor/splash-screen');
  const { App: CapacitorApp } = await import('@capacitor/app');

  // ── Keyboard ──────────────────────────────────────────────
  try {
    const { Keyboard } = await import('@capacitor/keyboard');

    Keyboard.addListener('keyboardWillShow', (info) => {
      document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
      document.body.classList.add('keyboard-visible');
    });

    Keyboard.addListener('keyboardWillHide', () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      document.body.classList.remove('keyboard-visible');
    });


  } catch {
    /* keyboard plugin not available — ignore */
  }

  // ── Status bar ────────────────────────────────────────────
  try {
    await StatusBar.setStyle({ style: Style.Dark }); // light icons on purple
    // Android: overlay WebView under the status bar so env(safe-area-inset-top) works
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {
    /* iOS-only calls may reject on Android — ignore */
  }

  // ── Splash screen ─────────────────────────────────────────
  try {
    // Give React a tick to mount, then fade out
    setTimeout(() => SplashScreen.hide({ fadeOutDuration: 300 }), 500);
  } catch {
    /* ignore */
  }

  // ── Back button (Android) ─────────────────────────────────
  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      CapacitorApp.exitApp();
    }
  });

  // ── Push notifications ────────────────────────────────────
  try {
    const { registerPushNotifications } = await import('@/lib/capacitor-push');
    await registerPushNotifications();
  } catch {
    /* push plugin not available — ignore */
  }

  // ── Deep links / Universal links ──────────────────────────
  CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    if (!url) return;
    try {
      const parsed = new URL(url);
      // worshipcenter://path  →  /path
      // https://worshipcenter.app/path  →  /path
      const path = parsed.pathname + parsed.search + parsed.hash;
      if (path && path !== '/') {
        // Use Next.js router if available via custom event
        window.dispatchEvent(
          new CustomEvent('mobile-deep-link', { detail: { path } })
        );
      }
    } catch {
      /* malformed url — ignore */
    }
  });

  // ── App state (pause/resume) ──────────────────────────────
  CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      window.dispatchEvent(new CustomEvent('mobile-resume'));
    }
  });

  // ── Clear WKWebView JS caches only — preserve offline data cache ──
  try {
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          // Preserve IndexedDB-backed offline data
          // Only delete JS/RSC caches from next-pwa, not custom app caches
          if (name.includes('worshipcenter') || name.includes('offline') || name.includes('idb')) return;
          caches.delete(name);
        });
      });
    }
  } catch {
    // Cache API may not be available
  }
}