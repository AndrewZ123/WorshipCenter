import { describe, expect, it, vi } from 'vitest';
import {
  clearPendingSignup,
  completeChurchSignup,
  pendingSignupFromMetadata,
  readPendingSignup,
  resolvePendingSignup,
  savePendingSignup,
  type SignupStorage,
} from './signup-completion';

function createMemoryStorage(): SignupStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

const userId = '00000000-0000-4000-8000-000000000010';
const churchName = 'Grace Church';
const userName = 'Test User';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('pending signup details', () => {
  it('reads church details from auth metadata', () => {
    expect(
      pendingSignupFromMetadata({ churchName, userName, email: 'user@example.test' })
    ).toEqual({ churchName, userName, email: 'user@example.test' });
  });

  it('rejects metadata without usable church/user names', () => {
    expect(pendingSignupFromMetadata({ churchName: ' ', userName })).toBeNull();
    expect(pendingSignupFromMetadata(null)).toBeNull();
  });

  it('round-trips a sessionStorage backup and clears it', () => {
    const storage = createMemoryStorage();

    expect(savePendingSignup(userId, { churchName, userName }, storage)).toBe(true);
    expect(readPendingSignup(userId, storage)).toEqual({ churchName, userName });

    clearPendingSignup(userId, storage);
    expect(readPendingSignup(userId, storage)).toBeNull();
  });

  it('prefers metadata over the stored backup but falls back to storage', () => {
    const storage = createMemoryStorage();
    savePendingSignup(userId, { churchName: 'Stored Church', userName: 'Stored User' }, storage);

    expect(
      resolvePendingSignup(userId, { churchName, userName }, storage)
    ).toEqual({ churchName, userName });

    expect(resolvePendingSignup(userId, null, storage)).toEqual({
      churchName: 'Stored Church',
      userName: 'Stored User',
    });
  });
});

describe('completeChurchSignup', () => {
  it('creates the church after confirmation using auth metadata and no password', async () => {
    const storage = createMemoryStorage();
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ success: true, church_id: 'church-1' })
    );

    const result = await completeChurchSignup(
      {
        access_token: 'test-access-token',
        user: {
          id: userId,
          email: 'user@example.test',
          user_metadata: { churchName, userName },
        },
      },
      fetchImpl as unknown as typeof fetch,
      storage
    );

    expect(result).toEqual({ completed: true, churchId: 'church-1' });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/auth/signup');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer test-access-token',
    });

    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ churchName, userName });
    expect(body).not.toHaveProperty('password');
  });

  it('uses the sessionStorage backup when metadata is missing', async () => {
    const storage = createMemoryStorage();
    savePendingSignup(userId, { churchName, userName }, storage);
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: true, church_id: 'church-2' })
    );

    const result = await completeChurchSignup(
      { access_token: 'test-access-token', user: { id: userId, user_metadata: {} } },
      fetchImpl as unknown as typeof fetch,
      storage
    );

    expect(result).toEqual({ completed: true, churchId: 'church-2' });
    expect(readPendingSignup(userId, storage)).toBeNull();
  });

  it('does nothing when the signup details were not preserved', async () => {
    const storage = createMemoryStorage();
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true }));

    const result = await completeChurchSignup(
      { access_token: 'test-access-token', user: { id: userId, user_metadata: {} } },
      fetchImpl as unknown as typeof fetch,
      storage
    );

    expect(result.completed).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not clear the backup when the API request fails', async () => {
    const storage = createMemoryStorage();
    savePendingSignup(userId, { churchName, userName }, storage);
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'Unauthorized' }, 401));

    const result = await completeChurchSignup(
      { access_token: 'test-access-token', user: { id: userId, user_metadata: {} } },
      fetchImpl as unknown as typeof fetch,
      storage
    );

    expect(result.completed).toBe(false);
    expect(readPendingSignup(userId, storage)).toEqual({ churchName, userName });
  });
});
