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

const stripeMock = vi.hoisted(() => ({
  subscriptions: { retrieve: vi.fn() },
  checkout: { sessions: { retrieve: vi.fn() } },
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

function syncRequest(token?: string, ip?: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/billing/sync-subscription', {
    method: 'POST',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(ip ? { 'x-forwarded-for': ip } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  fake.reset();
  stripeMock.subscriptions.retrieve.mockReset();
  stripeMock.checkout.sessions.retrieve.mockReset();
});

describe('POST /api/billing/sync-subscription', () => {
  it('returns 401 without an Authorization header', async () => {
    const response = await POST(syncRequest());

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
    expect(fake.auth.getUser).not.toHaveBeenCalled();
  });

  it('returns 404 when the authenticated user has no profile', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user-1@example.test' } },
      error: null,
    });

    const response = await POST(syncRequest('test-token'));

    expect(response.status).toBe(404);
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('reads the subscription scoped to the caller church', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user-1@example.test' } },
      error: null,
    });
    fake.setTableResult('users', {
      data: { church_id: 'church-1' },
      error: null,
    });
    fake.setTableResult('subscriptions', {
      data: { id: 'sub-1', church_id: 'church-1', stripe_subscription_id: null },
      error: null,
    });

    const response = await POST(syncRequest('test-token'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ synced: false });
    expect(fake.operationsFor('subscriptions')).toContainEqual({
      table: 'subscriptions',
      method: 'eq',
      args: ['church_id', 'church-1'],
    });
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('returns 429 once the client IP exhausts the billing limit', async () => {
    const ip = '203.0.113.81';
    exhaustRateLimit(`billing-sync-subscription:${ip}`, RateLimitTiers.BILLING);

    const response = await POST(syncRequest('test-token', ip));

    expect(response.status).toBe(429);
    expect(fake.from).not.toHaveBeenCalled();
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('recovers a missed webhook from a completed checkout session', async () => {
    const periodStart = 1762000000;
    const periodEnd = 1764592000;

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
        stripe_subscription_id: null,
        stripe_customer_id: 'cus_real123',
        status: 'trialing',
      },
      error: null,
    });
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_test_1',
      status: 'complete',
      payment_status: 'paid',
      customer: 'cus_real123',
      subscription: 'sub_checkout',
      metadata: { church_id: 'church-1', price_type: 'monthly' },
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_checkout',
      status: 'active',
      customer: 'cus_real123',
      items: {
        data: [
          {
            current_period_start: periodStart,
            current_period_end: periodEnd,
            price: { recurring: { interval: 'month', interval_count: 1 } },
          },
        ],
      },
    });

    const response = await POST(
      syncRequest('test-token', undefined, { session_id: 'cs_test_1' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ synced: true });
    expect(stripeMock.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_test_1');

    const update = fake
      .operationsFor('subscriptions')
      .find((op) => op.method === 'update');
    expect(update?.args[0]).toMatchObject({
      status: 'active',
      stripe_subscription_id: 'sub_checkout',
      current_period_end: new Date(periodEnd * 1000).toISOString(),
    });
  });
});
