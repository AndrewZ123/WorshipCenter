/**
 * Sentry is opt-in. Only a non-empty DSN should start the SDK; an unset,
 * empty, or whitespace-only value must keep the app a complete no-op.
 */
export function isSentryEnabled(dsn?: string): boolean {
  return typeof dsn === 'string' && dsn.trim().length > 0;
}
