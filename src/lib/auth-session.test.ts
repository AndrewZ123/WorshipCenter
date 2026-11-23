import { describe, expect, it } from 'vitest';
import { shouldIgnoreAuthEvent } from './auth-session';

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
