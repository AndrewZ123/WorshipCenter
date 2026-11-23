import { describe, expect, it } from 'vitest';
import {
  isInvalidCredentialsError,
  isRetryableLoginError,
  loginErrorMessage,
  shouldClearResidualSession,
  shouldIgnoreAuthEvent,
} from './auth-session';

describe('shouldIgnoreAuthEvent', () => {
  it('never ignores events when the user has not explicitly signed out', () => {
    for (const event of ['INITIAL_SESSION', 'TOKEN_REFRESHED', 'SIGNED_IN', 'SIGNED_OUT']) {
      expect(
        shouldIgnoreAuthEvent({
          event,
          signedOut: false,
          explicitAuthInFlight: false,
        })
      ).toBe(false);
    }
  });

  it('ignores leftover session events while signed out', () => {
    for (const event of ['INITIAL_SESSION', 'TOKEN_REFRESHED', 'USER_UPDATED']) {
      expect(
        shouldIgnoreAuthEvent({
          event,
          signedOut: true,
          explicitAuthInFlight: false,
        })
      ).toBe(true);
    }
  });

  it('ignores a leftover SIGNED_IN while signed out', () => {
    expect(
      shouldIgnoreAuthEvent({
        event: 'SIGNED_IN',
        signedOut: true,
        explicitAuthInFlight: false,
      })
    ).toBe(true);
  });

  it('allows the SIGNED_IN produced by an explicit login/signup/join', () => {
    expect(
      shouldIgnoreAuthEvent({
        event: 'SIGNED_IN',
        signedOut: true,
        explicitAuthInFlight: true,
      })
    ).toBe(false);
  });

  it('still ignores leftover refresh events during an explicit auth attempt', () => {
    expect(
      shouldIgnoreAuthEvent({
        event: 'TOKEN_REFRESHED',
        signedOut: true,
        explicitAuthInFlight: true,
      })
    ).toBe(true);
  });

  it('lets SIGNED_OUT settle normally without leaving the signed-out state', () => {
    expect(
      shouldIgnoreAuthEvent({
        event: 'SIGNED_OUT',
        signedOut: true,
        explicitAuthInFlight: false,
      })
    ).toBe(false);
  });
});

describe('login failure helpers', () => {
  it('treats only real credential rejections as invalid credentials', () => {
    expect(
      isInvalidCredentialsError({
        message: 'Invalid login credentials',
        status: 400,
        code: 'invalid_credentials',
      })
    ).toBe(true);
    expect(
      isInvalidCredentialsError({ message: 'Failed to fetch', name: 'TypeError' })
    ).toBe(false);
    expect(isInvalidCredentialsError(null)).toBe(false);
  });

  it('retries transient failures but never credential errors', () => {
    expect(isRetryableLoginError({ message: 'Invalid login credentials', status: 400 })).toBe(false);
    expect(isRetryableLoginError({ message: 'Email not confirmed', code: 'email_not_confirmed' })).toBe(false);
    expect(isRetryableLoginError({ message: 'Failed to fetch', name: 'TypeError' })).toBe(true);
    expect(isRetryableLoginError({ message: 'Too many requests', status: 429 })).toBe(true);
    expect(isRetryableLoginError({ message: 'Service unavailable', status: 503 })).toBe(true);
    expect(
      isRetryableLoginError({ message: 'Service temporarily unavailable', name: 'AuthRetryableFetchError' })
    ).toBe(true);
  });

  it('keeps invalid-password copy and gives a clearer permanent-error message', () => {
    expect(
      loginErrorMessage({ message: 'Invalid login credentials', code: 'invalid_credentials' })
    ).toBe('Invalid email or password.');
    expect(loginErrorMessage({ message: 'Email not confirmed' })).toBe(
      'Please confirm your email address before signing in.'
    );
    expect(loginErrorMessage({ message: 'Failed to fetch' })).toBe(
      'Unable to sign in right now. Please try again.'
    );
  });

  it('clears a leftover session or the residual signed-out state before login', () => {
    expect(shouldClearResidualSession({ signedOut: true, hasSession: false })).toBe(true);
    expect(shouldClearResidualSession({ signedOut: false, hasSession: true })).toBe(true);
    expect(shouldClearResidualSession({ signedOut: false, hasSession: false })).toBe(false);
  });
});
