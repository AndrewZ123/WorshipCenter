import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import {
  buildResponseUrls,
  computeResponseTokenExpiry,
  createResponseToken,
  hashResponseToken,
  previewResponseToken,
  redeemResponseToken,
  ResponseTokenError,
} from './assignment-response-tokens';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const churchId = '00000000-0000-4000-8000-000000000001';
const assignmentId = '00000000-0000-4000-8000-000000000002';
const serviceId = '00000000-0000-4000-8000-000000000003';
const now = new Date('2026-12-01T12:00:00.000Z');
const futureExpiry = '2026-12-05T00:00:00.000Z';

function tokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'token-row-1',
    assignment_id: assignmentId,
    church_id: churchId,
    expires_at: futureExpiry,
    used_at: null,
    ...overrides,
  };
}

function assignmentRow() {
  return {
    id: assignmentId,
    role: 'vocals',
    service_id: serviceId,
    status: 'pending',
    services: {
      id: serviceId,
      title: 'Sunday Worship',
      date: '2026-12-04',
      church_id: churchId,
    },
  };
}

beforeEach(() => {
  fake.reset();
});

describe('assignment response tokens', () => {
  it('stores only the sha256 hash of the raw token', async () => {
    fake.setTableResult('assignment_response_tokens', { data: null, error: null });

    const rawToken = await createResponseToken(assignmentId, churchId, '2026-12-04', now);

    const insert = fake
      .operationsFor('assignment_response_tokens')
      .find((operation) => operation.method === 'insert');
    expect(insert).toBeDefined();

    const row = insert?.args[0] as Record<string, unknown>;
    expect(row.token_hash).toBe(hashResponseToken(rawToken));
    expect(row.token_hash).not.toBe(rawToken);
    expect(JSON.stringify(row)).not.toContain(rawToken);
    expect(row.assignment_id).toBe(assignmentId);
    expect(row.church_id).toBe(churchId);
  });

  it('expires at the end of the service date when that is sooner than 14 days', () => {
    const expiry = computeResponseTokenExpiry('2026-12-04', now);
    expect(expiry.toISOString()).toBe('2026-12-05T00:00:00.000Z');
  });

  it('caps tokens at 14 days for distant services', () => {
    const expiry = computeResponseTokenExpiry('2027-02-01', now);
    expect(expiry.getTime()).toBe(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  });

  it('keeps at least one hour of life for past service dates', () => {
    const expiry = computeResponseTokenExpiry('2026-11-01', now);
    expect(expiry.getTime()).toBe(now.getTime() + 60 * 60 * 1000);
  });

  it('builds public respond URLs from NEXT_PUBLIC_APP_URL', () => {
    const urls = buildResponseUrls('raw-token-value');
    expect(urls.confirmUrl).toBe(
      'http://localhost:3000/respond?t=raw-token-value&a=confirm'
    );
    expect(urls.declineUrl).toBe(
      'http://localhost:3000/respond?t=raw-token-value&a=decline'
    );
  });

  it('rejects a missing token with a generic invalid-link error', async () => {
    fake.setTableResult('assignment_response_tokens', { data: null, error: null });

    await expect(
      redeemResponseToken('a'.repeat(43), 'confirmed', now)
    ).rejects.toMatchObject({ code: 'invalid' });
    expect(fake.operationsFor('service_assignments')).toHaveLength(0);
  });

  it('rejects an expired token without updating anything', async () => {
    fake.setTableResult('assignment_response_tokens', {
      data: tokenRow({ expires_at: '2026-11-30T00:00:00.000Z' }),
      error: null,
    });

    await expect(
      redeemResponseToken('a'.repeat(43), 'confirmed', now)
    ).rejects.toMatchObject({ code: 'invalid' });
    expect(fake.operationsFor('service_assignments')).toHaveLength(0);
  });

  it('rejects an already-used token without updating anything', async () => {
    fake.setTableResult('assignment_response_tokens', {
      data: tokenRow({ used_at: '2026-12-01T10:00:00.000Z', used_action: 'confirmed' }),
      error: null,
    });

    await expect(
      redeemResponseToken('a'.repeat(43), 'declined', now)
    ).rejects.toMatchObject({ code: 'invalid' });
    expect(fake.operationsFor('service_assignments')).toHaveLength(0);
  });

  it('redeems once, marks the token used, and updates only its assignment', async () => {
    let tokenQueries = 0;
    fake.setTableResult('assignment_response_tokens', () => {
      tokenQueries += 1;
      if (tokenQueries === 1) return { data: tokenRow(), error: null };
      return { data: [{ id: 'token-row-1' }], error: null };
    });
    fake.setTableResult('service_assignments', { data: assignmentRow(), error: null });

    const result = await redeemResponseToken('b'.repeat(43), 'confirmed', now);

    expect(result).toEqual({
      status: 'confirmed',
      serviceId,
      serviceTitle: 'Sunday Worship',
      serviceDate: '2026-12-04',
      role: 'vocals',
    });

    const tokenUpdate = fake
      .operationsFor('assignment_response_tokens')
      .find((operation) => operation.method === 'update');
    expect(tokenUpdate?.args[0]).toMatchObject({
      used_action: 'confirmed',
      used_at: now.toISOString(),
    });
    expect(
      fake
        .operationsFor('assignment_response_tokens')
        .some((operation) => operation.method === 'is' && operation.args[0] === 'used_at')
    ).toBe(true);

    const assignmentUpdate = fake
      .operationsFor('service_assignments')
      .find((operation) => operation.method === 'update');
    expect(assignmentUpdate?.args[0]).toEqual({ status: 'confirmed' });
    expect(
      fake
        .operationsFor('service_assignments')
        .some(
          (operation) =>
            operation.method === 'eq' &&
            operation.args[0] === 'id' &&
            operation.args[1] === assignmentId
        )
    ).toBe(true);

    // Second redemption of the same token is rejected (token now used).
    fake.setTableResult('assignment_response_tokens', {
      data: tokenRow({ used_at: now.toISOString(), used_action: 'confirmed' }),
      error: null,
    });
    await expect(
      redeemResponseToken('b'.repeat(43), 'declined', now)
    ).rejects.toBeInstanceOf(ResponseTokenError);
  });

  it('previews a token without redeeming it', async () => {
    fake.setTableResult('assignment_response_tokens', { data: tokenRow(), error: null });
    fake.setTableResult('service_assignments', { data: assignmentRow(), error: null });

    const preview = await previewResponseToken('c'.repeat(43), now);

    expect(preview).toEqual({
      valid: true,
      status: 'pending',
      serviceTitle: 'Sunday Worship',
      serviceDate: '2026-12-04',
      role: 'vocals',
    });
    expect(fake.operations.some((operation) => operation.method === 'update')).toBe(false);
    expect(fake.operations.some((operation) => operation.method === 'insert')).toBe(false);
  });
});
