import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { GET } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const fetchMock = vi.fn();

function giphyRequest(token?: string): NextRequest {
  return new NextRequest('http://localhost/api/chat/giphy?q=celebration', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(() => {
  fake.reset();
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

describe('GET /api/chat/giphy', () => {
  it('returns 401 without an Authorization header', async () => {
    const response = await GET(giphyRequest());

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid token', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid JWT' },
    });

    const response = await GET(giphyRequest('not-a-real-token'));

    expect(response.status).toBe(401);
    expect(fake.auth.getUser).toHaveBeenCalledWith('not-a-real-token');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves an authenticated caller with an active subscription', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user-1@example.test' } },
      error: null,
    });
    fake.setTableResult('users', {
      data: {
        id: 'user-1',
        email: 'user-1@example.test',
        role: 'admin',
        church_id: 'church-1',
      },
      error: null,
    });

    // No GIPHY key is configured in the test env, so the route short-circuits
    // before any upstream request.
    const response = await GET(giphyRequest('test-token'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ results: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid offset after authentication', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user-1@example.test' } },
      error: null,
    });
    fake.setTableResult('users', {
      data: {
        id: 'user-1',
        email: 'user-1@example.test',
        role: 'admin',
        church_id: 'church-1',
      },
      error: null,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/chat/giphy?q=celebration&offset=-1', {
        headers: { authorization: 'Bearer test-token' },
      })
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 402 for an expired trial', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user-1@example.test' } },
      error: null,
    });
    fake.setTableResult('users', {
      data: {
        id: 'user-1',
        email: 'user-1@example.test',
        role: 'admin',
        church_id: 'church-1',
      },
      error: null,
    });
    fake.setTableResult('subscriptions', {
      data: {
        status: 'trialing',
        trial_end: '2020-01-01T00:00:00.000Z',
        current_period_end: null,
      },
      error: null,
    });

    const response = await GET(giphyRequest('test-token'));

    expect(response.status).toBe(402);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
