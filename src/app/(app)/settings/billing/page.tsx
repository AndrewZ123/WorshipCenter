/**
 * Billing Page — Complete Rebuild
 *
 * Handles all subscription states:
 * 1. Loading → Skeleton
 * 2. Trial → Show upgrade CTA with trial info
 * 3. Active → Show plan details + manage/cancel buttons
 * 4. Past Due → Show warning + link to update payment
 * 5. Canceled → Show re-subscribe CTA
 *
 * Flow: Checkout Session → Stripe hosted page → webhook activates subscription
 */

'use client';

import { useState } from 'react';
import { useSubscription } from '@/lib/useSubscription';
import { isStripeConfigured, PRICING } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import SyncSubscriptionButton from '@/components/billing/SyncSubscriptionButton';

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
  const { subscription, isActive, isTrialing, isCanceled, isPastDue, loading, error, refresh } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const stripeReady = isStripeConfigured();

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

      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ priceType }),
      });

      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || 'Failed to create checkout session.');
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      setActionError(err.message || 'Network error');
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

      const res = await fetch('/api/billing/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || 'Failed to open billing portal.');
        return;
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    } catch (err: any) {
      setActionError(err.message || 'Network error');
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
    if (!subscription?.current_period_end) return 0;
    const end = new Date(subscription.current_period_end).getTime();
    const now = Date.now();
    return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  };

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

  const showSubscribeButtons = !isActive || isCanceled;
  const showManageButton = isActive && !isCanceled;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
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
        border: '1px solid #e2e8f0', padding: '28px', marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
              {isActive && !isCanceled ? 'Pro Plan' : isTrialing ? 'Free Trial' : 'Free Plan'}
            </h2>
            <StatusBadge status={subscription?.status || 'inactive'} />
          </div>
          {(isActive || isTrialing) && (
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '28px', fontWeight: 700, color: '#2d3748' }}>
                ${subscription?.price_type === 'yearly' ? PRICING.yearly.amount / 100 : PRICING.monthly.amount / 100}
              </span>
              <span style={{ fontSize: '14px', color: '#718096' }}>
                /{subscription?.price_type === 'yearly' ? 'year' : 'mo'}
              </span>
            </div>
          )}
        </div>

        {/* Plan details grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '16px', paddingTop: '20px', borderTop: '1px solid #edf2f7',
        }}>
          <div>
            <p style={{ fontSize: '12px', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              {isTrialing ? 'Trial Ends' : isActive ? 'Renews On' : 'Status'}
            </p>
            <p style={{ fontSize: '15px', fontWeight: 500, color: '#2d3748' }}>
              {isTrialing
                ? `${getTrialDaysLeft()} days left (${formatDate(subscription?.current_period_end)})`
                : isActive
                  ? formatDate(subscription?.current_period_end)
                  : 'No active subscription'}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Billing Period
            </p>
            <p style={{ fontSize: '15px', fontWeight: 500, color: '#2d3748' }}>
              {subscription?.price_type === 'yearly' ? 'Yearly' : subscription?.price_type === 'monthly' ? 'Monthly' : '—'}
            </p>
          </div>
          {subscription?.canceled_at && (
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={{ fontSize: '13px', color: '#e53e3e' }}>
                Canceled on {formatDate(subscription.canceled_at)} — you can still use Pro features until {formatDate(subscription.current_period_end)}.
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {showManageButton && stripeReady && (
            <button
              onClick={handleManage}
              disabled={portalLoading}
              style={{
                padding: '10px 20px', backgroundColor: '#4a5568', color: '#fff',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 600, fontSize: '14px',
              }}
            >
              {portalLoading ? 'Loading...' : 'Manage Subscription'}
            </button>
          )}
          <SyncSubscriptionButton onSynced={refresh} />
        </div>
      </div>

      {/* ── Upgrade/Resubscribe Card ───────────────────────────────────── */}
      {showSubscribeButtons && stripeReady && (
        <div style={{
          backgroundColor: '#fff', borderRadius: '12px',
          border: '1px solid #e2e8f0', padding: '28px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
            {isCanceled ? 'Resubscribe to Pro' : 'Upgrade to Pro'}
          </h3>
          <p style={{ color: '#718096', fontSize: '14px', marginBottom: '24px' }}>
            Unlock unlimited services, songs, team members, and more.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Monthly */}
            <div style={{
              padding: '20px', borderRadius: '10px',
              border: '1px solid #e2e8f0', textAlign: 'center',
            }}>
              <p style={{ fontSize: '13px', color: '#718096', marginBottom: '8px', fontWeight: 500 }}>
                Monthly
              </p>
              <p style={{ fontSize: '32px', fontWeight: 700, color: '#2d3748', marginBottom: '4px' }}>
                ${PRICING.monthly.amount / 100}
              </p>
              <p style={{ fontSize: '13px', color: '#a0aec0', marginBottom: '16px' }}>per month</p>
              <button
                onClick={() => handleSubscribe('monthly')}
                disabled={checkoutLoading}
                style={{
                  width: '100%', padding: '10px 16px',
                  backgroundColor: checkoutLoading ? '#e2e8f0' : '#3182ce',
                  color: checkoutLoading ? '#a0aec0' : '#fff',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                  fontWeight: 600, fontSize: '14px',
                }}
              >
                {checkoutLoading ? 'Processing...' : 'Subscribe Monthly'}
              </button>
            </div>

            {/* Yearly */}
            <div style={{
              padding: '20px', borderRadius: '10px',
              border: '2px solid #3182ce', textAlign: 'center',
              position: 'relative',
            }}>
              <span style={{
                position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
                backgroundColor: '#3182ce', color: '#fff', fontSize: '11px', fontWeight: 700,
                padding: '2px 10px', borderRadius: '9999px', textTransform: 'uppercase',
              }}>
                Save 25%
              </span>
              <p style={{ fontSize: '13px', color: '#718096', marginBottom: '8px', fontWeight: 500 }}>
                Yearly
              </p>
              <p style={{ fontSize: '32px', fontWeight: 700, color: '#2d3748', marginBottom: '4px' }}>
                ${PRICING.yearly.amount / 100}
              </p>
              <p style={{ fontSize: '13px', color: '#a0aec0', marginBottom: '16px' }}>
                per year (${(PRICING.yearly.amount / 100 / 12).toFixed(0)}/mo)
              </p>
              <button
                onClick={() => handleSubscribe('yearly')}
                disabled={checkoutLoading}
                style={{
                  width: '100%', padding: '10px 16px',
                  backgroundColor: checkoutLoading ? '#e2e8f0' : '#3182ce',
                  color: checkoutLoading ? '#a0aec0' : '#fff',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                  fontWeight: 600, fontSize: '14px',
                }}
              >
                {checkoutLoading ? 'Processing...' : 'Subscribe Yearly'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stripe Not Configured ──────────────────────────────────────── */}
      {!stripeReady && (
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
      )}
    </div>
  );
}