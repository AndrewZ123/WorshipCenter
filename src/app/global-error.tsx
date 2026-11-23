'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { isSentryEnabled } from '@/lib/sentry-enabled';

const buttonStyle: React.CSSProperties = {
  border: '1px solid #cbd5e0',
  borderRadius: '0.375rem',
  background: '#ffffff',
  color: '#1a202c',
  cursor: 'pointer',
  fontSize: '0.875rem',
  padding: '0.5rem 0.875rem',
};

/**
 * Last-resort error boundary. It replaces the root layout, so it must render
 * its own <html> and <body> and cannot use the app's providers or theme.
 *
 * Only a generic recovery message is shown. The error text, stack, and any
 * user data are never rendered; the exception is reported to Sentry only when
 * the browser SDK is configured (PII collection stays off there).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isSentryEnabled(process.env.NEXT_PUBLIC_SENTRY_DSN)) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f7fafc' }}>
        <main
          style={{
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
          }}
        >
          <div style={{ maxWidth: '24rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem' }}>Something went wrong</h1>
            <p style={{ color: '#4a5568', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
              WorshipCenter hit an unexpected error. Try again, reload, or return home.
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                justifyContent: 'center',
              }}
            >
              <button type="button" onClick={reset} style={buttonStyle}>
                Try again
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={buttonStyle}
              >
                Reload page
              </button>
              <button
                type="button"
                onClick={() => window.location.assign('/')}
                style={buttonStyle}
              >
                Go home
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
