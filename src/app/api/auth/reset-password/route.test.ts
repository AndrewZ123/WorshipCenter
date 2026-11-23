import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

function resetRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  fake.reset();
  vi.mocked(createClient).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/auth/reset-password', () => {
  it('returns 400 for an invalid email and never calls Supabase auth', async () => {
    const response = await POST(resetRequest({ email: 'not-an-email' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request' });
    expect(createClient).not.toHaveBeenCalled();
    expect(fake.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('returns 400 when the email is missing', async () => {
    const response = await POST(resetRequest({}));

    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('stays public and responds with an enumeration-safe success message', async () => {
    fake.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: null,
    });

    const response = await POST(
      resetRequest({ email: 'User@Example.test' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect(fake.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.test',
      expect.objectContaining({ redirectTo: expect.stringContaining('/new-password') })
    );
  });
});
