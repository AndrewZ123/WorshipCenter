/**
 * Small, pure helpers for auth-related redirect decisions.
 *
 * The app layout must not send a signed-in user to /login just because their
 * profile row is still loading. Only redirect once auth has finished loading,
 * the profile is absent, the session check has completed, and there is truly
 * no Supabase session.
 */
export interface LoginRedirectState {
  /** Auth provider is still restoring the session / loading the profile. */
  loading: boolean;
  /** A user/profile is available in auth context. */
  hasUser: boolean;
  /** The async supabase.auth.getSession() check has completed. */
  sessionChecked: boolean;
  /** supabase.auth.getSession() returned a user. */
  hasSession: boolean;
}

export function shouldRedirectToLogin({
  loading,
  hasUser,
  sessionChecked,
  hasSession,
}: LoginRedirectState): boolean {
  return !loading && !hasUser && sessionChecked && !hasSession;
}
