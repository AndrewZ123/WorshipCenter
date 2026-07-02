'use client';

import { useState, useEffect, useRef } from 'react';
import {
  VStack,
  HStack,
  Text,
  Box,
  IconButton,
  useColorModeValue,
} from '@chakra-ui/react';
import { useToast } from '@chakra-ui/react';
import { X } from 'lucide-react';
import { db } from '@/lib/store';
import type { Service, ServiceAssignmentPopulated, TeamMember } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import StatusBadge, { mapAssignmentStatus } from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatServiceDate } from '@/lib/formatDate';

interface ServiceScheduleProps {
  service: Service;
  churchId: string;
  currentUserId: string;
  highlightedAssignmentId?: string | null;
}

export default function ServiceSchedule({
  service,
  churchId,
  currentUserId,
  highlightedAssignmentId,
}: ServiceScheduleProps) {
  const [assignments, setAssignments] = useState<ServiceAssignmentPopulated[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const highlightedRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Bulk assign state
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  const cardBg = useColorModeValue('white', 'gray.800');
  const subtleBg = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const headingColor = useColorModeValue('gray.900', 'white');
  const subTextColor = useColorModeValue('gray.500', 'gray.400');
  const roleTextColor = useColorModeValue('gray.600', 'gray.300');

  // Fetch assignments
  useEffect(() => {
    loadAssignments();
  }, [service.id, churchId]);

  // Scroll to highlighted assignment
  useEffect(() => {
    if (highlightedAssignmentId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [assignments, highlightedAssignmentId]);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const data = await db.assignments.getByService(service.id, churchId);
      setAssignments(data);
    } catch (error) {
      console.error('[ServiceSchedule] Failed to load assignments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load schedule',
        status: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (assignmentId: string) => {
    try {
      setProcessing(assignmentId);

      const response = await fetch(`/api/assignments/${assignmentId}/confirm`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to confirm assignment');
      }

      toast({
        title: 'Confirmed!',
        description: 'Your attendance has been confirmed',
        status: 'success',
      });

      await loadAssignments();
    } catch (error) {
      console.error('[ServiceSchedule] Failed to confirm:', error);
      toast({
        title: 'Error',
        description: 'Failed to confirm assignment',
        status: 'error',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (assignmentId: string) => {
    try {
      setProcessing(assignmentId);

      const response = await fetch(`/api/assignments/${assignmentId}/decline`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to decline assignment');
      }

      toast({
        title: 'Declined',
        description: 'You have declined this assignment',
        status: 'success',
      });

      await loadAssignments();
    } catch (error) {
      console.error('[ServiceSchedule] Failed to decline:', error);
      toast({
        title: 'Error',
        description: 'Failed to decline assignment',
        status: 'error',
      });
    } finally {
      setProcessing(null);
    }
  };

  const loadTeamMembersForBulk = async () => {
    try {
      const members = await db.teamMembers.getByChurch(churchId);
      const assignedIds = new Set(assignments.map((a) => a.team_member_id));
      setTeamMembers(members.filter((m) => !assignedIds.has(m.id)));
    } catch (error) {
      console.error('[ServiceSchedule] Failed to load team members:', error);
    }
  };

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handleBulkAssign = async () => {
    if (selectedMembers.size === 0 || !bulkRole.trim()) {
      toast({
        title: 'Missing information',
        description: 'Select at least one member and enter a role',
        status: 'warning',
      });
      return;
    }

    try {
      setBulkSaving(true);

      const response = await fetch('/api/assignments/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          assignments: Array.from(selectedMembers).map((memberId) => ({
            team_member_id: memberId,
            role: bulkRole.trim(),
          })),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create assignments');
      }

      const result = await response.json();
      toast({
        title: 'Success!',
        description: `Created ${result.created} assignment${result.created !== 1 ? 's' : ''}`,
        status: 'success',
      });

      setShowBulkAdd(false);
      setSelectedMembers(new Set());
      setBulkRole('');
      await loadAssignments();
    } catch (error) {
      console.error('[ServiceSchedule] Bulk assign failed:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create assignments',
        status: 'error',
      });
    } finally {
      setBulkSaving(false);
    }
  };

  const resetBulkAdd = () => {
    setShowBulkAdd(false);
    setSelectedMembers(new Set());
    setBulkRole('');
  };

  const startBulkAdd = () => {
    setShowBulkAdd(true);
    loadTeamMembersForBulk();
  };

  const isHighlighted = (assignmentId: string) => {
    return assignmentId === highlightedAssignmentId;
  };

  const isOwnAssignment = (assignment: ServiceAssignmentPopulated) => {
    if (!assignment.team_member?.user_id) return false;
    return assignment.team_member.user_id === currentUserId;
  };

  // ─── Loading State ───────────────────────────────────────────────────
  if (loading) {
    return (
      <VStack spacing="3" align="stretch" mt="6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Box
            key={i}
            bg={cardBg}
            border="1px solid"
            borderColor={borderColor}
            borderRadius="lg"
            p="4"
          >
            <HStack spacing="3" align="start">
              <Skeleton height="40px" width="40px" borderRadius="full" />
              <VStack align="start" spacing="2" flex="1">
                <HStack spacing="2">
                  <Skeleton height="18px" width="120px" />
                  <Skeleton height="18px" width="60px" borderRadius="full" />
                </HStack>
                <Skeleton height="14px" width="140px" />
              </VStack>
            </HStack>
          </Box>
        ))}
      </VStack>
    );
  }

  // ─── Empty State ─────────────────────────────────────────────────────
  if (assignments.length === 0 && !showBulkAdd) {
    return (
      <Box mt="6">
        <EmptyState
          icon="userCheck"
          title="No team members scheduled"
          description="Add team members to the schedule to get started."
          ctaLabel="Add Team Members"
          ctaOnClick={startBulkAdd}
          size="sm"
        />
      </Box>
    );
  }

  // ─── Main Schedule ───────────────────────────────────────────────────
  return (
    <Box mt="6">
      {/* Header */}
      <HStack justify="space-between" align="center" mb="4">
        <VStack align="start" spacing="0">
          <Text fontSize="lg" fontWeight="600" color={headingColor}>
            Team Schedule
          </Text>
          <Text fontSize="sm" color={subTextColor}>
            {formatServiceDate(service.date, service.time)}
          </Text>
        </VStack>
        {!showBulkAdd && (
          <Button variant="secondary" size="sm" onClick={startBulkAdd}>
            + Add Members
          </Button>
        )}
      </HStack>

      {/* Bulk Add Panel */}
      {showBulkAdd && (
        <Box
          bg={subtleBg}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="lg"
          p="4"
          mb="4"
        >
          <HStack justify="space-between" mb="4">
            <Text fontWeight="600" color={headingColor}>
              Add Team Members
            </Text>
            <IconButton
              aria-label="Close"
              icon={<X size={18} />}
              size="sm"
              variant="ghost"
              onClick={resetBulkAdd}
            />
          </HStack>

          <VStack spacing="4" align="stretch">
            {/* Role input */}
            <VStack align="start" spacing="1">
              <Text fontSize="sm" fontWeight="500" color={roleTextColor}>
                Role / Position
              </Text>
              <input
                type="text"
                value={bulkRole}
                onChange={(e) => setBulkRole(e.target.value)}
                placeholder="e.g., Worship Leader, Guitar, Vocals, Drums..."
                style={{
                  width: '100%',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3182ce';
                  e.target.style.boxShadow = '0 0 0 1px #3182ce';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </VStack>

            {/* Member selection */}
            <VStack align="start" spacing="2">
              <Text fontSize="sm" fontWeight="500" color={roleTextColor}>
                Select Members
                {selectedMembers.size > 0 && ` (${selectedMembers.size} selected)`}
              </Text>
              {teamMembers.length === 0 ? (
                <Text fontSize="sm" color={subTextColor} py="2">
                  No available team members.
                </Text>
              ) : (
                <Box
                  maxH="240px"
                  overflowY="auto"
                  bg={cardBg}
                  border="1px solid"
                  borderColor={borderColor}
                  borderRadius="md"
                  p="2"
                  w="100%"
                >
                  {teamMembers.map((member) => (
                    <HStack
                      key={member.id}
                      spacing="3"
                      p="2"
                      borderRadius="md"
                      cursor="pointer"
                      _hover={{ bg: subtleBg }}
                      onClick={() => toggleMemberSelection(member.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.has(member.id)}
                        onChange={() => toggleMemberSelection(member.id)}
                        style={{
                          height: '16px',
                          width: '16px',
                          borderRadius: '4px',
                          borderColor: '#d1d5db',
                          cursor: 'pointer',
                        }}
                      />
                      <Avatar name={member.name} src={member.avatar_url} size="sm" />
                      <VStack align="start" spacing="0">
                        <Text fontSize="sm" fontWeight="500" color={headingColor}>
                          {member.name}
                        </Text>
                        <Text fontSize="xs" color={subTextColor}>
                          {member.roles.join(', ')}
                        </Text>
                      </VStack>
                    </HStack>
                  ))}
                </Box>
              )}
            </VStack>

            {/* Actions */}
            <HStack justify="flex-end" spacing="2" pt="2">
              <Button variant="ghost" size="sm" onClick={resetBulkAdd}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleBulkAssign}
                isDisabled={bulkSaving || selectedMembers.size === 0 || !bulkRole.trim()}
              >
                {bulkSaving
                  ? 'Adding...'
                  : `Add ${selectedMembers.size || ''} Member${selectedMembers.size !== 1 ? 's' : ''}`}
              </Button>
            </HStack>
          </VStack>
        </Box>
      )}

      {/* Assignment Cards */}
      <VStack spacing="3" align="stretch">
        {assignments.map((assignment) => {
          const highlighted = isHighlighted(assignment.id);
          const isOwn = isOwnAssignment(assignment);
          const showActions = isOwn && assignment.status === 'pending';

          return (
            <Box
              key={assignment.id}
              ref={highlighted ? highlightedRef : null}
              bg={highlighted ? 'blue.50' : cardBg}
              border="1px solid"
              borderColor={highlighted ? 'blue.400' : borderColor}
              borderRadius="lg"
              p="4"
              transition="all 0.2s"
            >
              <HStack spacing="3" align="start" justify="space-between">
                {/* Left: Avatar + Info */}
                <HStack spacing="3" align="start" flex="1">
                  <Avatar
                    name={assignment.team_member?.name || 'Unknown'}
                    src={assignment.team_member?.avatar_url}
                    size="md"
                  />
                  <VStack align="start" spacing="1" flex="1">
                    <HStack spacing="2" wrap="wrap">
                      <Text fontWeight="600" color={headingColor} fontSize="sm">
                        {assignment.team_member?.name || 'Unknown'}
                      </Text>
                      <StatusBadge
                        status={mapAssignmentStatus(assignment.status)}
                        size="sm"
                      />
                    </HStack>
                    <Text fontSize="sm" color={subTextColor}>
                      {assignment.role}
                    </Text>
                    {highlighted && (
                      <Text fontSize="xs" color="blue.600" fontWeight="500" mt="1">
                        Please confirm your attendance below
                      </Text>
                    )}
                  </VStack>
                </HStack>

                {/* Right: Actions */}
                {showActions && (
                  <HStack spacing="2" flexShrink={0}>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleConfirm(assignment.id)}
                      isDisabled={processing === assignment.id}
                    >
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDecline(assignment.id)}
                      isDisabled={processing === assignment.id}
                    >
                      Decline
                    </Button>
                  </HStack>
                )}
              </HStack>
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
}