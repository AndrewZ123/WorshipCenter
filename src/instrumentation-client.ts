import * as Sentry from '@sentry/nextjs';
import { isSentryEnabled } from './lib/sentry-enabled';

// Only the public var is available in the browser. Set it alongside
// SENTRY_DSN when client-side error reporting is wanted.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (isSentryEnabled(dsn)) {
  Sentry.init({
    dsn,
    // Errors only. Tracing, Session Replay, and default PII stay disabled.
    tracesSampleRate: 0,
    dataCollection: { userInfo: false },
  });
}

export function onRouterTransitionStart(
  ...args: Parameters<typeof Sentry.captureRouterTransitionStart>
): void {
  if (!isSentryEnabled(dsn)) {
    return;
  }

  Sentry.captureRouterTransitionStart(...args);
}
