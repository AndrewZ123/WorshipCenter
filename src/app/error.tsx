'use client';

import { Button, Center, Heading, Text, VStack } from '@chakra-ui/react';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { isSentryEnabled } from '@/lib/sentry-enabled';

/**
 * Root App Router error boundary. Catches render/data errors below the root
 * layout and reports them to Sentry only when the browser SDK is configured.
 *
 * The UI stays generic on purpose: the error message, stack, and any user
 * data stay out of the page. Sentry is also configured without default PII.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isSentryEnabled(process.env.NEXT_PUBLIC_SENTRY_DSN)) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <Center minH="100vh" p="8">
      <VStack spacing="4" textAlign="center">
        <Heading size="md">Something went wrong</Heading>
        <Text fontSize="sm" color="gray.500">
          The page could not be loaded. Try again, reload, or return home.
        </Text>
        <Button size="sm" colorScheme="teal" onClick={reset}>
          Try again
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
          Reload page
        </Button>
        <Button size="sm" variant="ghost" onClick={() => window.location.assign('/')}>
          Go home
        </Button>
      </VStack>
    </Center>
  );
}
