import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { exhaustRateLimit } from '@/test/rate-limit';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import { GET } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

function searchRequest(query = '?q=grace', token?: string): NextRequest {
  return new NextRequest(`http://localhost/api/songs/search${query}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function authenticate(churchId = 'church-1') {
  fake.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user-1@example.test' } },
    error: null,
  });
  fake.setTableResult('users', {
    data: { id: 'user-1', role: 'leader', church_id: churchId },
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

describe('GET /api/songs/search', () => {
  it('returns 401 without authentication', async () => {
    const response = await GET(searchRequest());

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 400 for an out-of-range limit after authentication', async () => {
    authenticate();

    const response = await GET(searchRequest('?q=grace&limit=0', 'test-token'));

    expect(response.status).toBe(400);
    expect(fake.operationsFor('songs')).toHaveLength(0);
  });

  it('scopes the search to the caller church', async () => {
    authenticate('church-1');
    fake.setTableResult('songs', {
      data: [{ id: 'song-1', title: 'Amazing Grace' }],
      error: null,
    });

    const response = await GET(searchRequest('?q=grace', 'test-token'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      songs: [{ id: 'song-1', title: 'Amazing Grace' }],
    });
    expect(fake.operationsFor('songs')).toContainEqual({
      table: 'songs',
      method: 'eq',
      args: ['church_id', 'church-1'],
    });
  });

  it('returns 429 once the per-user read limit is exhausted', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-rate-limited', email: 'limited@example.test' } },
      error: null,
    });
    fake.setTableResult('users', {
      data: { id: 'user-rate-limited', role: 'leader', church_id: 'church-1' },
      error: null,
    });
    exhaustRateLimit('songs-search:user-rate-limited', RateLimitTiers.API_READ);

    const response = await GET(searchRequest('?q=grace', 'test-token'));

    expect(response.status).toBe(429);
    expect(fake.operationsFor('songs')).toHaveLength(0);
    expect(fake.operationsFor('subscriptions')).toHaveLength(0);
  });
});
