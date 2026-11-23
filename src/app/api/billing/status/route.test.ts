import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { GET } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  isStripeConfigured: () => true,
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

function statusRequest(token?: string): NextRequest {
  return new NextRequest('http://localhost/api/billing/status', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(() => {
  fake.reset();
  // Dummy values only. The response must never echo these back.
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_dummy_should_never_leak');
  vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_dummy_should_never_leak');
  vi.stubEnv('STRIPE_MONTHLY_PRICE_ID', 'price_dummy_monthly_should_never_leak');
  vi.stubEnv('STRIPE_YEARLY_PRICE_ID', 'price_dummy_yearly_should_never_leak');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/billing/status', () => {
  it('returns 401 without authentication', async () => {
    const response = await GET(statusRequest());

    expect(response.status).toBe(401);
  });

  it('returns only { configured: boolean } for an authenticated user', async () => {
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

    const response = await GET(statusRequest('test-token'));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(text)).toEqual({ configured: true });
    expect(Object.keys(JSON.parse(text))).toEqual(['configured']);

    const lowered = text.toLowerCase();
    for (const forbidden of [
      'stripe_secret_key',
      'publishable',
      'monthly_price',
      'yearly_price',
      'sk_test_dummy',
      'pk_test_dummy',
      'price_dummy',
      'supabase',
      'service_role',
      'env',
      'missing',
    ]) {
      expect(lowered).not.toContain(forbidden);
    }
  });
});
