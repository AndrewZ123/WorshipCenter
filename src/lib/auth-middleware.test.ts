import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import type { User } from '@/lib/types';
import {
  getRequestUser,
  validateChurchAccess,
  verifyAuthToken,
  withAuth,
} from './auth-middleware';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const user: User = {
  id: 'user-1',
  church_id: 'church-1',
  email: 'user-1@example.test',
  name: 'Test User',
  role: 'admin',
  created_at: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  fake.reset();
});

describe('verifyAuthToken', () => {
  it('rejects a missing Authorization header', async () => {
    const result = await verifyAuthToken(null);

    expect(result.success).toBe(false);
    expect(result.user).toBeNull();
    expect(result.error).toBe('Missing authorization header');
  });

  it('rejects a token that Supabase cannot verify', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid JWT' },
    });

    const result = await verifyAuthToken('Bearer not-a-real-token');

    expect(result.success).toBe(false);
    expect(result.user).toBeNull();
    expect(fake.auth.getUser).toHaveBeenCalledWith('not-a-real-token');
  });
});

describe('getRequestUser', () => {
  it('returns null when no Authorization header is present', async () => {
    const request = new NextRequest('http://localhost/api/test');

    await expect(getRequestUser(request)).resolves.toBeNull();
  });

  it('returns null for an invalid token', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid JWT' },
    });
    const request = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer not-a-real-token' },
    });

    await expect(getRequestUser(request)).resolves.toBeNull();
  });
});

describe('withAuth', () => {
  it('responds 401 without an Authorization header', async () => {
    const handler = vi.fn();
    const wrapped = withAuth(handler);

    const response = await wrapped(new NextRequest('http://localhost/api/test'));

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('validateChurchAccess', () => {
  it('allows the user to access their own church', async () => {
    await expect(validateChurchAccess(user, 'church-1')).resolves.toBe(true);
  });

  it('denies access to a different church', async () => {
    await expect(validateChurchAccess(user, 'church-2')).resolves.toBe(false);
  });
});
