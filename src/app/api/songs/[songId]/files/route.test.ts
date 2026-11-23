import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { exhaustRateLimit } from '@/test/rate-limit';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import { GET, POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const songId = '00000000-0000-4000-8000-000000000070';

function fileRequest(
  method: 'GET' | 'POST',
  token?: string
): NextRequest {
  return new NextRequest(`http://localhost/api/songs/${songId}/files`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(method === 'POST' ? { body: JSON.stringify({}) } : {}),
  });
}

function authenticateAsRateLimitedUser() {
  fake.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-rate-limited', email: 'limited@example.test' } },
    error: null,
  });
  fake.setTableResult('users', {
    data: { id: 'user-rate-limited', role: 'leader', church_id: 'church-1' },
    error: null,
  });
}

beforeEach(() => {
  fake.reset();
});

describe('/api/songs/[songId]/files rate limits', () => {
  it('returns 401 for an unauthenticated GET', async () => {
    const response = await GET(fileRequest('GET'), {
      params: Promise.resolve({ songId }),
    });

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 429 once the per-user read limit is exhausted', async () => {
    authenticateAsRateLimitedUser();
    exhaustRateLimit('songs-files-read:user-rate-limited', RateLimitTiers.API_READ);

    const response = await GET(fileRequest('GET', 'test-token'), {
      params: Promise.resolve({ songId }),
    });

    expect(response.status).toBe(429);
    expect(fake.operationsFor('subscriptions')).toHaveLength(0);
  });

  it('returns 429 once the per-user write limit is exhausted', async () => {
    authenticateAsRateLimitedUser();
    exhaustRateLimit('songs-files-write:user-rate-limited', RateLimitTiers.API_WRITE);

    const response = await POST(fileRequest('POST', 'test-token'), {
      params: Promise.resolve({ songId }),
    });

    expect(response.status).toBe(429);
    expect(fake.operationsFor('subscriptions')).toHaveLength(0);
    expect(fake.operationsFor('songs')).toHaveLength(0);
  });
});
