import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/notifications', () => ({
  sendAssignmentNotification: vi.fn(),
}));
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
  isEmailConfigured: vi.fn(async () => false),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const validBody = {
  serviceId: '00000000-0000-4000-8000-000000000001',
  assignments: [
    { team_member_id: '00000000-0000-4000-8000-000000000002' },
  ],
};

function bulkRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/assignments/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(validBody),
  });
}

beforeEach(() => {
  fake.reset();
});

describe('POST /api/assignments/bulk', () => {
  it('returns 401 without a Bearer token', async () => {
    const response = await POST(bulkRequest({}));

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 401 when the Bearer token is invalid', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid JWT' },
    });

    const response = await POST(
      bulkRequest({ authorization: 'Bearer not-a-real-token' })
    );

    expect(response.status).toBe(401);
    expect(fake.auth.getUser).toHaveBeenCalledWith('not-a-real-token');
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 402 when the church subscription has expired', async () => {
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
    fake.setTableResult('subscriptions', {
      data: {
        status: 'trialing',
        trial_end: '2020-01-01T00:00:00.000Z',
        current_period_end: null,
      },
      error: null,
    });

    const response = await POST(
      bulkRequest({ authorization: 'Bearer test-token' })
    );

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Subscription required',
    });
  });
});
