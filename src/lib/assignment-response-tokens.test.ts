import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import {
  buildResponseUrls,
  computeResponseTokenExpiry,
  createResponseToken,
  createResponseTokenWithRetry,
  hashResponseToken,
  previewResponseToken,
  redeemResponseToken,
  ResponseTokenError,
} from './assignment-response-tokens';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
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
  vi.mocked(Sentry.captureException).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
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

  describe('createResponseTokenWithRetry', () => {
    it('succeeds on the first attempt without reporting to Sentry', async () => {
      fake.setTableResult('assignment_response_tokens', { data: null, error: null });

      const rawToken = await createResponseTokenWithRetry(
        assignmentId,
        churchId,
        '2026-12-04',
        now
      );

      expect(rawToken).toHaveLength(43);
      expect(
        fake
          .operationsFor('assignment_response_tokens')
          .filter((operation) => operation.method === 'insert')
      ).toHaveLength(1);
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('retries once after a failure and does not report to Sentry', async () => {
      let attempts = 0;
      fake.setTableResult('assignment_response_tokens', () => {
        attempts += 1;
        return attempts === 1
          ? { data: null, error: { message: 'transient failure' } }
          : { data: null, error: null };
      });

      const rawToken = await createResponseTokenWithRetry(
        assignmentId,
        churchId,
        '2026-12-04',
        now
      );

      expect(rawToken).toHaveLength(43);
      expect(attempts).toBe(2);
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('reports once and throws when both attempts fail', async () => {
      vi.stubEnv('SENTRY_DSN', 'https://example.invalid/1');
      let attempts = 0;
      fake.setTableResult('assignment_response_tokens', () => {
        attempts += 1;
        return { data: null, error: { message: 'still failing' } };
      });

      await expect(
        createResponseTokenWithRetry(assignmentId, churchId, '2026-12-04', now)
      ).rejects.toThrow('Failed to create response token');

      expect(attempts).toBe(2);
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
      expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
        tags: { feature: 'assignment-response-token' },
        extra: { assignmentId },
      });
    });

    it('does not report to Sentry when the DSN is unset', async () => {
      fake.setTableResult('assignment_response_tokens', {
        data: null,
        error: { message: 'still failing' },
      });

      await expect(
        createResponseTokenWithRetry(assignmentId, churchId, '2026-12-04', now)
      ).rejects.toThrow('Failed to create response token');

      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('never logs the raw token', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fake.setTableResult('assignment_response_tokens', { data: null, error: null });

      const rawToken = await createResponseTokenWithRetry(
        assignmentId,
        churchId,
        '2026-12-04',
        now
      );

      for (const spy of [logSpy, infoSpy, warnSpy, errorSpy]) {
        expect(JSON.stringify(spy.mock.calls)).not.toContain(rawToken);
      }

      logSpy.mockRestore();
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
