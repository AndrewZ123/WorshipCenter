import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import {
  checkSubscriptionStatus,
  requireActiveSubscription,
} from './subscription-middleware';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

function authenticatedRequest(): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    headers: { authorization: 'Bearer test-token' },
  });
}

function statusOf(result: boolean | NextResponse): number | null {
  return typeof result === 'boolean' ? null : result.status;
}

beforeEach(() => {
  fake.reset();
  fake.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });
  fake.setTableResult('users', {
    data: { church_id: 'church-1' },
    error: null,
  });
});

describe('requireActiveSubscription', () => {
  it('does not treat an expired trial as active', async () => {
    fake.setTableResult('subscriptions', {
      data: {
        status: 'trialing',
        trial_end: '2020-01-01T00:00:00.000Z',
        current_period_end: null,
      },
      error: null,
    });

    const result = await requireActiveSubscription(authenticatedRequest());

    expect(result).not.toBe(true);
    expect(statusOf(result)).toBe(402);
  });

  it('allows access while the trial end is still in the future', async () => {
    fake.setTableResult('subscriptions', {
      data: {
        status: 'trialing',
        trial_end: '2999-01-01T00:00:00.000Z',
        current_period_end: null,
      },
      error: null,
    });

    await expect(requireActiveSubscription(authenticatedRequest())).resolves.toBe(true);
  });

  it('allows access for an active subscription', async () => {
    fake.setTableResult('subscriptions', {
      data: {
        status: 'active',
        trial_end: null,
        current_period_end: null,
      },
      error: null,
    });

    await expect(requireActiveSubscription(authenticatedRequest())).resolves.toBe(true);
  });
});

describe('checkSubscriptionStatus', () => {
  it('reports an expired trial as no access', async () => {
    fake.setTableResult('subscriptions', {
      data: {
        status: 'trialing',
        trial_end: '2020-01-01T00:00:00.000Z',
        current_period_end: null,
      },
      error: null,
    });

    const status = await checkSubscriptionStatus('test-token');

    expect(status).not.toBeNull();
    expect(status?.hasAccess).toBe(false);
    expect(status?.isTrialing).toBe(false);
  });

  it('reports a future trial as active and in-trial', async () => {
    fake.setTableResult('subscriptions', {
      data: {
        status: 'trialing',
        trial_end: '2999-01-01T00:00:00.000Z',
        current_period_end: null,
      },
      error: null,
    });

    const status = await checkSubscriptionStatus('test-token');

    expect(status?.hasAccess).toBe(true);
    expect(status?.isTrialing).toBe(true);
  });
});
