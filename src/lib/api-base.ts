/**
 * API base URL resolver for web + Capacitor (iOS/Android).
 *
 * On web: returns '' (empty string) so fetch('/api/...') uses a relative path
 *         and hits the same Next.js server that served the page.
 * On mobile (Capacitor native): returns the deployed web app's origin so
 *         fetch calls reach the Next.js API routes running on Vercel/etc.
 *         The WebView origin is capacitor://localhost or https://localhost,
 *         which has no server, so all API calls must be absolute.
 */

export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  // Capacitor injects this global when running in a native shell
  return (
    typeof (window as any).Capacitor !== 'undefined' &&
    typeof (window as any).Capacitor.isNativePlatform === 'function' &&
    (window as any).Capacitor.isNativePlatform()
  );
}

export function isCapacitorWeb(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    typeof (window as any).Capacitor !== 'undefined' &&
    !isCapacitorNative()
  );
}

/**
 * Returns the API base URL.
 * - Web: '' (relative)
 * - Mobile: the deployed app URL from NEXT_PUBLIC_APP_URL
 */
export function getApiBase(): string {
  if (isCapacitorNative()) {
    // Must be an absolute URL to the hosted Next.js backend
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    // Strip trailing slash
    return appUrl.replace(/\/$/, '');
  }
  // On web, relative URLs work — return empty string
  return '';
}

/**
 * Builds an API URL that works on both web and mobile.
 * Usage: fetch(apiUrl('/api/billing/status'))
 */
export function apiUrl(path: string): string {
  const base = getApiBase();
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path; // already absolute
  }
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

/**
 * Alias for getApiBase — returns the base URL for API calls.
 * Kept for backward compatibility with code that uses apiBaseUrl().
 */
export function apiBaseUrl(): string {
  return getApiBase();
}

/**
 * Returns a redirect URL for auth flows (password reset, email confirm).
 *
 * On web: returns the full URL on the current origin.
 * On mobile: returns a deep link using the app's custom scheme so the
 *            redirect opens the native app instead of a browser tab.
 *
 * @param path - app path, e.g. '/new-password'
 */
export function getRedirectUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (isCapacitorNative()) {
    // Use the app scheme registered in capacitor.config.json
    // Default: worshipcenter://
    const scheme =
      process.env.NEXT_PUBLIC_APP_SCHEME || 'worshipcenter';
    return `${scheme}://${normalizedPath}`;
  }

  // Web: full URL on current origin
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  return `${appUrl}${normalizedPath}`;
}
