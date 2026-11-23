import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { clearRateLimit } from '@/lib/auth-middleware';
import * as route from './route';

const TEST_IP = '203.0.113.10';
const RATE_LIMIT_KEY = `health:${TEST_IP}`;

// Matches HEALTH_RATE_LIMIT in route.ts. Kept in the test so a limit change is
// a deliberate, visible edit rather than something that silently drifts.
const REQUESTS_PER_WINDOW = 30;

function healthRequest(ip: string = TEST_IP): NextRequest {
  return new NextRequest('http://localhost/api/health', {
    headers: { 'x-forwarded-for': ip },
  });
}

beforeEach(() => {
  clearRateLimit(RATE_LIMIT_KEY);
});

afterEach(() => {
  clearRateLimit(RATE_LIMIT_KEY);
});

describe('GET /api/health', () => {
  it('returns 200 with only { ok: true }', async () => {
    const response = await route.GET(healthRequest());
    const text = await response.text();
    const body = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(Object.keys(body)).toEqual(['ok']);
    expect(text).not.toMatch(/supabase|sentry|version|node|env/i);
  });

  it('rate limits repeated requests from the same client', async () => {
    for (let i = 0; i < REQUESTS_PER_WINDOW; i++) {
      const response = await route.GET(healthRequest());
      expect(response.status).toBe(200);
    }

    const limited = await route.GET(healthRequest());
    const text = await limited.text();

    expect(limited.status).toBe(429);
    // The 429 body is a generic message, not internal detail.
    expect(text).not.toMatch(/supabase|sentry|error details/i);
  });

  it('only exports GET, so Next answers other methods with 405', () => {
    // Next's route module returns 405 Method Not Allowed when a handler for
    // the requested method is not exported.
    expect(Object.keys(route)).not.toContain('POST');
    expect(Object.keys(route)).not.toContain('PUT');
    expect(Object.keys(route)).not.toContain('DELETE');
  });
});
