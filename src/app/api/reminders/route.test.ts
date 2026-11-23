import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { GET, POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

function reminderRequest(
  url = 'http://localhost/api/reminders',
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(url, { headers });
}

beforeEach(() => {
  fake.reset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('/api/reminders cron auth', () => {
  it('fails closed in production when CRON_SECRET is unset', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CRON_SECRET', '');

    const response = await GET(reminderRequest());

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('denies a missing bearer token when a secret is configured', async () => {
    vi.stubEnv('CRON_SECRET', 'test-cron-secret');

    const response = await GET(reminderRequest());

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('denies a wrong bearer token', async () => {
    vi.stubEnv('CRON_SECRET', 'test-cron-secret');

    const response = await POST(
      reminderRequest('http://localhost/api/reminders', {
        authorization: 'Bearer wrong-secret',
      })
    );

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('denies a wrong query secret in a production-like environment', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CRON_SECRET', 'test-cron-secret');

    const response = await GET(
      reminderRequest('http://localhost/api/reminders?secret=wrong-secret')
    );

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns nested counts for every reminder kind', async () => {
    vi.stubEnv('CRON_SECRET', 'test-cron-secret');

    const response = await GET(
      reminderRequest('http://localhost/api/reminders', {
        authorization: 'Bearer test-cron-secret',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.reminders.unconfirmed).toMatchObject({ checked: 0, sent: 0 });
    expect(body.reminders.initial).toEqual({
      checked: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    });
    expect(body.reminders.preService.sent).toBe(0);
    expect(body.reminders.preRehearsal.sent).toBe(0);
    expect(body.reminders.escalation).toEqual({
      services: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    });
  });
});
