import { beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  loadNotificationPreferences,
  normalizeNotificationPreferences,
  saveNotificationPreferences,
} from './notification-preferences';

const fake = createFakeSupabaseClient();
const client = fake as unknown as Pick<SupabaseClient, 'from'>;

beforeEach(() => {
  fake.reset();
});

describe('notification preferences defaults', () => {
  it('treats a missing row as email and push on', async () => {
    fake.setTableResult('user_notification_preferences', { data: null, error: null });

    await expect(loadNotificationPreferences(client, 'user-1')).resolves.toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    );
    expect(DEFAULT_NOTIFICATION_PREFERENCES).toEqual({
      email_reminders: true,
      push_enabled: true,
    });
  });

  it('loads explicit opt-outs', async () => {
    fake.setTableResult('user_notification_preferences', {
      data: { email_reminders: false, push_enabled: false },
      error: null,
    });

    await expect(loadNotificationPreferences(client, 'user-1')).resolves.toEqual({
      email_reminders: false,
      push_enabled: false,
    });
  });

  it('falls back to defaults when the preference read fails', async () => {
    fake.setTableResult('user_notification_preferences', {
      data: null,
      error: { message: 'boom' },
    });

    await expect(loadNotificationPreferences(client, 'user-1')).resolves.toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    );
  });

  it('treats only an explicit false as off', () => {
    expect(normalizeNotificationPreferences({ email_reminders: null })).toEqual({
      email_reminders: true,
      push_enabled: true,
    });
  });
});

describe('saving notification preferences', () => {
  it('upserts the signed-in user row with the changed preference', async () => {
    const result = await saveNotificationPreferences(
      client,
      'user-1',
      { email_reminders: false },
      new Date('2026-12-01T12:00:00.000Z')
    );

    expect(result).toEqual({ ok: true });

    const upsert = fake
      .operationsFor('user_notification_preferences')
      .find((operation) => operation.method === 'upsert');
    expect(upsert?.args[0]).toEqual({
      user_id: 'user-1',
      email_reminders: false,
      updated_at: '2026-12-01T12:00:00.000Z',
    });
    expect(upsert?.args[1]).toEqual({ onConflict: 'user_id' });
  });

  it('reports a failed save without throwing', async () => {
    fake.setTableResult('user_notification_preferences', {
      data: null,
      error: { message: 'permission denied' },
    });

    await expect(
      saveNotificationPreferences(client, 'user-1', { push_enabled: false })
    ).resolves.toEqual({ ok: false, error: 'permission denied' });
  });
});
