'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Center,
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
  Progress,
  Select,
  SimpleGrid,
  Spinner,
  Text,
  Tooltip,
  VStack,
  useColorModeValue,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import {
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Monitor,
  RefreshCw,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/lib/PermissionsContext';
import { useStore } from '@/lib/StoreContext';
import { supabase } from '@/lib/supabase';
import { apiUrl, getAuthHeaders, parseJsonSafe } from '@/lib/api-base';
import { notifyPushEvent } from '@/lib/push-events-client';
import type {
  AssignmentSwapSummary,
  Service,
  ServiceAssignmentPopulated,
  TeamMember,
} from '@/lib/types';
import StatusBadge, { mapAssignmentStatus } from '@/components/ui/StatusBadge';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import SwapRequestAction from '@/components/serve/SwapRequestAction';
import {
  countAssignmentStatuses,
  formatRoleLabel,
  getNextUpcomingService,
  getTodaysServices,
  groupAssignmentsByRole,
  pickDefaultTodayService,
} from '@/lib/sunday';
import {
  formatFullDate,
  formatServiceDate,
  formatTime,
} from '@/lib/formatDate';
import { isOwnAssignment, shouldShowSwapRequest } from '@/lib/swaps/ui';

function StatTile({
  label,
  value,
  icon: IconComponent,
  bg,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number }>;
  bg: string;
  color: string;
}) {
  return (
    <Box
      bg={bg}
      color={color}
      borderRadius="xl"
      px={{ base: '3', md: '4' }}
      py={{ base: '3', md: '4' }}
      border="1px solid"
      borderColor="transparent"
    >
      <HStack spacing="2" align="center">
        <IconComponent size={18} />
        <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="wide">
          {label}
        </Text>
      </HStack>
      <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" lineHeight="1.1" mt="1">
        {value}
      </Text>
    </Box>
  );
}

export default function SundayPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, church, loading: authLoading } = useAuth();
  const permissions = usePermissions();
  const store = useStore();

  const isLeader = permissions.isAdmin || user?.role === 'leader';

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [servicesError, setServicesError] = useState(false);

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<ServiceAssignmentPopulated[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [swaps, setSwaps] = useState<AssignmentSwapSummary[]>([]);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [swapProcessingId, setSwapProcessingId] = useState<string | null>(null);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [teamMembersLoaded, setTeamMembersLoaded] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<ServiceAssignmentPopulated | null>(null);
  const [reassignMemberId, setReassignMemberId] = useState('');
  const [savingReassign, setSavingReassign] = useState(false);
  const reassignModal = useDisclosure();

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const headingColor = useColorModeValue('gray.900', 'white');
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const ownBg = useColorModeValue('teal.50', 'rgba(13,148,136,0.12)');
  const ownBorder = useColorModeValue('teal.300', 'teal.600');
  const confirmedBg = useColorModeValue('green.50', 'rgba(22,163,74,0.16)');
  const confirmedColor = useColorModeValue('green.700', 'green.200');
  const declinedBg = useColorModeValue('red.50', 'rgba(220,38,38,0.16)');
  const declinedColor = useColorModeValue('red.600', 'red.200');
  const pendingBg = useColorModeValue('orange.50', 'rgba(217,119,6,0.16)');
  const pendingColor = useColorModeValue('orange.700', 'orange.200');

  const todayServices = useMemo(() => getTodaysServices(services), [services]);
  const nextUpcoming = useMemo(() => getNextUpcomingService(services), [services]);

  const selectedService = useMemo(
    () => todayServices.find((service) => service.id === selectedServiceId) ?? null,
    [todayServices, selectedServiceId]
  );

  const loadServices = useCallback(async () => {
    if (!church || !user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setServicesError(false);

      const all = await store.services.getByChurch(church.id);
      let visible = all;

      // Team members only see services they are actually scheduled for. Leaders
      // and admins see the whole day.
      if (!isLeader) {
        const myServiceIds = new Set<string>();
        if (user.team_member_id) {
          const mine = await store.assignments.getByTeamMember(user.team_member_id, church.id);
          for (const assignment of mine) {
            if (assignment.service_id) myServiceIds.add(assignment.service_id);
          }
        }
        visible = all.filter((service) => myServiceIds.has(service.id));
      }

      setServices(visible);
    } catch (error) {
      console.error('[Sunday] Failed to load services:', error);
      setServicesError(true);
      toast({
        title: 'Could not load today’s service',
        description: 'Please check your connection and try again.',
        status: 'error',
        duration: 4000,
      });
    } finally {
      setLoading(false);
    }
  }, [church, user, isLeader, store, toast]);

  useEffect(() => {
    if (!authLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- loadServices owns the async loading lifecycle.
      void loadServices();
    }
  }, [authLoading, loadServices]);

  // Keep the selected service valid as today's list loads or changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- selection must follow today's loaded services.
    setSelectedServiceId((current) => {
      if (current && todayServices.some((service) => service.id === current)) {
        return current;
      }
      return pickDefaultTodayService(todayServices)?.id ?? null;
    });
  }, [todayServices]);

  const loadAssignments = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!selectedService || !church) return;

      try {
        if (!options?.silent) setAssignmentsLoading(true);
        const data = await store.assignments.getByService(selectedService.id, church.id);
        setAssignments(data);
      } catch (error) {
        console.error('[Sunday] Failed to load assignments:', error);
        if (!options?.silent) {
          toast({
            title: 'Could not load the schedule',
            description: 'Pull to refresh or try again in a moment.',
            status: 'error',
            duration: 4000,
          });
        }
      } finally {
        if (!options?.silent) setAssignmentsLoading(false);
      }
    },
    [selectedService, church, store, toast]
  );

  const loadSwaps = useCallback(async () => {
    if (!selectedService) return;

    try {
      // /api/swaps owns eligibility, the future-service check, and the
      // church's auto-approve setting, so this view only renders what it
      // returns and never decides swap permissions itself.
      const response = await fetch(
        apiUrl(`/api/swaps?status=pending&serviceId=${selectedService.id}`),
        { headers: await getAuthHeaders() }
      );
      if (!response.ok) return;

      const data = await parseJsonSafe(response);
      setSwaps(Array.isArray(data.swaps) ? data.swaps : []);
    } catch (error) {
      console.error('[Sunday] Failed to load swaps:', error);
    }
  }, [selectedService]);

  useEffect(() => {
    if (!selectedService || !church) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale rows when no service is selected.
      setAssignments([]);
      setSwaps([]);
      return;
    }

    void loadAssignments();
    void loadSwaps();
  }, [selectedService, church, loadAssignments, loadSwaps]);

  // Live assignment responses (emailed accept/decline links, another leader in
  // the schedule tab) and a focus refetch for when the phone wakes up.
  useEffect(() => {
    if (!selectedService || !church) return;

    let cancelled = false;
    const channel = supabase
      .channel(`sunday-service-assignments:${selectedService.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_assignments',
          filter: `service_id=eq.${selectedService.id}`,
        },
        () => {
          if (!cancelled) {
            void loadAssignments({ silent: true });
            void loadSwaps();
          }
        }
      )
      .subscribe();

    const handleFocus = () => {
      if (!cancelled) {
        void loadAssignments({ silent: true });
        void loadSwaps();
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(channel);
    };
  }, [selectedService, church, loadAssignments, loadSwaps]);

  const counts = useMemo(() => countAssignmentStatuses(assignments), [assignments]);
  const confirmedPercent = counts.total > 0
    ? Math.round((counts.confirmed / counts.total) * 100)
    : 0;

  const groups = useMemo(() => {
    const sorted = [...assignments].sort((a, b) => {
      const aName = a.team_member?.name || '';
      const bName = b.team_member?.name || '';
      return aName.localeCompare(bName);
    });
    return groupAssignmentsByRole(sorted);
  }, [assignments]);

  const swapByAssignment = useMemo(
    () => new Map(swaps.map((swap) => [swap.assignment_id, swap])),
    [swaps]
  );

  const reassignCandidates = useMemo(() => {
    if (!reassignTarget) return [];

    const assignedIds = new Set(assignments.map((assignment) => assignment.team_member_id));
    return teamMembers
      .filter(
        (member) =>
          member.id !== reassignTarget.team_member_id && !assignedIds.has(member.id)
      )
      .sort((a, b) => {
        const aHasRole = a.roles?.includes(reassignTarget.role) ? 0 : 1;
        const bHasRole = b.roles?.includes(reassignTarget.role) ? 0 : 1;
        if (aHasRole !== bHasRole) return aHasRole - bHasRole;
        return a.name.localeCompare(b.name);
      });
  }, [reassignTarget, teamMembers, assignments]);

  const handleConfirm = async (assignmentId: string) => {
    try {
      setProcessingId(assignmentId);
      const response = await fetch(apiUrl(`/api/assignments/${assignmentId}/confirm`), {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      if (!response.ok) {
        const result = await parseJsonSafe(response).catch(() => ({}));
        throw new Error(result.error || 'Failed to confirm');
      }

      toast({
        title: 'Confirmed',
        description: 'Thanks for serving today.',
        status: 'success',
      });
      await Promise.all([loadAssignments({ silent: true }), loadSwaps()]);
    } catch (error) {
      console.error('[Sunday] Confirm failed:', error);
      toast({
        title: 'Could not confirm',
        description: error instanceof Error ? error.message : 'Please try again.',
        status: 'error',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (assignmentId: string) => {
    try {
      setProcessingId(assignmentId);
      const response = await fetch(apiUrl(`/api/assignments/${assignmentId}/decline`), {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      if (!response.ok) {
        const result = await parseJsonSafe(response).catch(() => ({}));
        throw new Error(result.error || 'Failed to decline');
      }

      toast({
        title: 'Declined',
        description: 'Your leader can now find a replacement.',
        status: 'info',
      });
      await Promise.all([loadAssignments({ silent: true }), loadSwaps()]);
    } catch (error) {
      console.error('[Sunday] Decline failed:', error);
      toast({
        title: 'Could not decline',
        description: error instanceof Error ? error.message : 'Please try again.',
        status: 'error',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleSwapDecision = async (swapId: string, action: 'approve' | 'decline') => {
    try {
      setSwapProcessingId(swapId);
      const response = await fetch(apiUrl(`/api/swaps/${swapId}/${action}`), {
        method: 'POST',
        headers: await getAuthHeaders(),
      });

      if (!response.ok) {
        const result = await parseJsonSafe(response).catch(() => ({}));
        throw new Error(result.error || `Failed to ${action} swap`);
      }

      toast({
        title: action === 'approve' ? 'Swap approved' : 'Swap declined',
        description: action === 'approve'
          ? 'The assignment moved to the teammate who claimed it.'
          : 'The original assignment is unchanged.',
        status: action === 'approve' ? 'success' : 'info',
      });
      await Promise.all([loadAssignments({ silent: true }), loadSwaps()]);
    } catch (error) {
      console.error('[Sunday] Swap decision failed:', error);
      toast({
        title: 'Could not update the swap',
        description: error instanceof Error ? error.message : 'Please try again.',
        status: 'error',
      });
    } finally {
      setSwapProcessingId(null);
    }
  };

  const openReassign = async (assignment: ServiceAssignmentPopulated) => {
    setReassignTarget(assignment);
    setReassignMemberId('');
    reassignModal.onOpen();

    if (!church || teamMembersLoaded) return;

    try {
      setTeamMembersLoading(true);
      const members = await store.teamMembers.getByChurch(church.id);
      setTeamMembers(members);
      setTeamMembersLoaded(true);
    } catch (error) {
      console.error('[Sunday] Failed to load team members:', error);
      toast({
        title: 'Could not load teammates',
        description: 'Close this and try again.',
        status: 'error',
      });
    } finally {
      setTeamMembersLoading(false);
    }
  };

  const closeReassign = () => {
    reassignModal.onClose();
    setReassignTarget(null);
    setReassignMemberId('');
  };

  const handleReassign = async () => {
    if (!church || !selectedService || !reassignTarget || !reassignMemberId) return;

    const replacement = teamMembers.find((member) => member.id === reassignMemberId);
    if (!replacement) return;

    try {
      setSavingReassign(true);

      const updated = await store.assignments.update(reassignTarget.id, church.id, {
        team_member_id: replacement.id,
        status: 'pending',
        confirmed_at: undefined,
        declined_at: undefined,
      });

      if (!updated) {
        throw new Error('The assignment could not be updated.');
      }

      void notifyPushEvent({
        type: 'assignment_created',
        assignmentId: reassignTarget.id,
      });

      if (replacement.email && selectedService.time) {
        fetch(apiUrl('/api/notifications/send-invitation'), {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            assignmentId: reassignTarget.id,
            churchId: church.id,
            serviceTitle: selectedService.title,
            serviceDate: selectedService.date,
            serviceTime: selectedService.time,
            memberName: replacement.name,
            memberEmail: replacement.email,
            role: reassignTarget.role,
          }),
        }).catch((error) => {
          console.error('[Sunday] Invitation failed:', error);
        });
      }

      toast({
        title: 'Reassigned',
        description: `${replacement.name} is now assigned to ${formatRoleLabel(reassignTarget.role)}.`,
        status: 'success',
      });
      closeReassign();
      await Promise.all([loadAssignments({ silent: true }), loadSwaps()]);
    } catch (error) {
      console.error('[Sunday] Reassign failed:', error);
      toast({
        title: 'Could not reassign',
        description: error instanceof Error ? error.message : 'Please try again.',
        status: 'error',
      });
    } finally {
      setSavingReassign(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Center minH="50vh">
        <Spinner size="xl" color="teal.500" />
      </Center>
    );
  }

  if (!church) {
    return (
      <Center minH="50vh">
        <VStack spacing={3} textAlign="center" px={6}>
          <Text fontWeight="600">Couldn&apos;t load your church data</Text>
          <Text fontSize="sm" color="gray.500">
            Check your internet connection and try refreshing the page.
          </Text>
          <Button size="sm" colorScheme="teal" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </VStack>
      </Center>
    );
  }

  return (
    <Box
      px={{ base: '4', md: '8' }}
      pt={{ base: '2', md: '8' }}
      pb={{ base: '6', md: '8' }}
      maxW="900px"
      w="full"
      mx="auto"
      overflowX="hidden"
    >
      <Flex
        justify="space-between"
        align={{ base: 'stretch', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
        gap="3"
        mb="5"
      >
        <Box>
          <Text
            fontSize="xs"
            fontWeight="800"
            color="teal.600"
            _dark={{ color: 'teal.300' }}
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Sunday morning
          </Text>
          <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" color={headingColor} letterSpacing="tight">
            {selectedService ? selectedService.title : 'Today'}
          </Text>
          <HStack spacing="2" mt="1" color={subtextColor} wrap="wrap">
            <CalendarDays size={15} />
            <Text fontSize="sm">
              {formatFullDate(selectedService?.date ?? todayServices[0]?.date ?? new Date())}
            </Text>
            {selectedService?.time && (
              <>
                <Text fontSize="sm">·</Text>
                <Clock size={15} />
                <Text fontSize="sm">{formatTime(selectedService.time)}</Text>
              </>
            )}
          </HStack>
        </Box>

        {selectedService && (
          <HStack spacing="2" wrap="wrap">
            <Button
              size="sm"
              minH="44px"
              variant="outline"
              colorScheme="teal"
              leftIcon={<CalendarDays size={16} />}
              onClick={() => router.push(`/services/${selectedService.id}?tab=schedule`)}
            >
              Full schedule
            </Button>
            <Button
              size="sm"
              minH="44px"
              colorScheme="teal"
              leftIcon={<Monitor size={16} />}
              onClick={() => router.push(`/services/${selectedService.id}?mode=live`)}
            >
              Service mode
            </Button>
          </HStack>
        )}
      </Flex>

      {servicesError && (
        <Card mb="5" bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl">
          <CardBody>
            <HStack justify="space-between" spacing="3" wrap="wrap">
              <Text fontSize="sm" color={textColor}>
                We couldn&apos;t refresh today&apos;s service.
              </Text>
              <Button size="sm" minH="44px" variant="outline" onClick={() => void loadServices()}>
                Try again
              </Button>
            </HStack>
          </CardBody>
        </Card>
      )}

      {todayServices.length === 0 ? (
        <VStack spacing="4" align="stretch">
          <EmptyState
            icon="calendar"
            title={isLeader ? 'No service today' : 'No service for you today'}
            description={
              isLeader
                ? 'There isn’t a service on the calendar for today. Enjoy the quiet, or open the full schedule.'
                : 'You don’t have an assignment for a service today. Check back or open your services list.'
            }
            ctaLabel="View all services"
            ctaOnClick={() => router.push('/services')}
          />

          {nextUpcoming && (
            <Card
              bg={cardBg}
              border="1px solid"
              borderColor={borderColor}
              borderRadius="xl"
              cursor="pointer"
              onClick={() => router.push(`/services/${nextUpcoming.id}`)}
              _hover={{ borderColor: 'teal.300' }}
            >
              <CardBody>
                <HStack spacing="3" justify="space-between">
                  <HStack spacing="3" minW="0">
                    <Box color="teal.500" flexShrink={0}>
                      <CalendarDays size={22} />
                    </Box>
                    <Box minW="0">
                      <Text fontSize="xs" fontWeight="700" color={subtextColor} textTransform="uppercase" letterSpacing="wide">
                        Next service
                      </Text>
                      <Text fontWeight="700" color={headingColor} noOfLines={1}>
                        {nextUpcoming.title}
                      </Text>
                      <Text fontSize="sm" color={subtextColor}>
                        {formatServiceDate(nextUpcoming.date, nextUpcoming.time || undefined)}
                      </Text>
                    </Box>
                  </HStack>
                  <ChevronRight size={20} color="var(--chakra-colors-gray-400)" />
                </HStack>
              </CardBody>
            </Card>
          )}
        </VStack>
      ) : (
        <>
          {todayServices.length > 1 && (
            <Box mb="5">
              <Text fontSize="xs" fontWeight="700" color={subtextColor} textTransform="uppercase" letterSpacing="wide" mb="2">
                Today’s services
              </Text>
              <HStack
                spacing="2"
                overflowX="auto"
                pb="1"
                sx={{ '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}
              >
                {todayServices.map((service) => {
                  const active = service.id === selectedServiceId;
                  return (
                    <Button
                      key={service.id}
                      flexShrink={0}
                      minH="48px"
                      size="sm"
                      variant={active ? 'solid' : 'outline'}
                      colorScheme="teal"
                      onClick={() => setSelectedServiceId(service.id)}
                      aria-pressed={active}
                    >
                      {formatTime(service.time)} · {service.title}
                    </Button>
                  );
                })}
              </HStack>
            </Box>
          )}

          {selectedService && (
            <>
              <SimpleGrid columns={3} spacing={{ base: 2, md: 3 }} mb="4">
                <StatTile
                  label="Confirmed"
                  value={counts.confirmed}
                  icon={CheckCircle2}
                  bg={confirmedBg}
                  color={confirmedColor}
                />
                <StatTile
                  label="Declined"
                  value={counts.declined}
                  icon={XCircle}
                  bg={declinedBg}
                  color={declinedColor}
                />
                <StatTile
                  label="No response"
                  value={counts.pending}
                  icon={Clock}
                  bg={pendingBg}
                  color={pendingColor}
                />
              </SimpleGrid>

              <Box mb="6">
                <HStack justify="space-between" mb="1.5" spacing="3">
                  <Text fontSize="sm" fontWeight="600" color={textColor}>
                    {counts.confirmed} of {counts.total} confirmed
                  </Text>
                  <Text fontSize="sm" color={subtextColor}>
                    {groups.length} {groups.length === 1 ? 'position' : 'positions'}
                  </Text>
                </HStack>
                <Progress
                  value={confirmedPercent}
                  size="sm"
                  borderRadius="full"
                  colorScheme="green"
                  aria-label={`${confirmedPercent}% of the team confirmed`}
                />
              </Box>

              {assignmentsLoading ? (
                <Center py="10">
                  <Spinner size="lg" color="teal.500" />
                </Center>
              ) : assignments.length === 0 ? (
                <EmptyState
                  icon="users"
                  title="No one is assigned yet"
                  description={
                    isLeader
                      ? 'Open the full schedule to add team members to today’s service.'
                      : 'Your leader hasn’t added anyone to this service yet.'
                  }
                  ctaLabel={isLeader ? 'Open schedule' : undefined}
                  ctaOnClick={isLeader ? () => router.push(`/services/${selectedService.id}?tab=schedule`) : undefined}
                />
              ) : (
                <VStack spacing="6" align="stretch">
                  {groups.map((group) => {
                    const groupCounts = countAssignmentStatuses(group.assignments);

                    return (
                      <Box key={group.role}>
                        <Flex justify="space-between" align="center" mb="2" gap="3">
                          <HStack spacing="2" minW="0">
                            <Text fontWeight="700" color={headingColor} noOfLines={1}>
                              {group.label}
                            </Text>
                            <Badge
                              borderRadius="full"
                              colorScheme="gray"
                              variant="subtle"
                              px="2"
                              flexShrink={0}
                            >
                              {group.assignments.length}
                            </Badge>
                          </HStack>
                          <Text fontSize="xs" color={subtextColor} flexShrink={0}>
                            {groupCounts.confirmed}/{groupCounts.total} confirmed
                          </Text>
                        </Flex>

                        <VStack spacing="2" align="stretch">
                          {group.assignments.map((assignment) => {
                            const own = isOwnAssignment(
                              {
                                team_member_id: assignment.team_member_id,
                                team_member_user_id: assignment.team_member?.user_id,
                                status: assignment.status,
                              },
                              user?.id,
                              user?.team_member_id
                            );
                            const swap = swapByAssignment.get(assignment.id);
                            const showSwapRequest = shouldShowSwapRequest(
                              {
                                team_member_id: assignment.team_member_id,
                                team_member_user_id: assignment.team_member?.user_id,
                                status: assignment.status,
                              },
                              {
                                currentUserId: user?.id,
                                currentTeamMemberId: user?.team_member_id,
                                serviceDate: selectedService.date,
                                serviceTime: selectedService.time,
                                activeSwapStatus: swap?.status ?? null,
                              }
                            );
                            const statusTimestamp = assignment.status === 'confirmed'
                              ? assignment.confirmed_at
                              : assignment.status === 'declined'
                                ? assignment.declined_at
                                : undefined;
                            const statusTooltip = statusTimestamp
                              ? `${assignment.status === 'confirmed' ? 'Confirmed' : 'Declined'} ${new Date(statusTimestamp).toLocaleString()}`
                              : 'No response yet';

                            return (
                              <Card
                                key={assignment.id}
                                bg={own ? ownBg : cardBg}
                                border="1px solid"
                                borderColor={own ? ownBorder : borderColor}
                                borderRadius="xl"
                                boxShadow="0 1px 2px rgba(0,0,0,0.04)"
                              >
                                <CardBody p={{ base: '3', md: '4' }}>
                                  <Flex
                                    direction={{ base: 'column', md: 'row' }}
                                    align={{ base: 'stretch', md: 'center' }}
                                    gap="3"
                                  >
                                    <HStack spacing="3" flex="1" minW="0">
                                      <Avatar
                                        name={assignment.team_member?.name || 'Unknown'}
                                        src={assignment.team_member?.avatar_url}
                                        size="md"
                                      />
                                      <Box minW="0" flex="1">
                                        <HStack spacing="2" wrap="wrap">
                                          <Text fontWeight="700" color={headingColor} noOfLines={1}>
                                            {own ? 'You' : (assignment.team_member?.name || 'Unknown')}
                                          </Text>
                                          <Tooltip label={statusTooltip} hasArrow>
                                            <Box as="span" display="inline-flex">
                                              <StatusBadge
                                                status={mapAssignmentStatus(assignment.status)}
                                                size="sm"
                                              />
                                            </Box>
                                          </Tooltip>
                                          {swap && (
                                            <Tooltip
                                              label={
                                                swap.status === 'claimed'
                                                  ? `${swap.claimed_by?.name || 'A teammate'} claimed this swap — awaiting leader approval`
                                                  : `${swap.requester.name} is looking for coverage`
                                              }
                                              hasArrow
                                            >
                                              <Badge
                                                variant="subtle"
                                                colorScheme={swap.status === 'claimed' ? 'blue' : 'yellow'}
                                                fontSize="xs"
                                                borderRadius="full"
                                                px="2"
                                              >
                                                <ArrowLeftRight size={10} style={{ display: 'inline', marginRight: 3 }} />
                                                {swap.status === 'claimed'
                                                  ? 'Swap claimed'
                                                  : own
                                                    ? 'Swap requested'
                                                    : 'Swap open'}
                                              </Badge>
                                            </Tooltip>
                                          )}
                                        </HStack>
                                        <Text fontSize="sm" color={subtextColor}>
                                          {formatRoleLabel(assignment.role)}
                                        </Text>
                                      </Box>
                                    </HStack>

                                    <HStack
                                      spacing="2"
                                      wrap="wrap"
                                      justify={{ base: 'stretch', md: 'flex-end' }}
                                    >
                                      {own && assignment.status === 'pending' && (
                                        <>
                                          <Button
                                            size="sm"
                                            minH="44px"
                                            colorScheme="teal"
                                            leftIcon={<CheckCircle2 size={16} />}
                                            isLoading={processingId === assignment.id}
                                            onClick={() => handleConfirm(assignment.id)}
                                          >
                                            Confirm
                                          </Button>
                                          <Button
                                            size="sm"
                                            minH="44px"
                                            variant="outline"
                                            colorScheme="red"
                                            leftIcon={<XCircle size={16} />}
                                            isDisabled={processingId === assignment.id}
                                            onClick={() => handleDecline(assignment.id)}
                                          >
                                            Decline
                                          </Button>
                                        </>
                                      )}

                                      {(showSwapRequest || (own && swap)) && (
                                        <SwapRequestAction
                                          assignmentId={assignment.id}
                                          role={assignment.role}
                                          serviceTitle={selectedService.title}
                                          serviceDate={selectedService.date}
                                          serviceTime={selectedService.time}
                                          activeSwap={swap ? { id: swap.id, status: swap.status } : null}
                                          showBadge={false}
                                          size="md"
                                          onChanged={async () => {
                                            await Promise.all([
                                              loadAssignments({ silent: true }),
                                              loadSwaps(),
                                            ]);
                                          }}
                                        />
                                      )}

                                      {isLeader && swap?.status === 'claimed' && (
                                        <Button
                                          size="sm"
                                          minH="44px"
                                          colorScheme="green"
                                          onClick={() => handleSwapDecision(swap.id, 'approve')}
                                          isLoading={swapProcessingId === swap.id}
                                        >
                                          Approve swap
                                        </Button>
                                      )}
                                      {isLeader && swap && (
                                        <Button
                                          size="sm"
                                          minH="44px"
                                          variant="outline"
                                          colorScheme="red"
                                          isDisabled={swapProcessingId === swap.id}
                                          onClick={() => handleSwapDecision(swap.id, 'decline')}
                                        >
                                          Decline swap
                                        </Button>
                                      )}

                                      {isLeader && (
                                        <Button
                                          size="sm"
                                          minH="44px"
                                          variant="outline"
                                          colorScheme="teal"
                                          leftIcon={<RefreshCw size={16} />}
                                          onClick={() => void openReassign(assignment)}
                                        >
                                          Reassign
                                        </Button>
                                      )}
                                    </HStack>
                                  </Flex>
                                </CardBody>
                              </Card>
                            );
                          })}
                        </VStack>
                      </Box>
                    );
                  })}
                </VStack>
              )}
            </>
          )}
        </>
      )}

      <Modal isOpen={reassignModal.isOpen} onClose={closeReassign} isCentered size="md">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl">
          <ModalHeader fontWeight="700">Reassign position</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {reassignTarget && (
              <VStack spacing="4" align="stretch">
                <Box bg={ownBg} borderRadius="lg" p="4" border="1px solid" borderColor={ownBorder}>
                  <Text fontSize="xs" fontWeight="700" color={subtextColor} textTransform="uppercase" letterSpacing="wide">
                    {formatRoleLabel(reassignTarget.role)}
                  </Text>
                  <Text fontWeight="600" color={headingColor}>
                    Currently {reassignTarget.team_member?.name || 'unassigned'}
                  </Text>
                  <Text fontSize="sm" color={subtextColor}>
                    {formatServiceDate(selectedService?.date || '', selectedService?.time || undefined)}
                  </Text>
                </Box>

                <FormControl isDisabled={teamMembersLoading || reassignCandidates.length === 0}>
                  <FormLabel fontWeight="600" fontSize="sm">
                    Replacement
                  </FormLabel>
                  <Select
                    size="lg"
                    borderRadius="lg"
                    placeholder={teamMembersLoading ? 'Loading teammates…' : 'Choose a teammate'}
                    value={reassignMemberId}
                    onChange={(event) => setReassignMemberId(event.target.value)}
                  >
                    {reassignCandidates.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                        {member.roles?.includes(reassignTarget.role)
                          ? ` — ${formatRoleLabel(reassignTarget.role)}`
                          : ''}
                      </option>
                    ))}
                  </Select>
                  <FormHelperText fontSize="xs">
                    Teammates already scheduled today are hidden. The replacement will be asked to confirm.
                  </FormHelperText>
                </FormControl>

                {!teamMembersLoading && reassignCandidates.length === 0 && (
                  <HStack spacing="2" color={pendingColor} align="start">
                    <Users size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    <Text fontSize="sm">
                      Everyone else is already scheduled for this service. Add someone from the full schedule instead.
                    </Text>
                  </HStack>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  minH="44px"
                  leftIcon={<CalendarDays size={16} />}
                  onClick={() => {
                    if (selectedService) {
                      closeReassign();
                      router.push(`/services/${selectedService.id}?tab=schedule`);
                    }
                  }}
                >
                  Open full schedule
                </Button>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" minH="44px" onClick={closeReassign}>
              Cancel
            </Button>
            <Button
              minH="44px"
              colorScheme="teal"
              leftIcon={<UserPlus size={16} />}
              isDisabled={!reassignMemberId || reassignCandidates.length === 0}
              isLoading={savingReassign}
              onClick={() => void handleReassign()}
            >
              Reassign
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
