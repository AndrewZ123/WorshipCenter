'use client';

import { useState, useMemo } from 'react';
import {
  Box, Text, VStack, HStack, Button, useColorModeValue,
  Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverBody,
  PopoverArrow, PopoverCloseButton, Badge, Tooltip,
} from '@chakra-ui/react';
import { Lightbulb, UserPlus, AlertTriangle } from 'lucide-react';
import type {
  TeamMember, TeamMemberBlockoutDate, ServiceAssignmentPopulated,
  SuggestedAssignment, SchedulingConflict,
} from '@/lib/types';
import Avatar from '@/components/ui/Avatar';

interface Props {
  role: string;
  teamMembers: TeamMember[];
  assignments: ServiceAssignmentPopulated[];
  blockoutDates: TeamMemberBlockoutDate[];
  serviceDate: string;
  onAssign: (memberId: string) => void;
  isDisabled?: boolean;
}

function rankSuggestions(
  candidates: TeamMember[],
  existingAssignments: ServiceAssignmentPopulated[],
  blockoutDates: TeamMemberBlockoutDate[],
  serviceDate: string,
  role: string,
): SuggestedAssignment[] {
  const svcDate = serviceDate ? new Date(serviceDate + 'T00:00:00') : new Date();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const recentAssignments = existingAssignments.filter((a) => {
    const svcDate = a.services?.date;
    if (!svcDate) return false;
    return new Date(svcDate) >= ninetyDaysAgo;
  });

  const assignmentCounts = new Map<string, number>();
  const lastServed = new Map<string, string>();
  for (const a of recentAssignments) {
    assignmentCounts.set(a.team_member_id, (assignmentCounts.get(a.team_member_id) || 0) + 1);
    const svcDate = a.services?.date;
    if (svcDate) {
      const existing = lastServed.get(a.team_member_id);
      if (!existing || svcDate > existing) {
        lastServed.set(a.team_member_id, svcDate);
      }
    }
  }

  const assignedIds = new Set(existingAssignments.map((a) => a.team_member_id));

  const results: SuggestedAssignment[] = candidates
    .filter((m) => !assignedIds.has(m.id))
    .map((member) => {
      const conflicts: SchedulingConflict[] = [];
      const reasons: string[] = [];
      let score = 100;

      const isBlocked = blockoutDates.find(
        (b) =>
          b.team_member_id === member.id &&
          new Date(b.start_date + 'T00:00:00') <= svcDate &&
          new Date(b.end_date + 'T00:00:00') >= svcDate,
      );
      if (isBlocked) {
        score -= 100;
        conflicts.push({
          type: 'blockout',
          message: `Blocked out ${isBlocked.start_date} – ${isBlocked.end_date}${isBlocked.reason ? ` (${isBlocked.reason})` : ''}`,
          severity: 'error',
          blockoutDate: isBlocked,
        });
        reasons.push('Blocked out');
      }

      const sameDayAssignments = existingAssignments.filter(
        (a) => a.services?.date === serviceDate && a.team_member_id !== member.id,
      );
      if (sameDayAssignments.length > 0) {
        score -= 50;
        conflicts.push({
          type: 'double_booking',
          message: `Already assigned to ${sameDayAssignments.length} other service(s) on this date`,
          severity: 'warning',
        });
        reasons.push('Other assignment this date');
      }

      const count = assignmentCounts.get(member.id) || 0;
      score -= count * 10;
      if (count === 0) {
        reasons.push('No recent services');
      } else {
        reasons.push(`${count} service(s) in 90d`);
      }

      const hasRole = member.roles.some(
        (r) => r.toLowerCase() === role.toLowerCase() || r.toLowerCase().includes(role.toLowerCase()),
      );
      if (hasRole) {
        score += 20;
        reasons.push('Has this role');
      }

      return {
        teamMemberId: member.id,
        name: member.name,
        avatar_url: member.avatar_url,
        role,
        score: Math.max(0, score),
        reasons,
        conflicts,
      };
    });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 5);
}

export default function SchedulingSuggestions(props: Props) {
  const { role, teamMembers, assignments, blockoutDates, serviceDate, onAssign, isDisabled } = props;
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const subTextColor = useColorModeValue('gray.500', 'gray.400');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtleBg = useColorModeValue('gray.50', 'gray.700');

  const suggestions = useMemo(
    () => rankSuggestions(teamMembers, assignments, blockoutDates, serviceDate, role),
    [teamMembers, assignments, blockoutDates, serviceDate, role],
  );

  const handleAssign = async (memberId: string) => {
    try {
      setAssigningId(memberId);
      await onAssign(memberId);
    } finally {
      setAssigningId(null);
    }
  };

  const available = suggestions.filter((s) => s.score > 0);
  if (available.length === 0) return null;

  return (
    <Popover placement="bottom-start" isLazy>
      <PopoverTrigger>
        <Button
          size="xs"
          variant="ghost"
          isDisabled={isDisabled}
          leftIcon={<Lightbulb size={12} />}
          color="orange.500"
          _hover={{ bg: 'orange.50', color: 'orange.600' }}
        >
          Suggest
        </Button>
      </PopoverTrigger>
      <PopoverContent
        bg={cardBg}
        borderWidth="1px"
        borderColor={borderColor}
        borderRadius="lg"
        boxShadow="lg"
        w="320px"
      >
        <PopoverArrow bg={cardBg} borderColor={borderColor} />
        <PopoverHeader fontWeight="600" fontSize="sm" borderBottomWidth="1px" borderColor={borderColor}>
          Suggestions for &ldquo;{role}&rdquo;
        </PopoverHeader>
        <PopoverCloseButton />
        <PopoverBody p="2" maxH="300px" overflowY="auto">
          <VStack spacing="1" align="stretch">
            {available.map((s) => {
              const isBlocked = s.conflicts.some((c) => c.type === 'blockout');
              return (
                <HStack
                  key={s.teamMemberId}
                  spacing="3"
                  p="2"
                  borderRadius="md"
                  bg={isBlocked ? 'red.50' : 'transparent'}
                  opacity={isBlocked ? 0.6 : 1}
                  _hover={!isBlocked ? { bg: subtleBg } : undefined}
                >
                  <Avatar name={s.name} src={s.avatar_url} size="sm" />
                  <Box flex="1" minW="0">
                    <Text fontSize="sm" fontWeight="500" color={textColor} noOfLines={1}>
                      {s.name}
                    </Text>
                    <HStack spacing="1" wrap="wrap">
                      <Badge
                        fontSize="2xs"
                        borderRadius="full"
                        px="1.5"
                        colorScheme={s.score > 70 ? 'green' : s.score > 40 ? 'yellow' : 'red'}
                      >
                        {s.score}pts
                      </Badge>
                      {s.reasons.slice(0, 2).map((r, i) => (
                        <Text key={i} fontSize="2xs" color={subTextColor} noOfLines={1}>
                          {r}
                        </Text>
                      ))}
                    </HStack>
                  </Box>
                  {isBlocked ? (
                    <Tooltip label="Team member is blocked out on this date">
                      <Box color="red.400">
                        <AlertTriangle size={14} />
                      </Box>
                    </Tooltip>
                  ) : (
                    <Button
                      size="xs"
                      variant="primary"
                      leftIcon={assigningId === s.teamMemberId ? undefined : <UserPlus size={12} />}
                      onClick={() => handleAssign(s.teamMemberId)}
                      isLoading={assigningId === s.teamMemberId}
                      isDisabled={!!assigningId}
                    >
                      Assign
                    </Button>
                  )}
                </HStack>
              );
            })}
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
