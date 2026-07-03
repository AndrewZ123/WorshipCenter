'use client';

import { useState, useEffect, useRef } from 'react';
import {
  VStack,
  HStack,
  Text,
  Box,
  Input,
  Checkbox,
  IconButton,
  useToast,
  useColorModeValue,
} from '@chakra-ui/react';
import { X, UserPlus, Users } from 'lucide-react';
import { apiUrl } from '@/lib/api-base';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/store';
import type { Service, ServiceAssignmentPopulated, TeamMember } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import StatusBadge, { mapAssignmentStatus } from '@/components/ui/StatusBadge';
import { Skeleton } from '@/components/ui/Skeleton';

interface ServiceScheduleProps {
  service: Service;
  churchId: string;
  currentUserId: string;
  highlightedAssignmentId?: string | null;
  onAssignmentsChange?: (count: number) => void;
}

export default function ServiceSchedule({
  service,
  churchId,
  currentUserId,
  highlightedAssignmentId,
  onAssignmentsChange,
}: ServiceScheduleProps) {
  const [assignments, setAssignments] = useState<ServiceAssignmentPopulated[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const highlightedRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Bulk assign state
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removeTargetName, setRemoveTargetName] = useState('');
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

  const prevCountRef = useRef<number>(0);
  useEffect(() => {
    if (prevCountRef.current !== assignments.length) {
      prevCountRef.current = assignments.length;
      onAssignmentsChange?.(assignments.length);
    }
  }, [assignments.length]);

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

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  const handleConfirm = async (assignmentId: string) => {
    try {
      setProcessing(assignmentId);

      const response = await fetch(apiUrl(`/api/assignments/${assignmentId}/confirm`), {
        method: 'POST',
        headers: await getAuthHeaders(),
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

  const confirmRemove = (assignmentId: string, memberName: string) => {
    setRemoveTarget(assignmentId);
    setRemoveTargetName(memberName);
  };

  const handleRemoveAssignment = async () => {
    if (!removeTarget) return;
    try {
      setProcessing(removeTarget);
      const response = await fetch(apiUrl(`/api/assignments/${removeTarget}`), {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to remove');
      toast({ title: 'Removed', description: 'Member removed from schedule', status: 'info' });
      setRemoveTarget(null);
      await loadAssignments();
    } catch (error) {
      console.error('[ServiceSchedule] Remove failed:', error);
      toast({ title: 'Error', description: 'Failed to remove member', status: 'error' });
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (assignmentId: string) => {
    try {
      setProcessing(assignmentId);

      const response = await fetch(apiUrl(`/api/assignments/${assignmentId}/decline`), {
        method: 'POST',
        headers: await getAuthHeaders(),
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
    if (selectedMembers.size === 0) {
      toast({
        title: 'Missing information',
        description: 'Select at least one member',
        status: 'warning',
      });
      return;
    }

    try {
      setBulkSaving(true);

      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(apiUrl('/api/assignments/bulk'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          serviceId: service.id,
          assignments: Array.from(selectedMembers).map((memberId) => ({
            team_member_id: memberId,
            role: bulkRole.trim() || 'Team Member',
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

      resetBulkAdd();
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

  const isOwnAssignment = (assignment: ServiceAssignmentPopulated) => {
    if (!assignment.team_member?.user_id) return false;
    return assignment.team_member.user_id === currentUserId;
  };

  // ─── Loading State ───────────────────────────────────────────────────
  if (loading) {
    return (
      <VStack spacing="3" align="stretch" p="6">
        {Array.from({ length: 3 }).map((_, i) => (
          <HStack key={i} spacing="3" align="start">
            <Skeleton height="40px" width="40px" borderRadius="full" />
            <VStack align="start" spacing="2" flex="1">
              <Skeleton height="16px" width="140px" />
              <Skeleton height="12px" width="90px" />
            </VStack>
          </HStack>
        ))}
      </VStack>
    );
  }

  // ─── Main Content ────────────────────────────────────────────────────
  return (
    <Box p="6">
      {/* Toolbar */}
      <HStack justify="space-between" align="center" mb="4">
        <Text fontSize="sm" color={subTextColor}>
          {assignments.length} {assignments.length === 1 ? 'person' : 'people'} scheduled
        </Text>
        {!showBulkAdd && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={UserPlus}
            onClick={startBulkAdd}
          >
            Add Members
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
            <Text fontWeight="600" color={headingColor} fontSize="sm">
              Add Team Members
            </Text>
            <IconButton
              aria-label="Close"
              icon={<X size={16} />}
              size="sm"
              variant="ghost"
              onClick={resetBulkAdd}
            />
          </HStack>

          <VStack spacing="4" align="stretch">
            {/* Role input */}
            <Box>
              <Text fontSize="xs" fontWeight="500" color={roleTextColor} mb="1.5">
                ROLE / POSITION
              </Text>
              <Input
                size="sm"
                borderRadius="md"
                value={bulkRole}
                onChange={(e) => setBulkRole(e.target.value)}
                placeholder="e.g., Worship Leader, Guitar, Vocals... (optional)"
                bg={cardBg}
              />
            </Box>

            {/* Member selection */}
            <Box>
              <Text fontSize="xs" fontWeight="500" color={roleTextColor} mb="1.5">
                SELECT MEMBERS{selectedMembers.size > 0 && ` (${selectedMembers.size} selected)`}
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
                      <Checkbox
                        isChecked={selectedMembers.has(member.id)}
                        onChange={() => toggleMemberSelection(member.id)}
                        size="sm"
                      />
                      <Avatar name={member.name} src={member.avatar_url} size="sm" />
                      <Text fontSize="sm" fontWeight="500" color={headingColor}>
                        {member.name}
                      </Text>
                      <Text fontSize="xs" color={subTextColor} ml="auto">
                        {member.roles.join(', ')}
                      </Text>
                    </HStack>
                  ))}
                </Box>
              )}
            </Box>

            {/* Actions */}
            <HStack justify="flex-end" spacing="2" pt="1">
              <Button variant="ghost" size="sm" onClick={resetBulkAdd}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleBulkAssign}
                isDisabled={bulkSaving || selectedMembers.size === 0}
              >
                {bulkSaving
                  ? 'Adding...'
                  : `Add ${selectedMembers.size || ''} Member${selectedMembers.size !== 1 ? 's' : ''}`}
              </Button>
            </HStack>
          </VStack>
        </Box>
      )}

      {/* Assignment List */}
      {assignments.length === 0 && !showBulkAdd ? (
        <Box
          textAlign="center"
          py="10"
          px="6"
          borderRadius="lg"
          border="1px solid"
          borderColor={borderColor}
          bg={cardBg}
        >
          <Users size={28} className="text-gray-300 mx-auto mb-3" />
          <Text fontSize="sm" fontWeight="600" color={headingColor}>
            No team members scheduled
          </Text>
          <Text fontSize="xs" color={subTextColor} mt="1" mb="4">
            Add team members to the schedule to get started.
          </Text>
          <Button variant="secondary" size="sm" leftIcon={UserPlus} onClick={startBulkAdd}>
            Add Team Members
          </Button>
        </Box>
      ) : (
        <VStack spacing="2" align="stretch">
          {assignments.map((assignment) => {
            const highlighted = assignment.id === highlightedAssignmentId;
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
                px="4"
                py="3"
                boxShadow={highlighted ? '0 0 0 3px rgba(66,153,225,0.15)' : '0 1px 2px rgba(0,0,0,0.04)'}
                transition="all 0.15s ease"
              >
              <HStack spacing="3" align="center" justify="space-between">
                {/* Left: Avatar + Info */}
                <HStack spacing="3" flex="1" minW="0">
                  <Avatar
                    name={assignment.team_member?.name || 'Unknown'}
                    src={assignment.team_member?.avatar_url}
                    size="sm"
                  />
                  <VStack align="start" spacing="0" flex="1" minW="0">
                    <HStack spacing="2" wrap="wrap">
                      <Text fontWeight="600" color={headingColor} fontSize="sm" isTruncated>
                        {assignment.team_member?.name || 'Unknown'}
                      </Text>
                      <StatusBadge
                        status={mapAssignmentStatus(assignment.status)}
                        size="sm"
                      />
                    </HStack>
                    <Text fontSize="xs" color={subTextColor} isTruncated>
                      {assignment.role}
                    </Text>
                    {highlighted && (
                      <Text fontSize="xs" color="blue.600" fontWeight="500" mt="0.5">
                        Please confirm your attendance →
                      </Text>
                    )}
                  </VStack>
                </HStack>

                {/* Right: Actions */}
                <HStack spacing="2" flexShrink="0">
                  {showActions && (
                    <>
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
                    </>
                  )}
                  {/* Remove button — on every row including declined */}
                  <IconButton
                    aria-label="Remove member"
                    icon={<X size={16} />}
                    size="sm"
                    variant="ghost"
                    color="gray.400"
                    _hover={{ color: 'red.500' }}
                    onClick={() => confirmRemove(assignment.id, assignment.team_member?.name || 'this member')}
                    isDisabled={processing === assignment.id}
                  />
                </HStack>
              </HStack>
              </Box>
            );
          })}
        </VStack>
      )}

      {/* Remove Confirmation */}
      <ConfirmDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveAssignment}
        title={`Remove ${removeTargetName}?`}
        message={`Are you sure you want to remove ${removeTargetName} from this service?`}
        confirmLabel="Remove"
        variant="destructive"
      />
    </Box>
  );
}
