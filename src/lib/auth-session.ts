/**
 * Pure decisions for handling Supabase auth events in the AuthProvider.
 *
 * An explicit sign-out clears local state immediately, but Supabase can still
 * emit a leftover session event (INITIAL_SESSION, TOKEN_REFRESHED, or a delayed
 * SIGNED_IN) before `signOut()` finishes. Those events must not restore a
 * profile, otherwise the login page can bounce back to the dashboard.
 */
export interface AuthEventState {
  /** Supabase event name from onAuthStateChange. */
  event: string;
  /** An explicit sign-out happened and has not been superseded by a login. */
  signedOut: boolean;
  /** login/signup/join is in flight, so a SIGNED_IN is expected. */
  explicitAuthInFlight: boolean;
}

/**
 * True when the event must be ignored to keep the explicit sign-out stable.
 *
 * SIGNED_OUT is never ignored: it still settles loading while leaving the
 * provider in the signed-out state. A SIGNED_IN that belongs to an explicit
 * login/signup/join is also allowed through so it can clear the flag.
 */
export function shouldIgnoreAuthEvent({
  event,
  signedOut,
  explicitAuthInFlight,
}: AuthEventState): boolean {
  if (!signedOut) return false;
  if (event === 'SIGNED_OUT') return false;
  if (event === 'SIGNED_IN' && explicitAuthInFlight) return false;
  return true;
}

function asLoginFailure(error: unknown): {
  message?: string;
  status?: number;
  code?: string;
  name?: string;
} | null {
  if (!error || typeof error !== 'object') return null;
  const value = error as Record<string, unknown>;
  return {
    message: typeof value.message === 'string' ? value.message : undefined,
    status: typeof value.status === 'number' ? value.status : undefined,
    code: typeof value.code === 'string' ? value.code : undefined,
    name: typeof value.name === 'string' ? value.name : undefined,
  };
}

/**
 * True only for a real credential rejection. This must not retry (that would
 * hand an attacker an extra guess) and must keep the existing login copy.
 */
export function isInvalidCredentialsError(error: unknown): boolean {
  const failure = asLoginFailure(error);
  if (!failure) return false;

  const code = (failure.code || '').toLowerCase();
  if (code === 'invalid_credentials' || code === 'invalid_grant') return true;

  const message = (failure.message || '').toLowerCase();
  return (
    message.includes('invalid login credentials') ||
    message.includes('invalid email or password')
  );
}

/**
 * True when retrying the password grant once could succeed: network blips,
 * rate limiting, 5xx, or Supabase lock contention. Credential errors and
 * permanent account states (e.g. unconfirmed email) are never retried.
 */
export function isRetryableLoginError(error: unknown): boolean {
  if (isInvalidCredentialsError(error)) return false;

  const failure = asLoginFailure(error);
  if (!failure) return false;

  const code = (failure.code || '').toLowerCase();
  if (code === 'email_not_confirmed' || code === 'user_not_found') return false;
  if (code === 'over_request_rate_limit' || code === 'request_timeout') return true;

  if (failure.name === 'AuthRetryableFetchError') return true;
  if (failure.status === 429 || (failure.status ?? 0) >= 500) return true;

  const message = (failure.message || '').toLowerCase();
  return /timeout|network|fetch|temporar|locked|rate limit|too many/.test(message);
}

/** Safe, short copy for a failed login. Never includes server error details. */
export function loginErrorMessage(error: unknown): string {
  if (isInvalidCredentialsError(error)) return 'Invalid email or password.';

  const failure = asLoginFailure(error);
  const code = (failure?.code || '').toLowerCase();
  const message = (failure?.message || '').toLowerCase();
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in.';
  }

  return 'Unable to sign in right now. Please try again.';
}

/**
 * A fresh password sign-in should drop any leftover local session. That
 * includes the brief residual window after an explicit sign-out, where the
 * Supabase session may still be in storage.
 */
export function shouldClearResidualSession({
  signedOut,
  hasSession,
}: {
  signedOut: boolean;
  hasSession: boolean;
}): boolean {
  return signedOut || hasSession;
}
