'use client';

import { useState, type ReactNode } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  Tag,
  TagLabel,
  Text,
  VStack,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { Calendar, CheckCircle, Users } from 'lucide-react';
import { apiUrl, getAuthHeaders, parseJsonSafe } from '@/lib/api-base';
import { formatServiceDate } from '@/lib/formatDate';
import { notifySwapsChanged } from '@/lib/swaps/refresh';
import type { AssignmentSwapSummary } from '@/lib/types';
import SwapRequestAction from './SwapRequestAction';

interface OpenSwapsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string;
  /** Live open/claimed requests for this service, from GET /api/swaps. */
  swaps: AssignmentSwapSummary[];
  isLeader: boolean;
  swapProcessing?: string | null;
  onApprove?: (swapId: string) => void | Promise<void>;
  onDecline?: (swapId: string) => void | Promise<void>;
  onChanged?: () => void | Promise<void>;
}

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function EmptySection({ children }: { children: ReactNode }) {
  return (
    <Text fontSize="sm" color="gray.500" py="2">
      {children}
    </Text>
  );
}

function SwapMeta({ swap }: { swap: AssignmentSwapSummary }) {
  return (
    <Box flex="1" minW="0">
      <HStack spacing="2" wrap="wrap" mb="1">
        <Text fontWeight="600" fontSize="sm" color="gray.800" _dark={{ color: 'white' }}>
          {swap.service.title}
        </Text>
        <Tag size="sm" colorScheme="teal" variant="subtle" borderRadius="full">
          <TagLabel>{formatRole(swap.role)}</TagLabel>
        </Tag>
      </HStack>
      <HStack spacing="3" color="gray.500" wrap="wrap">
        <HStack spacing="1.5">
          <Calendar size={13} />
          <Text fontSize="xs">{formatServiceDate(swap.service.date, swap.service.time)}</Text>
        </HStack>
        <HStack spacing="1.5">
          <Users size={13} />
          <Text fontSize="xs">{swap.requester.name}</Text>
        </HStack>
      </HStack>
      {swap.note && (
        <Text mt="1" fontSize="xs" color="gray.500" fontStyle="italic">
          “{swap.note}”
        </Text>
      )}
    </Box>
  );
}

/**
 * The Team tab's service-scoped swap drawer. "Your requests" can be cancelled,
 * eligible teammates can claim open shifts, and leaders approve or decline
 * claimed requests waiting on them.
 */
export default function OpenSwapsDrawer({
  isOpen,
  onClose,
  serviceId,
  swaps,
  isLeader,
  swapProcessing,
  onApprove,
  onDecline,
  onChanged,
}: OpenSwapsDrawerProps) {
  const toast = useToast();
  const [claiming, setClaiming] = useState<string | null>(null);
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');

  const liveSwaps = swaps.filter(
    (swap) => swap.status === 'open' || swap.status === 'claimed'
  );
  const yourRequests = liveSwaps.filter((swap) => swap.is_mine);
  const claimable = liveSwaps.filter(
    (swap) => swap.status === 'open' && swap.can_claim && !swap.is_mine
  );
  const waitingForApproval = isLeader
    ? liveSwaps.filter((swap) => swap.status === 'claimed' && !swap.is_mine)
    : [];

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
      await onChanged?.();
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

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="md">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader pb="2">
          <Text as="span" fontWeight="700">
            Open swaps
          </Text>
          <Text fontSize="sm" fontWeight="400" color="gray.500" mt="1">
            Your requests, claimable shifts, and approvals for this service.
          </Text>
        </DrawerHeader>
        <DrawerBody px={{ base: '4', md: '6' }} data-service-id={serviceId}>
          <VStack spacing="6" align="stretch">
            <Box>
              <Text fontWeight="600" fontSize="sm" mb="2">
                Your requests
              </Text>
              {yourRequests.length === 0 ? (
                <EmptySection>
                  No open swap requests of yours on this service.
                </EmptySection>
              ) : (
                <VStack spacing="2" align="stretch">
                  {yourRequests.map((swap) => (
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
                          <SwapMeta swap={swap} />
                          <HStack spacing="2" flexShrink="0">
                            {swap.status === 'claimed' && (
                              <Badge colorScheme="blue" borderRadius="full" px="2" textTransform="capitalize">
                                {swap.claimed_by ? `${swap.claimed_by.name} claimed` : 'Claimed'}
                              </Badge>
                            )}
                            <SwapRequestAction
                              assignmentId={swap.assignment_id}
                              role={swap.role}
                              serviceTitle={swap.service.title}
                              serviceDate={swap.service.date}
                              serviceTime={swap.service.time}
                              activeSwap={{ id: swap.id, status: swap.status }}
                              onChanged={onChanged}
                              showBadge={false}
                              size="xs"
                            />
                          </HStack>
                        </Flex>
                      </CardBody>
                    </Card>
                  ))}
                </VStack>
              )}
            </Box>

            <Box>
              <Text fontWeight="600" fontSize="sm" mb="2">
                Claimable
              </Text>
              {claimable.length === 0 ? (
                <EmptySection>No open swaps you can claim right now.</EmptySection>
              ) : (
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
                          <SwapMeta swap={swap} />
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
              )}
            </Box>

            {isLeader && (
              <Box>
                <Text fontWeight="600" fontSize="sm" mb="2">
                  Waiting for approval
                </Text>
                {waitingForApproval.length === 0 ? (
                  <EmptySection>No claimed swaps waiting for your approval.</EmptySection>
                ) : (
                  <VStack spacing="2" align="stretch">
                    {waitingForApproval.map((swap) => (
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
                            <SwapMeta swap={swap} />
                            <HStack spacing="2" flexShrink="0">
                              <Button
                                size="sm"
                                colorScheme="teal"
                                isLoading={swapProcessing === swap.id}
                                onClick={() => onApprove?.(swap.id)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                colorScheme="red"
                                isDisabled={swapProcessing === swap.id}
                                onClick={() => onDecline?.(swap.id)}
                              >
                                Decline
                              </Button>
                            </HStack>
                          </Flex>
                        </CardBody>
                      </Card>
                    ))}
                  </VStack>
                )}
              </Box>
            )}
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
