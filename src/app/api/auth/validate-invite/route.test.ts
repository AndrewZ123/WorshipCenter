import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

function requestWith(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/validate-invite', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/validate-invite', () => {
  it('returns 400 when email or churchId is missing', async () => {
    const response = await POST(requestWith({ email: '', churchId: '' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ valid: false });
  });
});
