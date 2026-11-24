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

function completeRequest(token?: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/church/onboarding-complete', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function authenticate(
  options: { id?: string; role?: string; churchId?: string } = {}
) {
  const id = options.id ?? 'user-1';
  fake.auth.getUser.mockResolvedValue({
    data: { user: { id, email: `${id}@example.com` } },
    error: null,
  });
  fake.setTableResult('users', {
    data: {
      id,
      role: options.role ?? 'admin',
      church_id: options.churchId ?? 'church-1',
    },
    error: null,
  });
}

beforeEach(() => {
  fake.reset();
});

describe('POST /api/church/onboarding-complete', () => {
  it('returns 401 without authentication', async () => {
    const response = await POST(completeRequest());

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('rejects non-admin users without touching churches', async () => {
    authenticate({ role: 'leader' });

    const response = await POST(completeRequest('test-token'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Admin only' });
    expect(fake.operationsFor('churches')).toHaveLength(0);
  });

  it("sets the timestamp for the caller's church only", async () => {
    authenticate({ churchId: 'church-1' });
    fake.setTableResult('churches', {
      data: {
        id: 'church-1',
        onboarding_completed_at: '2026-11-24T10:00:00.000Z',
      },
      error: null,
    });

    // A foreign church id in the body must be ignored.
    const response = await POST(
      completeRequest('test-token', { churchId: 'church-2' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      church_id: 'church-1',
      onboarding_completed_at: '2026-11-24T10:00:00.000Z',
    });

    const churchOps = fake.operationsFor('churches');
    const update = churchOps.find((operation) => operation.method === 'update');
    expect(update?.args[0]).toMatchObject({
      onboarding_completed_at: expect.any(String),
    });

    const filters = churchOps.filter((operation) => operation.method === 'eq');
    expect(filters).toContainEqual({
      table: 'churches',
      method: 'eq',
      args: ['id', 'church-1'],
    });
    expect(
      filters.some((operation) => operation.args[1] === 'church-2')
    ).toBe(false);
  });

  it('returns 400 when the caller has no church context', async () => {
    authenticate({ churchId: '' });

    const response = await POST(completeRequest('test-token'));

    expect(response.status).toBe(400);
    expect(fake.operationsFor('churches')).toHaveLength(0);
  });
});
