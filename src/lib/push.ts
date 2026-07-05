import { supabaseAdmin } from '@/lib/supabase';

interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface PushSendResult {
  success: boolean;
  error?: string;
}

let fcmConfigured: boolean | null = null;

function isFcmConfigured(): boolean {
  if (fcmConfigured !== null) return fcmConfigured;
  fcmConfigured = !!(process.env.FCM_SERVER_KEY);
  if (!fcmConfigured) {
    console.warn('[Push] FCM_SERVER_KEY not configured — push notifications disabled');
  }
  return fcmConfigured;
}

async function getActiveDeviceTokens(userId: string): Promise<Array<{ token: string; platform: string }>> {
  const { data, error } = await supabaseAdmin
    .from('device_tokens')
    .select('token, platform')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    console.error('[Push] Failed to fetch device tokens:', error);
    return [];
  }

  return data || [];
}

async function sendFcmMessage(token: string, payload: PushNotificationPayload, platform: string): Promise<PushSendResult> {
  if (!isFcmConfigured()) {
    return { success: false, error: 'FCM not configured' };
  }

  const message: Record<string, unknown> = {
    to: token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
  };

  if (platform === 'ios') {
    message.content_available = true;
    message.priority = 'high';
  }

  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${process.env.FCM_SERVER_KEY}`,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `FCM error ${response.status}: ${text}` };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ success: boolean; sent: number; errors: string[] }> {
  const tokens = await getActiveDeviceTokens(userId);

  if (tokens.length === 0) {
    return { success: true, sent: 0, errors: [] };
  }

  const results = await Promise.all(
    tokens.map(({ token, platform }) => sendFcmMessage(token, payload, platform))
  );

  const sent = results.filter((r) => r.success).length;
  const errors = results.filter((r) => !r.success).map((r) => r.error!).filter(Boolean);

  return {
    success: errors.length === 0,
    sent,
    errors,
  };
}

export function isPushConfigured(): boolean {
  return isFcmConfigured();
}

export async function getPushConfigStatus(): Promise<{
  configured: boolean;
  hasServerKey: boolean;
  missingVariables: string[];
  instructions: string;
}> {
  const hasServerKey = !!process.env.FCM_SERVER_KEY;
  const missingVariables: string[] = [];
  if (!hasServerKey) missingVariables.push('FCM_SERVER_KEY');

  return {
    configured: hasServerKey,
    hasServerKey,
    missingVariables,
    instructions: missingVariables.length > 0
      ? `Add FCM_SERVER_KEY to .env.local and Vercel environment variables. Get it from Firebase Console → Project Settings → Cloud Messaging → Server Key.`
      : 'Push notification service is fully configured.',
  };
}
