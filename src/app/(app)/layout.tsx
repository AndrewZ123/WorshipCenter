
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
import ProfileSetupWizard from '@/components/onboarding/ProfileSetupWizard';
import { Center, Spinner, VStack, Text } from '@chakra-ui/react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signedOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sessionState, setSessionState] = React.useState({
    checked: false,
    hasSession: false,
  });

  // An explicit sign-out means there is no session to hydrate. Mark the check
  // complete immediately so we redirect instead of showing "Logging you in...".
  React.useEffect(() => {
    if (signedOut) {
      setSessionState({ checked: true, hasSession: false });
    }
  }, [signedOut]);

  // When the profile is missing, check the actual Supabase session before
  // redirecting. During signup the profile row can lag behind SIGNED_IN.
  React.useEffect(() => {
    if (signedOut) return;
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
  }, [user, loading, signedOut]);

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

  // Silently refresh an already-granted APNs token after sign-in. This never
  // prompts; the explicit Settings toggle requests permission.
  React.useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    import('@/lib/capacitor-push')
      .then(({ registerPushNotifications }) => {
        if (!cancelled) void registerPushNotifications();
      })
      .catch(() => {
        // Push is optional.
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Push taps and universal links both dispatch this event.
  React.useEffect(() => {
    const handleDeepLink = (event: Event) => {
      const path = (event as CustomEvent<{ path?: string }>).detail?.path;
      if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')) {
        router.push(path);
      }
    };

    window.addEventListener('mobile-deep-link', handleDeepLink);
    return () => window.removeEventListener('mobile-deep-link', handleDeepLink);
  }, [router]);

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
    // Sign-out already cleared the session: go straight to /login rather than
    // showing the hydration spinner this route uses for profile loading.
    if (signedOut) return null;

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
