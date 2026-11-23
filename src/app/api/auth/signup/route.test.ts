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

const authUserId = '00000000-0000-4000-8000-000000000010';

function signupRequest(
  body: Record<string, unknown>,
  ip = '203.0.113.10'
): NextRequest {
  return new NextRequest('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  fake.reset();
});

describe('POST /api/auth/signup', () => {
  it('returns 400 for an invalid email and creates nothing', async () => {
    const response = await POST(
      signupRequest(
        {
          churchName: 'Grace Church',
          userName: 'Test User',
          email: 'not-an-email',
          password: 'secret123',
          authUserId,
        },
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

  it('creates the church and admin profile for a valid public signup', async () => {
    fake.setTableResult('churches', {
      data: { id: 'church-1' },
      error: null,
    });

    const response = await POST(
      signupRequest(
        {
          churchName: 'Grace Church',
          userName: 'Test User',
          email: 'User@Example.test',
          password: 'secret123',
          authUserId,
        },
        '203.0.113.13'
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      church_id: 'church-1',
    });

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
          id: authUserId,
          church_id: 'church-1',
          name: 'Test User',
          email: 'user@example.test',
          role: 'admin',
        },
      ],
    });
  });
});
