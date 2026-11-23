/**
 * Billing Page
 *
 * Handles all subscription states with clean demo-inspired design:
 * 1. Loading → Skeleton
 * 2. Trial → Show upgrade CTA with trial info
 * 3. Active → Show plan details + manage/cancel buttons
 * 4. Past Due → Show warning + link to update payment
 * 5. Canceled → Show re-subscribe CTA
 *
 * Flow: Checkout Session → Stripe hosted page → webhook activates subscription
 */

'use client';

import { useState, useEffect } from 'react';
import { useSubscription } from '@/lib/useSubscription';
import { PRICING } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  apiUrl,
  getAccessToken,
  getApiBase,
  parseJsonSafe,
  waitForAccessToken,
} from '@/lib/api-base';
import { Box, SimpleGrid } from '@chakra-ui/react';
import { getBillingPeriodText, getPlanCtaLabel } from '@/lib/billing-display';

const BRAND_TEAL = '#0D9488';
const BRAND_TEAL_DARK = '#0b8278';

/** Real Stripe customers only — ignore legacy `cus_pending_<uuid>` placeholders. */
function isRealStripeCustomerId(id: string | null | undefined): id is string {
  return Boolean(id) && /^cus_[A-Za-z0-9]+$/.test(id as string) && !(id as string).startsWith('cus_pending_');
}


/**
 * Absolute origin for Stripe return URLs. Web uses the current origin; the
 * native shell (whose WebView origin has no server) uses the deployed app URL.
 */
function checkoutOrigin(): string {
  if (typeof window === 'undefined') return '';
  return getApiBase() || window.location.origin;
}

// ─── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    active: { bg: '#c6f6d5', text: '#22543d' },
    trialing: { bg: '#bee3f8', text: '#2a4365' },
    past_due: { bg: '#fed7d7', text: '#742a2a' },
    canceled: { bg: '#e2e8f0', text: '#4a5568' },
    incomplete: { bg: '#fefcbf', text: '#744210' },
  };
  const c = colors[status] || colors.canceled;

  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      backgroundColor: c.bg,
      color: c.text,
    }}>
      {status.replace('_', ' ')}
    </span>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { subscription, isActive, isTrialing, isCanceled, isPastDue, loading, error, refresh } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Stripe config check must happen server-side (STRIPE_SECRET_KEY is server-only).
  // Fetch the real value once on mount so we only show pricing/CTAs when Stripe
  // is actually configured, instead of hardcoding true and failing on click.
  const [stripeReady, setStripeReady] = useState(false);
  const [stripeStatusLoading, setStripeStatusLoading] = useState(true);
  const [stripeStatusError, setStripeStatusError] = useState<'signed_out' | 'error' | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    // Never leave "Checking payment configuration…" on screen. A stuck
    // getSession()/fetch is bounded to ~2s; after that the page lets the user
    // try checkout anyway (the route returns a clear 503 if Stripe is unset).
    const deadline = setTimeout(() => {
      if (cancelled) return;
      controller.abort();
      setStripeStatusError('error');
      setStripeStatusLoading(false);
    }, 2000);

    (async () => {
      try {
        // The Supabase session can still be hydrating on first mount. Prefer a
        // token that is already available and only wait briefly if it is not.
        const accessToken = await Promise.race([
          (async () =>
            (await getAccessToken()) ||
            (await waitForAccessToken({ attempts: 2, delayMs: 100, timeoutMs: 400 })))(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1800)),
        ]);
        if (cancelled) return;
        if (!accessToken) {
          setStripeStatusError('signed_out');
          return;
        }

        const res = await fetch(apiUrl('/api/billing/status'), {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          if (!cancelled) setStripeStatusError('error');
          return;
        }
        const data = await parseJsonSafe(res);
        if (!cancelled) setStripeReady(Boolean(data?.configured));
      } catch {
        if (!cancelled && !controller.signal.aborted) setStripeStatusError('error');
      } finally {
        clearTimeout(deadline);
        if (!cancelled) setStripeStatusLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(deadline);
      controller.abort();
    };
  }, []);

  // ── Checkout: Subscribe ─────────────────────────────────────────────────
  const handleSubscribe = async (priceType: 'monthly' | 'yearly') => {
    setCheckoutLoading(true);
    setActionError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setActionError('Please log in to subscribe.');
        setCheckoutLoading(false);
        return;
      }

      const res = await fetch(apiUrl('/api/billing/create-checkout-session'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          priceType,
          // Stripe requires absolute return URLs. On the web this is the
          // current origin; on native it is the deployed app URL.
          successUrl: `${checkoutOrigin()}/settings/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${checkoutOrigin()}/settings/billing`,
        }),
      });

      const data = await parseJsonSafe(res);

      if (!res.ok) {
        setActionError(data.error || 'Failed to create checkout session.');
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // ── Portal: Manage subscription ─────────────────────────────────────────
  const handleManage = async () => {
    setPortalLoading(true);
    setActionError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setActionError('Please log in.');
        setPortalLoading(false);
        return;
      }

      const res = await fetch(apiUrl('/api/billing/create-portal-session'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await parseJsonSafe(res);

      if (!res.ok) {
        setActionError(data.error || 'Failed to open billing portal.');
        return;
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setPortalLoading(false);
    }
  };

  // ── Format date ─────────────────────────────────────────────────────────
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // ── Calculate trial days remaining ──────────────────────────────────────
  const getTrialDaysLeft = () => {
    // Use trial_end for trialing subscriptions (current_period_end may be NULL
    // for newly-created trial rows from the DB trigger)
    if (!subscription?.trial_end) return 0;
    const end = new Date(subscription.trial_end).getTime();
    const now = Date.now();
    return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  };

  // ── Check for success from checkout ─────────────────────────────────────
  useEffect(() => {
    // Redirect to success page if coming from checkout
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      router.replace('/settings/billing/success');
    }
  }, [searchParams, router]);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{
          width: '200px', height: '28px', backgroundColor: '#e2e8f0',
          borderRadius: '6px', marginBottom: '24px',
        }} />
        <div style={{
          width: '100%', height: '300px', backgroundColor: '#f7fafc',
          borderRadius: '12px', border: '1px solid #e2e8f0',
        }} />
      </div>
    );
  }

  if (error && !subscription) {
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>
          Billing & Subscription
        </h1>
        <div style={{
          padding: '20px', backgroundColor: '#fff5f5', borderRadius: '10px',
          border: '1px solid #fed7d7', color: '#742a2a',
        }}>
          <p style={{ fontWeight: 600, marginBottom: '8px' }}>Unable to load subscription</p>
          <p style={{ fontSize: '14px', opacity: 0.8 }}>{error}</p>
          <button
            onClick={refresh}
            style={{
              marginTop: '12px', padding: '8px 16px', backgroundColor: '#742a2a',
              color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Pro users manage everything (including plan switches) through the Stripe
  // portal. Show Manage whenever a real Stripe customer exists — including
  // past_due/canceled — but hide pricing/upgrade CTAs once the plan is active.
  const hasRealCustomer = isRealStripeCustomerId(subscription?.stripe_customer_id);
  const showManageButton = Boolean(stripeReady && hasRealCustomer);
  const showPricingCards =
    !(isActive && !isCanceled) &&
    (stripeReady || stripeStatusLoading || stripeStatusError === 'error');
  const currentPlan = subscription?.price_type || null;
  const hasSubscription = Boolean(subscription);
  const planActionsDisabled = checkoutLoading || stripeStatusLoading;

  const planCta = (priceType: 'monthly' | 'yearly') =>
    getPlanCtaLabel({
      priceType,
      currentPlan,
      isActive,
      isTrialing,
      hasSubscription,
    });

  const billingPeriodText = getBillingPeriodText({
    priceType: subscription?.price_type,
    isTrialing,
    trialEnd: subscription?.trial_end,
    formatDate,
  });

  return (
    <Box px={{ base: '4', md: '8' }} pt={{ base: '2', md: '8' }} pb={{ base: '4', md: '8' }} maxW="720px" mx="auto">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
        Billing & Subscription
      </h1>
      <p style={{ color: '#718096', fontSize: '15px', marginBottom: '28px' }}>
        Manage your WorshipCenter subscription and billing.
      </p>

      {/* ── Error Banner ───────────────────────────────────────────────── */}
      {actionError && (
        <div style={{
          padding: '14px 18px', backgroundColor: '#fff5f5', borderRadius: '10px',
          border: '1px solid #fed7d7', color: '#742a2a', marginBottom: '20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '14px' }}>{actionError}</span>
          <button onClick={() => setActionError(null)} style={{
            background: 'none', border: 'none', color: '#742a2a',
            cursor: 'pointer', fontSize: '18px', fontWeight: 700,
          }}>×</button>
        </div>
      )}

      {/* ── Past Due Warning ───────────────────────────────────────────── */}
      {isPastDue && (
        <div style={{
          padding: '20px', backgroundColor: '#fffaf0', borderRadius: '10px',
          border: '1px solid #fbd38d', marginBottom: '20px',
        }}>
          <p style={{ fontWeight: 600, color: '#744210', marginBottom: '8px' }}>
            ⚠️ Payment Overdue
          </p>
          <p style={{ fontSize: '14px', color: '#744210', marginBottom: '12px' }}>
            Your last payment failed. Please update your payment method to avoid service interruption.
          </p>
          {stripeReady && (
            <button
              onClick={handleManage}
              disabled={portalLoading}
              style={{
                padding: '8px 16px', backgroundColor: '#dd6b20', color: '#fff',
                border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600,
              }}
            >
              {portalLoading ? 'Loading...' : 'Update Payment Method'}
            </button>
          )}
        </div>
      )}

      {/* ── Current Plan Card ──────────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#fff', borderRadius: '12px',
        border: '1px solid #e2e8f0', padding: '32px', marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#2d3748' }}>
              {isActive && !isCanceled ? 'Pro Plan' : isTrialing ? 'Free Trial' : 'Free Plan'}
            </h2>
            <StatusBadge status={subscription?.status || 'inactive'} />
          </div>
          {(isActive || isTrialing) && (
            <div style={{ textAlign: 'right', minWidth: '120px' }}>
              <span style={{ fontSize: '32px', fontWeight: 700, color: '#2d3748' }}>
                ${subscription?.price_type === 'yearly' ? PRICING.yearly.amount / 100 : PRICING.monthly.amount / 100}
              </span>
              <span style={{ fontSize: '14px', color: '#718096', marginLeft: '4px' }}>
                /{subscription?.price_type === 'yearly' ? 'year' : 'mo'}
              </span>
            </div>
          )}
        </div>

        {/* Plan details */}
        <div style={{
          backgroundColor: '#f7fafc', borderRadius: '8px', padding: '20px', marginBottom: '24px',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
          }}>
            <div>
              <p style={{ fontSize: '12px', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                {isTrialing ? 'Trial Ends' : isActive ? 'Renews On' : 'Status'}
              </p>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#2d3748' }}>
                {isTrialing
                  ? `${getTrialDaysLeft()} days left`
                  : isActive
                    ? formatDate(subscription?.current_period_end)
                    : 'No active subscription'}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Billing Period
              </p>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#2d3748' }}>
                {billingPeriodText}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Status
              </p>
              <StatusBadge status={subscription?.status || 'inactive'} />
            </div>
          </div>
          {isTrialing && (
            <p style={{ fontSize: '13px', color: '#718096', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
              Your trial ends on {formatDate(subscription?.trial_end)}. Upgrade now to continue using all features.
            </p>
          )}
          {subscription?.canceled_at && (
            <p style={{ fontSize: '13px', color: '#e53e3e', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #fed7d7' }}>
              Canceled on {formatDate(subscription.canceled_at)} — you can still use Pro features until {formatDate(subscription.current_period_end)}.
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {showManageButton && stripeReady && (
            <button
              onClick={handleManage}
              disabled={portalLoading}
              style={{
                padding: '12px 24px', backgroundColor: BRAND_TEAL, color: '#fff',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 600, fontSize: '14px', transition: 'all 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = BRAND_TEAL_DARK}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = BRAND_TEAL}
            >
              {portalLoading ? 'Loading...' : 'Manage Subscription'}
            </button>
          )}
        </div>
      </div>

      {/* ── Pricing Cards ──────────────────────────────────────────────── */}
      {showPricingCards && (
        <div style={{
          backgroundColor: '#fff', borderRadius: '12px',
          border: '1px solid #e2e8f0', padding: '32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#2d3748' }}>
              {isCanceled ? 'Resubscribe to Pro' : isActive ? 'Switch Your Plan' : 'Choose Your Plan'}
            </h3>
            <p style={{ color: '#718096', fontSize: '15px', lineHeight: '1.6' }}>
              {isActive && !isCanceled
                ? 'Switch plans anytime — changes are prorated automatically.'
                : 'Unlock unlimited services, team members, and powerful features to grow your ministry.'}
            </p>
          </div>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing="5">
            {/* Monthly */}
            <div style={{
              padding: '28px', borderRadius: '12px',
              border: currentPlan === 'monthly' ? '2px solid #38a169' : '1px solid #e2e8f0',
              textAlign: 'center', position: 'relative',
              backgroundColor: currentPlan === 'monthly' ? '#f0fff4' : '#fff',
              transition: 'all 0.2s',
            }}>
              {currentPlan === 'monthly' && (
                <span style={{
                  position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                  backgroundColor: '#38a169', color: '#fff', fontSize: '11px', fontWeight: 700,
                  padding: '4px 12px', borderRadius: '9999px', textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Current Plan
                </span>
              )}
              <p style={{ fontSize: '14px', color: '#718096', marginBottom: '12px', fontWeight: 600 }}>
                Monthly
              </p>
              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '40px', fontWeight: 700, color: '#2d3748' }}>
                  ${PRICING.monthly.amount / 100}
                </span>
                <span style={{ fontSize: '15px', color: '#718096', marginLeft: '4px' }}>
                  /month
                </span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', textAlign: 'left' }}>
                {[
                  'Unlimited services',
                  'Unlimited team members',
                  'Advanced reporting',
                  'Priority support',
                ].map((feature, i) => (
                  <li key={i} style={{
                    padding: '8px 0',
                    fontSize: '14px',
                    color: '#4a5568',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <span style={{ color: '#38a169', fontSize: '16px' }}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe('monthly')}
                disabled={planActionsDisabled || currentPlan === 'monthly'}
                style={{
                  width: '100%', padding: '14px 24px',
                  backgroundColor: currentPlan === 'monthly' ? '#e2e8f0' : planActionsDisabled ? '#e2e8f0' : BRAND_TEAL,
                  color: currentPlan === 'monthly' ? '#a0aec0' : planActionsDisabled ? '#a0aec0' : '#fff',
                  border: 'none', borderRadius: '8px',
                  cursor: currentPlan === 'monthly' ? 'default' : 'pointer',
                  fontWeight: 600, fontSize: '14px',
                  transition: 'all 0.2s',
                }}
              >
                {currentPlan === 'monthly'
                  ? 'Current Plan'
                  : !stripeReady && stripeStatusLoading
                    ? 'Checking…'
                    : checkoutLoading
                      ? 'Processing...'
                      : planCta('monthly')}
              </button>
            </div>

            {/* Yearly */}
            <div style={{
              padding: '28px', borderRadius: '12px',
              border: currentPlan === 'yearly' ? '2px solid #38a169' : `2px solid ${BRAND_TEAL}`,
              textAlign: 'center', position: 'relative',
              backgroundColor: currentPlan === 'yearly' ? '#f0fff4' : '#fff',
              transition: 'all 0.2s',
            }}>
              {currentPlan === 'yearly' ? (
                <span style={{
                  position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                  backgroundColor: '#38a169', color: '#fff', fontSize: '11px', fontWeight: 700,
                  padding: '4px 12px', borderRadius: '9999px', textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Current Plan
                </span>
              ) : (
                <span style={{
                  position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                  backgroundColor: BRAND_TEAL, color: '#fff', fontSize: '11px', fontWeight: 700,
                  padding: '4px 12px', borderRadius: '9999px', textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Best Value
                </span>
              )}
              <p style={{ fontSize: '14px', color: '#718096', marginBottom: '12px', fontWeight: 600 }}>
                Yearly
              </p>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '40px', fontWeight: 700, color: '#2d3748' }}>
                  ${PRICING.yearly.amount / 100}
                </span>
                <span style={{ fontSize: '15px', color: '#718096', marginLeft: '4px' }}>
                  /year
                </span>
              </div>
              <p style={{ fontSize: '13px', color: BRAND_TEAL, fontWeight: 600, marginBottom: '20px' }}>
                Save $58 (2 months free)
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', textAlign: 'left' }}>
                {[
                  'Unlimited services',
                  'Unlimited team members',
                  'Advanced reporting',
                  'Priority support',
                ].map((feature, i) => (
                  <li key={i} style={{
                    padding: '8px 0',
                    fontSize: '14px',
                    color: '#4a5568',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <span style={{ color: BRAND_TEAL, fontSize: '16px' }}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe('yearly')}
                disabled={planActionsDisabled || currentPlan === 'yearly'}
                style={{
                  width: '100%', padding: '14px 24px',
                  backgroundColor: currentPlan === 'yearly' ? '#e2e8f0' : planActionsDisabled ? '#e2e8f0' : BRAND_TEAL,
                  color: currentPlan === 'yearly' ? '#a0aec0' : planActionsDisabled ? '#a0aec0' : '#fff',
                  border: 'none', borderRadius: '8px',
                  cursor: currentPlan === 'yearly' ? 'default' : 'pointer',
                  fontWeight: 600, fontSize: '14px',
                  transition: 'all 0.2s',
                }}
              >
                {currentPlan === 'yearly'
                  ? 'Current Plan'
                  : !stripeReady && stripeStatusLoading
                    ? 'Checking…'
                    : checkoutLoading
                      ? 'Processing...'
                      : planCta('yearly')}
              </button>
            </div>
          </SimpleGrid>
        </div>
      )}

      {/* ── Stripe status ─────────────────────────────────────────────── */}
      {stripeStatusLoading ? (
        <div style={{
          padding: '20px', backgroundColor: '#f7fafc', borderRadius: '10px',
          border: '1px solid #e2e8f0', marginTop: '16px',
        }}>
          <p style={{ fontSize: '14px', color: '#718096' }}>
            Checking payment configuration…
          </p>
        </div>
      ) : stripeStatusError === 'signed_out' ? (
        <div style={{
          padding: '20px', backgroundColor: '#fffaf0', borderRadius: '10px',
          border: '1px solid #fbd38d', marginTop: '16px',
        }}>
          <p style={{ fontWeight: 600, color: '#744210', marginBottom: '8px' }}>
            Please log in
          </p>
          <p style={{ fontSize: '14px', color: '#744210' }}>
            Log in to manage your subscription and billing.
          </p>
        </div>
      ) : stripeStatusError ? (
        <div style={{
          padding: '20px', backgroundColor: '#f7fafc', borderRadius: '10px',
          border: '1px solid #e2e8f0', marginTop: '16px',
        }}>
          <p style={{ fontWeight: 600, color: '#4a5568', marginBottom: '8px' }}>
            Unable to check billing status
          </p>
          <p style={{ fontSize: '14px', color: '#718096' }}>
            We couldn&apos;t confirm payment configuration. You can still try
            upgrading below.
          </p>
        </div>
      ) : !stripeReady ? (
        <div style={{
          padding: '20px', backgroundColor: '#f7fafc', borderRadius: '10px',
          border: '1px solid #e2e8f0', marginTop: '16px',
        }}>
          <p style={{ fontWeight: 600, color: '#4a5568', marginBottom: '8px' }}>
            💳 Payment System Not Configured
          </p>
          <p style={{ fontSize: '14px', color: '#718096' }}>
            Stripe is not set up yet. Contact support if you need to manage your subscription.
          </p>
        </div>
      ) : null}
    </Box>
  );
}