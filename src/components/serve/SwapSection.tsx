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
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Tag,
  TagLabel,
  Text,
  Textarea,
  VStack,
  useColorModeValue,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { ArrowLeftRight, Calendar, CheckCircle, Clock, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import { apiUrl, getAuthHeaders, parseJsonSafe } from '@/lib/api-base';
import { formatServiceDate, formatTime } from '@/lib/formatDate';
import type {
  AssignmentSwapStatus,
  AssignmentSwapSummary,
  Service,
  ServiceAssignment,
} from '@/lib/types';

interface MyAssignmentRow {
  assignment: ServiceAssignment;
  service: Service;
}

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

export default function SwapSection() {
  const { user, church, loading: authLoading } = useAuth();
  const store = useStore();
  const toast = useToast();
  const requestModal = useDisclosure();

  const [openSwaps, setOpenSwaps] = useState<AssignmentSwapSummary[]>([]);
  const [mySwaps, setMySwaps] = useState<AssignmentSwapSummary[]>([]);
  const [myAssignments, setMyAssignments] = useState<MyAssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestTarget, setRequestTarget] = useState<MyAssignmentRow | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

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
      const [openResponse, mineResponse, assignments, services] = await Promise.all([
        fetch(apiUrl('/api/swaps?status=open'), { headers }),
        fetch(apiUrl('/api/swaps?status=mine'), { headers }),
        user.team_member_id
          ? store.assignments.getByTeamMember(user.team_member_id, church.id)
          : Promise.resolve([]),
        store.services.getByChurch(church.id),
      ]);

      const openData = openResponse.ok ? await parseJsonSafe(openResponse) : {};
      const mineData = mineResponse.ok ? await parseJsonSafe(mineResponse) : {};

      setOpenSwaps(Array.isArray(openData.swaps) ? openData.swaps : []);
      setMySwaps(Array.isArray(mineData.swaps) ? mineData.swaps : []);

      const servicesById = new Map<string, Service>(
        (services as Service[]).map((service) => [service.id, service])
      );
      const today = new Date().toISOString().slice(0, 10);

      const upcoming = (assignments as ServiceAssignment[])
        .map((assignment) => {
          const service = servicesById.get(assignment.service_id);
          return service ? { assignment, service } : null;
        })
        .filter((row): row is MyAssignmentRow => Boolean(row))
        .filter(
          (row) =>
            row.assignment.status !== 'declined' &&
            row.service.date.slice(0, 10) >= today
        )
        .sort((a, b) => {
          if (a.service.date !== b.service.date) {
            return a.service.date < b.service.date ? -1 : 1;
          }
          return a.service.time.localeCompare(b.service.time);
        });

      setMyAssignments(upcoming);
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

  const activeSwapForAssignment = (assignmentId: string) =>
    mySwaps.find(
      (swap) =>
        swap.assignment_id === assignmentId &&
        (swap.status === 'open' || swap.status === 'claimed')
    );

  const openRequestModal = (row: MyAssignmentRow) => {
    setRequestTarget(row);
    setNote('');
    requestModal.onOpen();
  };

  const handleRequestSwap = async () => {
    if (!requestTarget) return;
    try {
      setSubmitting(true);
      const response = await fetch(apiUrl('/api/swaps'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          assignmentId: requestTarget.assignment.id,
          note: note.trim() || undefined,
        }),
      });
      const result = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(result.error || 'Failed to request swap');
      }

      toast({
        title: 'Swap requested',
        description: 'Qualified teammates have been notified.',
        status: 'success',
      });
      requestModal.onClose();
      await loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to request swap',
        status: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleCancel = async (swapId: string) => {
    try {
      setCancelling(swapId);
      const response = await fetch(apiUrl(`/api/swaps/${swapId}/cancel`), {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      const result = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel swap');
      }
      toast({ title: 'Swap request cancelled', status: 'info' });
      await loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel swap',
        status: 'error',
      });
    } finally {
      setCancelling(null);
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
  const hasMyAssignments = myAssignments.length > 0;
  const hasMySwaps = mySwaps.length > 0;

  if (!hasMyAssignments && claimable.length === 0 && !hasMySwaps) {
    return null;
  }

  return (
    <Box mb="6">
      <Divider mb="4" borderColor={borderColor} />

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

      {hasMyAssignments && (
        <Box mb="5">
          <Text fontWeight="600" fontSize="sm" mb="2" color={subtextColor}>
            My upcoming assignments
          </Text>
          <VStack spacing="2" align="stretch">
            {myAssignments.map((row) => {
              const activeSwap = activeSwapForAssignment(row.assignment.id);
              return (
                <Card
                  key={row.assignment.id}
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
                            {row.service.title}
                          </Text>
                          <Tag size="sm" colorScheme="teal" variant="subtle" borderRadius="full">
                            <TagLabel>{formatRole(row.assignment.role)}</TagLabel>
                          </Tag>
                          {activeSwap && (
                            <Badge
                              colorScheme={statusColor(activeSwap.status)}
                              borderRadius="full"
                              px="2"
                              textTransform="capitalize"
                            >
                              {activeSwap.status === 'open' ? 'Swap requested' : activeSwap.status}
                            </Badge>
                          )}
                        </HStack>
                        <HStack spacing="3" color={subtextColor}>
                          <HStack spacing="1.5">
                            <Calendar size={13} />
                            <Text fontSize="xs">
                              {formatServiceDate(row.service.date, row.service.time)}
                            </Text>
                          </HStack>
                          <HStack spacing="1.5">
                            <Clock size={13} />
                            <Text fontSize="xs">{formatTime(row.service.time)}</Text>
                          </HStack>
                        </HStack>
                      </Box>
                      {activeSwap ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          isLoading={cancelling === activeSwap.id}
                          onClick={() => handleCancel(activeSwap.id)}
                        >
                          Cancel request
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          leftIcon={<ArrowLeftRight size={14} />}
                          onClick={() => openRequestModal(row)}
                        >
                          Request swap
                        </Button>
                      )}
                    </Flex>
                  </CardBody>
                </Card>
              );
            })}
          </VStack>
        </Box>
      )}

      {claimable.length > 0 && (
        <Box mb="5">
          <Text fontWeight="600" fontSize="sm" mb="2" color={subtextColor}>
            Open swaps
          </Text>
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

      <Modal isOpen={requestModal.isOpen} onClose={requestModal.onClose} isCentered size="md">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl">
          <ModalHeader fontWeight="700">Request a swap</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {requestTarget && (
              <VStack spacing="4" align="stretch">
                <Box bg="teal.50" borderRadius="lg" p="4" border="1px solid" borderColor="teal.100">
                  <Text fontWeight="600" fontSize="sm" color="teal.800">
                    {requestTarget.service.title}
                  </Text>
                  <Text mt="1" fontSize="sm" color="teal.600">
                    {formatServiceDate(requestTarget.service.date, requestTarget.service.time)} ·{' '}
                    {formatRole(requestTarget.assignment.role)}
                  </Text>
                </Box>
                <FormControl>
                  <FormLabel fontSize="sm">Note for your teammates (optional)</FormLabel>
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Let the team know why you need coverage."
                  />
                  <FormHelperText fontSize="xs">
                    {note.length}/500 characters
                  </FormHelperText>
                </FormControl>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={requestModal.onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="teal"
              onClick={handleRequestSwap}
              isLoading={submitting}
              isDisabled={!requestTarget}
            >
              Request swap
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
