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

function importRequest(
  body: unknown,
  token: string | null = 'test-token'
): NextRequest {
  return new NextRequest('http://localhost/api/songs/import/csv', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function authenticate(role: 'admin' | 'leader' | 'team' = 'leader', churchId = 'church-1') {
  fake.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user-1@example.test' } },
    error: null,
  });
  fake.setTableResult('users', {
    data: { id: 'user-1', role, church_id: churchId },
    error: null,
  });
  fake.setTableResult('subscriptions', {
    data: { status: 'active', trial_end: null, current_period_end: null },
    error: null,
  });
}

type SongOperation = { method: string; args: unknown[] };

function songOperations(method: string): SongOperation[] {
  return fake
    .operationsFor('songs')
    .filter((operation) => operation.method === method);
}

beforeEach(() => {
  fake.reset();
});

describe('POST /api/songs/import/csv', () => {
  it('returns 401 without authentication', async () => {
    const response = await POST(
      importRequest({ csv: 'Title\nMorning Light', mode: 'preview' }, null)
    );

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 403 for team members, who cannot create songs', async () => {
    authenticate('team');

    const response = await POST(
      importRequest({ csv: 'Title\nMorning Light', mode: 'preview' })
    );

    expect(response.status).toBe(403);
    expect(fake.operationsFor('songs')).toHaveLength(0);
    expect(fake.operationsFor('subscriptions')).toHaveLength(0);
  });

  it('returns 429 once the per-user import limit is exhausted', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-rate-limited', email: 'limited@example.test' } },
      error: null,
    });
    fake.setTableResult('users', {
      data: { id: 'user-rate-limited', role: 'leader', church_id: 'church-1' },
      error: null,
    });
    exhaustRateLimit(
      'songs-csv-import:user-rate-limited',
      RateLimitTiers.API_WRITE
    );

    const response = await POST(
      importRequest({ csv: 'Title\nMorning Light', mode: 'preview' })
    );

    expect(response.status).toBe(429);
    expect(fake.operationsFor('subscriptions')).toHaveLength(0);
    expect(fake.operationsFor('songs')).toHaveLength(0);
  });

  it('returns 402 when the church has no active subscription', async () => {
    authenticate();
    fake.setTableResult('subscriptions', { data: null, error: null });

    const response = await POST(
      importRequest({ csv: 'Title\nMorning Light', mode: 'preview' })
    );

    expect(response.status).toBe(402);
    expect(fake.operationsFor('songs')).toHaveLength(0);
  });

  it('returns 400 for invalid JSON or an empty csv field', async () => {
    authenticate();

    const invalidJson = await POST(importRequest('not-json'));
    expect(invalidJson.status).toBe(400);

    const emptyCsv = await POST(importRequest({ csv: '', mode: 'preview' }));
    expect(emptyCsv.status).toBe(400);
    expect(fake.operationsFor('songs')).toHaveLength(0);
  });

  it('returns a clear 400 for a CSV without a title column', async () => {
    authenticate();

    const response = await POST(
      importRequest({ csv: 'Artist,Key\nExample Artist,G', mode: 'preview' })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/Missing title column/),
    });
    expect(fake.operationsFor('songs')).toHaveLength(0);
  });

  it('previews new and duplicate rows scoped to the caller church', async () => {
    authenticate('leader', 'church-1');
    fake.setTableResult('songs', {
      data: [
        {
          id: 'song-1',
          title: 'Morning Light',
          artist: 'Example Artist',
          ccli_number: '0000001',
        },
      ],
      error: null,
    });

    const response = await POST(
      importRequest({
        csv: [
          'Title,Author,CCLI #,Default Key,Tags',
          'Morning Light,Example Artist,0000001,G,praise',
          'Different Song,Other Artist,,D,grace|hope',
        ].join('\n'),
        mode: 'preview',
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      summary: {
        totalRows: 2,
        newCount: 1,
        duplicateCount: 1,
        invalidCount: 0,
      },
      rows: [
        {
          rowNumber: 2,
          status: 'duplicate',
          matchedSongId: 'song-1',
          matchedTitle: 'Morning Light',
          matchSource: 'library',
        },
        {
          rowNumber: 3,
          status: 'new',
          title: 'Different Song',
          defaultKey: 'D',
          tags: ['grace', 'hope'],
        },
      ],
      errors: [],
    });

    expect(fake.operationsFor('songs')).toContainEqual({
      table: 'songs',
      method: 'eq',
      args: ['church_id', 'church-1'],
    });
    expect(songOperations('insert')).toHaveLength(0);
    expect(songOperations('update')).toHaveLength(0);
  });

  it('imports new songs with church_id from the profile and skips duplicates', async () => {
    authenticate('leader', 'church-1');
    let songsCalls = 0;
    fake.setTableResult('songs', () => {
      songsCalls += 1;
      if (songsCalls === 1) {
        return {
          data: [
            {
              id: 'song-1',
              title: 'Morning Light',
              artist: 'Example Artist',
              ccli_number: '0000001',
            },
          ],
          error: null,
        };
      }
      return { data: [{ id: 'song-new' }], error: null };
    });

    const response = await POST(
      importRequest({
        csv: [
          'Title,Author,CCLI #',
          'Morning Light,Example Artist,0000001',
          'Brand New,Other Artist,',
        ].join('\n'),
        mode: 'import',
        // A client-supplied church id must never be trusted.
        church_id: 'attacker-church',
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      summary: {
        added: 1,
        updated: 0,
        skipped: 1,
        failed: 0,
        totalRows: 2,
        invalidCount: 0,
      },
      errors: [],
    });

    const insert = songOperations('insert');
    expect(insert).toHaveLength(1);
    expect(insert[0].args[0]).toEqual([
      {
        church_id: 'church-1',
        title: 'Brand New',
        artist: 'Other Artist',
        default_key: 'C',
        ccli_number: '',
        tags: [],
      },
    ]);
    expect(songOperations('update')).toHaveLength(0);
  });

  it('skips duplicates by default when updateExisting is omitted', async () => {
    authenticate();
    fake.setTableResult('songs', {
      data: [
        {
          id: 'song-1',
          title: 'Morning Light',
          artist: 'Example Artist',
          ccli_number: '0000001',
        },
      ],
      error: null,
    });

    const response = await POST(
      importRequest({
        csv: 'Title,Author,CCLI #\nMorning Light,Example Artist,0000001',
        mode: 'import',
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      summary: { added: 0, updated: 0, skipped: 1, failed: 0 },
    });
    expect(songOperations('insert')).toHaveLength(0);
    expect(songOperations('update')).toHaveLength(0);
  });

  it('updates only default_key, ccli_number, and tags for existing songs', async () => {
    authenticate();
    let songsCalls = 0;
    fake.setTableResult('songs', () => {
      songsCalls += 1;
      if (songsCalls === 1) {
        return {
          data: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              title: 'Morning Light',
              artist: 'Example Artist',
              ccli_number: '0000001',
            },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const response = await POST(
      importRequest({
        csv: [
          'Title,Author,CCLI #,Default Key,Tags',
          'Morning Light,Example Artist,0000001,D,grace|hope',
        ].join('\n'),
        mode: 'import',
        updateExisting: true,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      summary: { added: 0, updated: 1, skipped: 0, failed: 0 },
    });

    const update = songOperations('update');
    expect(update).toHaveLength(1);
    expect(update[0].args[0]).toEqual({
      default_key: 'D',
      ccli_number: '0000001',
      tags: ['grace', 'hope'],
    });
    expect(songOperations('eq')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ args: ['id', '11111111-1111-4111-8111-111111111111'] }),
        expect.objectContaining({ args: ['church_id', 'church-1'] }),
      ])
    );
    expect(songOperations('insert')).toHaveLength(0);
  });

  it('counts invalid rows as failed without aborting valid rows', async () => {
    authenticate();
    let songsCalls = 0;
    fake.setTableResult('songs', () => {
      songsCalls += 1;
      if (songsCalls === 1) return { data: [], error: null };
      return { data: [{ id: 'song-new' }], error: null };
    });

    const response = await POST(
      importRequest({
        csv: [
          'Title,Artist',
          ',Example Artist',
          'Brand New,Other Artist',
        ].join('\n'),
        mode: 'import',
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      summary: {
        added: 1,
        updated: 0,
        skipped: 0,
        failed: 1,
        totalRows: 2,
        invalidCount: 1,
      },
      errors: [{ rowNumber: 2, message: 'Title is required.' }],
    });
  });
});
