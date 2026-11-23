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
      create: vi.fn(async (params: Record<string, unknown>) => {
        void params;
        return {
          id: 'cs_test123',
          url: 'https://stripe.test/checkout',
        };
      }),
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

function checkoutRequest(token?: string, body: unknown = { priceType: 'monthly' }): NextRequest {
  return new NextRequest('http://localhost/api/billing/create-checkout-session', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function authenticateWithTrialSubscription() {
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
}

beforeEach(() => {
  fake.reset();
  stripeMock.checkout.sessions.create.mockClear();
});

describe('POST /api/billing/create-checkout-session', () => {
  it('returns 401 without an Authorization header', async () => {
    const response = await POST(checkoutRequest());

    expect(response.status).toBe(401);
  });

  it('returns 400 for an invalid price type', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer test-token',
        },
        body: JSON.stringify({ priceType: 'weekly' }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request' });
  });

  it('stays reachable for an authenticated expired trial (no subscription gate)', async () => {
    authenticateWithTrialSubscription();

    const response = await POST(checkoutRequest('test-token'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: 'https://stripe.test/checkout',
    });
  });

  it('accepts the current client protocol-relative return URLs', async () => {
    authenticateWithTrialSubscription();

    // Exact body the billing page sent before the fix.
    const response = await POST(
      checkoutRequest('test-token', {
        priceType: 'monthly',
        successUrl: '//settings/billing/success?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: '//settings/billing',
      })
    );

    expect(response.status).toBe(200);
    const args = stripeMock.checkout.sessions.create.mock.calls[0][0] as {
      success_url: string;
      cancel_url: string;
    };
    expect(args.success_url).toBe(
      'http://localhost:3000/settings/billing/success?session_id={CHECKOUT_SESSION_ID}'
    );
    expect(args.cancel_url).toBe('http://localhost:3000/settings/billing');
  });

  it('accepts absolute https return URLs and keeps the Stripe placeholder', async () => {
    authenticateWithTrialSubscription();

    const response = await POST(
      checkoutRequest('test-token', {
        priceType: 'yearly',
        successUrl: 'https://app.example.test/settings/billing/success?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://app.example.test/settings/billing',
      })
    );

    expect(response.status).toBe(200);
    const args = stripeMock.checkout.sessions.create.mock.calls[0][0] as {
      success_url: string;
      cancel_url: string;
    };
    expect(args.success_url).toBe(
      'https://app.example.test/settings/billing/success?session_id={CHECKOUT_SESSION_ID}'
    );
    expect(args.cancel_url).toBe('https://app.example.test/settings/billing');
  });

  it('falls back to server defaults when return URLs use an unsafe scheme', async () => {
    authenticateWithTrialSubscription();

    const response = await POST(
      checkoutRequest('test-token', {
        priceType: 'monthly',
        successUrl: 'javascript:alert(1)',
        cancelUrl: 'data:text/html,hi',
      })
    );

    expect(response.status).toBe(200);
    const args = stripeMock.checkout.sessions.create.mock.calls[0][0] as {
      success_url: string;
      cancel_url: string;
    };
    expect(args.success_url).toBe('http://localhost:3000/settings/billing?success=true');
    expect(args.cancel_url).toBe('http://localhost:3000/settings/billing?canceled=true');
  });
});
