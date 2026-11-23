import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const fetchMock = vi.fn();

function welcomeRequest(body: Record<string, unknown>, token?: string): NextRequest {
  return new NextRequest('http://localhost/api/notifications/send-welcome', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  fake.reset();
  // Protected routes now require an active subscription after auth.
  fake.setTableResult('subscriptions', {
    data: { status: 'active', trial_end: null, current_period_end: null },
    error: null,
  });
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/notifications/send-welcome', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const response = await POST(
      welcomeRequest({ userId: 'user-1', churchId: 'church-1' })
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid body without sending email', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user-1@example.test' } },
      error: null,
    });
    fake.setTableResult('users', {
      data: {
        id: 'user-1',
        name: 'Test User',
        email: 'user-1@example.test',
        role: 'admin',
        church_id: 'church-1',
      },
      error: null,
    });

    const response = await POST(welcomeRequest({}, 'test-token'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 403 when posting a different userId', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user-1@example.test' } },
      error: null,
    });
    fake.setTableResult('users', {
      data: {
        id: 'user-1',
        name: 'Test User',
        email: 'user-1@example.test',
        role: 'admin',
        church_id: 'church-1',
      },
      error: null,
    });

    const response = await POST(
      welcomeRequest({ userId: 'user-2', churchId: 'church-1' }, 'test-token')
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 403 when posting to a different church', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user-1@example.test' } },
      error: null,
    });
    fake.setTableResult('users', {
      data: {
        id: 'user-1',
        name: 'Test User',
        email: 'user-1@example.test',
        role: 'admin',
        church_id: 'church-1',
      },
      error: null,
    });

    const response = await POST(
      welcomeRequest({ userId: 'user-1', churchId: 'church-2' }, 'test-token')
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the welcome email when userId and church match the caller', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user-1@example.test' } },
      error: null,
    });
    fake.setTableResult('users', {
      data: {
        id: 'user-1',
        name: 'Test User',
        email: 'user-1@example.test',
        role: 'admin',
        church_id: 'church-1',
      },
      error: null,
    });
    fake.setTableResult('churches', {
      data: { id: 'church-1', name: 'Test Church' },
      error: null,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });

    const response = await POST(
      welcomeRequest({ userId: 'user-1', churchId: 'church-1' }, 'test-token')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const sent = JSON.parse(String(init.body)) as { to: string[] };
    expect(sent.to).toEqual(['user-1@example.test']);
  });
});
