import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const stripeMock = vi.hoisted(() => ({
  customers: {
    create: async () => ({ id: 'cus_test123' }),
  },
  checkout: {
    sessions: {
      create: async () => ({ id: 'cs_test123', url: 'https://stripe.test/checkout' }),
    },
  },
  billingPortal: {
    configurations: {
      list: async () => ({ data: [] }),
      create: async () => ({ id: 'bpc_test123' }),
    },
    sessions: {
      create: async () => ({ url: 'https://stripe.test/portal' }),
    },
  },
}));

vi.mock('@/lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stripe')>();
  return {
    ...actual,
    isStripeConfigured: () => true,
    getMissingStripeConfig: () => [],
    getStripe: () => stripeMock,
  };
});

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

function checkoutRequest(token?: string): NextRequest {
  return new NextRequest('http://localhost/api/billing/create-checkout-session', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ priceType: 'monthly' }),
  });
}

beforeEach(() => {
  fake.reset();
});

describe('POST /api/billing/create-checkout-session', () => {
  it('returns 401 without an Authorization header', async () => {
    const response = await POST(checkoutRequest());

    expect(response.status).toBe(401);
  });

  it('stays reachable for an authenticated expired trial (no subscription gate)', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user-1@example.test' } },
      error: null,
    });
    fake.setTableResult('users', {
      data: { church_id: 'church-1' },
      error: null,
    });
    fake.setTableResult('subscriptions', {
      data: {
        id: 'sub-1',
        church_id: 'church-1',
        status: 'trialing',
        trial_end: '2020-01-01T00:00:00.000Z',
        current_period_end: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        price_type: 'monthly',
      },
      error: null,
    });

    const response = await POST(checkoutRequest('test-token'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: 'https://stripe.test/checkout',
    });
  });
});
