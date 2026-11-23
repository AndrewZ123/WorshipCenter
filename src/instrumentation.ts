import * as Sentry from '@sentry/nextjs';
import { isSentryEnabled } from './lib/sentry-enabled';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export function onRequestError(
  ...args: Parameters<typeof Sentry.captureRequestError>
): void {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!isSentryEnabled(dsn)) {
    return;
  }

  Sentry.captureRequestError(...args);
}
