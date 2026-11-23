import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { exhaustRateLimit } from '@/test/rate-limit';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import { DELETE } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const assignmentId = '00000000-0000-4000-8000-000000000003';
const serviceId = '00000000-0000-4000-8000-000000000004';

function deleteRequest(id: string, token?: string): NextRequest {
  return new NextRequest(`http://localhost/api/assignments/${id}`, {
    method: 'DELETE',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function authenticateAsChurchAdmin(role = 'admin') {
  fake.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user-1@example.test' } },
    error: null,
  });
  fake.setTableResult('users', {
    data: { id: 'user-1', role, church_id: 'church-1' },
    error: null,
  });
  fake.setTableResult('subscriptions', {
    data: { status: 'active', trial_end: null, current_period_end: null },
    error: null,
  });
}

beforeEach(() => {
  fake.reset();
});

describe('DELETE /api/assignments/[assignmentId]', () => {
  it('returns 401 without a Bearer token', async () => {
    const response = await DELETE(deleteRequest(assignmentId), {
      params: Promise.resolve({ assignmentId }),
    });

    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-UUID assignment id after authentication', async () => {
    authenticateAsChurchAdmin();

    const response = await DELETE(deleteRequest('not-a-uuid', 'test-token'), {
      params: Promise.resolve({ assignmentId: 'not-a-uuid' }),
    });

    expect(response.status).toBe(400);
    expect(fake.operationsFor('service_assignments')).toHaveLength(0);
  });

  it('returns 403 when the assignment belongs to another church', async () => {
    authenticateAsChurchAdmin();
    fake.setTableResult('service_assignments', {
      data: { id: assignmentId, service_id: serviceId },
      error: null,
    });
    // Simulates the church-scoped services lookup returning no row.
    fake.setTableResult('services', { data: null, error: null });

    const response = await DELETE(deleteRequest(assignmentId, 'test-token'), {
      params: Promise.resolve({ assignmentId }),
    });

    expect(response.status).toBe(403);
    expect(
      fake.operationsFor('service_assignments').some((op) => op.method === 'delete')
    ).toBe(false);
  });

  it('returns 403 for team-role callers', async () => {
    authenticateAsChurchAdmin('team');

    const response = await DELETE(deleteRequest(assignmentId, 'test-token'), {
      params: Promise.resolve({ assignmentId }),
    });

    expect(response.status).toBe(403);
    expect(fake.operationsFor('service_assignments')).toHaveLength(0);
  });

  it('deletes an assignment scoped to the caller church', async () => {
    authenticateAsChurchAdmin();
    fake.setTableResult('service_assignments', {
      data: { id: assignmentId, service_id: serviceId },
      error: null,
    });
    fake.setTableResult('services', {
      data: { id: serviceId, church_id: 'church-1' },
      error: null,
    });

    const response = await DELETE(deleteRequest(assignmentId, 'test-token'), {
      params: Promise.resolve({ assignmentId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });

    const operations = fake.operationsFor('service_assignments');
    expect(operations).toContainEqual({
      table: 'service_assignments',
      method: 'delete',
      args: [],
    });
    expect(operations).toContainEqual({
      table: 'service_assignments',
      method: 'eq',
      args: ['id', assignmentId],
    });
    expect(fake.operationsFor('services')).toContainEqual({
      table: 'services',
      method: 'eq',
      args: ['church_id', 'church-1'],
    });
  });

  it('returns 429 once the per-user write limit is exhausted', async () => {
    fake.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-rate-limited', email: 'limited@example.test' } },
      error: null,
    });
    fake.setTableResult('users', {
      data: { id: 'user-rate-limited', role: 'admin', church_id: 'church-1' },
      error: null,
    });
    exhaustRateLimit('assignments-delete:user-rate-limited', RateLimitTiers.API_WRITE);

    const response = await DELETE(deleteRequest(assignmentId, 'test-token'), {
      params: Promise.resolve({ assignmentId }),
    });

    expect(response.status).toBe(429);
    expect(fake.operationsFor('service_assignments')).toHaveLength(0);
    expect(fake.operationsFor('subscriptions')).toHaveLength(0);
  });
});
