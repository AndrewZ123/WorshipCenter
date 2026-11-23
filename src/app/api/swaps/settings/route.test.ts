import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { GET, PATCH } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  isEmailConfigured: vi.fn().mockResolvedValue(false),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

function authAs(role = 'leader', churchId = 'church-1') {
  fake.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user@example.test' } },
    error: null,
  });
  fake.setTableResult('users', {
    data: { id: 'user-1', role, church_id: churchId, email: 'user@example.test' },
    error: null,
  });
  fake.setTableResult('subscriptions', {
    data: { status: 'active', trial_end: null, current_period_end: null },
    error: null,
  });
}

function request(method: 'GET' | 'PATCH', body?: unknown, token = 'test-token') {
  return new NextRequest('http://localhost/api/swaps/settings', {
    method,
    headers: { authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  fake.reset();
});

describe('/api/swaps/settings', () => {
  it('returns 401 without a Bearer token', async () => {
    const response = await GET(request('GET', undefined, ''));
    expect(response.status).toBe(401);
  });

  it('returns the church setting (default false)', async () => {
    authAs('team');
    fake.setTableResult('church_settings', { data: null, error: null });

    const response = await GET(request('GET'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      autoApproveSwaps: false,
      canManage: false,
    });
  });

  it('forbids volunteers from changing the setting', async () => {
    authAs('team');

    const response = await PATCH(request('PATCH', { autoApproveSwaps: true }));
    expect(response.status).toBe(403);
    expect(
      fake.operationsFor('church_settings').some((op) => op.method === 'upsert')
    ).toBe(false);
  });

  it('lets a leader enable auto-approve for the caller church', async () => {
    authAs('leader');
    fake.setTableResult('church_settings', { data: null, error: null });

    const response = await PATCH(request('PATCH', { autoApproveSwaps: true }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ autoApproveSwaps: true });

    const upsert = fake
      .operationsFor('church_settings')
      .find((op) => op.method === 'upsert');
    expect(upsert?.args[0]).toMatchObject({
      church_id: 'church-1',
      auto_approve_swaps: true,
    });
  });
});
