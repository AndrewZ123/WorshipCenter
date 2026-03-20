'use client';

import { useState } from 'react';
import { Button, HStack, Icon, Text, useToast } from '@chakra-ui/react';
import { FiRefreshCw } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';

interface SyncSubscriptionButtonProps {
  onSyncComplete?: () => void;
}

export default function SyncSubscriptionButton({ onSyncComplete }: SyncSubscriptionButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const toast = useToast();

  const handleSync = async () => {
    setIsSyncing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch('/api/billing/sync-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync subscription');
      }

      // Show success message
      toast({
        title: 'Subscription synced',
        description: data.previousStatus !== data.newStatus
          ? `Status updated from ${data.previousStatus} to ${data.newStatus}`
          : 'Your subscription is up to date',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Call completion callback
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: 'Sync failed',
        description: error.message || 'Unable to sync subscription. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      isLoading={isSyncing}
      leftIcon={<FiRefreshCw />}
      onClick={handleSync}
    >
      <HStack spacing={2}>
        <Icon as={FiRefreshCw} />
        <Text>Sync Status</Text>
      </HStack>
    </Button>
  );
}