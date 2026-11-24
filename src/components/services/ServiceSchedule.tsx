'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
  Tooltip,
  Badge,
  Switch,
} from '@chakra-ui/react';
import { X, UserPlus, Users, Calendar, AlertTriangle, Sparkles, ArrowLeftRight } from 'lucide-react';
import { apiUrl, getAuthHeaders, parseJsonSafe } from '@/lib/api-base';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import type {
  Service, ServiceAssignmentPopulated, TeamMember, TeamMemberBlockoutDate,
  SchedulingConflict, ServiceRolePosition, AssignmentSwapSummary,
} from '@/lib/types';
import {
  getFillRolesHint,
  getFillRolesState,
  getRoleFillBadges,
} from '@/lib/scheduling/rolesNeeded';
import {
  getSwapActionVisibility,
  isOwnAssignment,
  shouldShowSwapRequest,
} from '@/lib/swaps/ui';
import { notifySwapsChanged, useSwapChanges, useSwapRealtime } from '@/lib/swaps/refresh';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import StatusBadge, { mapAssignmentStatus } from '@/components/ui/StatusBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import SchedulingSuggestions from './SchedulingSuggestions';
import AutoFillRolesModal from './AutoFillRolesModal';
import RolesNeededEditor from './RolesNeededEditor';
import SwapRequestAction from '@/components/serve/SwapRequestAction';
import OpenSwapsDrawer from '@/components/serve/OpenSwapsDrawer';

interface ServiceScheduleProps {
  service: Service;
  churchId: string;
  currentUserId: string;
  highlightedAssignmentId?: string | null;
  onAssignmentsChange?: (count: number) => void;
  readOnly?: boolean;
}

interface MemberConflictInfo {
  memberId: string;
  conflicts: SchedulingConflict[];
  isBlocked: boolean;
  hasWarning: boolean;
}

export default function ServiceSchedule({
  service,
  churchId,
  currentUserId,
  highlightedAssignmentId,
  onAssignmentsChange,
  readOnly = false,
}: ServiceScheduleProps) {
  const [assignments, setAssignments] = useState<ServiceAssignmentPopulated[]>([]);
  const [swaps, setSwaps] = useState<AssignmentSwapSummary[]>([]);
  const [openSwapCount, setOpenSwapCount] = useState(0);
  const [showOpenSwaps, setShowOpenSwaps] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [swapProcessing, setSwapProcessing] = useState<string | null>(null);
  const highlightedRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const { user } = useAuth();
  const isLeader = user?.role === 'admin' || user?.role === 'leader';

  // Bulk assign state
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removeTargetName, setRemoveTargetName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  // Auto-fill preview state. Role positions define the staffing needs; open
  // slots are recomputed from them whenever assignments change.
  const [showAutoFill, setShowAutoFill] = useState(false);
  const [rolePositions, setRolePositions] = useState<ServiceRolePosition[]>([]);

  // Conflict detection
  const [blockoutDates, setBlockoutDates] = useState<TeamMemberBlockoutDate[]>([]);
  const [memberConflicts, setMemberConflicts] = useState<Map<string, SchedulingConflict[]>>(new Map());
  const [conflictChecked, setConflictChecked] = useState(false);
  const [showUnavailable, setShowUnavailable] = useState(true);
  const [conflictAssignConfirm, setConflictAssignConfirm] = useState<{
    open: boolean;
    memberIds: string[];
    conflictCount: number;
  }>({ open: false, memberIds: [], conflictCount: 0 });

  // Fetch blockout dates for the church
  useEffect(() => {
    if (!churchId) return;
    db.blockoutDates.getByChurch(churchId).then(setBlockoutDates).catch(console.error);
  }, [churchId]);

  // Fetch configured role positions so the "Fill open roles" action knows
  // whether any staffing slots are still empty.
  const loadRolePositions = () => {
    if (!churchId || !service.id) return;
    db.rolePositions
      .getByService(service.id, churchId)
      .then(setRolePositions)
      .catch(console.error);
  };

  useEffect(() => {
    loadRolePositions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id, churchId]);

  const fillRolesState = useMemo(
    () => getFillRolesState(rolePositions, assignments),
    [rolePositions, assignments],
  );
  const fillRolesHint = getFillRolesHint(fillRolesState);

  const assignmentRoleNames = useMemo(
    () => Array.from(new Set(assignments.map((assignment) => assignment.role))),
    [assignments],
  );

  const isBlockedOut = (memberId: string): TeamMemberBlockoutDate | undefined => {
    if (!service.date) return undefined;
    const svcDate = new Date(service.date + 'T00:00:00');
    return blockoutDates.find(b =>
      b.team_member_id === memberId &&
      new Date(b.start_date + 'T00:00:00') <= svcDate &&
      new Date(b.end_date + 'T00:00:00') >= svcDate
    );
  };

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

  const loadAssignments = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);
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
      if (!options?.silent) setLoading(false);
    }
  };

  // Pending swaps for this service. The counter includes every live request on
  // the service (any requester); leaders can approve/decline inline and
  // volunteers see the badge on their row.
  const loadSwaps = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        apiUrl(`/api/swaps?status=pending&serviceId=${service.id}`),
        { headers }
      );

      if (response.ok) {
        const data = await parseJsonSafe(response);
        const nextSwaps = Array.isArray(data.swaps) ? data.swaps : [];
        setSwaps(nextSwaps);
        setOpenSwapCount(nextSwaps.length);
      }
    } catch (error) {
      console.error('[ServiceSchedule] Failed to load swaps:', error);
    }
  };

  const handleSwapDecision = async (swapId: string, action: 'approve' | 'decline') => {
    try {
      setSwapProcessing(swapId);
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
        description:
          action === 'approve'
            ? 'The assignment has moved to the teammate who claimed it.'
            : 'The original assignment is unchanged.',
        status: action === 'approve' ? 'success' : 'info',
      });
      notifySwapsChanged();
      await Promise.all([loadAssignments(), loadSwaps()]);
    } catch (error) {
      console.error('[ServiceSchedule] Swap decision failed:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${action} swap`,
        status: 'error',
      });
    } finally {
      setSwapProcessing(null);
    }
  };

  useSwapChanges(() => {
    loadAssignments({ silent: true });
    loadSwaps();
  });

  useSwapRealtime(churchId, () => {
    loadAssignments({ silent: true });
    loadSwaps();
  });

  const swapByAssignment = useMemo(
    () => new Map(swaps.map((swap) => [swap.assignment_id, swap])),
    [swaps]
  );

  useEffect(() => {
    if (!service.id || !churchId) return;
    loadSwaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id, churchId]);

  // Live assignment status updates from volunteers responding to emailed
  // confirm/decline links. Refetch on focus too so a leader who comes back to
  // the tab sees the latest status without a manual reload.
  useEffect(() => {
    if (!service.id || !churchId) return;

    let cancelled = false;
    const channel = supabase
      .channel(`service-assignments:${service.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_assignments',
          filter: `service_id=eq.${service.id}`,
        },
        () => {
          if (!cancelled) {
            loadAssignments({ silent: true });
            loadSwaps();
          }
        }
      )
      .subscribe();

    const handleFocus = () => {
      if (!cancelled) {
        loadAssignments({ silent: true });
        loadSwaps();
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id, churchId]);

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

  // ─── Conflict Detection ──────────────────────────────────────────

  const computeConflicts = async (members: TeamMember[]) => {
    const conflictMap = new Map<string, SchedulingConflict[]>();
    if (!service.date) return conflictMap;

    try {
      const sameDayAssignments = await db.assignments.getByDate(service.date, churchId);

      for (const member of members) {
        const conflicts: SchedulingConflict[] = [];

        const existing = sameDayAssignments.filter(
          (a) => a.team_member_id === member.id && a.service_id !== service.id
        );
        for (const ea of existing) {
          const svc = ea.services || { id: ea.service_id, title: 'Service', date: service.date, time: '' };
          conflicts.push({
            type: 'double_booking',
            message: `Already assigned to "${svc.title}" role on ${svc.date}`,
            severity: 'warning',
            conflictingService: {
              id: svc.id,
              title: svc.title,
              date: svc.date,
              time: svc.time,
            },
          });
        }

        const blockout = isBlockedOut(member.id);
        if (blockout) {
          conflicts.push({
            type: 'blockout',
            message: `Blocked out ${blockout.start_date} – ${blockout.end_date}${blockout.reason ? ` (${blockout.reason})` : ''}`,
            severity: 'error',
            blockoutDate: blockout,
          });
        }

        if (conflicts.length > 0) {
          conflictMap.set(member.id, conflicts);
        }
      }
    } catch (error) {
      console.error('[ServiceSchedule] Conflict detection error:', error);
    }

    return conflictMap;
  };

  const getMemberConflictInfo = (memberId: string): MemberConflictInfo | null => {
    const conflicts = memberConflicts.get(memberId);
    if (!conflicts) return null;
    return {
      memberId,
      conflicts,
      isBlocked: conflicts.some((c) => c.type === 'blockout'),
      hasWarning: conflicts.some((c) => c.type === 'double_booking'),
    };
  };

  const loadTeamMembersForBulk = async () => {
    try {
      const members = await db.teamMembers.getByChurch(churchId);
      const assignedIds = new Set(assignments.map((a) => a.team_member_id));
      const available = members.filter((m) => !assignedIds.has(m.id));
      setTeamMembers(available);
      setConflictChecked(false);
      setSelectedMembers(new Set());

      const conflicts = await computeConflicts(available);
      setMemberConflicts(conflicts);
      setConflictChecked(true);
    } catch (error) {
      console.error('[ServiceSchedule] Failed to load team members:', error);
    }
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

    const conflictedSelected = Array.from(selectedMembers).filter(
      (id) => memberConflicts.has(id)
    );

    if (conflictedSelected.length > 0) {
      setConflictAssignConfirm({
        open: true,
        memberIds: conflictedSelected,
        conflictCount: conflictedSelected.length,
      });
      return;
    }

    await doBulkAssign(Array.from(selectedMembers));
  };

  const doBulkAssign = async (memberIds: string[]) => {
    try {
      setBulkSaving(true);

      const response = await fetch(apiUrl('/api/assignments/bulk'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          serviceId: service.id,
          assignments: memberIds.map((memberId) => ({
            team_member_id: memberId,
            role: bulkRole.trim() || 'Team Member',
          })),
        }),
      });

      if (!response.ok) {
        const err = await parseJsonSafe(response).catch(() => ({}));
        throw new Error(err.error || 'Failed to create assignments');
      }

      const result = await parseJsonSafe(response);
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

  const handleForceBulkAssign = async () => {
    setConflictAssignConfirm({ open: false, memberIds: [], conflictCount: 0 });
    await doBulkAssign(Array.from(selectedMembers));
  };

  const resetBulkAdd = () => {
    setShowBulkAdd(false);
    setSelectedMembers(new Set());
    setBulkRole('');
    setShowUnavailable(true);
  };

  const startBulkAdd = () => {
    setShowBulkAdd(true);
    loadTeamMembersForBulk();
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

  // ─── Role-based suggestions logic ────────────────────────────────

  const roleFillBadges = useMemo(
    () => getRoleFillBadges(rolePositions, assignments),
    [rolePositions, assignments],
  );

  const handleSuggestAssign = async (memberId: string) => {
    try {
      await doBulkAssign([memberId]);
    } catch {
      // Toast already shown in doBulkAssign
    }
  };

  // ─── Assignment list helpers ─────────────────────────────────────

  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((a, b) => {
      const aRole = a.role || '';
      const bRole = b.role || '';
      if (aRole !== bRole) return aRole.localeCompare(bRole);
      const aName = a.team_member?.name || '';
      const bName = b.team_member?.name || '';
      return aName.localeCompare(bName);
    });
  }, [assignments]);

  const isConflicted = (memberId: string) => memberConflicts.has(memberId);

  // ─── Loading State ──────────────────────────────────────────────────
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

  // ─── Main Content ───────────────────────────────────────────────────
  return (
    <Box p="6">
      {/* Toolbar */}
      <HStack justify="space-between" align="center" mb="4" wrap="wrap" gap="2">
        <HStack spacing="2" wrap="wrap">
          <Text fontSize="sm" color={subTextColor}>
            {assignments.length} {assignments.length === 1 ? 'person' : 'people'} scheduled
          </Text>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={ArrowLeftRight}
            onClick={() => setShowOpenSwaps(true)}
          >
            Open swaps ({openSwapCount})
          </Button>
        </HStack>
        <HStack spacing="2">
          {!showBulkAdd && isLeader && !readOnly && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={Sparkles}
              onClick={() => setShowAutoFill(true)}
              isDisabled={fillRolesState !== 'open'}
              disabledTooltip={fillRolesHint || undefined}
            >
              Fill open roles
            </Button>
          )}
          {!showBulkAdd && !readOnly && (
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
      </HStack>

      {!showBulkAdd && isLeader && !readOnly && (
        <RolesNeededEditor
          serviceId={service.id}
          serviceTitle={service.title}
          serviceDate={service.date}
          serviceTime={service.time}
          churchId={churchId}
          positions={rolePositions}
          assignmentRoles={assignmentRoleNames}
          onSaved={loadRolePositions}
        />
      )}

      {/* Bulk Add Panel */}
      {showBulkAdd && !readOnly && (
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
            <HStack spacing="2">
              {conflictChecked && (
                <HStack spacing="1">
                  <Text fontSize="xs" color={subTextColor}>Show unavailable</Text>
                  <Switch
                    size="sm"
                    isChecked={showUnavailable}
                    onChange={(e) => setShowUnavailable(e.target.checked)}
                  />
                </HStack>
              )}
              <IconButton
                aria-label="Close"
                icon={<X size={16} />}
                size="sm"
                variant="ghost"
                onClick={resetBulkAdd}
              />
            </HStack>
          </HStack>

          <VStack spacing="4" align="stretch">
            {/* Role input */}
            <Box>
              <Text fontSize="xs" fontWeight="500" color={roleTextColor} mb="1.5">
                ROLE / POSITION
              </Text>
              <HStack spacing="2">
                <Input
                  size="sm"
                  borderRadius="md"
                  value={bulkRole}
                  onChange={(e) => setBulkRole(e.target.value)}
                  placeholder="e.g., Worship Leader, Guitar, Vocals..."
                  bg={cardBg}
                  flex="1"
                />
                {bulkRole.trim() && (
                  <SchedulingSuggestions
                    role={bulkRole.trim()}
                    teamMembers={teamMembers}
                    assignments={assignments}
                    blockoutDates={blockoutDates}
                    serviceDate={service.date || ''}
                    onAssign={handleSuggestAssign}
                    isDisabled={bulkSaving}
                  />
                )}
              </HStack>
            </Box>

            {/* Member selection */}
            <Box>
              <Text fontSize="xs" fontWeight="500" color={roleTextColor} mb="1.5">
                SELECT MEMBERS{selectedMembers.size > 0 && ` (${selectedMembers.size} selected)`}
              </Text>
              {teamMembers.length === 0 ? (
                <Text fontSize="sm" color={subTextColor} py="2">
                  No team members available.
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
                  {teamMembers
                    .filter((m) => showUnavailable || !isConflicted(m.id))
                    .map((member) => {
                    const isOwn = member.user_id === currentUserId;
                    const blockout = isBlockedOut(member.id);
                    const conflictInfo = getMemberConflictInfo(member.id);
                    const hasConflict = conflictInfo !== null;
                    return (
                    <HStack
                      key={member.id}
                      spacing="3"
                      p="2"
                      borderRadius="md"
                      cursor={hasConflict ? 'default' : 'pointer'}
                      bg={hasConflict ? 'orange.50' : 'transparent'}
                      _hover={!hasConflict ? { bg: subtleBg } : undefined}
                      onClick={() => !hasConflict && toggleMemberSelection(member.id)}
                    >
                      <Checkbox
                        isChecked={selectedMembers.has(member.id)}
                        onChange={() => toggleMemberSelection(member.id)}
                        size="sm"
                        isDisabled={hasConflict}
                      />
                      <Box opacity={hasConflict ? 0.5 : 1}>
                        <Avatar
                          name={member.name}
                          src={member.avatar_url}
                          size="sm"
                        />
                      </Box>
                      <Box flex="1" minW="0">
                        <HStack spacing="1" wrap="wrap">
                          <Text
                            fontSize="sm"
                            fontWeight="500"
                            color={hasConflict ? subTextColor : headingColor}
                            noOfLines={1}
                            textDecoration={hasConflict ? 'line-through' : 'none'}
                          >
                            {isOwn ? 'You' : member.name}
                          </Text>
                          {blockout && (
                            <Tooltip label={`Blocked out ${new Date(blockout.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(blockout.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${blockout.reason ? ` (${blockout.reason})` : ''}`}>
                              <Badge variant="subtle" colorScheme="orange" fontSize="xs" borderRadius="full" px="1.5" whiteSpace="nowrap">
                                <Calendar size={10} style={{ display: 'inline', marginRight: 2 }} />
                                Blocked
                              </Badge>
                            </Tooltip>
                          )}
                          {conflictInfo?.hasWarning && !blockout && (
                            <Tooltip label={conflictInfo.conflicts.map(c => c.message).join('; ')}>
                              <Badge variant="subtle" colorScheme="yellow" fontSize="xs" borderRadius="full" px="1.5" whiteSpace="nowrap">
                                <AlertTriangle size={10} style={{ display: 'inline', marginRight: 2 }} />
                                Conflict
                              </Badge>
                            </Tooltip>
                          )}
                        </HStack>
                        <Text fontSize="xs" color={subTextColor} noOfLines={1}>{member.roles.join(', ')}</Text>
                      </Box>
                    </HStack>
                    );
                  })}
                </Box>
              )}
            </Box>

            {/* Conflict info */}
            {conflictChecked && !showUnavailable && (
              <Text fontSize="xs" color={subTextColor} fontStyle="italic">
                Hiding {teamMembers.filter(m => isConflicted(m.id)).length} unavailable member(s).
              </Text>
            )}

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
                isLoading={bulkSaving}
              >
                {bulkSaving
                  ? 'Adding...'
                  : `Add ${selectedMembers.size || ''} Member${selectedMembers.size !== 1 ? 's' : ''}`}
              </Button>
            </HStack>
          </VStack>
        </Box>
      )}

      {/* Role Summary */}
      {roleFillBadges.length > 0 && !showBulkAdd && (
        <HStack spacing="2" mb="3" wrap="wrap">
          {roleFillBadges.map((role) => (
            <Badge
              key={role.role}
              variant="subtle"
              colorScheme={role.complete ? 'green' : 'orange'}
              borderRadius="full"
              px="2"
              py="0.5"
              fontSize="xs"
            >
              {role.text}
            </Badge>
          ))}
        </HStack>
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
          <Users size={28} color="var(--chakra-colors-gray-300)" />
          <Text fontSize="sm" fontWeight="600" color={headingColor}>
            No team members scheduled
          </Text>
          <Text fontSize="xs" color={subTextColor} mt="1" mb="4">
            Add team members to the schedule to get started.
          </Text>
          {!readOnly && (
            <Button variant="secondary" size="sm" leftIcon={UserPlus} onClick={startBulkAdd}>
              Add Team Members
            </Button>
          )}
        </Box>
      ) : (
        <VStack spacing="2" align="stretch">
          {sortedAssignments.map((assignment) => {
            const highlighted = assignment.id === highlightedAssignmentId;
            const isOwn = isOwnAssignment(
              {
                team_member_id: assignment.team_member_id,
                team_member_user_id: assignment.team_member?.user_id,
                status: assignment.status,
              },
              currentUserId,
              user?.team_member_id,
            );
            const showActions = isOwn && assignment.status === 'pending';
            const swap = swapByAssignment.get(assignment.id);
            const swapActions = getSwapActionVisibility({
              isOwn,
              isLeader,
              status: swap?.status ?? null,
            });
            const showRequestSwap = shouldShowSwapRequest(
              {
                team_member_id: assignment.team_member_id,
                team_member_user_id: assignment.team_member?.user_id,
                status: assignment.status,
              },
              {
                currentUserId,
                currentTeamMemberId: user?.team_member_id,
                serviceDate: service.date,
                serviceTime: service.time,
                activeSwapStatus: swap?.status ?? null,
              },
            );
            const blockout = assignment.team_member ? isBlockedOut(assignment.team_member.id) : undefined;
            const statusTimestamp = assignment.status === 'confirmed'
              ? assignment.confirmed_at
              : assignment.status === 'declined'
                ? assignment.declined_at
                : undefined;

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
              <HStack spacing="3" justify="space-between" flexDir={{ base: 'column', md: 'row' }} align={{ base: 'stretch', md: 'center' }}>
                {/* Left: Avatar + Info */}
                <HStack spacing="3" flex="1" minW="0">
                  <Box opacity={blockout ? 0.5 : 1}>
                    <Avatar
                      name={assignment.team_member?.name || 'Unknown'}
                      src={assignment.team_member?.avatar_url}
                      size="sm"
                    />
                  </Box>
                  <VStack align="start" spacing="0" flex="1" minW="0">
                    <HStack spacing="2" wrap="wrap">
                      <Text fontWeight="600" color={headingColor} fontSize="sm" isTruncated>
                        {isOwn ? 'You' : (assignment.team_member?.name || 'Unknown')}
                      </Text>
                      {blockout && (
                        <Tooltip label={`Blocked out ${new Date(blockout.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(blockout.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${blockout.reason ? ` (${blockout.reason})` : ''}`}>
                          <Badge variant="subtle" colorScheme="orange" fontSize="xs" borderRadius="full" px="1.5">
                            <Calendar size={10} style={{ display: 'inline', marginRight: 2 }} />
                            Blocked
                          </Badge>
                        </Tooltip>
                      )}
                      <Tooltip
                        label={
                          statusTimestamp
                            ? `${assignment.status === 'confirmed' ? 'Confirmed' : 'Declined'} ${new Date(statusTimestamp).toLocaleString()}`
                            : ''
                        }
                        isDisabled={!statusTimestamp}
                        hasArrow
                      >
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
                              : isOwn
                                ? 'You asked teammates to cover this role'
                                : 'This volunteer is looking for a swap'
                          }
                        >
                          <Badge
                            variant="subtle"
                            colorScheme={swap.status === 'claimed' ? 'blue' : 'yellow'}
                            fontSize="xs"
                            borderRadius="full"
                            px="1.5"
                          >
                            <ArrowLeftRight size={10} style={{ display: 'inline', marginRight: 2 }} />
                            {swap.status === 'claimed'
                              ? 'Swap claimed'
                              : isOwn
                                ? 'Swap requested'
                                : 'Swap open'}
                          </Badge>
                        </Tooltip>
                      )}
                    </HStack>
                    <Text fontSize="xs" color={subTextColor} isTruncated>
                      {assignment.role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </Text>
                    {highlighted && (
                      <Text fontSize="xs" color="blue.600" fontWeight="500" mt="0.5">
                        Please confirm your attendance →
                      </Text>
                    )}
                  </VStack>
                </HStack>

                {/* Right: Actions */}
                <HStack spacing="2" flexShrink="0" justifyContent={{ base: 'center', md: 'flex-start' }}>
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
                  {(showRequestSwap || (isOwn && swap)) && (
                    <SwapRequestAction
                      assignmentId={assignment.id}
                      role={assignment.role}
                      serviceTitle={service.title}
                      serviceDate={service.date}
                      serviceTime={service.time}
                      activeSwap={swap ? { id: swap.id, status: swap.status } : null}
                      showBadge={false}
                      onChanged={async () => {
                        await Promise.all([loadAssignments(), loadSwaps()]);
                      }}
                    />
                  )}
                  {!readOnly && swap && (swapActions.showApprove || swapActions.showDecline) && (
                    <>
                      {swapActions.showApprove && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleSwapDecision(swap.id, 'approve')}
                          isDisabled={swapProcessing === swap.id}
                          isLoading={swapProcessing === swap.id}
                        >
                          Approve swap
                        </Button>
                      )}
                      {swapActions.showDecline && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleSwapDecision(swap.id, 'decline')}
                          isDisabled={swapProcessing === swap.id}
                        >
                          Decline swap
                        </Button>
                      )}
                    </>
                  )}
                  {/* Remove button — on every row including declined */}
                  {!readOnly && (
                    <IconButton
                      aria-label="Remove member"
                      icon={<X size={16} />}
                      size="sm"
                      variant="ghost"
                      color="gray.400"
                      _hover={{ color: 'red.500' }}
                      onClick={() => confirmRemove(assignment.id, isOwn ? 'You' : (assignment.team_member?.name || 'this member'))}
                      isDisabled={processing === assignment.id}
                    />
                  )}
                </HStack>
              </HStack>
              </Box>
            );
          })}
        </VStack>
      )}

      <OpenSwapsDrawer
        isOpen={showOpenSwaps}
        onClose={() => setShowOpenSwaps(false)}
        serviceId={service.id}
        swaps={swaps}
        isLeader={isLeader}
        swapProcessing={swapProcessing}
        onApprove={(swapId) => handleSwapDecision(swapId, 'approve')}
        onDecline={(swapId) => handleSwapDecision(swapId, 'decline')}
        onChanged={async () => {
          await Promise.all([loadAssignments({ silent: true }), loadSwaps()]);
        }}
      />

      {/* Auto-fill preview */}
      <AutoFillRolesModal
        isOpen={showAutoFill}
        onClose={() => setShowAutoFill(false)}
        service={service}
        churchId={churchId}
        rolePositions={rolePositions}
        existingAssignments={assignments}
        blockoutDates={blockoutDates}
        onSaved={async () => {
          await loadAssignments();
        }}
      />

      {/* Remove Confirmation */}
      <ConfirmDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveAssignment}
        title={`Remove ${removeTargetName === 'You' ? 'yourself' : removeTargetName}?`}
        message={`Are you sure you want to remove ${removeTargetName === 'You' ? 'yourself' : removeTargetName} from this service?`}
        confirmLabel="Remove"
        variant="destructive"
      />

      {/* Conflict Assign Confirmation */}
      <ConfirmDialog
        isOpen={conflictAssignConfirm.open}
        onClose={() => setConflictAssignConfirm({ open: false, memberIds: [], conflictCount: 0 })}
        onConfirm={handleForceBulkAssign}
        title="Assign Despite Conflicts?"
        message={`${conflictAssignConfirm.conflictCount} selected member(s) have scheduling conflicts (blocked out dates or double-booking). Assign them anyway? They will be notified as usual.`}
        confirmLabel="Assign Anyway"
        variant="warning"
      />
    </Box>
  );
}
