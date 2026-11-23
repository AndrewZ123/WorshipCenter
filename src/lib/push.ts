/**
 * Push notification sender.
 *
 * iOS delivery goes directly to APNs (see `src/lib/apns.ts`). Push is entirely
 * gated by `PUSH_ENABLED=true` plus complete APNs credentials; otherwise every
 * send is a no-op. Web and Android have no push transport here.
 */

import { supabaseAdmin } from '@/lib/supabase';
import {
  getApnsConfig,
  getMissingPushConfig,
  isPushEnabled,
  sendApnsNotification,
} from '@/lib/apns';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
}

export interface PushSendResult {
  success: boolean;
  sent: number;
  errors: string[];
  /** Present when the send was intentionally skipped. */
  skipped?: 'not_configured';
}

interface DeviceTokenRow {
  id: string;
  token: string;
}

async function getActiveIosDeviceTokens(userId: string): Promise<DeviceTokenRow[]> {
  const { data, error } = await supabaseAdmin
    .from('device_tokens')
    .select('id, token')
    .eq('user_id', userId)
    .eq('platform', 'ios')
    .eq('is_active', true);

  if (error) {
    return [];
  }

  return (data || []) as DeviceTokenRow[];
}

async function deactivateToken(id: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('device_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch {
    // Token cleanup is best-effort; never surface this to the request path.
  }
}

/**
 * Sends a push to every active iOS device token for a user.
 *
 * This function never throws. Delivery failures are captured in the result so
 * callers can fire-and-forget after a successful database write.
 */
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload,
  options: { data?: Record<string, string> } = {}
): Promise<PushSendResult> {
  try {
    if (!isPushEnabled() || !getApnsConfig()) {
      return { success: true, sent: 0, errors: [], skipped: 'not_configured' };
    }

    // No row means push is on. A failed lookup keeps the previous behavior
    // (best-effort delivery) rather than blocking every notification.
    const { data: preferences } = await supabaseAdmin
      .from('user_notification_preferences')
      .select('push_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (preferences && (preferences as { push_enabled?: boolean }).push_enabled === false) {
      return { success: true, sent: 0, errors: [] };
    }

    const tokens = await getActiveIosDeviceTokens(userId);
    if (tokens.length === 0) {
      return { success: true, sent: 0, errors: [] };
    }

    const data = { ...(payload.data || {}), ...(options.data || {}) };
    const deepLink = data.url || data.link_url;

    const results = await Promise.all(
      tokens.map(async (row) => {
        const result = await sendApnsNotification(row.token, {
          title: payload.title,
          body: payload.body,
          badge: payload.badge,
          url: deepLink,
        });

        if (result.invalidToken) {
          await deactivateToken(row.id);
        }

        return result;
      })
    );

    const sent = results.filter((result) => result.ok).length;
    const errors = results
      .filter((result) => !result.ok)
      .map((result) => result.reason || result.error || 'apns_send_failed');

    return { success: errors.length === 0, sent, errors };
  } catch {
    // Never let a push failure break the caller's request.
    return { success: false, sent: 0, errors: ['push_send_failed'] };
  }
}

export function isPushConfigured(): boolean {
  return isPushEnabled() && getApnsConfig() !== null;
}

export async function getPushConfigStatus(): Promise<{
  configured: boolean;
  enabled: boolean;
  missingVariables: string[];
  instructions: string;
}> {
  const enabled = isPushEnabled();
  const missingVariables = getMissingPushConfig();
  const configured = missingVariables.length === 0;

  return {
    configured,
    enabled,
    missingVariables,
    instructions: configured
      ? 'APNs push is configured.'
      : 'Set PUSH_ENABLED=true and all APNs variables (APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_PRIVATE_KEY, APNS_PRODUCTION). Push is a no-op until then. See docs/push-notifications.md.',
  };
}
