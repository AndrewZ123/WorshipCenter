import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { exhaustRateLimit } from '@/test/rate-limit';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import { POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const stripeMock = vi.hoisted(() => ({
  prices: {
    retrieve: vi.fn(),
  },
  billingPortal: {
    configurations: {
      list: vi.fn(),
      create: vi.fn(),
    },
    sessions: {
      create: vi.fn(),
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

function portalRequest(token?: string, ip?: string): NextRequest {
  return new NextRequest('http://localhost/api/billing/create-portal-session', {
    method: 'POST',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(ip ? { 'x-forwarded-for': ip } : {}),
    },
  });
}

beforeEach(() => {
  fake.reset();
  vi.stubEnv('STRIPE_MONTHLY_PRICE_ID', 'price_test_monthly');
  vi.stubEnv('STRIPE_YEARLY_PRICE_ID', 'price_test_yearly');
  stripeMock.prices.retrieve.mockReset();
  stripeMock.billingPortal.configurations.list.mockReset();
  stripeMock.billingPortal.configurations.create.mockReset();
  stripeMock.billingPortal.sessions.create.mockReset();
  stripeMock.prices.retrieve.mockImplementation(async (priceId: string) => ({
    id: priceId,
    product: priceId === 'price_test_monthly' ? 'prod_monthly' : 'prod_yearly',
  }));
  stripeMock.billingPortal.configurations.list.mockResolvedValue({ data: [] });
  stripeMock.billingPortal.configurations.create.mockResolvedValue({
    id: 'bpc_test123',
  });
  stripeMock.billingPortal.sessions.create.mockResolvedValue({
    url: 'https://stripe.test/portal',
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/billing/create-portal-session', () => {
  it('returns 401 without an Authorization header', async () => {
    const response = await POST(portalRequest());

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
    expect(stripeMock.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it('rejects placeholder Stripe customer ids', async () => {
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
        stripe_customer_id: 'cus_pending_123',
        status: 'trialing',
      },
      error: null,
    });

    const response = await POST(portalRequest('test-token'));

    expect(response.status).toBe(400);
    expect(stripeMock.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it('creates a portal session for a valid customer scoped to the caller church', async () => {
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
        stripe_customer_id: 'cus_real123',
        status: 'active',
      },
      error: null,
    });

    const response = await POST(portalRequest('test-token'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: 'https://stripe.test/portal',
    });
    expect(fake.operationsFor('subscriptions')).toContainEqual({
      table: 'subscriptions',
      method: 'eq',
      args: ['church_id', 'church-1'],
    });

    // No configuration existed, so one must be created with BOTH configured
    // prices (grouped by product) — omitting products caused the 500.
    expect(stripeMock.prices.retrieve).toHaveBeenCalledWith('price_test_monthly');
    expect(stripeMock.prices.retrieve).toHaveBeenCalledWith('price_test_yearly');
    expect(stripeMock.billingPortal.configurations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        features: expect.objectContaining({
          subscription_update: expect.objectContaining({
            enabled: true,
            products: [
              { product: 'prod_monthly', prices: ['price_test_monthly'] },
              { product: 'prod_yearly', prices: ['price_test_yearly'] },
            ],
          }),
          payment_method_update: { enabled: true },
          invoice_history: { enabled: true },
          subscription_cancel: expect.objectContaining({
            enabled: true,
            mode: 'at_period_end',
          }),
        }),
      })
    );
    expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ configuration: 'bpc_test123' })
    );
  });

  it('reuses any active portal configuration instead of requiring the default', async () => {
    stripeMock.billingPortal.configurations.list.mockResolvedValue({
      data: [{ id: 'bpc_existing', is_default: false }],
    });

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
        stripe_customer_id: 'cus_real123',
        status: 'active',
      },
      error: null,
    });

    const response = await POST(portalRequest('test-token'));

    expect(response.status).toBe(200);
    expect(stripeMock.billingPortal.configurations.list).toHaveBeenCalledWith({
      active: true,
      limit: 1,
    });
    expect(stripeMock.billingPortal.configurations.create).not.toHaveBeenCalled();
    expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ configuration: 'bpc_existing' })
    );
  });

  it('returns 429 once the client IP exhausts the billing limit', async () => {
    const ip = '203.0.113.80';
    exhaustRateLimit(`billing-portal:${ip}`, RateLimitTiers.BILLING);

    const response = await POST(portalRequest('test-token', ip));

    expect(response.status).toBe(429);
    expect(fake.from).not.toHaveBeenCalled();
    expect(stripeMock.billingPortal.sessions.create).not.toHaveBeenCalled();
  });
});
