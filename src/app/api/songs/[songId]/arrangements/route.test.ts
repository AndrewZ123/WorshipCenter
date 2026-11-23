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

const songId = '00000000-0000-4000-8000-000000000070';

function arrangementRequest(
  id: string,
  body: Record<string, unknown>,
  token?: string
): NextRequest {
  return new NextRequest(`http://localhost/api/songs/${id}/arrangements`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
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

describe('POST /api/songs/[songId]/arrangements', () => {
  it('returns 401 without authentication', async () => {
    const response = await POST(
      arrangementRequest(songId, { name: 'Acoustic' }),
      { params: Promise.resolve({ songId }) }
    );

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-UUID song id after authentication', async () => {
    authenticate();

    const response = await POST(
      arrangementRequest('not-a-uuid', { name: 'Acoustic' }, 'test-token'),
      { params: Promise.resolve({ songId: 'not-a-uuid' }) }
    );

    expect(response.status).toBe(400);
    expect(fake.operationsFor('songs')).toHaveLength(0);
    expect(fake.operationsFor('song_arrangements')).toHaveLength(0);
  });

  it('rejects a song that does not belong to the caller church', async () => {
    authenticate('church-1');
    fake.setTableResult('songs', { data: null, error: null });

    const response = await POST(
      arrangementRequest(songId, { name: 'Acoustic' }, 'test-token'),
      { params: Promise.resolve({ songId }) }
    );

    expect(response.status).toBe(404);
    expect(
      fake
        .operationsFor('song_arrangements')
        .some((op) => op.method === 'insert')
    ).toBe(false);
  });

  it('creates an arrangement scoped to the caller church', async () => {
    authenticate('church-1');
    fake.setTableResult('songs', {
      data: { id: songId, church_id: 'church-1' },
      error: null,
    });
    fake.setTableResult('song_arrangements', {
      data: { id: 'arrangement-1', name: 'Acoustic' },
      error: null,
    });

    const response = await POST(
      arrangementRequest(songId, { name: 'Acoustic' }, 'test-token'),
      { params: Promise.resolve({ songId }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      arrangement: { id: 'arrangement-1' },
    });
    expect(fake.operationsFor('song_arrangements')).toContainEqual({
      table: 'song_arrangements',
      method: 'insert',
      args: [
        expect.objectContaining({
          song_id: songId,
          church_id: 'church-1',
          name: 'Acoustic',
        }),
      ],
    });
    expect(fake.operationsFor('songs')).toContainEqual({
      table: 'songs',
      method: 'eq',
      args: ['church_id', 'church-1'],
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
    exhaustRateLimit('songs-arrangements-write:user-rate-limited', RateLimitTiers.API_WRITE);

    const response = await POST(
      arrangementRequest(songId, { name: 'Acoustic' }, 'test-token'),
      { params: Promise.resolve({ songId }) }
    );

    expect(response.status).toBe(429);
    expect(fake.operationsFor('song_arrangements')).toHaveLength(0);
    expect(fake.operationsFor('songs')).toHaveLength(0);
  });
});
