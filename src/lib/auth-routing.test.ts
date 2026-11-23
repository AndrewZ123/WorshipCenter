import { describe, expect, it } from 'vitest';
import { shouldRedirectToLogin } from './auth-routing';

describe('shouldRedirectToLogin', () => {
  it('redirects only when auth is done, there is no profile, and no session exists', () => {
    expect(
      shouldRedirectToLogin({
        loading: false,
        hasUser: false,
        sessionChecked: true,
        hasSession: false,
      })
    ).toBe(true);
  });

  it('does not redirect while auth is still loading', () => {
    expect(
      shouldRedirectToLogin({
        loading: true,
        hasUser: false,
        sessionChecked: false,
        hasSession: false,
      })
    ).toBe(false);
  });

  it('does not redirect while the profile is missing but a session still exists', () => {
    expect(
      shouldRedirectToLogin({
        loading: false,
        hasUser: false,
        sessionChecked: true,
        hasSession: true,
      })
    ).toBe(false);
  });

  it('does not redirect before the session check completes', () => {
    expect(
      shouldRedirectToLogin({
        loading: false,
        hasUser: false,
        sessionChecked: false,
        hasSession: false,
      })
    ).toBe(false);
  });
});
