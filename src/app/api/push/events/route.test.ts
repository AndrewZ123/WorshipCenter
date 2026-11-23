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
const serviceId = '00000000-0000-4000-8000-000000000004';
const messageId = '00000000-0000-4000-8000-000000000005';

const serviceFixture = {
  id: serviceId,
  title: 'Sunday Worship',
  date: '2026-12-06',
  time: '10:00',
  church_id: 'church-1',
};

const assignmentFixture = {
  id: assignmentId,
  role: 'vocals',
  service_id: serviceId,
  team_member_id: 'member-1',
  services: serviceFixture,
  team_members: { user_id: 'user-2', name: 'Jane Doe' },
};

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

function authenticate(role = 'leader', options?: { mentionUsers?: boolean }) {
  let usersCalls = 0;

  fake.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user-1@example.test' } },
    error: null,
  });
  fake.setTableResult('users', () => {
    usersCalls += 1;
    if (options?.mentionUsers && usersCalls > 2) {
      return {
        data: [
          { id: 'user-1', name: 'Test Sender' },
          { id: 'user-2', name: 'Jane Doe' },
        ],
        error: null,
      };
    }
    return {
      data: { id: 'user-1', role, church_id: 'church-1' },
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

  it.each([
    {
      event: 'schedule_changed',
      body: { type: 'schedule_changed', serviceId },
    },
    {
      event: 'assignment_created',
      body: { type: 'assignment_created', assignmentId },
    },
  ])('forbids volunteers from sending $event', async ({ body }) => {
    authenticate('team');
    vi.mocked(isPushConfigured).mockReturnValue(true);

    const response = await POST(eventRequest(body, 'test-token'));

    expect(response.status).toBe(403);
    expect(sendPushNotification).not.toHaveBeenCalled();
    expect(fake.operationsFor('service_assignments')).toHaveLength(0);
    expect(fake.operationsFor('services')).toHaveLength(0);
  });

  it.each([
    {
      role: 'leader',
      event: 'schedule_changed',
      body: { type: 'schedule_changed', serviceId },
    },
    {
      role: 'admin',
      event: 'schedule_changed',
      body: { type: 'schedule_changed', serviceId },
    },
    {
      role: 'leader',
      event: 'assignment_created',
      body: { type: 'assignment_created', assignmentId },
    },
    {
      role: 'admin',
      event: 'assignment_created',
      body: { type: 'assignment_created', assignmentId },
    },
  ])('allows $role to send $event', async ({ role, event, body }) => {
    authenticate(role);
    vi.mocked(isPushConfigured).mockReturnValue(true);

    if (event === 'schedule_changed') {
      fake.setTableResult('services', { data: serviceFixture, error: null });
      fake.setTableResult('service_assignments', {
        data: [{ id: assignmentId, role: 'vocals', team_members: { user_id: 'user-2' } }],
        error: null,
      });
    } else {
      fake.setTableResult('service_assignments', { data: assignmentFixture, error: null });
    }

    const response = await POST(eventRequest(body, 'test-token'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, notified: 1 });
  });

  it('notifies mentioned users but never the message sender', async () => {
    authenticate('team', { mentionUsers: true });
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
