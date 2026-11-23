import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import {
  reminderKindForServiceDate,
  reminderTargetDates,
  sendEscalations,
  sendInitialReminders,
  sendPreServiceReminders,
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
      { id: 'member-1', name: 'Ada Example', email: 'ada@example.com', user_id: 'user-ada' },
      { id: 'member-2', name: 'Ben Example', email: 'ben@example.com', user_id: 'user-ben' },
      { id: 'member-3', name: 'No Email', email: '', user_id: 'user-no-email' },
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
  vi.mocked(isEmailConfigured).mockResolvedValue(true);
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

  it('skips volunteers who opted out of email reminders', async () => {
    seedReminderData();
    fake.setTableResult('user_notification_preferences', {
      data: [{ user_id: 'user-ada', email_reminders: false }],
      error: null,
    });

    const counts = await sendUnconfirmedResponseReminders(now);

    expect(counts.sent).toBe(1);
    expect(counts.skipped).toBe(2);
    expect(counts.threeDay).toBe(0);
    expect(counts.oneDay).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail).mock.calls[0][0].to).toBe('ben@example.com');
  });

  it('still sends to volunteers with no preference row', async () => {
    seedReminderData();
    fake.setTableResult('user_notification_preferences', { data: [], error: null });

    const counts = await sendUnconfirmedResponseReminders(now);

    expect(counts.sent).toBe(2);
    expect(sendEmail).toHaveBeenCalledTimes(2);
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

  it('retries response token creation before sending each reminder', async () => {
    seedReminderData();
    let attempts = 0;
    fake.setTableResult('assignment_response_tokens', () => {
      attempts += 1;
      return attempts === 1
        ? { data: null, error: { message: 'transient failure' } }
        : { data: null, error: null };
    });

    const counts = await sendUnconfirmedResponseReminders(now);

    expect(counts.sent).toBe(2);
    expect(counts.failed).toBe(0);
    expect(attempts).toBe(3);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('counts a reminder as failed and leaves the ledger untouched when token creation keeps failing', async () => {
    seedReminderData();
    let attempts = 0;
    fake.setTableResult('assignment_response_tokens', () => {
      attempts += 1;
      return { data: null, error: { message: 'still failing' } };
    });

    const counts = await sendUnconfirmedResponseReminders(now);

    expect(counts.sent).toBe(0);
    expect(counts.failed).toBe(2);
    expect(attempts).toBe(4);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(
      fake
        .operationsFor('assignment_reminders_sent')
        .filter((operation) => operation.method === 'insert')
    ).toHaveLength(0);
  });
});

describe('sendInitialReminders', () => {
  const initialService = {
    id: 'svc-initial',
    title: 'Sunday Gathering',
    date: '2026-12-10',
    time: '10:00',
    status: 'finalized',
    church_id: churchId,
  };

  function seedInitial(options: {
    service?: Record<string, unknown>;
    assignment?: Record<string, unknown>;
    ledger?: Array<{ assignment_id: string; kind: string }>;
    member?: Record<string, unknown>;
  } = {}) {
    fake.setTableResult('services', {
      data: [options.service || initialService],
      error: null,
    });
    fake.setTableResult('service_assignments', {
      data: [
        options.assignment || {
          id: 'a-initial',
          service_id: 'svc-initial',
          team_member_id: 'member-1',
          role: 'vocals',
          status: 'pending',
          created_at: '2026-11-29T00:00:00.000Z',
        },
      ],
      error: null,
    });
    fake.setTableResult('assignment_reminders_sent', {
      data: options.ledger || [],
      error: null,
    });
    fake.setTableResult('team_members', {
      data: [
        options.member || {
          id: 'member-1',
          name: 'Ada Example',
          email: 'ada@example.com',
        },
      ],
      error: null,
    });
    fake.setTableResult('churches', {
      data: [{ id: churchId, name: 'Example Church' }],
      error: null,
    });
    fake.setTableResult('assignment_response_tokens', { data: null, error: null });
  }

  it('sends an initial reminder for a pending assignment older than 48 hours', async () => {
    seedInitial();

    const counts = await sendInitialReminders(now);

    expect(counts).toEqual({ checked: 1, sent: 1, skipped: 0, failed: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = vi.mocked(sendEmail).mock.calls[0][0];
    expect(email.to).toBe('ada@example.com');
    expect(email.html).toContain('/respond?t=');
    expect(email.html).toContain('a=confirm');

    const sentInserts = fake
      .operationsFor('assignment_reminders_sent')
      .filter((operation) => operation.method === 'insert');
    expect(sentInserts.map((operation) => operation.args[0])).toEqual([
      { assignment_id: 'a-initial', kind: 'initial' },
    ]);
  });

  it('skips assignments created less than 48 hours ago', async () => {
    seedInitial({
      assignment: {
        id: 'a-initial',
        service_id: 'svc-initial',
        team_member_id: 'member-1',
        role: 'vocals',
        status: 'pending',
        created_at: '2026-12-01T06:00:00.000Z',
      },
    });

    const counts = await sendInitialReminders(now);

    expect(counts.sent).toBe(0);
    expect(counts.skipped).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips an assignment that already has an initial reminder', async () => {
    seedInitial({ ledger: [{ assignment_id: 'a-initial', kind: 'initial' }] });

    const counts = await sendInitialReminders(now);

    expect(counts.sent).toBe(0);
    expect(counts.skipped).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips when a 3d or 1d reminder was already recorded', async () => {
    seedInitial({ ledger: [{ assignment_id: 'a-initial', kind: '3d' }] });

    const counts = await sendInitialReminders(now);

    expect(counts.sent).toBe(0);
    expect(counts.skipped).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips services inside the 3-day / 1-day window', async () => {
    seedInitial({
      service: { ...initialService, date: '2026-12-04' },
    });

    const counts = await sendInitialReminders(now);

    expect(counts.sent).toBe(0);
    expect(counts.skipped).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips volunteers without an email address', async () => {
    seedInitial({
      member: { id: 'member-1', name: 'No Email', email: '' },
    });

    const counts = await sendInitialReminders(now);

    expect(counts.sent).toBe(0);
    expect(counts.skipped).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not send when email is not configured', async () => {
    seedInitial();
    vi.mocked(isEmailConfigured).mockResolvedValue(false);

    const counts = await sendInitialReminders(now);

    expect(counts.sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(fake.operationsFor('assignment_reminders_sent').filter(
      (operation) => operation.method === 'insert'
    )).toHaveLength(0);
  });
});

describe('sendPreServiceReminders', () => {
  function seedPreService(options: {
    service?: Record<string, unknown>;
    assignments?: Array<Record<string, unknown>>;
    ledger?: Array<{ assignment_id: string; kind: string }>;
  } = {}) {
    fake.setTableResult('services', {
      data: [
        options.service || {
          id: 'svc-soon',
          title: 'Sunday Gathering',
          date: '2026-12-02',
          time: '10:00',
          status: 'finalized',
          church_id: churchId,
        },
      ],
      error: null,
    });
    fake.setTableResult('service_assignments', {
      data: options.assignments || [
        {
          id: 'a-confirmed',
          service_id: 'svc-soon',
          team_member_id: 'member-1',
          role: 'vocals',
          status: 'confirmed',
        },
        {
          id: 'a-pending',
          service_id: 'svc-soon',
          team_member_id: 'member-2',
          role: 'guitar',
          status: 'pending',
        },
      ],
      error: null,
    });
    fake.setTableResult('assignment_reminders_sent', {
      data: options.ledger || [],
      error: null,
    });
    fake.setTableResult('team_members', {
      data: [
        { id: 'member-1', name: 'Ada Example', email: 'ada@example.com' },
        { id: 'member-2', name: 'Ben Example', email: 'ben@example.com' },
      ],
      error: null,
    });
    fake.setTableResult('churches', {
      data: [{ id: churchId, name: 'Example Church' }],
      error: null,
    });
    fake.setTableResult('assignment_response_tokens', { data: null, error: null });
  }

  it('sends to confirmed and pending volunteers inside the window', async () => {
    seedPreService();

    const counts = await sendPreServiceReminders(now);

    expect(counts.preService).toEqual({ checked: 2, sent: 2, skipped: 0, failed: 0 });
    expect(counts.preRehearsal.sent).toBe(0);
    expect(sendEmail).toHaveBeenCalledTimes(2);

    const emails = vi.mocked(sendEmail).mock.calls.map((call) => call[0]);
    const confirmedEmail = emails.find((email) => email.to === 'ada@example.com')!;
    const pendingEmail = emails.find((email) => email.to === 'ben@example.com')!;

    expect(confirmedEmail.html).not.toContain('/respond?t=');
    expect(pendingEmail.html).toContain('/respond?t=');
    expect(pendingEmail.html).toContain('a=confirm');

    const sentInserts = fake
      .operationsFor('assignment_reminders_sent')
      .filter((operation) => operation.method === 'insert');
    expect(sentInserts.map((operation) => operation.args[0])).toEqual([
      { assignment_id: 'a-confirmed', kind: 'pre_service' },
      { assignment_id: 'a-pending', kind: 'pre_service' },
    ]);
  });

  it('skips assignments that were already reminded', async () => {
    seedPreService({
      ledger: [{ assignment_id: 'a-confirmed', kind: 'pre_service' }],
    });

    const counts = await sendPreServiceReminders(now);

    expect(counts.preService.sent).toBe(1);
    expect(counts.preService.skipped).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail).mock.calls[0][0].to).toBe('ben@example.com');
  });

  it('skips completed and past services', async () => {
    seedPreService({
      service: {
        id: 'svc-soon',
        title: 'Completed Gathering',
        date: '2026-12-02',
        time: '10:00',
        status: 'completed',
        church_id: churchId,
      },
    });

    const completed = await sendPreServiceReminders(now);
    expect(completed.preService.sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();

    seedPreService({
      service: {
        id: 'svc-soon',
        title: 'Past Gathering',
        date: '2026-11-30',
        time: '10:00',
        status: 'finalized',
        church_id: churchId,
      },
    });

    const past = await sendPreServiceReminders(now);
    expect(past.preService.sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not send when email is not configured', async () => {
    seedPreService();
    vi.mocked(isEmailConfigured).mockResolvedValue(false);

    const counts = await sendPreServiceReminders(now);

    expect(counts.preService.sent).toBe(0);
    expect(counts.preRehearsal.sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('pre-rehearsal reminders', () => {
  function seedPreRehearsal(options: {
    rehearsalTime?: string | null;
    status?: string;
    ledger?: Array<{ assignment_id: string; kind: string }>;
  } = {}) {
    fake.setTableResult('services', {
      data: [
        {
          id: 'svc-rehearsal',
          title: 'Sunday Gathering',
          date: '2026-12-04',
          time: '10:00',
          status: 'finalized',
          church_id: churchId,
          rehearsal_time: options.rehearsalTime ?? '2026-12-02T08:00:00.000Z',
        },
      ],
      error: null,
    });
    fake.setTableResult('service_assignments', {
      data: [
        {
          id: 'a-rehearsal',
          service_id: 'svc-rehearsal',
          team_member_id: 'member-1',
          role: 'vocals',
          status: options.status || 'confirmed',
        },
      ],
      error: null,
    });
    fake.setTableResult('assignment_reminders_sent', {
      data: options.ledger || [],
      error: null,
    });
    fake.setTableResult('team_members', {
      data: [{ id: 'member-1', name: 'Ada Example', email: 'ada@example.com' }],
      error: null,
    });
    fake.setTableResult('churches', {
      data: [{ id: churchId, name: 'Example Church' }],
      error: null,
    });
    fake.setTableResult('assignment_response_tokens', { data: null, error: null });
  }

  it('sends only when the rehearsal time is parseable and inside the window', async () => {
    seedPreRehearsal();

    const counts = await sendPreServiceReminders(now);

    expect(counts.preRehearsal).toEqual({ checked: 1, sent: 1, skipped: 0, failed: 0 });
    expect(counts.preService.sent).toBe(0);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail).mock.calls[0][0].subject).toContain('rehearsal');
  });

  it('includes response links for pending volunteers', async () => {
    seedPreRehearsal({ status: 'pending' });

    await sendPreServiceReminders(now);

    const email = vi.mocked(sendEmail).mock.calls[0][0];
    expect(email.html).toContain('/respond?t=');
    expect(email.html).toContain('a=confirm');
  });

  it('skips an unparseable rehearsal time', async () => {
    seedPreRehearsal({ rehearsalTime: 'not-a-time' });

    const counts = await sendPreServiceReminders(now);

    expect(counts.preRehearsal.checked).toBe(0);
    expect(counts.preRehearsal.sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips when the rehearsal reminder was already sent', async () => {
    seedPreRehearsal({
      ledger: [{ assignment_id: 'a-rehearsal', kind: 'pre_rehearsal' }],
    });

    const counts = await sendPreServiceReminders(now);

    expect(counts.preRehearsal.sent).toBe(0);
    expect(counts.preRehearsal.skipped).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('sendEscalations', () => {
  const escalationService = {
    id: 'svc-escalate',
    title: 'Sunday Gathering',
    date: '2026-12-02',
    time: '10:00',
    status: 'finalized',
    church_id: churchId,
    created_by: null,
  };

  function seedEscalation(options: {
    service?: Record<string, unknown>;
    assignments?: Array<Record<string, unknown>>;
    ledger?: Array<{ assignment_id: string; kind: string }>;
    users?: Array<Record<string, unknown>>;
    members?: Array<Record<string, unknown>>;
  } = {}) {
    fake.setTableResult('services', {
      data: [options.service || escalationService],
      error: null,
    });
    fake.setTableResult('service_assignments', {
      data: options.assignments || [
        {
          id: 'a-pending',
          service_id: 'svc-escalate',
          team_member_id: 'member-1',
          role: 'vocals',
          status: 'pending',
        },
      ],
      error: null,
    });
    fake.setTableResult('assignment_reminders_sent', {
      data: options.ledger || [],
      error: null,
    });
    fake.setTableResult('team_members', {
      data: options.members || [
        { id: 'member-1', name: 'Ada Example', email: 'ada@example.com' },
        { id: 'member-2', name: 'Ben Example', email: 'ben@example.com' },
      ],
      error: null,
    });
    fake.setTableResult('churches', {
      data: [{ id: churchId, name: 'Example Church' }],
      error: null,
    });
    fake.setTableResult('users', {
      data: options.users || [
        {
          id: 'user-admin',
          name: 'Admin Example',
          email: 'admin@example.com',
          role: 'admin',
          church_id: churchId,
        },
        {
          id: 'user-leader',
          name: 'Leader Example',
          email: 'leader@example.com',
          role: 'leader',
          church_id: churchId,
        },
        {
          id: 'user-team',
          name: 'Team Example',
          email: 'team@example.com',
          role: 'team',
          church_id: churchId,
        },
      ],
      error: null,
    });
  }

  it('emails admins and leaders, not team members, with names and roles only', async () => {
    seedEscalation();

    const counts = await sendEscalations(now);

    expect(counts.services).toBe(1);
    expect(counts.sent).toBe(2);
    expect(counts.skipped).toBe(0);
    expect(sendEmail).toHaveBeenCalledTimes(2);

    const emails = vi.mocked(sendEmail).mock.calls.map((call) => call[0]);
    expect(emails.map((email) => email.to).sort()).toEqual([
      'admin@example.com',
      'leader@example.com',
    ]);

    for (const email of emails) {
      expect(email.html).toContain('Ada Example');
      expect(email.html).toContain('Vocals');
      expect(email.html).not.toContain('ada@example.com');
      expect(email.html).toContain('/services/svc-escalate?tab=schedule');
    }

    const sentInserts = fake
      .operationsFor('assignment_reminders_sent')
      .filter((operation) => operation.method === 'insert');
    expect(sentInserts.map((operation) => operation.args[0])).toEqual([
      { assignment_id: 'a-pending', kind: 'escalation' },
    ]);
  });

  it('does not email a team-role service creator', async () => {
    seedEscalation({
      service: { ...escalationService, created_by: 'user-creator' },
      users: [
        {
          id: 'user-admin',
          name: 'Admin Example',
          email: 'admin@example.com',
          role: 'admin',
          church_id: churchId,
        },
        {
          id: 'user-creator',
          name: 'Creator Example',
          email: 'creator@example.com',
          role: 'team',
          church_id: churchId,
        },
      ],
    });

    const counts = await sendEscalations(now);

    expect(counts.sent).toBe(1);
    expect(
      vi.mocked(sendEmail).mock.calls.map((call) => call[0].to)
    ).toEqual(['admin@example.com']);
  });

  it('emails an admin or leader service creator in the same church', async () => {
    seedEscalation({
      service: { ...escalationService, created_by: 'user-creator' },
      users: [
        {
          id: 'user-admin',
          name: 'Admin Example',
          email: 'admin@example.com',
          role: 'admin',
          church_id: churchId,
        },
        {
          id: 'user-creator',
          name: 'Creator Example',
          email: 'creator@example.com',
          role: 'leader',
          church_id: churchId,
        },
      ],
    });

    const counts = await sendEscalations(now);

    expect(counts.sent).toBe(2);
    expect(
      vi.mocked(sendEmail).mock.calls.map((call) => call[0].to).sort()
    ).toEqual(['admin@example.com', 'creator@example.com']);
  });

  it('emails a qualifying creator who was missing from the church user query', async () => {
    const churchUsers = [
      {
        id: 'user-admin',
        name: 'Admin Example',
        email: 'admin@example.com',
        role: 'admin',
        church_id: churchId,
      },
    ];
    seedEscalation({
      service: { ...escalationService, created_by: 'user-creator' },
      users: churchUsers,
    });

    let userQueries = 0;
    fake.setTableResult('users', () => {
      userQueries += 1;
      return {
        data:
          userQueries === 1
            ? churchUsers
            : [
                {
                  id: 'user-creator',
                  name: 'Creator Example',
                  email: 'creator@example.com',
                  role: 'leader',
                  church_id: churchId,
                },
              ],
        error: null,
      };
    });

    const counts = await sendEscalations(now);

    expect(userQueries).toBe(2);
    expect(counts.sent).toBe(2);
    expect(
      vi.mocked(sendEmail).mock.calls.map((call) => call[0].to).sort()
    ).toEqual(['admin@example.com', 'creator@example.com']);
  });

  it('does not email admins or leaders without a church', async () => {
    seedEscalation({
      users: [
        {
          id: 'user-admin',
          name: 'Admin Example',
          email: 'admin@example.com',
          role: 'admin',
          church_id: churchId,
        },
        {
          id: 'user-null-church',
          name: 'Null Church Example',
          email: 'null-church@example.com',
          role: 'admin',
          church_id: null,
        },
        {
          id: 'user-missing-church',
          name: 'Missing Church Example',
          email: 'missing-church@example.com',
          role: 'leader',
        },
      ],
    });

    const counts = await sendEscalations(now);

    expect(counts.sent).toBe(1);
    expect(
      vi.mocked(sendEmail).mock.calls.map((call) => call[0].to)
    ).toEqual(['admin@example.com']);
  });

  it('does not email admins or leaders from a different church', async () => {
    const otherChurchId = '00000000-0000-4000-8000-000000000002';
    seedEscalation({
      users: [
        {
          id: 'user-admin',
          name: 'Admin Example',
          email: 'admin@example.com',
          role: 'admin',
          church_id: churchId,
        },
        {
          id: 'user-other-admin',
          name: 'Other Admin Example',
          email: 'other-admin@example.com',
          role: 'admin',
          church_id: otherChurchId,
        },
        {
          id: 'user-other-leader',
          name: 'Other Leader Example',
          email: 'other-leader@example.com',
          role: 'leader',
          church_id: otherChurchId,
        },
      ],
    });

    const counts = await sendEscalations(now);

    expect(counts.sent).toBe(1);
    expect(
      vi.mocked(sendEmail).mock.calls.map((call) => call[0].to)
    ).toEqual(['admin@example.com']);
  });

  it('is idempotent on a second run', async () => {
    seedEscalation();

    await sendEscalations(now);
    const sentRows = fake
      .operationsFor('assignment_reminders_sent')
      .filter((operation) => operation.method === 'insert')
      .map((operation) => operation.args[0] as { assignment_id: string; kind: string });
    fake.setTableResult('assignment_reminders_sent', { data: sentRows, error: null });
    vi.mocked(sendEmail).mockClear();

    const second = await sendEscalations(now);

    expect(second.sent).toBe(0);
    expect(second.skipped).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends again when a new pending assignment appears, listing all pending members', async () => {
    seedEscalation({
      ledger: [{ assignment_id: 'a-pending', kind: 'escalation' }],
      assignments: [
        {
          id: 'a-pending',
          service_id: 'svc-escalate',
          team_member_id: 'member-1',
          role: 'vocals',
          status: 'pending',
        },
        {
          id: 'a-new',
          service_id: 'svc-escalate',
          team_member_id: 'member-2',
          role: 'guitar',
          status: 'pending',
        },
      ],
    });

    const counts = await sendEscalations(now);

    expect(counts.sent).toBe(2);
    expect(sendEmail).toHaveBeenCalledTimes(2);

    const email = vi.mocked(sendEmail).mock.calls[0][0];
    expect(email.html).toContain('Ada Example');
    expect(email.html).toContain('Ben Example');

    const sentInserts = fake
      .operationsFor('assignment_reminders_sent')
      .filter((operation) => operation.method === 'insert');
    expect(sentInserts.map((operation) => operation.args[0])).toEqual([
      { assignment_id: 'a-new', kind: 'escalation' },
    ]);
  });

  it('skips and does not mark when no admin or leader has an email', async () => {
    seedEscalation({
      users: [
        {
          id: 'user-team',
          name: 'Team Example',
          email: 'team@example.com',
          role: 'team',
          church_id: churchId,
        },
      ],
    });

    const counts = await sendEscalations(now);

    expect(counts.sent).toBe(0);
    expect(counts.skipped).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(fake.operationsFor('assignment_reminders_sent').filter(
      (operation) => operation.method === 'insert'
    )).toHaveLength(0);
  });

  it('does not send when email is not configured', async () => {
    seedEscalation();
    vi.mocked(isEmailConfigured).mockResolvedValue(false);

    const counts = await sendEscalations(now);

    expect(counts.sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(fake.operationsFor('assignment_reminders_sent').filter(
      (operation) => operation.method === 'insert'
    )).toHaveLength(0);
  });
});
