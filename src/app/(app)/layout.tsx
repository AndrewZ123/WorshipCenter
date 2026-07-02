
'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { StoreProvider } from '@/lib/StoreContext';
import { db } from '@/lib/store';
import AppShell from '@/components/layout/AppShell';
import { SubscriptionGate } from '@/components/layout/SubscriptionGate';
import { SubscriptionProvider } from '@/components/providers/SubscriptionProvider';
import { Center, Spinner, VStack, Text } from '@chakra-ui/react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Track whether auth has ever completed once — prevents spinner flash
  // on subsequent tab navigations.
  const hasLoadedOnce = React.useRef(false);
  if (!loading && user) hasLoadedOnce.current = true;

  React.useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
        return;
      }
      
      // Role-Based Route Protection
      if (user.role === 'team') {
        // Team members can view services and songs (read-only), but not manage team, templates, or usage
        const restrictedPrefixes = ['/team', '/templates', '/usage'];
        
        if (restrictedPrefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix))) {
          router.replace('/dashboard');
        }
      }
    }
  }, [user, loading, router, pathname]);

  // Show spinner only on initial page load, not on subsequent tab navigations.
  // After auth has resolved once, render children immediately and let them
  // handle their own loading states.
  if (loading && !hasLoadedOnce.current) {
    return (
      <Center h="100vh">
        <VStack spacing="4">
          <Spinner size="xl" color="brand.500" thickness="4px" />
          <Text color="gray.500" fontWeight="500">Checking authentication...</Text>
        </VStack>
      </Center>
    );
  }

  if (!user) {
    return (
      <Center h="100vh">
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
      <SubscriptionProvider>
        <AppShell>
          {isAlwaysAccessible ? children : <SubscriptionGate>{children}</SubscriptionGate>}
        </AppShell>
      </SubscriptionProvider>
    </StoreProvider>
  );
}
