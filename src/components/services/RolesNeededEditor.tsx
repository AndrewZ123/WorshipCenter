'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  HStack,
  IconButton,
  Input,
  Text,
  VStack,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/store';
import type { ServiceRolePosition } from '@/lib/types';
import {
  ROLE_NEEDED_MAX,
  ROLE_NEEDED_MIN,
  clampRoleCount,
  deriveRoleNeededPrefill,
  deriveRoleOptions,
  findMatchingTemplate,
  normalizeRoleName,
  roleLabel,
} from '@/lib/scheduling/rolesNeeded';
import Button from '@/components/ui/Button';

interface RolesNeededEditorProps {
  serviceId: string;
  serviceTitle: string;
  serviceDate: string;
  serviceTime?: string | null;
  churchId: string;
  positions: ServiceRolePosition[];
  assignmentRoles: string[];
  onSaved: () => void | Promise<void>;
}

interface DraftRow {
  key: string;
  id?: string;
  role: string;
  max_volunteers: number;
}

/**
 * Compact leader-only editor for staffing targets. Rows are a local draft
 * (prefilled from assignments/template when empty) and only written when the
 * leader clicks Save roles.
 */
export default function RolesNeededEditor({
  serviceId,
  serviceTitle,
  serviceDate,
  serviceTime,
  churchId,
  positions,
  assignmentRoles,
  onSaved,
}: RolesNeededEditorProps) {
  const toast = useToast();
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [newRole, setNewRole] = useState('');
  const [teamMemberRoles, setTeamMemberRoles] = useState<string[]>([]);
  const [templateRoles, setTemplateRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const subtleBg = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const headingColor = useColorModeValue('gray.900', 'white');
  const subTextColor = useColorModeValue('gray.500', 'gray.400');

  useEffect(() => {
    if (!churchId) return;
    db.teamMembers
      .getByChurch(churchId)
      .then((members) => setTeamMemberRoles(members.flatMap((member) => member.roles || [])))
      .catch(console.error);
  }, [churchId]);

  useEffect(() => {
    if (!churchId || !serviceDate) return;
    db.templates
      .getByChurch(churchId)
      .then((templates) => {
        const match = findMatchingTemplate(templates, {
          title: serviceTitle,
          time: serviceTime,
          date: serviceDate,
        });
        setTemplateRoles(match?.roles || []);
      })
      .catch(console.error);
  }, [churchId, serviceTitle, serviceTime, serviceDate]);

  // Rebuild the draft whenever saved positions or suggestion inputs change.
  useEffect(() => {
    if (positions.length > 0) {
      setRows(
        positions.map((position) => ({
          key: position.id,
          id: position.id,
          role: normalizeRoleName(position.role),
          max_volunteers: clampRoleCount(position.max_volunteers),
        })),
      );
      return;
    }

    setRows(
      deriveRoleNeededPrefill({ assignmentRoles, templateRoles }).map((suggestion, index) => ({
        key: `suggested-${index}-${suggestion.role}`,
        role: suggestion.role,
        max_volunteers: suggestion.max_volunteers,
      })),
    );
  }, [positions, assignmentRoles, templateRoles]);

  const roleOptions = useMemo(
    () => deriveRoleOptions({ teamMemberRoles, assignmentRoles, templateRoles }),
    [teamMemberRoles, assignmentRoles, templateRoles],
  );

  const addRole = () => {
    const role = normalizeRoleName(newRole);
    if (!role) return;
    if (rows.some((row) => row.role === role)) {
      toast({ title: 'Role already added', status: 'info', duration: 2000 });
      return;
    }

    setRows((current) => [
      ...current,
      {
        key: `new-${role}-${current.length}`,
        role,
        max_volunteers: 1,
      },
    ]);
    setNewRole('');
  };

  const removeRole = (key: string) => {
    setRows((current) => current.filter((row) => row.key !== key));
  };

  const setCount = (key: string, value: string) => {
    const parsed = Number.parseInt(value, 10);
    setRows((current) =>
      current.map((row) =>
        row.key === key
          ? { ...row, max_volunteers: clampRoleCount(Number.isFinite(parsed) ? parsed : 1) }
          : row,
      ),
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const existingById = new Map(positions.map((position) => [position.id, position]));
      const keptExistingIds = new Set(rows.map((row) => row.id).filter(Boolean) as string[]);

      // Remove roles the leader deleted.
      for (const position of positions) {
        if (!keptExistingIds.has(position.id)) {
          await db.rolePositions.delete(position.id, churchId);
        }
      }

      for (const row of rows) {
        if (row.id) {
          const existing = existingById.get(row.id);
          if (
            existing &&
            (existing.max_volunteers !== row.max_volunteers ||
              normalizeRoleName(existing.role) !== row.role)
          ) {
            await db.rolePositions.update(row.id, churchId, {
              role: row.role,
              max_volunteers: row.max_volunteers,
            });
          }
        } else {
          await db.rolePositions.create({
            service_id: serviceId,
            role: row.role,
            max_volunteers: row.max_volunteers,
            signup_enabled: false,
            church_id: churchId,
          });
        }
      }

      toast({ title: 'Roles updated', status: 'success', duration: 2000 });
      await onSaved();
    } catch (error) {
      console.error('[RolesNeeded] Save failed:', error);
      toast({
        title: 'Could not save roles',
        description: 'Please try again.',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const suggestionListId = `roles-needed-suggestions-${serviceId}`;

  return (
    <Box
      bg={subtleBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="lg"
      p="3"
      mb="4"
    >
      <HStack justify="space-between" align="center" mb="2">
        <Text fontSize="xs" fontWeight="700" color={headingColor} textTransform="uppercase" letterSpacing="wide">
          Roles needed
        </Text>
        <Text fontSize="xs" color={subTextColor}>
          {rows.length} {rows.length === 1 ? 'role' : 'roles'}
        </Text>
      </HStack>

      <VStack spacing="2" align="stretch">
        {rows.length === 0 && (
          <Text fontSize="xs" color={subTextColor}>
            No roles set. Add roles so you can fill open positions.
          </Text>
        )}

        {rows.map((row) => (
          <HStack key={row.key} spacing="2">
            <Text flex="1" fontSize="sm" color={headingColor} noOfLines={1}>
              {roleLabel(row.role)}
            </Text>
            <Input
              type="number"
              size="xs"
              w="64px"
              min={ROLE_NEEDED_MIN}
              max={ROLE_NEEDED_MAX}
              value={row.max_volunteers}
              onChange={(event) => setCount(row.key, event.target.value)}
              aria-label={`${roleLabel(row.role)} volunteers needed`}
              bg="white"
              _dark={{ bg: 'gray.800' }}
              textAlign="center"
            />
            <IconButton
              aria-label={`Remove ${roleLabel(row.role)}`}
              icon={<Trash2 size={14} />}
              size="xs"
              variant="ghost"
              color="gray.400"
              _hover={{ color: 'red.500' }}
              onClick={() => removeRole(row.key)}
            />
          </HStack>
        ))}

        <HStack spacing="2">
          <Input
            size="sm"
            list={suggestionListId}
            value={newRole}
            onChange={(event) => setNewRole(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addRole();
              }
            }}
            placeholder="Add a role (pick from team or type new)"
            bg="white"
            _dark={{ bg: 'gray.800' }}
            flex="1"
          />
          <datalist id={suggestionListId}>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </datalist>
          <Button
            variant="secondary"
            size="xs"
            leftIcon={Plus}
            onClick={addRole}
            isDisabled={!newRole.trim()}
          >
            Add
          </Button>
        </HStack>
      </VStack>

      <HStack justify="flex-end" mt="2">
        <Button variant="primary" size="xs" onClick={handleSave} isLoading={saving}>
          Save roles
        </Button>
      </HStack>
    </Box>
  );
}
