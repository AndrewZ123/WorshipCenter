import { apiUrl, getAuthHeaders, isCapacitorNative } from '@/lib/api-base';
import type { PushNotificationSchema } from '@capacitor/push-notifications';

type PushPlugin = typeof import('@capacitor/push-notifications')['PushNotifications'];

export type PushPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';
export type PushRegistrationResult =
  | 'registered'
  | 'permission_required'
  | 'permission_denied'
  | 'unsupported'
  | 'error';

const TOKEN_STORAGE_KEY = 'wc_push_token';
let tokenListenerAttached = false;
let notificationListenersAttached = false;

function getNativePlatform(): 'ios' | 'android' | null {
  if (typeof window === 'undefined') return null;

  const capacitor = (window as unknown as {
    Capacitor?: { getPlatform?: () => string };
  }).Capacitor;
  const platform =
    typeof capacitor?.getPlatform === 'function' ? capacitor.getPlatform() : null;
  if (platform === 'ios' || platform === 'android') return platform;

  const ua = navigator.userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return null;
}

/**
 * Push is iPhone-only for now and stays fully behind a public build flag, so a
 * web or Android bundle never prompts for permission.
 */
export function isNativePushAvailable(): boolean {
  if (process.env.NEXT_PUBLIC_PUSH_ENABLED !== 'true') return false;
  if (!isCapacitorNative()) return false;
  return getNativePlatform() === 'ios';
}

/** True when this device has a token stored from a successful registration. */
export function isPushTokenRegistered(): boolean {
  return Boolean(getStoredToken());
}

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // localStorage can be unavailable in private webviews.
  }
}

async function sendTokenToServer(token: string, platform: string): Promise<boolean> {
  try {
    const response = await fetch(apiUrl('/api/push/register'), {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ token, platform }),
    });
    if (response.ok) setStoredToken(token);
    return response.ok;
  } catch {
    return false;
  }
}

async function unregisterTokenOnServer(token: string): Promise<boolean> {
  try {
    const response = await fetch(apiUrl('/api/push/unregister'), {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ token }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function attachTokenListener(plugin: PushPlugin): Promise<void> {
  if (tokenListenerAttached) return;
  tokenListenerAttached = true;

  await plugin.addListener('registration', async (token) => {
    const platform = getNativePlatform();
    if (!platform || !token.value) return;
    await sendTokenToServer(token.value, platform);
  });

  await plugin.addListener('registrationError', () => {
    // Never log the token or raw APNs response.
    console.warn('[Push] Device registration failed');
  });
}

/**
 * Attaches notification-tap handling once per app launch. This does not request
 * permission; it only routes a tap to the in-app deep link listener.
 */
export async function initPushNotificationListeners(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isCapacitorNative()) return;
  if (notificationListenersAttached) return;

  notificationListenersAttached = true;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    await PushNotifications.addListener('pushNotificationReceived', () => {
      // Foreground presentation is handled by the native AppDelegate.
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      const data = notification.notification.data as Record<string, unknown> | undefined;
      const path = data?.url || data?.link_url;
      if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')) {
        window.dispatchEvent(new CustomEvent('mobile-deep-link', { detail: { path } }));
      }
    });
  } catch {
    notificationListenersAttached = false;
  }
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (!isNativePushAvailable()) return 'unsupported';

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const status = await PushNotifications.checkPermissions();
    if (status.receive === 'granted') return 'granted';
    if (status.receive === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'unsupported';
  }
}

/**
 * Registers for APNs. Permission is only requested when `requestPermission` is
 * true, which callers should do from an explicit user action (the settings
 * toggle). Login calls this with the default to silently refresh an already
 * granted token — never as a cold-launch prompt.
 */
export async function registerPushNotifications(
  options: { requestPermission?: boolean } = {}
): Promise<PushRegistrationResult> {
  if (!isNativePushAvailable()) return 'unsupported';
  if (typeof window === 'undefined') return 'unsupported';

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    let permission = await PushNotifications.checkPermissions();

    if (permission.receive !== 'granted') {
      if (!options.requestPermission) {
        return permission.receive === 'denied'
          ? 'permission_denied'
          : 'permission_required';
      }

      permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') {
        return permission.receive === 'denied'
          ? 'permission_denied'
          : 'permission_required';
      }
    }

    await attachTokenListener(PushNotifications);
    await PushNotifications.register();
    return 'registered';
  } catch {
    return 'error';
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  if (!isCapacitorNative()) return;

  const token = getStoredToken();

  try {
    // Tell the API while the session is still valid (before signOut).
    if (token) {
      await unregisterTokenOnServer(token);
    }

    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.unregister();
  } catch {
    // Best-effort cleanup.
  } finally {
    setStoredToken(null);
  }
}

export async function getDeliveredPushNotifications(): Promise<PushNotificationSchema[]> {
  if (!isCapacitorNative()) return [];

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const result = await PushNotifications.getDeliveredNotifications();
    return result.notifications;
  } catch {
    return [];
  }
}

export async function removeAllDeliveredPushNotifications(): Promise<void> {
  if (!isCapacitorNative()) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.removeAllDeliveredNotifications();
  } catch {
    // ignore
  }
}
