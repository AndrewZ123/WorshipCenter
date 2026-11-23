import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { sendEmail } from '@/lib/email';
import { POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  isEmailConfigured: vi.fn(async () => true),
  sendEmail: vi.fn(async () => ({ success: true, messageId: 'test-message' })),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const teamMemberId = '00000000-0000-4000-8000-000000000001';
const churchId = '00000000-0000-4000-8000-000000000010';

function invitationRequest(token?: string): NextRequest {
  return new NextRequest('http://localhost/api/notifications/send-team-invitation', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ teamMemberId, churchId }),
  });
}

beforeEach(() => {
  fake.reset();
  vi.mocked(sendEmail).mockClear();
  fake.setTableResult('subscriptions', {
    data: { status: 'active', trial_end: null, current_period_end: null },
    error: null,
  });
});

describe('POST /api/notifications/send-team-invitation', () => {
  it('returns 401 without authentication', async () => {
    const response = await POST(invitationRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('reaches the handler for an authenticated same-church user', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user-1@example.test' } },
      error: null,
    });
    fake.setTableResult('users', {
      data: {
        id: 'user-1',
        email: 'user-1@example.test',
        role: 'admin',
        church_id: churchId,
      },
      error: null,
    });
    fake.setTableResult('team_members', {
      data: {
        id: teamMemberId,
        church_id: churchId,
        name: 'Test Member',
        email: 'member@example.test',
        user_id: null,
      },
      error: null,
    });
    fake.setTableResult('churches', {
      data: { id: churchId, name: 'Test Church' },
      error: null,
    });

    const response = await POST(invitationRequest('test-token'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      emailSent: true,
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
