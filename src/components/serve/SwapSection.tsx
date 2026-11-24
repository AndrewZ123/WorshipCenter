'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Center,
  Divider,
  Flex,
  HStack,
  Spinner,
  Tag,
  TagLabel,
  Text,
  VStack,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { ArrowLeftRight, Calendar, CheckCircle, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { apiUrl, getAuthHeaders, parseJsonSafe } from '@/lib/api-base';
import { formatServiceDate } from '@/lib/formatDate';
import { notifySwapsChanged, useSwapChanges } from '@/lib/swaps/refresh';
import type {
  AssignmentSwapStatus,
  AssignmentSwapSummary,
} from '@/lib/types';

function statusColor(status: AssignmentSwapStatus): string {
  switch (status) {
    case 'approved':
      return 'green';
    case 'claimed':
      return 'blue';
    case 'declined':
      return 'red';
    case 'cancelled':
      return 'gray';
    default:
      return 'yellow';
  }
}

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

interface SwapSectionProps {
  /** "open" renders just the claimable list, for the Team tab drawer. */
  mode?: 'full' | 'open';
}

export default function SwapSection({ mode = 'full' }: SwapSectionProps) {
  const { user, church, loading: authLoading } = useAuth();
  const toast = useToast();

  const [openSwaps, setOpenSwaps] = useState<AssignmentSwapSummary[]>([]);
  const [mySwaps, setMySwaps] = useState<AssignmentSwapSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  useEffect(() => {
    if (church && user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [church?.id, user?.id, user?.team_member_id]);

  const loadData = async () => {
    if (!church || !user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const [openResponse, mineResponse] = await Promise.all([
        fetch(apiUrl('/api/swaps?status=open'), { headers }),
        fetch(apiUrl('/api/swaps?status=mine'), { headers }),
      ]);

      const openData = openResponse.ok ? await parseJsonSafe(openResponse) : {};
      const mineData = mineResponse.ok ? await parseJsonSafe(mineResponse) : {};

      setOpenSwaps(Array.isArray(openData.swaps) ? openData.swaps : []);
      setMySwaps(Array.isArray(mineData.swaps) ? mineData.swaps : []);
    } catch (error) {
      console.error('[Swaps] Failed to load swap data:', error);
      toast({
        title: 'Could not load swaps',
        description: 'Please try again.',
        status: 'error',
        duration: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  useSwapChanges(loadData);

  const handleClaim = async (swapId: string) => {
    try {
      setClaiming(swapId);
      const response = await fetch(apiUrl(`/api/swaps/${swapId}/claim`), {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      const result = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(result.error || 'Failed to claim swap');
      }

      toast({
        title: result.auto_approved ? 'Swap approved' : 'Swap claimed',
        description: result.auto_approved
          ? 'You now hold this assignment.'
          : 'Your claim was sent to a leader for approval.',
        status: 'success',
      });
      notifySwapsChanged();
      await loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to claim swap',
        status: 'error',
      });
    } finally {
      setClaiming(null);
    }
  };

  if (authLoading) {
    return (
      <Center py="6">
        <Spinner size="lg" color="teal.500" />
      </Center>
    );
  }

  if (!user || !church) return null;

  if (loading) {
    return (
      <Center py="6">
        <Spinner size="lg" color="teal.500" />
      </Center>
    );
  }

  const claimable = openSwaps.filter(
    (swap) => swap.status === 'open' && swap.can_claim && !swap.is_mine
  );
  const isOpenOnly = mode === 'open';
  const hasMySwaps = !isOpenOnly && mySwaps.length > 0;

  if (claimable.length === 0 && !hasMySwaps) {
    if (!isOpenOnly) return null;
    return (
      <Box py="8" textAlign="center">
        <Text fontSize="sm" color={subtextColor}>
          No open swaps you can claim right now.
        </Text>
      </Box>
    );
  }

  return (
    <Box mb={isOpenOnly ? '0' : '6'}>
      {!isOpenOnly && <Divider mb="4" borderColor={borderColor} />}

      {!isOpenOnly && (
        <Flex justify="space-between" align="center" mb="3">
          <Box>
            <Text fontSize="lg" fontWeight="600" color={textColor}>
              Swaps
            </Text>
            <Text mt="0.5" fontSize="sm" color={subtextColor}>
              Ask a teammate to cover your role, or pick up an open shift
            </Text>
          </Box>
          <ArrowLeftRight size={20} color="var(--chakra-colors-teal-500)" />
        </Flex>
      )}

      {claimable.length > 0 && (
        <Box mb={isOpenOnly ? '0' : '5'}>
          {!isOpenOnly && (
            <Text fontWeight="600" fontSize="sm" mb="2" color={subtextColor}>
              Open swaps
            </Text>
          )}
          <VStack spacing="2" align="stretch">
            {claimable.map((swap) => (
              <Card
                key={swap.id}
                bg={cardBg}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="lg"
                size="sm"
              >
                <CardBody py="3" px="4">
                  <Flex
                    direction={{ base: 'column', md: 'row' }}
                    align={{ base: 'stretch', md: 'center' }}
                    justify="space-between"
                    gap="3"
                  >
                    <Box flex="1">
                      <HStack spacing="2" wrap="wrap" mb="1">
                        <Text fontWeight="600" fontSize="sm" color={textColor}>
                          {swap.service.title}
                        </Text>
                        <Tag size="sm" colorScheme="teal" variant="subtle" borderRadius="full">
                          <TagLabel>{formatRole(swap.role)}</TagLabel>
                        </Tag>
                      </HStack>
                      <HStack spacing="3" color={subtextColor} wrap="wrap">
                        <HStack spacing="1.5">
                          <Calendar size={13} />
                          <Text fontSize="xs">
                            {formatServiceDate(swap.service.date, swap.service.time)}
                          </Text>
                        </HStack>
                        <HStack spacing="1.5">
                          <Users size={13} />
                          <Text fontSize="xs">{swap.requester.name} needs a swap</Text>
                        </HStack>
                      </HStack>
                      {swap.note && (
                        <Text mt="1" fontSize="xs" color={subtextColor} fontStyle="italic">
                          “{swap.note}”
                        </Text>
                      )}
                    </Box>
                    <Button
                      size="sm"
                      colorScheme="teal"
                      leftIcon={<CheckCircle size={14} />}
                      isLoading={claiming === swap.id}
                      onClick={() => handleClaim(swap.id)}
                    >
                      Claim
                    </Button>
                  </Flex>
                </CardBody>
              </Card>
            ))}
          </VStack>
        </Box>
      )}

      {hasMySwaps && (
        <Box>
          <Text fontWeight="600" fontSize="sm" mb="2" color={subtextColor}>
            My swap requests
          </Text>
          <VStack spacing="2" align="stretch">
            {mySwaps.map((swap) => (
              <HStack
                key={swap.id}
                justify="space-between"
                px="4"
                py="2"
                bg={cardBg}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="lg"
              >
                <Box>
                  <Text fontSize="sm" fontWeight="600" color={textColor}>
                    {formatRole(swap.role)} — {swap.service.title}
                  </Text>
                  <Text fontSize="xs" color={subtextColor}>
                    {formatServiceDate(swap.service.date, swap.service.time)}
                    {swap.claimed_by ? ` · ${swap.claimed_by.name} claimed` : ''}
                  </Text>
                </Box>
                <Badge
                  colorScheme={statusColor(swap.status)}
                  borderRadius="full"
                  px="2.5"
                  py="0.5"
                  textTransform="capitalize"
                >
                  {swap.status}
                </Badge>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

    </Box>
  );
}
