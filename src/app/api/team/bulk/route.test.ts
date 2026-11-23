import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { PATCH } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const churchMemberId = '00000000-0000-4000-8000-000000000001';
const foreignMemberId = '00000000-0000-4000-8000-000000000002';
const groupId = '00000000-0000-4000-8000-000000000003';

function bulkRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/team/bulk', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer test-token',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  fake.reset();
  fake.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user-1@example.test' } },
    error: null,
  });
  fake.setTableResult('users', {
    data: { id: 'user-1', role: 'admin', church_id: 'church-1' },
    error: null,
  });
  fake.setTableResult('subscriptions', {
    data: { status: 'active', trial_end: null, current_period_end: null },
    error: null,
  });
});

describe('PATCH /api/team/bulk addToGroup', () => {
  it('does not add member IDs from another church', async () => {
    fake.setTableResult('member_groups', {
      data: { id: groupId },
      error: null,
    });
    // Simulates the church-scoped team_members lookup: only the row owned by
    // church-1 is returned, the foreign row is absent.
    fake.setTableResult('team_members', {
      data: [{ id: churchMemberId }],
      error: null,
    });
    fake.setTableResult('member_group_members', {
      data: [{ id: 'membership-1' }],
      error: null,
    });

    const upsertedRows: unknown[] = [];
    const baseFrom = fake.from.getMockImplementation();
    if (!baseFrom) {
      throw new Error('fake supabase from() has no implementation');
    }
    fake.from.mockImplementation((table: string) => {
      const builder = baseFrom(table);
      if (table !== 'member_group_members') {
        return builder;
      }
      return {
        ...builder,
        upsert: (rows: unknown) => {
          upsertedRows.push(rows);
          return builder;
        },
      };
    });

    const response = await PATCH(
      bulkRequest({
        action: 'addToGroup',
        groupId,
        memberIds: [churchMemberId, foreignMemberId],
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ added: 1 });
    expect(upsertedRows).toEqual([
      [{ group_id: groupId, team_member_id: churchMemberId }],
    ]);
  });
});
