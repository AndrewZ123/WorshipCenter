import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFakeSupabaseClient } from '@/test/fake-supabase';
import { clearRateLimit } from '@/lib/auth-middleware';
import { GET, POST } from './route';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

const fake = createFakeSupabaseClient();
vi.mocked(createClient).mockReturnValue(fake as never);

const churchId = '00000000-0000-4000-8000-000000000001';
const assignmentId = '00000000-0000-4000-8000-000000000002';
const serviceId = '00000000-0000-4000-8000-000000000003';
const validToken = 'd'.repeat(43);

const ip = '198.51.100.10';

function postRequest(body: unknown, requestIp = ip): NextRequest {
  return new NextRequest('http://localhost/api/assignments/respond', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': requestIp,
    },
    body: JSON.stringify(body),
  });
}

function previewRequest(token: string, requestIp = ip): NextRequest {
  return new NextRequest(
    `http://localhost/api/assignments/respond?t=${encodeURIComponent(token)}`,
    { headers: { 'x-forwarded-for': requestIp } }
  );
}

function tokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'token-row-1',
    assignment_id: assignmentId,
    church_id: churchId,
    expires_at: '2026-12-05T00:00:00.000Z',
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

function allowTokenRedemption() {
  let tokenQueries = 0;
  fake.setTableResult('assignment_response_tokens', () => {
    tokenQueries += 1;
    if (tokenQueries === 1) return { data: tokenRow(), error: null };
    return { data: [{ id: 'token-row-1' }], error: null };
  });
  fake.setTableResult('service_assignments', { data: assignmentRow(), error: null });
}

beforeEach(() => {
  fake.reset();
  clearRateLimit(`respond:${ip}`);
  clearRateLimit(`respond-preview:${ip}`);
});

describe('POST /api/assignments/respond', () => {
  it('rejects an invalid body with 400', async () => {
    const response = await POST(postRequest({ token: 'short', action: 'maybe' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Invalid request',
    });
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('confirms the assignment referenced by the token', async () => {
    allowTokenRedemption();

    const response = await POST(postRequest({ token: validToken, action: 'confirm' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: 'confirmed',
      serviceTitle: 'Sunday Worship',
      serviceDate: '2026-12-04',
      role: 'vocals',
    });

    const assignmentUpdate = fake
      .operationsFor('service_assignments')
      .find((operation) => operation.method === 'update');
    expect(assignmentUpdate?.args[0]).toEqual({ status: 'confirmed' });
  });

  it('declines the assignment referenced by the token', async () => {
    allowTokenRedemption();

    const response = await POST(postRequest({ token: validToken, action: 'decline' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      status: 'declined',
    });

    const assignmentUpdate = fake
      .operationsFor('service_assignments')
      .find((operation) => operation.method === 'update');
    expect(assignmentUpdate?.args[0]).toEqual({ status: 'declined' });
  });

  it('returns 410 for a reused token', async () => {
    fake.setTableResult('assignment_response_tokens', {
      data: tokenRow({
        used_at: '2026-12-01T12:00:00.000Z',
        used_action: 'confirmed',
      }),
      error: null,
    });

    const response = await POST(postRequest({ token: validToken, action: 'decline' }));

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'This link is invalid or has expired.',
    });
  });

  it('returns 410 for a missing/expired token without leaking details', async () => {
    fake.setTableResult('assignment_response_tokens', { data: null, error: null });

    const response = await POST(postRequest({ token: validToken, action: 'confirm' }));

    expect(response.status).toBe(410);
  });

  it('rate limits repeated POSTs from one IP with 429', async () => {
    // 50 malformed requests are still rejected as 400 but count toward the
    // API_WRITE tier; the 51st is denied before validation.
    for (let i = 0; i < 50; i += 1) {
      const response = await POST(postRequest({ token: 'short', action: 'confirm' }));
      expect(response.status).toBe(400);
    }

    const limited = await POST(postRequest({ token: validToken, action: 'confirm' }));
    expect(limited.status).toBe(429);
    expect(fake.from).not.toHaveBeenCalled();
  });
});

describe('GET /api/assignments/respond', () => {
  it('previews a token without redeeming it', async () => {
    fake.setTableResult('assignment_response_tokens', { data: tokenRow(), error: null });
    fake.setTableResult('service_assignments', { data: assignmentRow(), error: null });

    const response = await GET(previewRequest(validToken));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      valid: true,
      status: 'pending',
      serviceTitle: 'Sunday Worship',
      serviceDate: '2026-12-04',
      role: 'vocals',
    });

    expect(fake.operations.some((operation) => operation.method === 'update')).toBe(false);
  });

  it('reports invalid tokens without erroring (link scanners)', async () => {
    fake.setTableResult('assignment_response_tokens', { data: null, error: null });

    const response = await GET(previewRequest(validToken));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ valid: false });
    expect(fake.operations.some((operation) => operation.method === 'update')).toBe(false);
  });
});
