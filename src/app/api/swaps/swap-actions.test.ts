import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { POST as claimSwap } from './[id]/claim/route';
import { POST as approveSwap } from './[id]/approve/route';
import { POST as declineSwap } from './[id]/decline/route';
import { POST as cancelSwap } from './[id]/cancel/route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  isEmailConfigured: vi.fn().mockResolvedValue(false),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const swapId = '00000000-0000-4000-8000-000000000021';
const assignmentId = '00000000-0000-4000-8000-000000000022';
const serviceId = '00000000-0000-4000-8000-000000000023';

const callerMember = {
  id: 'tm-claimer',
  church_id: 'church-1',
  name: 'Casey Claimer',
  email: 'casey@example.test',
  user_id: 'user-1',
  avatar_url: null,
  roles: ['vocals'],
};

const requesterMember = {
  id: 'tm-requester',
  church_id: 'church-1',
  name: 'Robin Requester',
  email: 'robin@example.test',
  user_id: 'user-2',
  avatar_url: null,
  roles: ['vocals'],
};

const assignment = {
  id: assignmentId,
  service_id: serviceId,
  team_member_id: 'tm-requester',
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

const swapRow = {
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

function setSequence(
  table: string,
  results: Array<{ data: unknown; error: unknown }>
) {
  let index = 0;
  fake.setTableResult(table, () => {
    const result = results[Math.min(index, results.length - 1)];
    index += 1;
    return result;
  });
}

function actionRequest(path: string, token = 'test-token') {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
}

function params() {
  return { params: Promise.resolve({ id: swapId }) };
}

beforeEach(() => {
  fake.reset();
  fake.rpc.mockReset();
  fake.rpc.mockResolvedValue({ data: null, error: null });
});

describe('POST /api/swaps/[id]/claim', () => {
  it('returns 401 without a Bearer token', async () => {
    const response = await claimSwap(
      actionRequest(`/api/swaps/${swapId}/claim`, ''),
      params()
    );
    expect(response.status).toBe(401);
  });

  it('returns 404 when the swap is not in the caller church', async () => {
    authAs('team', 'church-2');
    fake.setTableResult('team_members', { data: callerMember, error: null });
    fake.setTableResult('assignment_swap_requests', { data: null, error: null });

    const response = await claimSwap(actionRequest(`/api/swaps/${swapId}/claim`), params());
    expect(response.status).toBe(404);
  });

  it('returns 403 when the caller lacks the assignment role', async () => {
    authAs();
    fake.setTableResult('team_members', {
      data: { ...callerMember, roles: ['drums'] },
      error: null,
    });
    fake.setTableResult('assignment_swap_requests', { data: swapRow, error: null });
    setSequence('service_assignments', [
      { data: assignment, error: null },
      { data: [assignment], error: null },
    ]);
    fake.setTableResult('team_member_blockout_dates', { data: [], error: null });

    const response = await claimSwap(actionRequest(`/api/swaps/${swapId}/claim`), params());
    expect(response.status).toBe(403);
    expect(
      fake.operationsFor('assignment_swap_requests').some((op) => op.method === 'update')
    ).toBe(false);
  });

  it('returns 403 when the caller is blocked out on the service date', async () => {
    authAs();
    fake.setTableResult('team_members', { data: callerMember, error: null });
    fake.setTableResult('assignment_swap_requests', { data: swapRow, error: null });
    setSequence('service_assignments', [
      { data: assignment, error: null },
      { data: [assignment], error: null },
    ]);
    fake.setTableResult('team_member_blockout_dates', {
      data: [
        {
          team_member_id: 'tm-claimer',
          start_date: '2099-06-14',
          end_date: '2099-06-14',
        },
      ],
      error: null,
    });

    const response = await claimSwap(actionRequest(`/api/swaps/${swapId}/claim`), params());
    expect(response.status).toBe(403);
  });

  it('returns 403 when the caller is already serving that service', async () => {
    authAs();
    fake.setTableResult('team_members', { data: callerMember, error: null });
    fake.setTableResult('assignment_swap_requests', { data: swapRow, error: null });
    setSequence('service_assignments', [
      { data: assignment, error: null },
      {
        data: [
          assignment,
          {
            id: 'assignment-existing',
            service_id: serviceId,
            team_member_id: 'tm-claimer',
            role: 'keys',
            status: 'confirmed',
            services: { ...assignment.services },
          },
        ],
        error: null,
      },
    ]);
    fake.setTableResult('team_member_blockout_dates', { data: [], error: null });

    const response = await claimSwap(actionRequest(`/api/swaps/${swapId}/claim`), params());
    expect(response.status).toBe(403);
  });

  it('claims an open swap once and notifies the requester', async () => {
    authAs();
    fake.setTableResult('team_members', { data: callerMember, error: null });
    setSequence('assignment_swap_requests', [
      { data: swapRow, error: null },
      { data: [{ id: swapId }], error: null },
    ]);
    setSequence('service_assignments', [
      { data: assignment, error: null },
      { data: [assignment], error: null },
    ]);
    fake.setTableResult('team_member_blockout_dates', { data: [], error: null });
    fake.setTableResult('church_settings', { data: null, error: null });
    fake.setTableResult('churches', { data: { name: 'Grace Church' }, error: null });

    const response = await claimSwap(actionRequest(`/api/swaps/${swapId}/claim`), params());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      auto_approved: false,
      swap: { status: 'claimed', claimed_by: 'tm-claimer' },
    });

    const update = fake
      .operationsFor('assignment_swap_requests')
      .find((op) => op.method === 'update');
    expect(update?.args[0]).toMatchObject({
      claimed_by: 'tm-claimer',
      status: 'claimed',
    });
    expect(
      fake.operationsFor('assignment_swap_requests').some(
        (op) => op.method === 'is' && op.args[0] === 'claimed_by'
      )
    ).toBe(true);
  });

  it('returns 409 when another teammate won the claim race', async () => {
    authAs();
    fake.setTableResult('team_members', { data: callerMember, error: null });
    setSequence('assignment_swap_requests', [
      { data: swapRow, error: null },
      { data: [], error: null },
    ]);
    setSequence('service_assignments', [
      { data: assignment, error: null },
      { data: [assignment], error: null },
    ]);
    fake.setTableResult('team_member_blockout_dates', { data: [], error: null });

    const response = await claimSwap(actionRequest(`/api/swaps/${swapId}/claim`), params());
    expect(response.status).toBe(409);
  });

  it('approves immediately when the church auto-approve setting is on', async () => {
    authAs();
    fake.setTableResult('team_members', { data: callerMember, error: null });
    setSequence('assignment_swap_requests', [
      { data: swapRow, error: null },
      { data: [{ id: swapId }], error: null },
    ]);
    setSequence('service_assignments', [
      { data: assignment, error: null },
      { data: [assignment], error: null },
    ]);
    fake.setTableResult('team_member_blockout_dates', { data: [], error: null });
    fake.setTableResult('church_settings', {
      data: { auto_approve_swaps: true },
      error: null,
    });
    fake.setTableResult('churches', { data: { name: 'Grace Church' }, error: null });

    const response = await claimSwap(actionRequest(`/api/swaps/${swapId}/claim`), params());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.auto_approved).toBe(true);
    expect(body.swap.status).toBe('approved');
    expect(fake.rpc).toHaveBeenCalledWith('approve_assignment_swap', {
      p_swap_id: swapId,
      p_church_id: 'church-1',
      p_actor_user_id: null,
    });
  });
});

describe('POST /api/swaps/[id]/approve', () => {
  it('returns 401 without a Bearer token', async () => {
    const response = await approveSwap(
      actionRequest(`/api/swaps/${swapId}/approve`, ''),
      params()
    );
    expect(response.status).toBe(401);
  });

  it('returns 403 for volunteers', async () => {
    authAs('team');
    const response = await approveSwap(actionRequest(`/api/swaps/${swapId}/approve`), params());
    expect(response.status).toBe(403);
  });

  it('returns 409 when the swap is not claimed', async () => {
    authAs('leader');
    fake.setTableResult('assignment_swap_requests', { data: swapRow, error: null });

    const response = await approveSwap(actionRequest(`/api/swaps/${swapId}/approve`), params());
    expect(response.status).toBe(409);
  });

  it('approves a claimed swap through the RPC', async () => {
    authAs('leader');
    fake.setTableResult('assignment_swap_requests', {
      data: { ...swapRow, status: 'claimed', claimed_by: 'tm-claimer' },
      error: null,
    });
    fake.setTableResult('service_assignments', { data: assignment, error: null });
    fake.setTableResult('team_members', { data: requesterMember, error: null });
    fake.setTableResult('churches', { data: { name: 'Grace Church' }, error: null });

    const response = await approveSwap(actionRequest(`/api/swaps/${swapId}/approve`), params());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.swap.status).toBe('approved');
    expect(fake.rpc).toHaveBeenCalledWith('approve_assignment_swap', {
      p_swap_id: swapId,
      p_church_id: 'church-1',
      p_actor_user_id: 'user-1',
    });
  });

  it('returns 409 when the RPC rejects a stale approval', async () => {
    authAs('leader');
    fake.setTableResult('assignment_swap_requests', {
      data: { ...swapRow, status: 'claimed', claimed_by: 'tm-claimer' },
      error: null,
    });
    fake.setTableResult('service_assignments', { data: assignment, error: null });
    fake.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'swap_not_claimed' },
    });

    const response = await approveSwap(actionRequest(`/api/swaps/${swapId}/approve`), params());
    expect(response.status).toBe(409);
  });
});

describe('POST /api/swaps/[id]/decline', () => {
  it('returns 401 without a Bearer token', async () => {
    const response = await declineSwap(
      actionRequest(`/api/swaps/${swapId}/decline`, ''),
      params()
    );
    expect(response.status).toBe(401);
  });

  it('returns 403 for volunteers', async () => {
    authAs('team');
    const response = await declineSwap(actionRequest(`/api/swaps/${swapId}/decline`), params());
    expect(response.status).toBe(403);
  });

  it('declines an open swap without changing the assignment', async () => {
    authAs('leader');
    setSequence('assignment_swap_requests', [
      { data: swapRow, error: null },
      { data: [{ id: swapId }], error: null },
    ]);
    fake.setTableResult('service_assignments', { data: assignment, error: null });
    fake.setTableResult('team_members', { data: requesterMember, error: null });
    fake.setTableResult('churches', { data: { name: 'Grace Church' }, error: null });

    const response = await declineSwap(actionRequest(`/api/swaps/${swapId}/decline`), params());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      swap: { id: swapId, status: 'declined' },
    });
    expect(
      fake.operationsFor('service_assignments').some(
        (op) => op.method === 'update' || op.method === 'delete'
      )
    ).toBe(false);
  });

  it('returns 409 when the swap is already resolved', async () => {
    authAs('leader');
    fake.setTableResult('assignment_swap_requests', {
      data: { ...swapRow, status: 'approved' },
      error: null,
    });

    const response = await declineSwap(actionRequest(`/api/swaps/${swapId}/decline`), params());
    expect(response.status).toBe(409);
  });
});

describe('POST /api/swaps/[id]/cancel', () => {
  it('returns 401 without a Bearer token', async () => {
    const response = await cancelSwap(
      actionRequest(`/api/swaps/${swapId}/cancel`, ''),
      params()
    );
    expect(response.status).toBe(401);
  });

  it('returns 403 when the caller is not the requester', async () => {
    authAs();
    fake.setTableResult('team_members', {
      data: { ...callerMember, id: 'tm-other' },
      error: null,
    });
    fake.setTableResult('assignment_swap_requests', { data: swapRow, error: null });

    const response = await cancelSwap(actionRequest(`/api/swaps/${swapId}/cancel`), params());
    expect(response.status).toBe(403);
  });

  it('cancels the requester own open swap', async () => {
    authAs();
    fake.setTableResult('team_members', { data: requesterMember, error: null });
    setSequence('assignment_swap_requests', [
      { data: swapRow, error: null },
      { data: [{ id: swapId }], error: null },
    ]);

    const response = await cancelSwap(actionRequest(`/api/swaps/${swapId}/cancel`), params());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      swap: { id: swapId, status: 'cancelled' },
    });
  });

  it('returns 409 when the swap is already resolved', async () => {
    authAs();
    fake.setTableResult('team_members', { data: requesterMember, error: null });
    fake.setTableResult('assignment_swap_requests', {
      data: { ...swapRow, status: 'declined' },
      error: null,
    });

    const response = await cancelSwap(actionRequest(`/api/swaps/${swapId}/cancel`), params());
    expect(response.status).toBe(409);
  });
});
