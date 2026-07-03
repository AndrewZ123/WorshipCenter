'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, VStack, HStack, Text, Button, Spinner, Center,
  useToast, useColorModeValue, Tag, TagLabel, Flex,
} from '@chakra-ui/react';
import { CheckSquare, Music, CheckCheck } from 'lucide-react';
import { db } from '@/lib/store';
import type { ServiceItem, RehearsalLog, RehearsalStats } from '@/lib/types';
import EmptyState from '@/components/ui/EmptyState';

interface RehearsalTabProps {
  serviceId: string;
  churchId: string;
  teamMemberId: string | null;
  items: ServiceItem[];
  isLeader: boolean;
}

export default function RehearsalTab({
  serviceId,
  churchId,
  teamMemberId,
  items,
  isLeader,
}: RehearsalTabProps) {
  const toast = useToast();
  const [logs, setLogs] = useState<Map<string, RehearsalLog>>(new Map());
  const [stats, setStats] = useState<RehearsalStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const songItemBg = useColorModeValue('gray.50', 'gray.700');
  const emptyColor = useColorModeValue('gray.400', 'gray.500');

  const songItems = items.filter(i => i.type === 'song' && i.song_id);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (teamMemberId) {
        const memberLogs = await db.rehearsals.getByTeamMember(serviceId, teamMemberId, churchId);
        const logMap = new Map<string, RehearsalLog>();
        for (const log of memberLogs) {
          logMap.set(log.song_id, log);
        }
        setLogs(logMap);
      }
      if (isLeader) {
        const s = await db.rehearsals.getStatsByService(serviceId, churchId);
        setStats(s);
      }
    } catch (error) {
      console.error('[RehearsalTab] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [serviceId, churchId, teamMemberId, isLeader]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggle = async (songId: string, currentlyRehearsed: boolean) => {
    if (!teamMemberId || toggling) return;
    setToggling(true);

    // Optimistic update
    const newValue = !currentlyRehearsed;
    setLogs(prev => {
      const next = new Map(prev);
      if (next.has(songId)) {
        next.set(songId, { ...next.get(songId)!, rehearsed: newValue, rehearsed_at: newValue ? new Date().toISOString() : null });
      } else {
        next.set(songId, {
          id: '',
          church_id: churchId,
          service_id: serviceId,
          team_member_id: teamMemberId,
          song_id: songId,
          rehearsed: newValue,
          rehearsed_at: newValue ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      return next;
    });

    try {
      await db.rehearsals.upsert(serviceId, teamMemberId, songId, newValue, churchId);
    } catch (error) {
      // Revert on failure
      setLogs(prev => {
        const next = new Map(prev);
        const existing = next.get(songId);
        if (existing && existing.id === '') {
          next.delete(songId);
        } else if (existing) {
          next.set(songId, { ...existing, rehearsed: !newValue });
        }
        return next;
      });
      toast({ title: 'Failed to update', status: 'error', duration: 2000 });
      console.error('[RehearsalTab] Toggle failed:', error);
    } finally {
      setToggling(false);
    }
  };

  const handleMarkAll = async () => {
    if (!teamMemberId || toggling) return;
    setToggling(true);

    // Optimistic: mark all songs as rehearsed
    const optimisticLogs = new Map<string, RehearsalLog>();
    for (const item of songItems) {
      optimisticLogs.set(item.song_id!, {
        id: '',
        church_id: churchId,
        service_id: serviceId,
        team_member_id: teamMemberId,
        song_id: item.song_id!,
        rehearsed: true,
        rehearsed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    setLogs(optimisticLogs);

    try {
      await db.rehearsals.markAll(serviceId, teamMemberId, churchId);
      toast({ title: 'All songs marked as rehearsed!', status: 'success', duration: 2000 });
    } catch (error) {
      await loadData();
      toast({ title: 'Failed to mark all', status: 'error', duration: 2000 });
      console.error('[RehearsalTab] MarkAll failed:', error);
    } finally {
      setToggling(false);
    }
  };

  const rehearsedCount = songItems.filter(item => logs.get(item.song_id!)?.rehearsed).length;
  const canToggle = !!teamMemberId;
  const allRehearsed = songItems.length > 0 && rehearsedCount === songItems.length;

  if (loading) {
    return (
      <Center py="12">
        <Spinner size="xl" color="teal.500" />
      </Center>
    );
  }

  if (songItems.length === 0) {
    return (
      <Box py="6">
        <EmptyState
          icon="music"
          title="No songs in this service"
          description="Songs will appear here once they are added to the service order."
        />
      </Box>
    );
  }

  return (
    <Box p="6">
      {/* Header */}
      <Flex justify="space-between" align="center" mb="4" flexWrap="wrap" gap="3">
        <Box>
          <Text fontSize="lg" fontWeight="semibold" color={textColor}>
            Song Rehearsal
          </Text>
          <Text fontSize="sm" color={subtextColor}>
            {rehearsedCount} of {songItems.length} songs rehearsed
          </Text>
        </Box>
        {canToggle && !allRehearsed && (
          <Button
            size="sm"
            colorScheme="teal"
            variant="outline"
            leftIcon={<CheckCheck size={16} />}
            onClick={handleMarkAll}
            isLoading={toggling}
          >
            Mark All Rehearsed
          </Button>
        )}
      </Flex>

      {/* Progress bar */}
      <Box
        w="full"
        h="2"
        bg={useColorModeValue('gray.100', 'gray.700')}
        borderRadius="full"
        mb="6"
        overflow="hidden"
      >
        <Box
          h="full"
          bg={allRehearsed ? 'green.400' : 'teal.400'}
          borderRadius="full"
          transition="width 0.3s ease"
          w={`${songItems.length > 0 ? (rehearsedCount / songItems.length) * 100 : 0}%`}
        />
      </Box>

      {/* Leader stats section */}
      {isLeader && stats.length > 0 && (
        <Box
          mb="6"
          p="4"
          bg={useColorModeValue('gray.50', 'gray.900')}
          borderRadius="lg"
          border="1px solid"
          borderColor={borderColor}
        >
          <Text fontSize="xs" fontWeight="700" color={subtextColor} textTransform="uppercase" mb="3" letterSpacing="wide">
            Band Rehearsal Progress
          </Text>
          <VStack spacing="2" align="stretch">
            {stats.map(stat => (
              <HStack key={stat.team_member_id} justify="space-between">
                <HStack spacing="2">
                  <Box
                    boxSize="8"
                    borderRadius="full"
                    bg={stat.rehearsed_count === stat.total_songs ? 'green.100' : 'orange.100'}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <CheckSquare
                      size={14}
                      color={stat.rehearsed_count === stat.total_songs ? '#16a34a' : '#ea580c'}
                    />
                  </Box>
                  <Box>
                    <Text fontSize="sm" fontWeight="600" color={textColor}>{stat.member_name}</Text>
                    <Text fontSize="xs" color={subtextColor}>{stat.member_role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
                  </Box>
                </HStack>
                <Tag
                  size="sm"
                  colorScheme={stat.rehearsed_count === stat.total_songs ? 'green' : 'orange'}
                  borderRadius="full"
                >
                  <TagLabel>{stat.rehearsed_count}/{stat.total_songs}</TagLabel>
                </Tag>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

      {/* Song Checklist */}
      <VStack spacing="2" align="stretch">
        {songItems.map((item, index) => {
          const log = logs.get(item.song_id!);
          const isRehearsed = log?.rehearsed ?? false;

          return (
            <Box
              key={item.song_id || item.id}
              bg={cardBg}
              border="1px solid"
              borderColor={isRehearsed ? 'green.200' : borderColor}
              borderRadius="lg"
              px="4"
              py="3"
              cursor={canToggle ? 'pointer' : 'default'}
              onClick={() => canToggle ? handleToggle(item.song_id!, isRehearsed) : undefined}
              transition="all 0.15s ease"
              borderLeft="3px solid"
              borderLeftColor={isRehearsed ? 'green.400' : 'gray.300'}
              _hover={canToggle ? {
                borderColor: isRehearsed ? 'green.300' : 'teal.200',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              } : undefined}
            >
              <HStack spacing="3">
                <Box
                  boxSize="24px"
                  borderRadius="md"
                  border="2px solid"
                  borderColor={isRehearsed ? 'green.400' : 'gray.300'}
                  bg={isRehearsed ? 'green.50' : 'transparent'}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  transition="all 0.15s ease"
                  flexShrink={0}
                  _hover={canToggle ? {
                    borderColor: isRehearsed ? 'green.500' : 'teal.400',
                  } : undefined}
                >
                  {isRehearsed && (
                    <Box as="span" color="green.500" fontSize="14px" lineHeight="1">✓</Box>
                  )}
                </Box>

                <VStack spacing="0" align="start" flex="1" minW="0">
                  <Text fontWeight="600" fontSize="sm" color={textColor} noOfLines={1}>
                    {item.title}
                  </Text>
                  {item.key && (
                    <Text fontSize="xs" color={subtextColor}>Key: {item.key}</Text>
                  )}
                </VStack>

                {isRehearsed && log?.rehearsed_at && (
                  <Text fontSize="xs" color="green.500" fontWeight="500" flexShrink={0}>
                    {new Date(log.rehearsed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </Text>
                )}
              </HStack>
            </Box>
          );
        })}
      </VStack>

      {!canToggle && (
        <Text mt="6" textAlign="center" fontSize="sm" color={emptyColor}>
          Sign in with a team member account linked to this service to track your rehearsal progress.
        </Text>
      )}
    </Box>
  );
}
