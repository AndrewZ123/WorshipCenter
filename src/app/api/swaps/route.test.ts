import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { GET, POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  isEmailConfigured: vi.fn().mockResolvedValue(false),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const assignmentId = '00000000-0000-4000-8000-000000000011';
const serviceId = '00000000-0000-4000-8000-000000000012';
const swapId = '00000000-0000-4000-8000-000000000013';

const callerMember = {
  id: 'tm-1',
  church_id: 'church-1',
  name: 'Alex Volunteer',
  email: 'alex@example.test',
  user_id: 'user-1',
  avatar_url: null,
  roles: ['vocals'],
};

const assignment = {
  id: assignmentId,
  service_id: serviceId,
  team_member_id: 'tm-1',
  role: 'vocals',
  status: 'confirmed',
  services: {
    id: serviceId,
    title: 'Sunday Worship',
    date: '2099-06-14',
    time: '10:00',
    church_id: 'church-1',
  },
};

function authAs(role = 'team', churchId = 'church-1', userId = 'user-1') {
  fake.auth.getUser.mockResolvedValue({
    data: { user: { id: userId, email: 'user@example.test' } },
    error: null,
  });
  fake.setTableResult('users', {
    data: { id: userId, role, church_id: churchId, email: 'user@example.test' },
    error: null,
  });
  fake.setTableResult('subscriptions', {
    data: { status: 'active', trial_end: null, current_period_end: null },
    error: null,
  });
}

function postRequest(body: Record<string, unknown>, token = 'test-token') {
  return new NextRequest('http://localhost/api/swaps', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

function getRequest(path: string, token = 'test-token') {
  return new NextRequest(`http://localhost${path}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  fake.reset();
});

describe('POST /api/swaps', () => {
  it('returns 401 without a Bearer token', async () => {
    const response = await POST(postRequest({ assignmentId }, ''));
    expect(response.status).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller does not own the assignment', async () => {
    authAs();
    fake.setTableResult('team_members', {
      data: { ...callerMember, id: 'tm-other' },
      error: null,
    });
    fake.setTableResult('service_assignments', { data: assignment, error: null });

    const response = await POST(postRequest({ assignmentId }));
    expect(response.status).toBe(403);
    expect(
      fake.operationsFor('assignment_swap_requests').some((op) => op.method === 'insert')
    ).toBe(false);
  });

  it('returns 404 for an assignment in another church', async () => {
    authAs();
    fake.setTableResult('team_members', { data: callerMember, error: null });
    fake.setTableResult('service_assignments', {
      data: {
        ...assignment,
        services: { ...assignment.services, church_id: 'church-2' },
      },
      error: null,
    });

    const response = await POST(postRequest({ assignmentId }));
    expect(response.status).toBe(404);
  });

  it('returns 400 when the service is not upcoming', async () => {
    authAs();
    fake.setTableResult('team_members', { data: callerMember, error: null });
    fake.setTableResult('service_assignments', {
      data: {
        ...assignment,
        services: { ...assignment.services, date: '2000-01-01' },
      },
      error: null,
    });

    const response = await POST(postRequest({ assignmentId }));
    expect(response.status).toBe(400);
  });

  it('returns 409 when an active swap already exists', async () => {
    authAs();
    fake.setTableResult('team_members', { data: callerMember, error: null });
    fake.setTableResult('service_assignments', { data: assignment, error: null });
    fake.setTableResult('assignment_swap_requests', {
      data: { id: swapId },
      error: null,
    });

    const response = await POST(postRequest({ assignmentId }));
    expect(response.status).toBe(409);
  });

  it('creates an open swap for the caller own future assignment', async () => {
    authAs();
    fake.setTableResult('team_members', { data: callerMember, error: null });
    fake.setTableResult('service_assignments', { data: assignment, error: null });
    fake.setTableResult('assignment_swap_requests', { data: null, error: null });
    fake.setTableResult('team_member_blockout_dates', { data: [], error: null });
    fake.setTableResult('churches', { data: { name: 'Grace Church' }, error: null });

    const response = await POST(
      postRequest({ assignmentId, note: 'Family trip' })
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.swap.status).toBe('open');
    expect(body.swap.assignment_id).toBe(assignmentId);
    expect(body.swap.note).toBe('Family trip');

    const insert = fake
      .operationsFor('assignment_swap_requests')
      .find((op) => op.method === 'insert');
    expect(insert?.args[0]).toMatchObject({
      church_id: 'church-1',
      assignment_id: assignmentId,
      requested_by: 'tm-1',
      status: 'open',
      note: 'Family trip',
    });
  });
});

describe('GET /api/swaps', () => {
  it('returns 401 without a Bearer token', async () => {
    const response = await GET(getRequest('/api/swaps?status=open', ''));
    expect(response.status).toBe(401);
  });

  it('returns open swaps the caller is qualified to claim', async () => {
    authAs();
    fake.setTableResult('team_members', { data: callerMember, error: null });
    fake.setTableResult('service_assignments', {
      data: { ...assignment, team_member_id: 'tm-requester' },
      error: null,
    });
    fake.setTableResult('team_member_blockout_dates', { data: [], error: null });
    fake.setTableResult('assignment_swap_requests', {
      data: [
        {
          id: swapId,
          church_id: 'church-1',
          assignment_id: assignmentId,
          requested_by: 'tm-requester',
          claimed_by: null,
          status: 'open',
          note: 'Need coverage',
          created_at: '2099-06-01T00:00:00.000Z',
          updated_at: '2099-06-01T00:00:00.000Z',
          resolved_at: null,
          resolved_by: null,
        },
      ],
      error: null,
    });

    const response = await GET(getRequest('/api/swaps?status=open'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.swaps).toHaveLength(1);
    expect(body.swaps[0]).toMatchObject({
      id: swapId,
      can_claim: true,
      is_mine: false,
      role: 'vocals',
    });
    expect(body.swaps[0].requester).toEqual({
      id: 'tm-requester',
      name: callerMember.name,
      avatar_url: null,
    });
    expect(JSON.stringify(body)).not.toContain('@example.test');
  });

  it('hides swaps the volunteer is not qualified to claim', async () => {
    authAs();
    fake.setTableResult('team_members', {
      data: { ...callerMember, roles: ['drums'] },
      error: null,
    });
    fake.setTableResult('service_assignments', {
      data: { ...assignment, team_member_id: 'tm-requester' },
      error: null,
    });
    fake.setTableResult('team_member_blockout_dates', { data: [], error: null });
    fake.setTableResult('assignment_swap_requests', {
      data: [
        {
          id: swapId,
          church_id: 'church-1',
          assignment_id: assignmentId,
          requested_by: 'tm-requester',
          claimed_by: null,
          status: 'open',
          note: null,
          created_at: '2099-06-01T00:00:00.000Z',
          resolved_at: null,
        },
      ],
      error: null,
    });

    const response = await GET(getRequest('/api/swaps?status=open'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ swaps: [] });
  });

  it('lets leaders see every pending swap in their church', async () => {
    authAs('leader');
    fake.setTableResult('team_members', {
      data: { ...callerMember, roles: ['drums'] },
      error: null,
    });
    fake.setTableResult('service_assignments', {
      data: { ...assignment, team_member_id: 'tm-requester' },
      error: null,
    });
    fake.setTableResult('team_member_blockout_dates', { data: [], error: null });
    fake.setTableResult('assignment_swap_requests', {
      data: [
        {
          id: swapId,
          church_id: 'church-1',
          assignment_id: assignmentId,
          requested_by: 'tm-requester',
          claimed_by: null,
          status: 'open',
          note: null,
          created_at: '2099-06-01T00:00:00.000Z',
          resolved_at: null,
        },
      ],
      error: null,
    });

    const response = await GET(getRequest('/api/swaps?status=pending'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.swaps).toHaveLength(1);
    expect(body.swaps[0].can_claim).toBe(false);
  });
});
