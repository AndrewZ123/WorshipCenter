import { isCapacitorNative } from '@/lib/api-base';
import { apiUrl } from '@/lib/api-base';
import type { PushNotificationSchema } from '@capacitor/push-notifications';

let pushRegistered = false;

function getPlatform(): 'ios' | 'android' | null {
  if (typeof window === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return null;
}

async function sendTokenToServer(token: string, platform: string): Promise<boolean> {
  try {
    const response = await fetch(apiUrl('/api/push/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform }),
    });
    return response.ok;
  } catch (error) {
    console.error('[Push] Failed to register token with server:', error);
    return false;
  }
}

async function unregisterTokenOnServer(token: string): Promise<boolean> {
  try {
    const response = await fetch(apiUrl('/api/push/unregister'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function registerPushNotifications(): Promise<void> {
  if (pushRegistered) return;
  if (!isCapacitorNative()) return;
  if (typeof window === 'undefined') return;

  pushRegistered = true;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    await PushNotifications.requestPermissions();
    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
      const platform = getPlatform();
      if (!platform || !token.value) return;

      await sendTokenToServer(token.value, platform);
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Registration error:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Notification received:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      const data = notification.notification.data;
      if (data?.link_url) {
        window.dispatchEvent(
          new CustomEvent('mobile-deep-link', { detail: { path: data.link_url } })
        );
      }
    });
  } catch (error) {
    console.error('[Push] Failed to initialize push notifications:', error);
    pushRegistered = false;
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  if (!isCapacitorNative()) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    PushNotifications.addListener('registration', async (token) => {
      if (token.value) {
        await unregisterTokenOnServer(token.value);
      }
    });

    await PushNotifications.unregister();
  } catch (error) {
    console.error('[Push] Failed to unregister:', error);
  }

  pushRegistered = false;
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
