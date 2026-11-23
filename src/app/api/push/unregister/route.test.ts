import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { exhaustRateLimit } from '@/test/rate-limit';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import { POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

function unregisterRequest(
  body: Record<string, unknown>,
  token?: string
): NextRequest {
  return new NextRequest('http://localhost/api/push/unregister', {
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

describe('POST /api/push/unregister', () => {
  it('returns 401 without authentication', async () => {
    const response = await POST(unregisterRequest({ token: 'device-token-1' }));

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 400 when the token is missing', async () => {
    authenticate();

    const response = await POST(unregisterRequest({}, 'test-token'));

    expect(response.status).toBe(400);
    expect(fake.operationsFor('device_tokens')).toHaveLength(0);
  });

  it('deactivates only the caller-owned device token', async () => {
    authenticate();

    const response = await POST(
      unregisterRequest({ token: 'device-token-1' }, 'test-token')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });

    const operations = fake.operationsFor('device_tokens');
    expect(operations).toContainEqual({
      table: 'device_tokens',
      method: 'update',
      args: [
        {
          is_active: false,
          updated_at: expect.any(String),
        },
      ],
    });
    expect(operations).toContainEqual({
      table: 'device_tokens',
      method: 'eq',
      args: ['token', 'device-token-1'],
    });
    expect(operations).toContainEqual({
      table: 'device_tokens',
      method: 'eq',
      args: ['user_id', 'user-1'],
    });
  });

  it('returns 429 once the per-user write limit is exhausted', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-rate-limited', email: 'limited@example.test' } },
      error: null,
    });
    fake.setTableResult('users', {
      data: { id: 'user-rate-limited', role: 'leader', church_id: 'church-1' },
      error: null,
    });
    exhaustRateLimit('push-unregister:user-rate-limited', RateLimitTiers.API_WRITE);

    const response = await POST(
      unregisterRequest({ token: 'device-token-1' }, 'test-token')
    );

    expect(response.status).toBe(429);
    expect(fake.operationsFor('device_tokens')).toHaveLength(0);
    expect(fake.operationsFor('subscriptions')).toHaveLength(0);
  });
});
