'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Checkbox,
  Divider,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  Text,
  VStack,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { apiUrl, getAuthHeaders, parseJsonSafe } from '@/lib/api-base';
import { db } from '@/lib/store';
import { addDays } from '@/lib/scheduling/suggestions';
import {
  autoFillOpenRoles,
  deriveOpenSlots,
  getSlotCandidates,
  type AutoFillCandidate,
  type AutoFillInput,
  type AutoFillUnfilled,
} from '@/lib/scheduling/autoFill';
import type {
  Service,
  ServiceAssignmentPopulated,
  ServiceRolePosition,
  TeamMember,
  TeamMemberBlockoutDate,
  TeamMemberPreference,
} from '@/lib/types';
import Button from '@/components/ui/Button';

interface AutoFillRolesModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: Service;
  churchId: string;
  rolePositions: ServiceRolePosition[];
  existingAssignments: ServiceAssignmentPopulated[];
  blockoutDates: TeamMemberBlockoutDate[];
  onSaved: () => void | Promise<void>;
}

interface PreviewRow {
  key: string;
  role: string;
  memberId: string;
  reason: string;
  checked: boolean;
}

const ROLE_LABEL = (role: string) =>
  role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

export default function AutoFillRolesModal({
  isOpen,
  onClose,
  service,
  churchId,
  rolePositions,
  existingAssignments,
  blockoutDates,
  onSaved,
}: AutoFillRolesModalProps) {
  const toast = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [preferences, setPreferences] = useState<TeamMemberPreference[]>([]);
  const [history, setHistory] = useState<ServiceAssignmentPopulated[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [unfilled, setUnfilled] = useState<AutoFillUnfilled[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const subtleBg = useColorModeValue('gray.50', 'gray.700');
  const subTextColor = useColorModeValue('gray.500', 'gray.400');
  const headingColor = useColorModeValue('gray.900', 'white');
  const warningBg = useColorModeValue('orange.50', 'orange.900');
  const warningBorder = useColorModeValue('orange.200', 'orange.700');

  const openSlots = useMemo(
    () => deriveOpenSlots(rolePositions, existingAssignments),
    [rolePositions, existingAssignments],
  );

  // Load the church-wide inputs once per modal open. RLS already scopes every
  // read to the signed-in user's church.
  useEffect(() => {
    if (!isOpen) return;
    if (!churchId || !service.id || !service.date) {
      setError('This service needs a date before roles can be filled.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const start = addDays(service.date, -90);
    const end = addDays(service.date, 90);

    Promise.all([
      db.teamMembers.getByChurch(churchId),
      db.preferences.getByChurch(churchId),
      db.assignments.getByChurchDateRange(churchId, start, end),
    ])
      .then(([members, prefs, assignments]) => {
        if (cancelled) return;
        setTeamMembers(members);
        setPreferences(prefs);
        setHistory(assignments);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[AutoFillRoles] Failed to load data:', err);
        setError('Could not load team availability. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, churchId, service.id, service.date]);

  const autoFillInput = useMemo<AutoFillInput | null>(() => {
    if (!service.date) return null;
    return {
      serviceId: service.id,
      serviceDate: service.date,
      openSlots,
      teamMembers,
      blockouts: blockoutDates,
      recentAssignments: history
        .filter((a) => a.services?.date)
        .map((a) => ({
          team_member_id: a.team_member_id,
          service_id: a.service_id,
          date: a.services!.date,
        })),
      existingAssignments: existingAssignments.map((a) => ({
        team_member_id: a.team_member_id,
        role: a.role,
        service_id: a.service_id,
      })),
      preferences,
      options: { maxPerMonth: 2, lookbackDays: 90 },
    };
  }, [
    service.id,
    service.date,
    openSlots,
    teamMembers,
    blockoutDates,
    history,
    existingAssignments,
    preferences,
  ]);

  // Build the preview. This is pure and only runs in local state; nothing is
  // written until the leader clicks Confirm.
  useEffect(() => {
    if (!isOpen || !autoFillInput || loading) return;
    const result = autoFillOpenRoles(autoFillInput);
    setRows(
      result.assignments.map((assignment, index) => ({
        key: `${assignment.role}-${index}-${assignment.teamMemberId}`,
        role: assignment.role,
        memberId: assignment.teamMemberId,
        reason: assignment.reason,
        checked: true,
      })),
    );
    setUnfilled(result.unfilled);
  }, [isOpen, autoFillInput, loading]);

  const alternativesByKey = useMemo(() => {
    const result = new Map<string, AutoFillCandidate[]>();
    if (!autoFillInput) return result;

    for (const row of rows) {
      const reserved = rows
        .filter((other) => other.checked && other.key !== row.key)
        .map((other) => other.memberId);
      result.set(row.key, getSlotCandidates(autoFillInput, row.role, reserved));
    }
    return result;
  }, [autoFillInput, rows]);

  const unfilledSummary = useMemo(() => {
    const groups = new Map<string, { count: number; reason: string }>();
    for (const entry of unfilled) {
      const existing = groups.get(entry.role);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(entry.role, { count: 1, reason: entry.reason });
      }
    }
    return Array.from(groups.entries()).map(([role, value]) => ({ role, ...value }));
  }, [unfilled]);

  const toggleRow = useCallback(
    (key: string) => {
      const row = rows.find((candidate) => candidate.key === key);
      if (!row) return;

      if (row.checked) {
        setRows((prev) =>
          prev.map((item) => (item.key === key ? { ...item, checked: false } : item)),
        );
        return;
      }

      const used = new Set(
        rows.filter((item) => item.checked).map((item) => item.memberId),
      );
      if (!used.has(row.memberId)) {
        setRows((prev) =>
          prev.map((item) => (item.key === key ? { ...item, checked: true } : item)),
        );
        return;
      }

      // Re-enabling this row would duplicate a member already selected for
      // another role. Swap in the best remaining eligible member instead.
      const replacement = autoFillInput
        ? getSlotCandidates(autoFillInput, row.role, used)[0]
        : undefined;
      if (!replacement) {
        toast({
          title: 'No other eligible member',
          description: `Everyone else available for ${ROLE_LABEL(row.role)} is already picked.`,
          status: 'warning',
        });
        return;
      }

      setRows((prev) =>
        prev.map((item) =>
          item.key === key
            ? {
                ...item,
                checked: true,
                memberId: replacement.teamMemberId,
                reason: replacement.reason,
              }
            : item,
        ),
      );
    },
    [rows, autoFillInput, toast],
  );

  const changeRowMember = useCallback(
    (key: string, memberId: string) => {
      const candidate = alternativesByKey
        .get(key)
        ?.find((option) => option.teamMemberId === memberId);
      setRows((prev) =>
        prev.map((row) =>
          row.key === key
            ? { ...row, memberId, reason: candidate?.reason ?? row.reason }
            : row,
        ),
      );
    },
    [alternativesByKey],
  );

  const selectedRows = rows.filter((row) => row.checked);

  const handleConfirm = async () => {
    if (selectedRows.length === 0) return;

    try {
      setSaving(true);
      const response = await fetch(apiUrl('/api/assignments/bulk'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          serviceId: service.id,
          assignments: selectedRows.map((row) => ({
            team_member_id: row.memberId,
            role: row.role,
          })),
        }),
      });

      if (!response.ok) {
        const err = await parseJsonSafe(response).catch(() => ({}));
        throw new Error(err.error || 'Failed to create assignments');
      }

      const result = await parseJsonSafe(response);
      toast({
        title: 'Roles filled',
        description: `Created ${result.created} pending assignment${result.created === 1 ? '' : 's'}.`,
        status: 'success',
      });

      await onSaved();
      onClose();
    } catch (err) {
      console.error('[AutoFillRoles] Save failed:', err);
      toast({
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'Failed to create assignments',
        status: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="xl">
      <ModalOverlay backdropBlur="sm" />
      <ModalContent bg={cardBg} borderRadius="2xl">
        <ModalHeader>
          <HStack spacing="2">
            <Sparkles size={18} />
            <Text>Fill open roles</Text>
          </HStack>
          <Text fontSize="sm" fontWeight="400" color={subTextColor} mt="1">
            Preview only — nothing is saved until you confirm.
          </Text>
        </ModalHeader>
        <ModalCloseButton isDisabled={saving} />

        <ModalBody maxH="70vh" overflowY="auto">
          {loading ? (
            <VStack py="10" spacing="3">
              <Spinner />
              <Text fontSize="sm" color={subTextColor}>
                Finding available volunteers…
              </Text>
            </VStack>
          ) : error ? (
            <Text fontSize="sm" color="red.500">
              {error}
            </Text>
          ) : rows.length === 0 && unfilledSummary.length === 0 ? (
            <Text fontSize="sm" color={subTextColor} py="6" textAlign="center">
              Every configured role is already filled.
            </Text>
          ) : (
            <VStack align="stretch" spacing="4">
              {rows.length > 0 && (
                <VStack align="stretch" spacing="2">
                  {rows.map((row) => {
                    const options = alternativesByKey.get(row.key) ?? [];
                    return (
                      <Box
                        key={row.key}
                        p="3"
                        border="1px solid"
                        borderColor={borderColor}
                        borderRadius="lg"
                        bg={row.checked ? subtleBg : 'transparent'}
                        opacity={row.checked ? 1 : 0.65}
                      >
                        <HStack align="start" spacing="3">
                          <Checkbox
                            mt="1.5"
                            isChecked={row.checked}
                            onChange={() => toggleRow(row.key)}
                          />
                          <Box flex="1" minW="0">
                            <HStack justify="space-between" spacing="2" mb="1.5">
                              <Text
                                fontSize="xs"
                                fontWeight="700"
                                color={headingColor}
                                textTransform="uppercase"
                                letterSpacing="wide"
                              >
                                {ROLE_LABEL(row.role)}
                              </Text>
                              <Text fontSize="xs" color={subTextColor}>
                                {row.reason}
                              </Text>
                            </HStack>
                            <Select
                              size="sm"
                              borderRadius="md"
                              bg={cardBg}
                              value={row.memberId}
                              isDisabled={!row.checked}
                              onChange={(e) => changeRowMember(row.key, e.target.value)}
                            >
                              {options.map((option) => (
                                <option
                                  key={option.teamMemberId}
                                  value={option.teamMemberId}
                                >
                                  {option.name} — {option.reason}
                                </option>
                              ))}
                              {!options.some(
                                (option) => option.teamMemberId === row.memberId,
                              ) && (
                                <option value={row.memberId}>
                                  {row.memberId}
                                </option>
                              )}
                            </Select>
                          </Box>
                        </HStack>
                      </Box>
                    );
                  })}
                </VStack>
              )}

              {unfilledSummary.length > 0 && (
                <>
                  <Divider borderColor={borderColor} />
                  <Box
                    bg={warningBg}
                    border="1px solid"
                    borderColor={warningBorder}
                    borderRadius="lg"
                    p="3"
                  >
                    <HStack spacing="2" mb="2">
                      <AlertTriangle size={16} />
                      <Text fontSize="sm" fontWeight="600" color={headingColor}>
                        Couldn&apos;t fill every slot
                      </Text>
                    </HStack>
                    <VStack align="stretch" spacing="1">
                      {unfilledSummary.map((entry) => (
                        <Text key={entry.role} fontSize="xs" color={subTextColor}>
                          <strong>{ROLE_LABEL(entry.role)}</strong>
                          {entry.count > 1 ? ` (${entry.count} slots)` : ''}:{' '}
                          {entry.reason}
                        </Text>
                      ))}
                    </VStack>
                  </Box>
                </>
              )}
            </VStack>
          )}
        </ModalBody>

        <ModalFooter gap="2">
          <Button variant="ghost" size="sm" onClick={onClose} isDisabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            isLoading={saving}
            isDisabled={loading || !!error || selectedRows.length === 0}
          >
            {saving
              ? 'Saving…'
              : selectedRows.length > 0
                ? `Confirm ${selectedRows.length} assignment${selectedRows.length === 1 ? '' : 's'}`
                : 'Confirm'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
