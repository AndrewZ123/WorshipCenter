/**
 * Client helpers for finishing church signup after email confirmation.
 *
 * When Supabase email confirmation is enabled, `signUp` returns no session.
 * The church/profile rows are then created on the first authenticated load,
 * using the church details saved in the auth user's metadata (plus a
 * sessionStorage backup for the browser that started the signup).
 */

import { apiBaseUrl, parseJsonSafe } from '@/lib/api-base';

export interface PendingSignupDetails {
  churchName: string;
  userName: string;
  email?: string;
}

export interface SignupCompletionSession {
  access_token?: string | null;
  user?: {
    id?: string | null;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  } | null;
}

export type SignupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const PENDING_SIGNUP_STORAGE_PREFIX = 'wc_pending_signup_';

const MIN_CHURCH_NAME_LENGTH = 2;
const MAX_CHURCH_NAME_LENGTH = 200;
const MIN_USER_NAME_LENGTH = 2;
const MAX_USER_NAME_LENGTH = 100;

/** Normalize and validate church details from metadata or stored JSON. */
function normalizePendingSignup(input: unknown): PendingSignupDetails | null {
  if (!input || typeof input !== 'object') return null;

  const record = input as Record<string, unknown>;
  const churchName = typeof record.churchName === 'string' ? record.churchName.trim() : '';
  const userName = typeof record.userName === 'string' ? record.userName.trim() : '';

  if (churchName.length < MIN_CHURCH_NAME_LENGTH || churchName.length > MAX_CHURCH_NAME_LENGTH) {
    return null;
  }
  if (userName.length < MIN_USER_NAME_LENGTH || userName.length > MAX_USER_NAME_LENGTH) {
    return null;
  }

  const email = typeof record.email === 'string' ? record.email.trim() : '';
  return email ? { churchName, userName, email } : { churchName, userName };
}

export function pendingSignupStorageKey(userId: string): string {
  return `${PENDING_SIGNUP_STORAGE_PREFIX}${userId}`;
}

function getSessionStorage(): SignupStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function pendingSignupFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): PendingSignupDetails | null {
  if (!metadata) return null;
  return normalizePendingSignup({
    churchName: metadata.churchName,
    userName: metadata.userName,
    email: metadata.email,
  });
}

/** Save a same-browser backup. Returns false when storage is unavailable. */
export function savePendingSignup(
  userId: string,
  details: Omit<PendingSignupDetails, 'email'> & { email?: string },
  storage: SignupStorage | null = getSessionStorage()
): boolean {
  const normalized = normalizePendingSignup(details);
  if (!userId || !normalized || !storage) return false;

  try {
    storage.setItem(pendingSignupStorageKey(userId), JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function readPendingSignup(
  userId: string,
  storage: SignupStorage | null = getSessionStorage()
): PendingSignupDetails | null {
  if (!userId || !storage) return null;

  try {
    const raw = storage.getItem(pendingSignupStorageKey(userId));
    if (!raw) return null;
    return normalizePendingSignup(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearPendingSignup(
  userId: string,
  storage: SignupStorage | null = getSessionStorage()
): void {
  if (!userId || !storage) return;
  try {
    storage.removeItem(pendingSignupStorageKey(userId));
  } catch {
    // Best effort: a stale backup is harmless once the profile exists.
  }
}

/**
 * Resolve the church details for a signed-in user. Auth metadata is the
 * durable source (it survives confirmation on any device); sessionStorage is
 * the fallback for browsers where the metadata write did not make it back.
 */
export function resolvePendingSignup(
  userId: string | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
  storage: SignupStorage | null = getSessionStorage()
): PendingSignupDetails | null {
  if (!userId) return null;
  return pendingSignupFromMetadata(metadata) ?? readPendingSignup(userId, storage);
}

/**
 * Create the church/profile for an authenticated user who has no public.users
 * row yet. The API is idempotent, so calling this after a partial signup is
 * safe: it returns the existing church instead of creating a second one.
 */
export async function completeChurchSignup(
  session: SignupCompletionSession | null | undefined,
  fetchImpl: typeof fetch = fetch,
  storage: SignupStorage | null = getSessionStorage()
): Promise<{ completed: boolean; churchId?: string; error?: string }> {
  const accessToken = session?.access_token;
  const userId = session?.user?.id;
  if (!accessToken || !userId) {
    return { completed: false, error: 'No authenticated session.' };
  }

  const pending = resolvePendingSignup(userId, session?.user?.user_metadata, storage);
  if (!pending) {
    return { completed: false, error: 'Missing church signup details.' };
  }

  try {
    const response = await fetchImpl(`${apiBaseUrl()}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        churchName: pending.churchName,
        userName: pending.userName,
        ...(pending.email ? { email: pending.email } : {}),
      }),
    });

    const result = await parseJsonSafe(response);
    if (!response.ok || !result?.success) {
      return {
        completed: false,
        error: result?.error || 'Could not finish setting up your church.',
      };
    }

    clearPendingSignup(userId, storage);
    return { completed: true, churchId: result.church_id };
  } catch {
    return { completed: false, error: 'Could not finish setting up your church.' };
  }
}
