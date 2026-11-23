import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

function registerRequest(
  body: Record<string, unknown>,
  token?: string
): NextRequest {
  return new NextRequest('http://localhost/api/push/register', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function authenticate() {
  fake.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user-1@example.test' } },
    error: null,
  });
  fake.setTableResult('users', {
    data: { id: 'user-1', role: 'leader', church_id: 'church-1' },
    error: null,
  });
  fake.setTableResult('subscriptions', {
    data: { status: 'active', trial_end: null, current_period_end: null },
    error: null,
  });
}

beforeEach(() => {
  fake.reset();
});

describe('POST /api/push/register', () => {
  it('returns 401 without authentication', async () => {
    const response = await POST(
      registerRequest({ token: 'device-token-1', platform: 'ios' })
    );

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid platform after authentication', async () => {
    authenticate();

    const response = await POST(
      registerRequest({ token: 'device-token-1', platform: 'web' }, 'test-token')
    );

    expect(response.status).toBe(400);
    expect(
      fake
        .operationsFor('device_tokens')
        .some((op) => ['insert', 'update'].includes(op.method))
    ).toBe(false);
  });

  it('registers a device token for the caller', async () => {
    authenticate();

    const response = await POST(
      registerRequest({ token: 'device-token-1', platform: 'ios' }, 'test-token')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(fake.operationsFor('device_tokens')).toContainEqual({
      table: 'device_tokens',
      method: 'insert',
      args: [
        {
          user_id: 'user-1',
          token: 'device-token-1',
          platform: 'ios',
          is_active: true,
        },
      ],
    });
  });
});
