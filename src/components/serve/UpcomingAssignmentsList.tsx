'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Card,
  CardBody,
  Flex,
  HStack,
  Tag,
  TagLabel,
  Text,
  VStack,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { Calendar, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import { apiUrl, getAuthHeaders, parseJsonSafe } from '@/lib/api-base';
import { formatServiceDate, formatTime } from '@/lib/formatDate';
import { isServiceInFuture } from '@/lib/swaps/eligibility';
import {
  findActiveSwapForAssignment,
  shouldShowSwapRequest,
} from '@/lib/swaps/ui';
import { useSwapChanges } from '@/lib/swaps/refresh';
import type {
  AssignmentSwapSummary,
  Service,
  ServiceAssignment,
} from '@/lib/types';
import SwapRequestAction from './SwapRequestAction';

interface UpcomingAssignmentsListProps {
  title?: string;
  limit?: number;
}

interface AssignmentRow {
  assignment: ServiceAssignment;
  service: Service;
}

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * The signed-in volunteer's own upcoming assignments, with a Request swap
 * entry point on each one. Used on the dashboard (through ServeSection) and on
 * My Tasks so volunteers can find swaps from wherever they see their schedule.
 */
export default function UpcomingAssignmentsList({
  title = 'My upcoming assignments',
  limit,
}: UpcomingAssignmentsListProps) {
  const { user, church, loading: authLoading } = useAuth();
  const store = useStore();
  const toast = useToast();

  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [mySwaps, setMySwaps] = useState<AssignmentSwapSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  const loadData = useCallback(async () => {
    if (!church || !user?.team_member_id) {
      setRows([]);
      setMySwaps([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [assignments, services, mineResponse] = await Promise.all([
        store.assignments.getByTeamMember(user.team_member_id, church.id),
        store.services.getByChurch(church.id),
        fetch(apiUrl('/api/swaps?status=mine'), { headers: await getAuthHeaders() }),
      ]);

      const mineData = mineResponse.ok ? await parseJsonSafe(mineResponse) : {};
      const servicesById = new Map<string, Service>(
        (services as Service[]).map((service) => [service.id, service]),
      );

      const upcoming = (assignments as ServiceAssignment[])
        .map((assignment) => {
          const service = servicesById.get(assignment.service_id);
          return service ? { assignment, service } : null;
        })
        .filter((row): row is AssignmentRow => Boolean(row))
        .filter(
          (row) =>
            row.assignment.status !== 'declined' &&
            isServiceInFuture(row.service.date, row.service.time),
        )
        .sort((a, b) => {
          if (a.service.date !== b.service.date) {
            return a.service.date < b.service.date ? -1 : 1;
          }
          return a.service.time.localeCompare(b.service.time);
        });

      setRows(upcoming);
      setMySwaps(Array.isArray(mineData.swaps) ? mineData.swaps : []);
    } catch (error) {
      console.error('[UpcomingAssignments] Failed to load assignments:', error);
      toast({
        title: 'Could not load your assignments',
        description: 'Please try again.',
        status: 'error',
        duration: 4000,
      });
    } finally {
      setLoading(false);
    }
  }, [church, user?.team_member_id, store, toast]);

  useSwapChanges(loadData);

  useEffect(() => {
    if (authLoading) return;
    loadData();
  }, [authLoading, loadData]);

  if (authLoading || loading || rows.length === 0) return null;

  const visibleRows = typeof limit === 'number' ? rows.slice(0, limit) : rows;

  return (
    <Box mb="5">
      <Text fontWeight="600" fontSize="sm" mb="2" color={subtextColor}>
        {title}
      </Text>
      <VStack spacing="2" align="stretch">
        {visibleRows.map((row) => {
          const activeSwap = findActiveSwapForAssignment(
            mySwaps,
            row.assignment.id,
          );
          const showRequest = shouldShowSwapRequest(
            {
              team_member_id: row.assignment.team_member_id,
              team_member_user_id: user?.id,
              status: row.assignment.status,
            },
            {
              currentUserId: user?.id,
              currentTeamMemberId: user?.team_member_id,
              serviceDate: row.service.date,
              serviceTime: row.service.time,
              activeSwapStatus: activeSwap?.status ?? null,
            },
          );

          if (!activeSwap && !showRequest) return null;

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
                  <Box flex="1" minW="0">
                    <HStack spacing="2" wrap="wrap" mb="1">
                      <Text fontWeight="600" fontSize="sm" color={textColor}>
                        {row.service.title}
                      </Text>
                      <Tag size="sm" colorScheme="teal" variant="subtle" borderRadius="full">
                        <TagLabel>{formatRole(row.assignment.role)}</TagLabel>
                      </Tag>
                      {activeSwap && (
                        <Badge
                          colorScheme={activeSwap.status === 'claimed' ? 'blue' : 'yellow'}
                          borderRadius="full"
                          px="2"
                          textTransform="capitalize"
                        >
                          {activeSwap.status === 'claimed' ? 'Swap claimed' : 'Swap requested'}
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
                  <SwapRequestAction
                    assignmentId={row.assignment.id}
                    role={row.assignment.role}
                    serviceTitle={row.service.title}
                    serviceDate={row.service.date}
                    serviceTime={row.service.time}
                    activeSwap={activeSwap}
                    onChanged={loadData}
                    showBadge={false}
                  />
                </Flex>
              </CardBody>
            </Card>
          );
        })}
      </VStack>
    </Box>
  );
}
