'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { StoreProvider } from '@/lib/StoreContext';
import { db } from '@/lib/store';
import AppShell from '@/components/layout/AppShell';
import { SubscriptionGate } from '@/components/layout/SubscriptionGate';
import { Center, Spinner, VStack, Text } from '@chakra-ui/react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    console.log('[AppLayout] Check:', { loading, hasUser: !!user, role: user?.role, pathname });
    
    if (!loading) {
      if (!user) {
        console.log('[AppLayout] No user found, redirecting to /login');
        router.replace('/login');
        return;
      }
      
      // Role-Based Route Protection
      if (user.role === 'team') {
        // Team members can view services and songs (read-only), but not manage team, templates, or usage
        const restrictedPrefixes = ['/team', '/templates', '/usage'];
        
        if (restrictedPrefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix))) {
          console.log('[AppLayout] Team role restricted, redirecting to /dashboard');
          router.replace('/dashboard');
        }
      }
    }
  }, [user, loading, router, pathname]);

  if (loading) {
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
      <AppShell>
        {isAlwaysAccessible ? children : <SubscriptionGate>{children}</SubscriptionGate>}
      </AppShell>
    </StoreProvider>
  );
}
