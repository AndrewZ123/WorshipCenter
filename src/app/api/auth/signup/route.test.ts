import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const tokenUserId = '00000000-0000-4000-8000-000000000010';
const otherUserId = '00000000-0000-4000-8000-000000000011';
const tokenEmail = 'user@example.test';
const accessToken = 'test-access-token';

function signupRequest(
  body: Record<string, unknown>,
  ip = '203.0.113.10',
  token: string | null = accessToken
): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-for': ip,
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  return new NextRequest('http://localhost/api/auth/signup', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const validBody = {
  churchName: 'Grace Church',
  userName: 'Test User',
  email: tokenEmail,
};

beforeEach(() => {
  fake.reset();
  fake.auth.getUser.mockResolvedValue({
    data: { user: { id: tokenUserId, email: tokenEmail } },
    error: null,
  });
});

describe('POST /api/auth/signup', () => {
  it('returns 401 without a bearer token and creates nothing', async () => {
    const response = await POST(
      signupRequest(validBody, '203.0.113.14', null)
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(fake.auth.getUser).not.toHaveBeenCalled();
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is invalid', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid token' },
    });

    const response = await POST(signupRequest(validBody, '203.0.113.15'));

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid email and creates nothing', async () => {
    const response = await POST(
      signupRequest(
        { ...validBody, email: 'not-an-email' },
        '203.0.113.11'
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request' });
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 400 for a missing body', async () => {
    const response = await POST(signupRequest({}, '203.0.113.12'));

    expect(response.status).toBe(400);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('rejects a body authUserId that differs from the JWT subject', async () => {
    const response = await POST(
      signupRequest(
        { ...validBody, authUserId: otherUserId },
        '203.0.113.16'
      )
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Access denied' });
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('rejects a body email that differs from the JWT email', async () => {
    const response = await POST(
      signupRequest(
        { ...validBody, email: 'other@example.test' },
        '203.0.113.17'
      )
    );

    expect(response.status).toBe(403);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('creates the church and admin profile for the JWT subject', async () => {
    fake.setTableResult('churches', {
      data: { id: 'church-1' },
      error: null,
    });

    const response = await POST(signupRequest(validBody, '203.0.113.13'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      church_id: 'church-1',
    });

    expect(fake.auth.getUser).toHaveBeenCalledWith(accessToken);
    expect(fake.operationsFor('churches')).toContainEqual({
      table: 'churches',
      method: 'insert',
      args: [{ name: 'Grace Church' }],
    });
    expect(fake.operationsFor('users')).toContainEqual({
      table: 'users',
      method: 'insert',
      args: [
        {
          id: tokenUserId,
          church_id: 'church-1',
          name: 'Test User',
          email: tokenEmail,
          role: 'admin',
        },
      ],
    });
    expect(fake.operationsFor('team_members')).toContainEqual({
      table: 'team_members',
      method: 'insert',
      args: [
        {
          church_id: 'church-1',
          name: 'Test User',
          email: tokenEmail,
          phone: '',
          roles: ['Worship Leader'],
          user_id: tokenUserId,
        },
      ],
    });
  });

  it('creates the profile when the body has no password field', async () => {
    fake.setTableResult('churches', {
      data: { id: 'church-passwordless' },
      error: null,
    });

    // The client never posts the password; the schema must keep accepting the
    // request without it.
    const response = await POST(signupRequest(validBody, '203.0.113.18'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      church_id: 'church-passwordless',
    });
    expect(
      fake.operationsFor('users').some((operation) => operation.method === 'insert')
    ).toBe(true);
  });

  it('returns the existing church for an existing profile without inserting another church', async () => {
    let existingProfile: { church_id: string } | null = null;
    fake.setTableResult('users', () => ({ data: existingProfile, error: null }));
    fake.setTableResult('churches', {
      data: { id: 'church-1' },
      error: null,
    });

    const first = await POST(signupRequest(validBody, '203.0.113.19'));
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({
      success: true,
      church_id: 'church-1',
    });

    // Simulate the profile that the first request persisted.
    existingProfile = { church_id: 'church-1' };
    fake.operations.length = 0;

    const second = await POST(signupRequest(validBody, '203.0.113.20'));

    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({
      success: true,
      church_id: 'church-1',
    });
    expect(fake.operationsFor('churches')).toHaveLength(0);
    expect(
      fake.operationsFor('users').some((operation) => operation.method === 'insert')
    ).toBe(false);
  });
});
