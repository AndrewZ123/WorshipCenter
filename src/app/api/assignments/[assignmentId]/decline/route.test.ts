import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
  isEmailConfigured: vi.fn(async () => false),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const assignmentId = '00000000-0000-4000-8000-000000000002';

function declineRequest(id: string, token?: string): NextRequest {
  return new NextRequest(`http://localhost/api/assignments/${id}/decline`, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function authenticateAsChurchAdmin() {
  fake.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user-1@example.test' } },
    error: null,
  });
  fake.setTableResult('users', {
    data: { id: 'user-1', role: 'admin', church_id: 'church-1' },
    error: null,
  });
  fake.setTableResult('subscriptions', {
    data: { status: 'active', trial_end: null, current_period_end: null },
    error: null,
  });
}

beforeEach(() => {
  fake.reset();
});

describe('POST /api/assignments/[assignmentId]/decline', () => {
  it('returns 401 without a Bearer token', async () => {
    const response = await POST(declineRequest(assignmentId), {
      params: Promise.resolve({ assignmentId }),
    });

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-UUID assignment id after authentication', async () => {
    authenticateAsChurchAdmin();

    const response = await POST(declineRequest('nope', 'test-token'), {
      params: Promise.resolve({ assignmentId: 'nope' }),
    });

    expect(response.status).toBe(400);
    expect(fake.operationsFor('service_assignments')).toHaveLength(0);
  });

  it("returns 403 when declining another user's assignment", async () => {
    authenticateAsChurchAdmin();
    fake.setTableResult('service_assignments', {
      data: {
        id: assignmentId,
        status: 'pending',
        team_members: { user_id: 'user-2' },
      },
      error: null,
    });

    const response = await POST(declineRequest(assignmentId, 'test-token'), {
      params: Promise.resolve({ assignmentId }),
    });

    expect(response.status).toBe(403);
    expect(
      fake.operationsFor('service_assignments').some((op) => op.method === 'update')
    ).toBe(false);
  });

  it('declines an assignment owned by the caller', async () => {
    authenticateAsChurchAdmin();
    fake.setTableResult('service_assignments', {
      data: {
        id: assignmentId,
        status: 'pending',
        team_members: { user_id: 'user-1' },
      },
      error: null,
    });

    const response = await POST(declineRequest(assignmentId, 'test-token'), {
      params: Promise.resolve({ assignmentId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(fake.operationsFor('service_assignments')).toContainEqual({
      table: 'service_assignments',
      method: 'update',
      args: [{ status: 'declined' }],
    });
  });
});
