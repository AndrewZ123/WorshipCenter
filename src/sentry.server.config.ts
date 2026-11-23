import * as Sentry from '@sentry/nextjs';
import { isSentryEnabled } from './lib/sentry-enabled';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (isSentryEnabled(dsn)) {
  Sentry.init({
    dsn,
    // Errors only. Tracing, Session Replay, and default PII stay disabled.
    tracesSampleRate: 0,
    dataCollection: { userInfo: false },
  });
}
