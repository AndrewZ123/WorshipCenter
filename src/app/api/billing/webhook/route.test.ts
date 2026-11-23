import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const headerState = vi.hoisted(() => ({
  signature: undefined as string | undefined,
}));

vi.mock('next/headers', () => ({
  headers: async () => {
    const result = new Headers();
    if (headerState.signature) {
      result.set('stripe-signature', headerState.signature);
    }
    return result;
  },
}));

const stripeMock = vi.hoisted(() => ({
  webhooks: {
    constructEvent: vi.fn(),
  },
  subscriptions: {
    retrieve: vi.fn(),
  },
}));

vi.mock('@/lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stripe')>();
  return {
    ...actual,
    getStripe: () => stripeMock,
  };
});

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

function webhookRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/billing/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function expectNoSubscriptionWrites() {
  expect(
    fake
      .operationsFor('subscriptions')
      .some((op) => ['insert', 'update', 'delete', 'upsert'].includes(op.method))
  ).toBe(false);
}

beforeEach(() => {
  fake.reset();
  headerState.signature = undefined;
  stripeMock.webhooks.constructEvent.mockReset();
  stripeMock.subscriptions.retrieve.mockReset();
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_dummy');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/billing/webhook', () => {
  it('returns 400 when the Stripe signature header is missing', async () => {
    const response = await POST(webhookRequest());

    expect(response.status).toBe(400);
    expect(stripeMock.webhooks.constructEvent).not.toHaveBeenCalled();
    expectNoSubscriptionWrites();
  });

  it('returns 400 for an invalid Stripe signature without writing subscriptions', async () => {
    headerState.signature = 't=1,v1=bad';
    stripeMock.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid signature' });
    expect(stripeMock.webhooks.constructEvent).toHaveBeenCalledWith(
      expect.any(String),
      't=1,v1=bad',
      'whsec_test_dummy'
    );
    expectNoSubscriptionWrites();
  });

  it('returns 400 for a validly signed but malformed event', async () => {
    headerState.signature = 't=1,v1=valid';
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'customer.subscription.deleted',
      data: { object: null },
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(400);
    expectNoSubscriptionWrites();
  });

  it('applies a valid event to the church carried in metadata', async () => {
    headerState.signature = 't=1,v1=valid';
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_1',
          metadata: { church_id: 'church-1' },
          status: 'canceled',
        },
      },
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });

    const operations = fake.operationsFor('subscriptions');
    expect(operations.some((op) => op.method === 'update')).toBe(true);
    expect(operations).toContainEqual({
      table: 'subscriptions',
      method: 'eq',
      args: ['church_id', 'church-1'],
    });
  });

  it('activates a paid checkout using item-level period fields (2026 API shape)', async () => {
    const periodStart = 1762000000;
    const periodEnd = 1764592000;

    headerState.signature = 't=1,v1=valid';
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_live_shape',
      status: 'active',
      customer: 'cus_real123',
      // No top-level current_period_start/end — the live API puts them on items.
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
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: 'evt_checkout',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          metadata: { church_id: 'church-1', price_type: 'monthly' },
          subscription: 'sub_live_shape',
          customer: 'cus_real123',
        },
      },
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledWith('sub_live_shape');

    const update = fake
      .operationsFor('subscriptions')
      .find((op) => op.method === 'update');
    expect(update?.args[0]).toMatchObject({
      status: 'active',
      stripe_subscription_id: 'sub_live_shape',
      stripe_customer_id: 'cus_real123',
      price_type: 'monthly',
      current_period_start: new Date(periodStart * 1000).toISOString(),
      current_period_end: new Date(periodEnd * 1000).toISOString(),
      canceled_at: null,
    });
  });

  it('activates on customer.subscription.created with church metadata', async () => {
    const periodStart = 1762000000;
    const periodEnd = 1793536000;

    fake.setTableResult('subscriptions', {
      data: { church_id: 'church-1', status: 'trialing' },
      error: null,
    });

    headerState.signature = 't=1,v1=valid';
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: 'evt_sub_created',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_created',
          status: 'active',
          customer: 'cus_real123',
          metadata: { church_id: 'church-1' },
          items: {
            data: [
              {
                current_period_start: periodStart,
                current_period_end: periodEnd,
                price: { recurring: { interval: 'year', interval_count: 1 } },
              },
            ],
          },
        },
      },
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });

    const update = fake
      .operationsFor('subscriptions')
      .find((op) => op.method === 'update');
    expect(update?.args[0]).toMatchObject({
      status: 'active',
      stripe_subscription_id: 'sub_created',
      price_type: 'yearly',
      current_period_end: new Date(periodEnd * 1000).toISOString(),
    });
  });

  it('returns 500 when the activation write fails so Stripe retries', async () => {
    headerState.signature = 't=1,v1=valid';
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_live_shape',
      status: 'active',
      customer: 'cus_real123',
      items: {
        data: [
          {
            current_period_start: 1762000000,
            current_period_end: 1764592000,
          },
        ],
      },
    });
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: 'evt_checkout',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          metadata: { church_id: 'church-1', price_type: 'monthly' },
          subscription: 'sub_live_shape',
          customer: 'cus_real123',
        },
      },
    });
    fake.setTableResult('subscriptions', {
      data: null,
      error: { message: 'write failed' },
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(500);
  });
});
