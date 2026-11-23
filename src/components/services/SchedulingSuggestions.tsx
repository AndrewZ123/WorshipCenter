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
} from '@/lib/types';
import { rankSuggestions } from '@/lib/scheduling/suggestions';
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
