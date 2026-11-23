import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { sendEmail } from '@/lib/email';
import {
  reminderKindForServiceDate,
  reminderTargetDates,
  sendUnconfirmedResponseReminders,
} from './reminders';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  isEmailConfigured: vi.fn(async () => true),
  sendEmail: vi.fn(async () => ({ success: true, messageId: 'test-message' })),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const churchId = '00000000-0000-4000-8000-000000000001';
const now = new Date('2026-12-01T12:00:00.000Z');

function seedReminderData() {
  fake.setTableResult('services', {
    data: [
      {
        id: 'svc-3d',
        title: 'Sunday Worship',
        date: '2026-12-04',
        time: '10:00',
        church_id: churchId,
      },
      {
        id: 'svc-1d',
        title: 'Midweek Prayer',
        date: '2026-12-02',
        time: '19:00',
        church_id: churchId,
      },
      {
        id: 'svc-2d',
        title: 'Ignored Service',
        date: '2026-12-03',
        time: '09:00',
        church_id: churchId,
      },
    ],
    error: null,
  });

  fake.setTableResult('service_assignments', {
    data: [
      {
        id: 'a-3d',
        service_id: 'svc-3d',
        team_member_id: 'member-1',
        role: 'vocals',
        status: 'pending',
      },
      {
        id: 'a-1d',
        service_id: 'svc-1d',
        team_member_id: 'member-2',
        role: 'guitar',
        status: 'pending',
      },
      {
        id: 'a-noemail',
        service_id: 'svc-3d',
        team_member_id: 'member-3',
        role: 'drums',
        status: 'pending',
      },
      {
        id: 'a-confirmed',
        service_id: 'svc-3d',
        team_member_id: 'member-2',
        role: 'keys',
        status: 'confirmed',
      },
      {
        id: 'a-declined',
        service_id: 'svc-1d',
        team_member_id: 'member-1',
        role: 'bass',
        status: 'declined',
      },
      {
        id: 'a-2d',
        service_id: 'svc-2d',
        team_member_id: 'member-2',
        role: 'vocals',
        status: 'pending',
      },
    ],
    error: null,
  });

  fake.setTableResult('assignment_reminders_sent', { data: [], error: null });

  fake.setTableResult('team_members', {
    data: [
      { id: 'member-1', name: 'Ada Example', email: 'ada@example.com' },
      { id: 'member-2', name: 'Ben Example', email: 'ben@example.com' },
      { id: 'member-3', name: 'No Email', email: '' },
    ],
    error: null,
  });

  fake.setTableResult('churches', {
    data: [{ id: churchId, name: 'Example Church' }],
    error: null,
  });

  fake.setTableResult('assignment_response_tokens', { data: null, error: null });
}

beforeEach(() => {
  fake.reset();
  vi.mocked(sendEmail).mockClear();
});

describe('reminder date helpers', () => {
  it('uses UTC calendar days for 3-day and 1-day targets', () => {
    expect(reminderTargetDates(new Date('2026-12-01T23:30:00.000Z'))).toEqual({
      threeDay: '2026-12-04',
      oneDay: '2026-12-02',
    });
    expect(reminderKindForServiceDate('2026-12-04', now)).toBe('3d');
    expect(reminderKindForServiceDate('2026-12-02T00:00:00', now)).toBe('1d');
    expect(reminderKindForServiceDate('2026-12-03', now)).toBeNull();
  });
});

describe('sendUnconfirmedResponseReminders', () => {
  it('picks only pending assignments exactly 3 and 1 days out', async () => {
    seedReminderData();

    const counts = await sendUnconfirmedResponseReminders(now);

    expect(counts).toEqual({
      checked: 3,
      sent: 2,
      skipped: 1,
      failed: 0,
      threeDay: 1,
      oneDay: 1,
    });

    expect(sendEmail).toHaveBeenCalledTimes(2);
    const emails = vi.mocked(sendEmail).mock.calls.map((call) => call[0]);
    expect(emails.map((email) => email.to)).toEqual([
      'ada@example.com',
      'ben@example.com',
    ]);
    expect(emails[0].html).toContain('/respond?t=');
    expect(emails[0].html).toContain('a=confirm');
    expect(emails[0].html).not.toContain('Ben Example');

    const tokenInserts = fake
      .operationsFor('assignment_response_tokens')
      .filter((operation) => operation.method === 'insert');
    expect(tokenInserts).toHaveLength(2);

    const sentInserts = fake
      .operationsFor('assignment_reminders_sent')
      .filter((operation) => operation.method === 'insert');
    expect(sentInserts.map((operation) => operation.args[0])).toEqual([
      { assignment_id: 'a-3d', kind: '3d' },
      { assignment_id: 'a-1d', kind: '1d' },
    ]);
  });

  it('skips assignments that were already reminded', async () => {
    seedReminderData();
    fake.setTableResult('assignment_reminders_sent', {
      data: [
        { assignment_id: 'a-3d', kind: '3d' },
        { assignment_id: 'a-1d', kind: '1d' },
      ],
      error: null,
    });

    const counts = await sendUnconfirmedResponseReminders(now);

    expect(counts.sent).toBe(0);
    expect(counts.skipped).toBe(3);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('is idempotent across runs once sent rows exist', async () => {
    seedReminderData();

    await sendUnconfirmedResponseReminders(now);
    expect(sendEmail).toHaveBeenCalledTimes(2);

    // Simulate the persisted ledger from the first run.
    const sentRows = fake
      .operationsFor('assignment_reminders_sent')
      .filter((operation) => operation.method === 'insert')
      .map((operation) => operation.args[0] as { assignment_id: string; kind: string });
    fake.setTableResult('assignment_reminders_sent', { data: sentRows, error: null });
    vi.mocked(sendEmail).mockClear();

    const second = await sendUnconfirmedResponseReminders(now);

    expect(second.sent).toBe(0);
    expect(second.skipped).toBe(3);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does nothing when the admin client cannot load services', async () => {
    fake.setTableResult('services', { data: null, error: { message: 'boom' } });

    const counts = await sendUnconfirmedResponseReminders(now);

    expect(counts.sent).toBe(0);
    expect(counts.failed).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
