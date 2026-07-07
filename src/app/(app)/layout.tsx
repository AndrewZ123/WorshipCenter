
'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { StoreProvider } from '@/lib/StoreContext';
import { db } from '@/lib/store';
import AppShell from '@/components/layout/AppShell';
import { SubscriptionGate } from '@/components/layout/SubscriptionGate';
import { SubscriptionProvider } from '@/components/providers/SubscriptionProvider';
import { TourProvider } from '@/lib/tour/TourContext';
import { PermissionsProvider } from '@/lib/PermissionsContext';
import { Center, Spinner, VStack, Text } from '@chakra-ui/react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
        return;
      }

      // All non-admin users (team + leader) are restricted from admin-only routes
      if (user.role !== 'admin') {
        const restrictedPrefixes = [
          '/team',
          '/templates',
          '/usage',
          '/reports',
          '/services/debriefs',
          '/settings/billing',
        ];

        if (restrictedPrefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix))) {
          router.replace('/dashboard');
        }
      }
    }
  }, [user, loading, router, pathname]);

  // Session is restored from localStorage synchronously (see auth.tsx init),
  // so loading is only true on the very first visit or after logout.
  // No spinner flash on page refresh or tab navigation.
  if (loading) {
    return (
      <Center h="100dvh">
        <VStack spacing="4">
          <Spinner size="xl" color="brand.500" thickness="4px" />
          <Text color="gray.500" fontWeight="500">Checking authentication...</Text>
        </VStack>
      </Center>
    );
  }

  if (!user) {
    return (
      <Center h="100dvh">
        <VStack spacing="4">
          <Spinner size="xl" color="brand.500" thickness="4px" />
          <Text color="gray.500" fontWeight="500">Logging you in...</Text>
        </VStack>
      </Center>
    );
  }

  // Pages that should always be accessible (even when subscription expired)
  const alwaysAccessiblePaths = ['/settings/billing'];
  const isAlwaysAccessible = alwaysAccessiblePaths.some(path => pathname.startsWith(path));

  // Wrap with subscription gate unless it's an always-accessible path
  return (
    <StoreProvider store={db}>
      <PermissionsProvider>
        <SubscriptionProvider>
          <TourProvider>
            <AppShell>
              {isAlwaysAccessible ? children : <SubscriptionGate>{children}</SubscriptionGate>}
            </AppShell>
          </TourProvider>
        </SubscriptionProvider>
      </PermissionsProvider>
    </StoreProvider>
  );
}
