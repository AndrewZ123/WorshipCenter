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
vi.mock('@/lib/stripe', () => ({
  isStripeConfigured: () => false,
  getStripe: () => null,
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

function deleteAccountRequest(token?: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/delete-account', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function expectNoDestructiveWrites() {
  for (const table of [
    'service_chat_messages',
    'service_debriefs',
    'notifications',
    'team_members',
    'users',
    'churches',
  ]) {
    expect(
      fake
        .operationsFor(table)
        .some((op) => ['insert', 'update', 'delete', 'upsert'].includes(op.method))
    ).toBe(false);
  }
}

beforeEach(() => {
  fake.reset();
});

describe('POST /api/auth/delete-account', () => {
  it('returns 401 without an Authorization header and deletes nothing', async () => {
    const response = await POST(deleteAccountRequest());

    expect(response.status).toBe(401);
    expect(fake.auth.getUser).not.toHaveBeenCalled();
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid token and deletes nothing', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid JWT' },
    });

    const response = await POST(deleteAccountRequest('not-a-real-token'));

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
    expectNoDestructiveWrites();
  });

  it('returns 404 when the authenticated user has no profile and deletes nothing', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user-1@example.test' } },
      error: null,
    });
    fake.setTableResult('users', { data: null, error: { message: 'not found' } });

    const response = await POST(deleteAccountRequest('test-token'));

    expect(response.status).toBe(404);
    expectNoDestructiveWrites();
    expect(fake.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('returns 429 once the per-user delete limit is exhausted', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-rate-limited', email: 'limited@example.test' } },
      error: null,
    });
    exhaustRateLimit(
      'auth-delete-account:user-rate-limited',
      RateLimitTiers.ACCOUNT_DELETE
    );

    const response = await POST(deleteAccountRequest('test-token'));

    expect(response.status).toBe(429);
    expect(response.headers.get('x-ratelimit-remaining')).toBe('0');
    expect(response.headers.get('retry-after')).toBeTruthy();
    expect(fake.from).not.toHaveBeenCalled();
    expectNoDestructiveWrites();
    expect(fake.auth.admin.deleteUser).not.toHaveBeenCalled();
  });
});
