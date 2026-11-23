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

const churchId = '00000000-0000-4000-8000-000000000030';
const otherChurchId = '00000000-0000-4000-8000-000000000031';
const serviceId = '00000000-0000-4000-8000-000000000032';

const validBody = {
  serviceId,
  churchId,
  serviceTitle: 'Sunday Worship',
  serviceDate: '2026-12-06',
  serviceTime: '10:00',
};

function reminderRequest(
  body: Record<string, unknown>,
  token?: string
): NextRequest {
  return new NextRequest('http://localhost/api/notifications/send-reminder', {
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

describe('POST /api/notifications/send-reminder', () => {
  it('returns 401 without authentication and sends no email', async () => {
    const response = await POST(reminderRequest(validBody));

    expect(response.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid body after authentication', async () => {
    authenticateAsChurchAdmin();

    const response = await POST(
      reminderRequest(
        { ...validBody, serviceId: 'not-a-uuid' },
        'test-token'
      )
    );

    expect(response.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller posts another church id', async () => {
    authenticateAsChurchAdmin();

    const response = await POST(
      reminderRequest({ ...validBody, churchId: otherChurchId }, 'test-token')
    );

    expect(response.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
