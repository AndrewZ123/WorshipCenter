import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const signupId = '00000000-0000-4000-8000-000000000060';
const serviceId = '00000000-0000-4000-8000-000000000061';

function declineRequest(id: string, token?: string): NextRequest {
  return new NextRequest(`http://localhost/api/signup/${id}/decline`, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function authenticate(churchId = 'church-1') {
  fake.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user-1@example.test' } },
    error: null,
  });
  fake.setTableResult('users', {
    data: { id: 'user-1', role: 'admin', church_id: churchId },
    error: null,
  });
  fake.setTableResult('subscriptions', {
    data: { status: 'active', trial_end: null, current_period_end: null },
    error: null,
  });
}

function expectNoMutation() {
  for (const table of ['signup_requests', 'service_assignments', 'team_members']) {
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

describe('POST /api/signup/[id]/decline', () => {
  it('returns 401 without authentication', async () => {
    const response = await POST(declineRequest(signupId), {
      params: Promise.resolve({ id: signupId }),
    });

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-UUID signup id after authentication', async () => {
    authenticate();

    const response = await POST(declineRequest('not-a-uuid', 'test-token'), {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });

    expect(response.status).toBe(400);
    expect(fake.operationsFor('signup_requests')).toHaveLength(0);
  });

  it("does not decline another church's signup request", async () => {
    authenticate('church-1');
    fake.setTableResult('signup_requests', {
      data: {
        id: signupId,
        service_id: serviceId,
        status: 'pending',
        role: 'vocals',
        team_member_id: null,
      },
      error: null,
    });
    fake.setTableResult('services', {
      data: {
        id: serviceId,
        title: 'Sunday Worship',
        date: '2026-12-06',
        church_id: 'church-2',
      },
      error: null,
    });

    const response = await POST(declineRequest(signupId, 'test-token'), {
      params: Promise.resolve({ id: signupId }),
    });

    expect(response.status).toBe(403);
    expectNoMutation();
  });
});
