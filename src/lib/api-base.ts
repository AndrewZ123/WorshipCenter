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

import { supabase } from '@/lib/supabase';

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
 * Get the current Supabase access token, if there is a session.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Build headers for an authenticated API call.
 *
 * Sends JSON by default and attaches the current Supabase session's bearer
 * token. Protected API routes require `Authorization: Bearer <access_token>`;
 * callers that skip it receive a 401 even when the user is signed in.
 */
export async function getAuthHeaders(
  options: { json?: boolean } = {}
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (options.json !== false) headers['Content-Type'] = 'application/json';

  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Wait for Supabase to restore/return a session before making an
 * authenticated request. The session can still be hydrating on first mount,
 * so a single getSession() call is not reliable.
 *
 * Returns null only after all attempts are exhausted (definitely signed out).
 */
export async function waitForAccessToken(
  options: { attempts?: number; delayMs?: number } = {}
): Promise<string | null> {
  const attempts = Math.max(1, options.attempts ?? 5);
  const delayMs = Math.max(0, options.delayMs ?? 250);

  for (let attempt = 0; attempt < attempts; attempt++) {
    const token = await getAccessToken();
    if (token) return token;
    if (attempt < attempts - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return null;
}

/**
 * Safely parse a fetch Response as JSON.
 * Returns {} when the body isn't JSON (proxy/HTML error pages, empty
 * responses) instead of throwing — callers can then report the HTTP status
 * honestly instead of crashing on response.json().
 */
export async function parseJsonSafe(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
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
