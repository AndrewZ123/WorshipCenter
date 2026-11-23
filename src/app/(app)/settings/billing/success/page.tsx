'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiUrl, parseJsonSafe, waitForAccessToken } from '@/lib/api-base';

type ConfirmPhase = 'confirming' | 'confirmed' | 'pending' | 'error';

interface ConfirmedSubscription {
  status?: string;
  price_type?: 'monthly' | 'yearly' | null;
  current_period_end?: string | null;
  [key: string]: unknown;
}

const CONFIRM_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 3000;
const POLL_INTERVAL_MS = 1200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusColors(status: string | undefined) {
  switch (status) {
    case 'active':
      return { bg: '#c6f6d5', text: '#22543d' };
    case 'past_due':
      return { bg: '#fed7d7', text: '#742a2a' };
    case 'trialing':
      return { bg: '#bee3f8', text: '#2a4365' };
    default:
      return { bg: '#e2e8f0', text: '#4a5568' };
  }
}

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [phase, setPhase] = useState<ConfirmPhase>('confirming');
  const [message, setMessage] = useState('');
  const [subscription, setSubscription] = useState<ConfirmedSubscription | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const run = async () => {
      setPhase('confirming');
      setMessage('');

      const accessToken = await waitForAccessToken();
      if (cancelledRef.current) return;
      if (!accessToken) {
        router.push('/login');
        return;
      }

      if (!sessionId) {
        setPhase('pending');
        setMessage(
          'We could not find a checkout session for this page. If you just paid, open Billing to confirm your plan.'
        );
        return;
      }

      const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
      let lastMessage = '';

      // Poll a few times so a webhook/DB write that lands moments later is
      // picked up, but always stop at the hard deadline (never spin forever).
      while (!cancelledRef.current && Date.now() < deadline) {
        const remaining = deadline - Date.now();
        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(),
          Math.min(remaining, REQUEST_TIMEOUT_MS)
        );

        try {
          const res = await fetch(apiUrl('/api/billing/confirm-checkout'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ session_id: sessionId }),
            signal: controller.signal,
          });
          const data = await parseJsonSafe(res);
          if (cancelledRef.current) return;

          if (res.status === 401) {
            router.push('/login');
            return;
          }

          if (res.status === 403) {
            setPhase('error');
            setMessage(
              data?.error || 'This checkout session does not belong to your account.'
            );
            return;
          }

          if (res.ok && data?.subscription) {
            setSubscription(data.subscription);
            if (data.subscription.status === 'active') {
              setPhase('confirmed');
              return;
            }
            lastMessage = 'Payment received — we are finishing your account update.';
          } else if (res.status === 409) {
            lastMessage = 'Your payment is still processing.';
          } else {
            lastMessage = data?.error || 'We could not confirm your payment yet.';
          }
        } catch {
          if (!cancelledRef.current) {
            lastMessage = 'We could not reach the billing service yet.';
          }
        } finally {
          clearTimeout(timer);
        }

        if (Date.now() >= deadline) break;
        await delay(POLL_INTERVAL_MS);
      }

      if (!cancelledRef.current) {
        setPhase('pending');
        setMessage(
          lastMessage || 'Payment received — we are still updating your account.'
        );
      }
    };

    run();

    return () => {
      cancelledRef.current = true;
    };
  }, [retryKey, router, sessionId]);

  const handleManage = useCallback(async () => {
    setPortalLoading(true);
    setPortalError(null);

    try {
      const accessToken = await waitForAccessToken();
      if (!accessToken) {
        router.push('/login');
        return;
      }

      const res = await fetch(apiUrl('/api/billing/create-portal-session'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await parseJsonSafe(res);

      if (res.ok && data?.url) {
        window.location.href = data.url;
        return;
      }

      // No portal available (e.g. no real Stripe customer yet) — land on the
      // billing page rather than leaving the user stuck on the success screen.
      router.push('/settings/billing');
    } catch {
      setPortalError('Could not open the billing portal. Redirecting to billing…');
      router.push('/settings/billing');
    } finally {
      setPortalLoading(false);
    }
  }, [router]);

  const isConfirmed = phase === 'confirmed';
  const planName =
    subscription?.price_type === 'yearly' ? 'Yearly Pro Plan' : 'Monthly Pro Plan';
  const amount = subscription?.price_type === 'yearly' ? '$290' : '$29';
  const period = subscription?.price_type === 'yearly' ? 'per year' : 'per month';
  const badge = statusColors(subscription?.status);

  const title = isConfirmed
    ? 'Welcome to Pro!'
    : phase === 'error'
      ? 'We couldn’t confirm your checkout'
      : phase === 'pending'
        ? 'We’re confirming your payment'
        : 'Confirming your payment…';

  const subtitle = isConfirmed
    ? 'Your subscription is now active.'
    : phase === 'confirming'
      ? 'Verifying your checkout with Stripe…'
      : message || 'Payment received — your plan is being activated.';

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Success / status header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            backgroundColor: isConfirmed ? '#f0fff4' : '#ebf8ff',
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            animation: 'scaleIn 0.5s ease-out',
          }}
        >
          <span style={{ fontSize: '40px' }}>{isConfirmed ? '✅' : '⏳'}</span>
        </div>

        <h1
          style={{
            fontSize: '32px',
            fontWeight: 700,
            color: '#2d3748',
            marginBottom: '12px',
          }}
        >
          {title}
        </h1>

        <p style={{ fontSize: '16px', color: '#718096', marginBottom: '8px' }}>
          {subtitle}
        </p>
      </div>

      {/* Details card */}
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '32px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {phase === 'confirming' ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                border: '3px solid #e2e8f0',
                borderTopColor: '#3182ce',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px',
              }}
            />
            <p style={{ fontSize: '14px', color: '#718096' }}>
              This usually takes a few seconds.
            </p>
          </div>
        ) : subscription ? (
          <>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#2d3748',
                marginBottom: '20px',
              }}
            >
              Subscription Details
            </h2>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={detailRowStyle}>
                <span style={{ fontSize: '14px', color: '#718096' }}>Plan</span>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#2d3748' }}>
                  {planName}
                </span>
              </div>

              <div style={detailRowStyle}>
                <span style={{ fontSize: '14px', color: '#718096' }}>Amount</span>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#2d3748' }}>
                  {amount}
                </span>
              </div>

              <div style={detailRowStyle}>
                <span style={{ fontSize: '14px', color: '#718096' }}>Billing</span>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#2d3748' }}>
                  {period}
                </span>
              </div>

              <div style={detailRowStyle}>
                <span style={{ fontSize: '14px', color: '#718096' }}>Status</span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    backgroundColor: badge.bg,
                    color: badge.text,
                  }}
                >
                  {(subscription.status || 'pending').replace('_', ' ')}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <p style={{ fontSize: '15px', color: '#4a5568', marginBottom: '16px' }}>
              {message || 'We are still activating your plan.'}
            </p>
            <button
              onClick={() => setRetryKey((key) => key + 1)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#3182ce',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* What's Next */}
      <div
        style={{
          backgroundColor: '#ebf8ff',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid #bee3f8',
        }}
      >
        <h3
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#2c5282',
            marginBottom: '12px',
          }}
        >
          What&apos;s Next?
        </h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {[
            'Create unlimited services',
            'Invite unlimited team members',
            'Access advanced reporting',
            'Use all Pro features',
          ].map((item, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 0',
              }}
            >
              <span style={{ color: '#2c5282', fontSize: '18px' }}>✓</span>
              <span style={{ fontSize: '14px', color: '#2c5282' }}>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {portalError && (
        <p style={{ fontSize: '13px', color: '#742a2a', marginBottom: '12px' }}>
          {portalError}
        </p>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            flex: 1,
            padding: '12px 24px',
            backgroundColor: '#3182ce',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            minWidth: '200px',
          }}
        >
          Go to Dashboard
        </button>

        <button
          onClick={handleManage}
          disabled={portalLoading}
          style={{
            flex: 1,
            padding: '12px 24px',
            backgroundColor: '#fff',
            color: '#3182ce',
            border: '2px solid #3182ce',
            borderRadius: '8px',
            cursor: portalLoading ? 'default' : 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            minWidth: '200px',
            opacity: portalLoading ? 0.7 : 1,
          }}
        >
          {portalLoading ? 'Opening…' : 'Manage Subscription'}
        </button>
      </div>

      <style jsx>{`
        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

const detailRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px',
  backgroundColor: '#f7fafc',
  borderRadius: '8px',
} as const;
