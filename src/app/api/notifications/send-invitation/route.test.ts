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

const churchId = '00000000-0000-4000-8000-000000000010';
const otherChurchId = '00000000-0000-4000-8000-000000000011';
const assignmentId = '00000000-0000-4000-8000-000000000012';

const validBody = {
  assignmentId,
  churchId,
  serviceTitle: 'Sunday Worship',
  serviceDate: '2026-12-06',
  serviceTime: '10:00',
  memberName: 'Test Member',
  memberEmail: 'member@example.test',
  role: 'Vocals',
};

function invitationRequest(
  body: Record<string, unknown>,
  token?: string
): NextRequest {
  return new NextRequest('http://localhost/api/notifications/send-invitation', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function authenticateAsChurchAdmin() {
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

beforeEach(() => {
  fake.reset();
  vi.mocked(sendEmail).mockClear();
});

describe('POST /api/notifications/send-invitation', () => {
  it('returns 401 without authentication and sends no email', async () => {
    const response = await POST(invitationRequest(validBody));

    expect(response.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid body after authentication', async () => {
    authenticateAsChurchAdmin();

    const response = await POST(
      invitationRequest(
        { ...validBody, assignmentId: 'not-a-uuid' },
        'test-token'
      )
    );

    expect(response.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller posts another church id', async () => {
    authenticateAsChurchAdmin();

    const response = await POST(
      invitationRequest({ ...validBody, churchId: otherChurchId }, 'test-token')
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Access denied' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends an invitation for the caller church', async () => {
    authenticateAsChurchAdmin();
    fake.setTableResult('churches', {
      data: { id: churchId, name: 'Test Church' },
      error: null,
    });
    fake.setTableResult('notifications', {
      data: { id: 'notification-1' },
      error: null,
    });

    const response = await POST(invitationRequest(validBody, 'test-token'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      emailSent: true,
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(fake.operationsFor('notifications')).toContainEqual({
      table: 'notifications',
      method: 'insert',
      args: [
        expect.objectContaining({
          church_id: churchId,
          service_id: assignmentId,
        }),
      ],
    });
  });
});
