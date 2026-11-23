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

const churchId = '00000000-0000-4000-8000-000000000040';
const otherChurchId = '00000000-0000-4000-8000-000000000041';
const serviceId = '00000000-0000-4000-8000-000000000042';

const validBody = {
  serviceId,
  role: 'vocals',
  churchId,
  name: 'Test Member',
  email: 'member@example.test',
  phone: '555-0100',
};

function signupRequest(
  body: Record<string, unknown>,
  token?: string
): NextRequest {
  return new NextRequest('http://localhost/api/signup/request', {
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
    data: {
      id: 'user-1',
      role: 'leader',
      church_id: churchId,
      email: 'user-1@example.test',
    },
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

describe('POST /api/signup/request', () => {
  it('returns 401 without authentication', async () => {
    const response = await POST(signupRequest(validBody));

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid body after authentication', async () => {
    authenticate();

    const response = await POST(
      signupRequest({ ...validBody, serviceId: 'not-a-uuid' }, 'test-token')
    );

    expect(response.status).toBe(400);
    expect(fake.operationsFor('signup_requests')).toHaveLength(0);
  });

  it('returns 403 when posting another church id', async () => {
    authenticate();

    const response = await POST(
      signupRequest({ ...validBody, churchId: otherChurchId }, 'test-token')
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(
      fake
        .operationsFor('signup_requests')
        .some((op) => op.method === 'insert')
    ).toBe(false);
  });
});
