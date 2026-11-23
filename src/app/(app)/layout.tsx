
'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { shouldRedirectToLogin } from '@/lib/auth-routing';
import { StoreProvider } from '@/lib/StoreContext';
import { db } from '@/lib/store';
import AppShell from '@/components/layout/AppShell';
import { SubscriptionGate } from '@/components/layout/SubscriptionGate';
import { SubscriptionProvider } from '@/components/providers/SubscriptionProvider';
import { TourProvider } from '@/lib/tour/TourContext';
import { PermissionsProvider } from '@/lib/PermissionsContext';
import { OfflineProvider } from '@/lib/offline/OfflineContext';
import { OfflineIndicator } from '@/components/layout/OfflineIndicator';
import ProfileSetupWizard from '@/components/onboarding/ProfileSetupWizard';
import { Center, Spinner, VStack, Text } from '@chakra-ui/react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sessionState, setSessionState] = React.useState({
    checked: false,
    hasSession: false,
  });

  // When the profile is missing, check the actual Supabase session before
  // redirecting. During signup the profile row can lag behind SIGNED_IN.
  React.useEffect(() => {
    if (loading) {
      setSessionState({ checked: false, hasSession: false });
      return;
    }

    if (user) {
      setSessionState({ checked: true, hasSession: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) {
          setSessionState({ checked: true, hasSession: Boolean(session?.user) });
        }
      } catch {
        if (!cancelled) setSessionState({ checked: true, hasSession: false });
      }
    })();

    return () => { cancelled = true; };
  }, [user, loading]);

  React.useEffect(() => {
    if (shouldRedirectToLogin({
      loading,
      hasUser: Boolean(user),
      sessionChecked: sessionState.checked,
      hasSession: sessionState.hasSession,
    })) {
      router.replace('/login');
      return;
    }

    if (!loading && user && user.role !== 'admin') {
      // All non-admin users (team + leader) are restricted from admin-only routes
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
  }, [user, loading, sessionState.checked, sessionState.hasSession, router, pathname]);

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
            <OfflineProvider>
              <AppShell>
                <ProfileSetupWizard />
                {isAlwaysAccessible ? children : <SubscriptionGate>{children}</SubscriptionGate>}
              </AppShell>
            </OfflineProvider>
          </TourProvider>
        </SubscriptionProvider>
      </PermissionsProvider>
    </StoreProvider>
  );
}
