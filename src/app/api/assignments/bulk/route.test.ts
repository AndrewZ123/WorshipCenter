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
});
