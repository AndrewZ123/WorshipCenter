import { describe, expect, it } from 'vitest';
import { isSentryEnabled } from './sentry-enabled';

describe('isSentryEnabled', () => {
  it('is disabled when the DSN is unset', () => {
    expect(isSentryEnabled(undefined)).toBe(false);
  });

  it('is disabled when the DSN is empty', () => {
    expect(isSentryEnabled('')).toBe(false);
  });

  it('is disabled when the DSN is only whitespace', () => {
    expect(isSentryEnabled('   \t\n')).toBe(false);
  });

  it('is enabled when the DSN has a value', () => {
    expect(isSentryEnabled('https://example.invalid/1')).toBe(true);
  });

  it('is enabled when the DSN has surrounding whitespace', () => {
    expect(isSentryEnabled('  https://example.invalid/1  ')).toBe(true);
  });
});
