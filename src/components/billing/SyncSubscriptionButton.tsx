/**
 * SyncSubscriptionButton
 *
 * Calls /api/billing/sync-subscription to manually pull the latest
 * subscription state from Stripe into our DB.
 */

'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PRICING } from '@/lib/stripe';

interface SyncSubscriptionButtonProps {
  onSynced?: () => void;
}

export default function SyncSubscriptionButton({ onSynced }: SyncSubscriptionButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMessage({ text: 'Not authenticated', type: 'error' });
        setSyncing(false);
        return;
      }

      const res = await fetch('/api/billing/sync-subscription', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ text: data.error || 'Sync failed', type: 'error' });
      } else {
        setMessage({ text: data.message || 'Synced successfully', type: 'success' });
        onSynced?.();
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Network error', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleSync}
        disabled={syncing}
        style={{
          padding: '8px 16px',
          fontSize: '14px',
          backgroundColor: syncing ? '#e2e8f0' : '#4a5568',
          color: syncing ? '#a0aec0' : '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: syncing ? 'not-allowed' : 'pointer',
          fontWeight: 500,
        }}
      >
        {syncing ? 'Syncing...' : '🔄 Sync with Stripe'}
      </button>
      {message && (
        <p style={{
          marginTop: '8px',
          fontSize: '13px',
          color: message.type === 'error' ? '#e53e3e' : '#38a169',
        }}>
          {message.text}
        </p>
      )}
    </div>
  );
}