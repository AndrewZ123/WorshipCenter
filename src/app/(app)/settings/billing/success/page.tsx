'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { apiUrl } from '@/lib/api-base';

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          router.push('/login');
          return;
        }

        const res = await fetch(apiUrl('/api/billing/status'), {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setSubscription(data.subscription);
        }
      } catch (error) {
        console.error('Failed to fetch subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [router]);

  const planName = subscription?.price_type === 'yearly' ? 'Yearly Pro Plan' : 'Monthly Pro Plan';
  const amount = subscription?.price_type === 'yearly' ? '$290' : '$29';
  const period = subscription?.price_type === 'yearly' ? 'per year' : 'per month';

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Success Animation */}
      <div style={{
        textAlign: 'center',
        marginBottom: '32px',
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          backgroundColor: '#f0fff4',
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          animation: 'scaleIn 0.5s ease-out',
        }}>
          <span style={{ fontSize: '40px' }}>✅</span>
        </div>
        
        <h1 style={{
          fontSize: '32px',
          fontWeight: 700,
          color: '#2d3748',
          marginBottom: '12px',
        }}>
          Welcome to Pro!
        </h1>
        
        <p style={{
          fontSize: '16px',
          color: '#718096',
          marginBottom: '8px',
        }}>
          Your subscription is now active
        </p>
      </div>

      {/* Success Card */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '32px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e2e8f0',
              borderTopColor: '#3182ce',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto',
            }} />
          </div>
        ) : (
          <>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#2d3748',
              marginBottom: '20px',
            }}>
              Subscription Details
            </h2>

            <div style={{
              display: 'grid',
              gap: '16px',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                backgroundColor: '#f7fafc',
                borderRadius: '8px',
              }}>
                <span style={{ fontSize: '14px', color: '#718096' }}>Plan</span>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#2d3748' }}>
                  {planName}
                </span>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                backgroundColor: '#f7fafc',
                borderRadius: '8px',
              }}>
                <span style={{ fontSize: '14px', color: '#718096' }}>Amount</span>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#2d3748' }}>
                  {amount}
                </span>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                backgroundColor: '#f7fafc',
                borderRadius: '8px',
              }}>
                <span style={{ fontSize: '14px', color: '#718096' }}>Billing</span>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#2d3748' }}>
                  {period}
                </span>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                backgroundColor: '#f7fafc',
                borderRadius: '8px',
              }}>
                <span style={{ fontSize: '14px', color: '#718096' }}>Status</span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  backgroundColor: '#c6f6d5',
                  color: '#22543d',
                }}>
                  Active
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* What's Next */}
      <div style={{
        backgroundColor: '#ebf8ff',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #bee3f8',
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#2c5282',
          marginBottom: '12px',
        }}>
          What's Next?
        </h3>
        <ul style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
        }}>
          {[
            'Create unlimited services',
            'Invite unlimited team members',
            'Access advanced reporting',
            'Use all Pro features',
          ].map((item, i) => (
            <li key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 0',
            }}>
              <span style={{ color: '#2c5282', fontSize: '18px' }}>✓</span>
              <span style={{ fontSize: '14px', color: '#2c5282' }}>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
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
          onClick={() => router.push('/settings/billing')}
          style={{
            flex: 1,
            padding: '12px 24px',
            backgroundColor: '#fff',
            color: '#3182ce',
            border: '2px solid #3182ce',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            minWidth: '200px',
          }}
        >
          Manage Subscription
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