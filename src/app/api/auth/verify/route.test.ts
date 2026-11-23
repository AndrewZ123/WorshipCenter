import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { GET } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

function verifyRequest(authorization?: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/verify', {
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  fake.reset();
});

describe('GET /api/auth/verify', () => {
  it('returns 401 without an Authorization header', async () => {
    const response = await GET(verifyRequest());

    expect(response.status).toBe(401);
    expect(fake.auth.getUser).not.toHaveBeenCalled();
  });

  it('returns 401 for a malformed Authorization header', async () => {
    const response = await GET(verifyRequest('Token abc'));

    expect(response.status).toBe(401);
    expect(fake.auth.getUser).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid token', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid JWT' },
    });

    const response = await GET(verifyRequest('Bearer bad-token'));

    expect(response.status).toBe(401);
    expect(fake.auth.getUser).toHaveBeenCalledWith('bad-token');
  });

  it('returns the authenticated profile for a valid token', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user-1@example.test' } },
      error: null,
    });
    fake.setTableResult('users', {
      data: {
        id: 'user-1',
        email: 'user-1@example.test',
        role: 'leader',
        church_id: 'church-1',
      },
      error: null,
    });

    const response = await GET(verifyRequest('Bearer test-token'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: {
        id: 'user-1',
        email: 'user-1@example.test',
        role: 'leader',
        church_id: 'church-1',
      },
      authenticated: true,
    });
  });
});
