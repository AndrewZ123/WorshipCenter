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
