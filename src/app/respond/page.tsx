'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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

type RespondAction = 'confirm' | 'decline';

interface PreviewData {
  valid: boolean;
  status?: string;
  serviceTitle?: string;
  serviceDate?: string;
  role?: string;
}

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

function RespondContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('t') || '';
  const initialAction: RespondAction =
    searchParams.get('a') === 'decline' ? 'decline' : 'confirm';

  const [action, setAction] = useState<RespondAction>(initialAction);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [respondedStatus, setRespondedStatus] = useState<'confirmed' | 'declined' | null>(null);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setAction(initialAction);
  }, [initialAction]);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setInvalid(true);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const response = await fetch(
          apiUrl(`/api/assignments/respond?t=${encodeURIComponent(token)}`)
        );
        const data = await parseJsonSafe(response);
        if (cancelled) return;

        if (!response.ok || !data.valid) {
          setInvalid(true);
        } else {
          setPreview(data as PreviewData);
        }
      } catch {
        if (!cancelled) setError('Unable to load this link. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleRespond = useCallback(async () => {
    if (!token) return;
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/assignments/respond'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action }),
      });
      const data = await parseJsonSafe(response);

      if (response.ok && data.ok) {
        setRespondedStatus(data.status === 'declined' ? 'declined' : 'confirmed');
        return;
      }

      if (response.status === 410) {
        setInvalid(true);
        return;
      }

      setError(data.error || 'Something went wrong. Please try again.');
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [token, action]);

  const otherAction: RespondAction = action === 'confirm' ? 'decline' : 'confirm';
  const switchHref = `/respond?t=${encodeURIComponent(token)}&a=${otherAction}`;

  if (loading) {
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
            {respondedStatus
              ? respondedStatus === 'confirmed'
                ? "You're confirmed"
                : 'Response recorded'
              : invalid
                ? 'Link unavailable'
                : 'Confirm your assignment'}
          </Heading>
        </VStack>

        <Card>
          <CardBody p="6">
            {invalid ? (
              <VStack spacing="4" textAlign="center">
                <Text fontSize="4xl">🔒</Text>
                <Text color="gray.600" fontSize="sm">
                  This link is invalid or has expired. Ask your worship leader for a new
                  invitation email.
                </Text>
              </VStack>
            ) : respondedStatus ? (
              <VStack spacing="4" textAlign="center">
                <Text fontSize="4xl">{respondedStatus === 'confirmed' ? '✅' : '📋'}</Text>
                <Text color="gray.600" fontSize="sm">
                  {respondedStatus === 'confirmed'
                    ? 'Thanks for confirming! Your worship leader will see your response.'
                    : "Thanks for letting the team know. Your worship leader will see your response."}
                </Text>
                {preview?.serviceTitle && (
                  <Box bg="gray.50" borderRadius="lg" px="4" py="3" w="full" textAlign="left">
                    <Text fontSize="sm" fontWeight="600" color="gray.800">
                      {preview.serviceTitle}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {formatServiceDate(preview.serviceDate)}
                      {preview.role ? ` · ${formatRole(preview.role)}` : ''}
                    </Text>
                  </Box>
                )}
              </VStack>
            ) : (
              <VStack spacing="5" align="stretch">
                {error && (
                  <Alert status="error" borderRadius="lg" fontSize="sm">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}

                <Box bg="gray.50" borderRadius="lg" px="4" py="3">
                  <Text fontSize="sm" fontWeight="600" color="gray.800">
                    {preview?.serviceTitle || 'Service'}
                  </Text>
                  <Text fontSize="xs" color="gray.500" mt="1">
                    {formatServiceDate(preview?.serviceDate)}
                    {preview?.role ? ` · ${formatRole(preview.role)}` : ''}
                  </Text>
                  {preview?.status && (
                    <HStack spacing="2" mt="3">
                      <Text fontSize="xs" color="gray.500">Current status:</Text>
                      <StatusBadge status={mapAssignmentStatus(preview.status)} size="sm" />
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

export default function RespondPage() {
  return (
    <Suspense
      fallback={
        <Flex minH="100dvh" align="center" justify="center" bg="gray.50">
          <Spinner size="xl" color="brand.500" />
        </Flex>
      }
    >
      <RespondContent />
    </Suspense>
  );
}
