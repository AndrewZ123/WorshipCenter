/**
 * Per-user notification preferences.
 *
 * No row means "on" for both channels, so existing users keep receiving
 * reminders and pushes until they explicitly opt out.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface UserNotificationPreferences {
  email_reminders: boolean;
  push_enabled: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  email_reminders: true,
  push_enabled: true,
};

type PreferencesClient = Pick<SupabaseClient, 'from'>;

export function normalizeNotificationPreferences(
  row: unknown
): UserNotificationPreferences {
  if (!row || typeof row !== 'object') {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  const value = row as Record<string, unknown>;
  return {
    email_reminders: value.email_reminders !== false,
    push_enabled: value.push_enabled !== false,
  };
}

export async function loadNotificationPreferences(
  client: PreferencesClient,
  userId: string
): Promise<UserNotificationPreferences> {
  if (!userId) return { ...DEFAULT_NOTIFICATION_PREFERENCES };

  try {
    const { data, error } = await client
      .from('user_notification_preferences')
      .select('email_reminders, push_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    return normalizeNotificationPreferences(data);
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

export interface SaveNotificationPreferencesResult {
  ok: boolean;
  error?: string;
}

/**
 * Upsert a partial preference patch for the signed-in user. RLS restricts the
 * row to `user_id = auth.uid()`, so the user id always comes from the session.
 */
export async function saveNotificationPreferences(
  client: PreferencesClient,
  userId: string,
  patch: Partial<UserNotificationPreferences>,
  now: Date = new Date()
): Promise<SaveNotificationPreferencesResult> {
  if (!userId) {
    return { ok: false, error: 'You need to be signed in to change notifications.' };
  }

  try {
    const { error } = await client
      .from('user_notification_preferences')
      .upsert(
        {
          user_id: userId,
          ...patch,
          updated_at: now.toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      return {
        ok: false,
        error: error.message || 'Unable to save notification preferences.',
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Unable to save notification preferences.' };
  }
}
