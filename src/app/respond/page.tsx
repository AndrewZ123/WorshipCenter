'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Heading,
  HStack,
  Link as ChakraLink,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { apiUrl, parseJsonSafe } from '@/lib/api-base';
import StatusBadge, { mapAssignmentStatus } from '@/components/ui/StatusBadge';
import {
  applyPreviewFailure,
  applyPreviewResult,
  applySubmitFailure,
  applySubmitResult,
  emptyRespondState,
  initialRespondState,
  INVALID_LINK_MESSAGE,
  type RespondAction,
  type RespondState,
} from '@/lib/respond-link';

const PREVIEW_TIMEOUT_MS = 15000;

function formatRole(role: string): string {
  return role
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatServiceDate(date: string | undefined): string {
  if (!date) return '';
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function RespondPage() {
  const [token, setToken] = useState('');
  const [action, setAction] = useState<RespondAction>('confirm');
  const [state, setState] = useState<RespondState>(() => emptyRespondState('loading'));
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Read the token from the real URL after mount instead of useSearchParams.
  // A statically prerendered page that calls useSearchParams is wrapped in a
  // Suspense hole; if that hole never resolves (the reported live hang), the
  // spinner stays forever. This effect always runs on hydration and always
  // ends loading with a concrete state.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search);
    const rawToken = params.get('t') || '';
    const initialAction: RespondAction =
      params.get('a') === 'decline' ? 'decline' : 'confirm';

    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time URL read on mount; there is no external store to subscribe to.
    setToken(rawToken);
    setAction(initialAction);

    const initial = initialRespondState(rawToken);
    setState(initial);
    if (initial.phase !== 'loading') {
      return () => controller.abort();
    }

    const timeoutId = window.setTimeout(
      () => controller.abort(),
      PREVIEW_TIMEOUT_MS
    );

    (async () => {
      try {
        const response = await fetch(
          apiUrl(`/api/assignments/respond?t=${encodeURIComponent(rawToken)}`),
          { signal: controller.signal }
        );
        const data = await parseJsonSafe(response);
        if (cancelled) return;
        setState((previous) =>
          applyPreviewResult(previous, {
            ok: response.ok,
            status: response.status,
            data,
          })
        );
      } catch {
        if (!cancelled) setState(() => applyPreviewFailure());
      } finally {
        window.clearTimeout(timeoutId);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [attempt]);

  const handleRespond = useCallback(async () => {
    if (!token) return;
    setSubmitting(true);

    try {
      const response = await fetch(apiUrl('/api/assignments/respond'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action }),
      });
      const data = await parseJsonSafe(response);

      setState((previous) =>
        applySubmitResult(previous, {
          ok: response.ok,
          status: response.status,
          data,
        })
      );
    } catch {
      setState((previous) => applySubmitFailure(previous));
    } finally {
      setSubmitting(false);
    }
  }, [token, action]);

  const retry = useCallback(() => {
    setState(emptyRespondState('loading'));
    setAttempt((value) => value + 1);
  }, []);

  const invalid = state.phase === 'invalid';
  const networkError = state.phase === 'network_error';
  const done = state.phase === 'done';
  const otherAction: RespondAction = action === 'confirm' ? 'decline' : 'confirm';
  const switchHref = `/respond?t=${encodeURIComponent(token)}&a=${otherAction}`;

  if (state.phase === 'loading') {
    return (
      <Flex minH="100dvh" align="center" justify="center" bg="gray.50">
        <Spinner size="xl" color="brand.500" />
      </Flex>
    );
  }

  return (
    <Flex minH="100dvh" align="center" justify="center" bg="gray.50" px="4" py="8">
      <Box w="full" maxW="480px">
        <VStack spacing="4" mb="6" textAlign="center">
          <Text fontSize="2xl" fontWeight="800" color="brand.500">♫ WorshipCenter</Text>
          <Heading size="lg" fontWeight="700">
            {done
              ? state.respondedStatus === 'confirmed'
                ? "You're confirmed"
                : 'Response recorded'
              : invalid
                ? 'Link unavailable'
                : networkError
                  ? "Couldn't load this link"
                  : 'Confirm your assignment'}
          </Heading>
        </VStack>

        <Card>
          <CardBody p="6">
            {invalid ? (
              <VStack spacing="4" textAlign="center">
                <Text fontSize="4xl">🔒</Text>
                <Text color="gray.600" fontSize="sm">
                  {INVALID_LINK_MESSAGE}
                </Text>
                <ChakraLink href="/login" color="brand.500" fontWeight="600" fontSize="sm">
                  Sign in
                </ChakraLink>
              </VStack>
            ) : networkError ? (
              <VStack spacing="4" textAlign="center">
                <Alert status="error" borderRadius="lg" fontSize="sm" textAlign="left">
                  <AlertIcon />
                  {state.error}
                </Alert>
                <Button colorScheme="teal" size="lg" w="full" onClick={retry}>
                  Try again
                </Button>
              </VStack>
            ) : done ? (
              <VStack spacing="4" textAlign="center">
                <Text fontSize="4xl">
                  {state.respondedStatus === 'confirmed' ? '✅' : '📋'}
                </Text>
                <Text color="gray.600" fontSize="sm">
                  {state.respondedStatus === 'confirmed'
                    ? 'Thanks for confirming! Your worship leader will see your response.'
                    : "Thanks for letting the team know. Your worship leader will see your response."}
                </Text>
                {state.preview?.serviceTitle && (
                  <Box bg="gray.50" borderRadius="lg" px="4" py="3" w="full" textAlign="left">
                    <Text fontSize="sm" fontWeight="600" color="gray.800">
                      {state.preview.serviceTitle}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {formatServiceDate(state.preview.serviceDate)}
                      {state.preview.role ? ` · ${formatRole(state.preview.role)}` : ''}
                    </Text>
                  </Box>
                )}
              </VStack>
            ) : (
              <VStack spacing="5" align="stretch">
                {state.error && (
                  <Alert status="error" borderRadius="lg" fontSize="sm">
                    <AlertIcon />
                    {state.error}
                  </Alert>
                )}

                <Box bg="gray.50" borderRadius="lg" px="4" py="3">
                  <Text fontSize="sm" fontWeight="600" color="gray.800">
                    {state.preview?.serviceTitle || 'Service'}
                  </Text>
                  <Text fontSize="xs" color="gray.500" mt="1">
                    {formatServiceDate(state.preview?.serviceDate)}
                    {state.preview?.role ? ` · ${formatRole(state.preview.role)}` : ''}
                  </Text>
                  {state.preview?.status && (
                    <HStack spacing="2" mt="3">
                      <Text fontSize="xs" color="gray.500">Current status:</Text>
                      <StatusBadge status={mapAssignmentStatus(state.preview.status)} size="sm" />
                    </HStack>
                  )}
                </Box>

                <Text fontSize="sm" color="gray.600">
                  {action === 'confirm'
                    ? 'Can you serve at this service?'
                    : 'Let the team know you are unable to serve at this service.'}
                </Text>

                <Button
                  colorScheme={action === 'confirm' ? 'teal' : 'red'}
                  size="lg"
                  w="full"
                  isLoading={submitting}
                  onClick={handleRespond}
                >
                  {action === 'confirm' ? 'Confirm' : 'Decline'}
                </Button>

                <Text textAlign="center" fontSize="sm" color="gray.500">
                  <ChakraLink href={switchHref} color="brand.500" fontWeight="600">
                    {action === 'confirm' ? "I can't make it" : 'Actually, I can serve'}
                  </ChakraLink>
                </Text>
              </VStack>
            )}
          </CardBody>
        </Card>

        <Text mt="6" textAlign="center" fontSize="xs" color="gray.400">
          No account or login needed — this link is unique to your assignment.
        </Text>
      </Box>
    </Flex>
  );
}
