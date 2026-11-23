import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const stripeMock = vi.hoisted(() => ({
  checkout: { sessions: { retrieve: vi.fn() } },
  subscriptions: { retrieve: vi.fn() },
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

function confirmRequest(token?: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/billing/confirm-checkout', {
    method: 'POST',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function authenticatedUser() {
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
      status: 'trialing',
    },
    error: null,
  });
}

beforeEach(() => {
  fake.reset();
  stripeMock.checkout.sessions.retrieve.mockReset();
  stripeMock.subscriptions.retrieve.mockReset();
});

describe('POST /api/billing/confirm-checkout', () => {
  it('returns 401 without an Authorization header', async () => {
    const response = await POST(confirmRequest());

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
    expect(stripeMock.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });

  it('rejects a checkout session belonging to another church', async () => {
    authenticatedUser();
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_test_other',
      status: 'complete',
      payment_status: 'paid',
      customer: 'cus_other123',
      subscription: 'sub_other',
      metadata: { church_id: 'church-other' },
    });

    const response = await POST(
      confirmRequest('test-token', { session_id: 'cs_test_other' })
    );

    expect(response.status).toBe(403);
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(
      fake
        .operationsFor('subscriptions')
        .some((op) => ['insert', 'update', 'upsert'].includes(op.method))
    ).toBe(false);
  });

  it('returns 409 while the checkout is not complete/paid', async () => {
    authenticatedUser();
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_test_pending',
      status: 'open',
      payment_status: 'unpaid',
      customer: 'cus_real123',
      subscription: null,
      metadata: { church_id: 'church-1' },
    });

    const response = await POST(
      confirmRequest('test-token', { session_id: 'cs_test_pending' })
    );

    expect(response.status).toBe(409);
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('activates the caller subscription from a paid checkout session', async () => {
    const periodStart = 1762000000;
    const periodEnd = 1764592000;

    authenticatedUser();
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
      confirmRequest('test-token', { session_id: 'cs_test_1' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      confirmed: true,
      session_status: 'complete',
      payment_status: 'paid',
    });

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
