import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { POST } from './route';
import { isPushConfigured, sendPushNotification } from '@/lib/push';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/push', () => ({
  isPushConfigured: vi.fn(() => false),
  sendPushNotification: vi.fn(async () => ({ success: true, sent: 1, errors: [] })),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const assignmentId = '00000000-0000-4000-8000-000000000003';
const messageId = '00000000-0000-4000-8000-000000000005';

function eventRequest(body: Record<string, unknown>, token?: string): NextRequest {
  return new NextRequest('http://localhost/api/push/events', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function authenticate(role = 'leader') {
  let usersCalls = 0;

  fake.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user-1@example.test' } },
    error: null,
  });
  fake.setTableResult('users', () => {
    usersCalls += 1;
    if (usersCalls <= 2) {
      return {
        data: { id: 'user-1', role, church_id: 'church-1' },
        error: null,
      };
    }
    return {
      data: [
        { id: 'user-1', name: 'Test Sender' },
        { id: 'user-2', name: 'Jane Doe' },
      ],
      error: null,
    };
  });
  fake.setTableResult('subscriptions', {
    data: { status: 'active', trial_end: null, current_period_end: null },
    error: null,
  });
}

beforeEach(() => {
  fake.reset();
  vi.mocked(isPushConfigured).mockReturnValue(false);
  vi.mocked(sendPushNotification).mockClear();
});

describe('POST /api/push/events', () => {
  it('returns 401 without authentication', async () => {
    const response = await POST(
      eventRequest({ type: 'assignment_created', assignmentId })
    );

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 400 for an unknown event after authentication', async () => {
    authenticate();

    const response = await POST(
      eventRequest({ type: 'something_else' }, 'test-token')
    );

    expect(response.status).toBe(400);
    expect(
      fake.operationsFor('service_assignments').some((op) => op.method === 'select')
    ).toBe(false);
  });

  it('is a no-op when push is not configured', async () => {
    authenticate();

    const response = await POST(
      eventRequest({ type: 'assignment_created', assignmentId }, 'test-token')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      skipped: 'not_configured',
    });
    expect(fake.operationsFor('service_assignments')).toHaveLength(0);
    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it('forbids non-leaders from triggering assignment events', async () => {
    authenticate('team');
    vi.mocked(isPushConfigured).mockReturnValue(true);

    const response = await POST(
      eventRequest({ type: 'assignment_created', assignmentId }, 'test-token')
    );

    expect(response.status).toBe(403);
    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it('notifies mentioned users but never the message sender', async () => {
    authenticate('team');
    vi.mocked(isPushConfigured).mockReturnValue(true);
    fake.setTableResult('chat_messages', {
      data: {
        id: messageId,
        user_id: 'user-1',
        content: 'Thanks @Jane Doe for covering',
        channel_id: 'channel-1',
        church_id: 'church-1',
      },
      error: null,
    });

    const response = await POST(
      eventRequest({ type: 'mention', messageId, kind: 'channel' }, 'test-token')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, notified: 1 });
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    expect(sendPushNotification).toHaveBeenCalledWith(
      'user-2',
      expect.objectContaining({
        title: 'Mentioned in chat',
        data: { url: '/chat?channel=channel-1' },
      })
    );
  });
});
