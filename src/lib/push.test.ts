import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { sendPushNotification } from './push';
import { sendApnsNotification } from '@/lib/apns';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/apns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/apns')>();
  return {
    ...actual,
    sendApnsNotification: vi.fn(),
  };
});

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const SEND_ENV = {
  PUSH_ENABLED: 'true',
  APNS_KEY_ID: 'KEYID12345',
  APNS_TEAM_ID: 'TEAMID1234',
  APNS_BUNDLE_ID: 'com.worshipcenter.app',
  APNS_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\ndummy\n-----END PRIVATE KEY-----',
  APNS_PRODUCTION: 'false',
};

function setPushEnv(values: Partial<Record<keyof typeof SEND_ENV, string>>) {
  for (const key of Object.keys(SEND_ENV) as Array<keyof typeof SEND_ENV>) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  fake.reset();
  setPushEnv(SEND_ENV);
  vi.mocked(sendApnsNotification).mockReset();
});

afterEach(() => {
  setPushEnv({});
});

describe('sendPushNotification', () => {
  it('is a no-op when the flag is off', async () => {
    setPushEnv({ ...SEND_ENV, PUSH_ENABLED: undefined });

    const result = await sendPushNotification('user-1', {
      title: 'New assignment',
      body: 'You are scheduled',
    });

    expect(result).toEqual({
      success: true,
      sent: 0,
      errors: [],
      skipped: 'not_configured',
    });
    expect(fake.from).not.toHaveBeenCalled();
    expect(sendApnsNotification).not.toHaveBeenCalled();
  });

  it('is a no-op when APNs config is incomplete', async () => {
    setPushEnv({ ...SEND_ENV, APNS_TEAM_ID: undefined });

    const result = await sendPushNotification('user-1', {
      title: 'New assignment',
      body: 'You are scheduled',
    });

    expect(result.skipped).toBe('not_configured');
    expect(fake.from).not.toHaveBeenCalled();
    expect(sendApnsNotification).not.toHaveBeenCalled();
  });

  it('sends to every active iOS token for the user', async () => {
    fake.setTableResult('device_tokens', {
      data: [
        { id: 'token-1', token: 'apns-token-1' },
        { id: 'token-2', token: 'apns-token-2' },
      ],
      error: null,
    });
    vi.mocked(sendApnsNotification).mockResolvedValue({
      ok: true,
      status: 200,
      invalidToken: false,
    });

    const result = await sendPushNotification('user-1', {
      title: 'New assignment',
      body: 'You are scheduled',
      data: { url: '/services/service-1' },
    });

    expect(result).toEqual({ success: true, sent: 2, errors: [] });
    expect(sendApnsNotification).toHaveBeenCalledTimes(2);
    expect(sendApnsNotification).toHaveBeenCalledWith(
      'apns-token-1',
      expect.objectContaining({
        title: 'New assignment',
        body: 'You are scheduled',
        url: '/services/service-1',
      })
    );

    const operations = fake.operationsFor('device_tokens');
    expect(operations).toContainEqual({
      table: 'device_tokens',
      method: 'eq',
      args: ['platform', 'ios'],
    });
    expect(operations).toContainEqual({
      table: 'device_tokens',
      method: 'eq',
      args: ['is_active', true],
    });
  });

  it('deactivates a token when APNs returns 410/Unregistered', async () => {
    fake.setTableResult('device_tokens', {
      data: [{ id: 'token-row-1', token: 'stale-token' }],
      error: null,
    });
    vi.mocked(sendApnsNotification).mockResolvedValue({
      ok: false,
      status: 410,
      reason: 'Unregistered',
      invalidToken: true,
    });

    const result = await sendPushNotification('user-1', {
      title: 'Schedule change',
      body: 'Service moved',
    });

    expect(result.sent).toBe(0);
    expect(result.errors).toContain('Unregistered');

    const operations = fake.operationsFor('device_tokens');
    expect(operations).toContainEqual({
      table: 'device_tokens',
      method: 'update',
      args: [{ is_active: false, updated_at: expect.any(String) }],
    });
    expect(operations).toContainEqual({
      table: 'device_tokens',
      method: 'eq',
      args: ['id', 'token-row-1'],
    });
  });

  it('captures delivery failure without throwing', async () => {
    fake.setTableResult('device_tokens', {
      data: [{ id: 'token-row-1', token: 'apns-token' }],
      error: null,
    });
    vi.mocked(sendApnsNotification).mockRejectedValue(new Error('socket hang up'));

    const result = await sendPushNotification('user-1', {
      title: 'Schedule change',
      body: 'Service moved',
    });

    expect(result).toEqual({
      success: false,
      sent: 0,
      errors: ['push_send_failed'],
    });
  });
});
