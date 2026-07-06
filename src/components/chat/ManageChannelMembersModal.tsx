'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, Button, Box, VStack, HStack, Text,
  Input, useToast, IconButton, useColorModeValue,
  Divider, Spinner, Center,
} from '@chakra-ui/react';
import { Search, X, UserPlus } from 'lucide-react';
import { db } from '@/lib/store';
import Avatar from '@/components/ui/Avatar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { User } from '@/lib/types';

interface MemberInfo {
  user_id: string;
  name: string;
  email?: string;
  avatar_url?: string;
  role: string;
}

interface ManageChannelMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
  churchId: string;
  currentMembers: MemberInfo[];
  onMembersChanged: () => void;
}

export default function ManageChannelMembersModal({
  isOpen,
  onClose,
  channelId,
  channelName,
  churchId,
  currentMembers,
  onMembersChanged,
}: ManageChannelMembersModalProps) {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<MemberInfo | null>(null);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const toast = useToast();

  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  const currentMemberIds = useMemo(
    () => new Set(currentMembers.map(m => m.user_id)),
    [currentMembers]
  );

  const nonMembers = useMemo(() => {
    return allUsers.filter(u => !currentMemberIds.has(u.id));
  }, [allUsers, currentMemberIds]);

  const filteredNonMembers = useMemo(() => {
    if (!searchQuery.trim()) return nonMembers;
    const q = searchQuery.toLowerCase();
    return nonMembers.filter(
      u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [nonMembers, searchQuery]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return currentMembers;
    const q = searchQuery.toLowerCase();
    return currentMembers.filter(
      m => m.name.toLowerCase().includes(q) || (m.email && m.email.toLowerCase().includes(q))
    );
  }, [currentMembers, searchQuery]);

  useEffect(() => {
    if (isOpen && churchId) {
      setLoading(true);
      db.users.getByChurch(churchId)
        .then(setAllUsers)
        .catch(() => toast({ title: 'Failed to load users', status: 'error', duration: 3000 }))
        .finally(() => setLoading(false));
    }
  }, [isOpen, churchId, toast]);

  const handleAddMember = async (userId: string) => {
    setAddingIds(prev => new Set(prev).add(userId));
    try {
      await db.channels.addMember(channelId, userId);
      toast({ title: 'Member added', status: 'success', duration: 2000 });
      onMembersChanged();
    } catch {
      toast({ title: 'Failed to add member', status: 'error', duration: 3000 });
    } finally {
      setAddingIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setRemovingIds(prev => new Set(prev).add(userId));
    try {
      await db.channels.removeMember(channelId, userId);
      toast({ title: 'Member removed', status: 'success', duration: 2000 });
      onMembersChanged();
    } catch {
      toast({ title: 'Failed to remove member', status: 'error', duration: 3000 });
    } finally {
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      setMemberToRemove(null);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered scrollBehavior="inside">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl" mx="4" maxH="80dvh">
          <ModalHeader fontWeight="700">
            Manage Members — {channelName}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box position="relative" mb="4">
              <Box position="absolute" left="3" top="50%" transform="translateY(-50%)" color={subtextColor}>
                <Search size={16} />
              </Box>
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                pl="10"
                borderRadius="lg"
                size="sm"
              />
            </Box>

            {loading ? (
              <Center py="8">
                <Spinner size="md" color="teal.500" />
              </Center>
            ) : (
              <>
                {/* Current Members */}
                <Text fontWeight="600" fontSize="sm" color={textColor} mb="2">
                  Current Members ({currentMembers.length})
                </Text>
                <VStack spacing="1" align="stretch" mb="6">
                  {filteredMembers.length === 0 ? (
                    <Text fontSize="sm" color={subtextColor} py="2">
                      {searchQuery ? 'No members match your search' : 'No members yet'}
                    </Text>
                  ) : (
                    filteredMembers.map((member) => (
                      <HStack
                        key={member.user_id}
                        p="2"
                        borderRadius="md"
                        bg={bgColor}
                        spacing="3"
                      >
                        <Avatar name={member.name} src={member.avatar_url} size="sm" />
                        <Box flex="1" minW="0">
                          <Text fontSize="sm" fontWeight="500" color={textColor} noOfLines={1}>
                            {member.name}
                          </Text>
                          <Text fontSize="xs" color={subtextColor}>
                            {member.role}
                            {member.email && ` · ${member.email}`}
                          </Text>
                        </Box>
                        {currentMembers.length > 1 && (
                          <IconButton
                            aria-label={`Remove ${member.name}`}
                            icon={<X size={14} />}
                            size="xs"
                            variant="ghost"
                            colorScheme="red"
                            isLoading={removingIds.has(member.user_id)}
                            onClick={() => setMemberToRemove(member)}
                          />
                        )}
                      </HStack>
                    ))
                  )}
                </VStack>

                <Divider mb="4" />

                {/* Add Members */}
                <Text fontWeight="600" fontSize="sm" color={textColor} mb="2">
                  Add Members ({filteredNonMembers.length} available)
                </Text>
                <VStack spacing="1" align="stretch">
                  {filteredNonMembers.length === 0 ? (
                    <Text fontSize="sm" color={subtextColor} py="2">
                      {searchQuery
                        ? 'No users match your search'
                        : 'All church members are already in this channel'}
                    </Text>
                  ) : (
                    filteredNonMembers.map((user) => (
                      <HStack
                        key={user.id}
                        p="2"
                        borderRadius="md"
                        _hover={{ bg: bgColor }}
                        spacing="3"
                      >
                        <Avatar name={user.name} src={user.avatar_url} size="sm" />
                        <Box flex="1" minW="0">
                          <Text fontSize="sm" fontWeight="500" color={textColor} noOfLines={1}>
                            {user.name}
                          </Text>
                          <Text fontSize="xs" color={subtextColor}>
                            {user.role}
                            {user.email && ` · ${user.email}`}
                          </Text>
                        </Box>
                        <Button
                          size="xs"
                          colorScheme="teal"
                          variant="ghost"
                          leftIcon={<UserPlus size={14} />}
                          isLoading={addingIds.has(user.id)}
                          onClick={() => handleAddMember(user.id)}
                        >
                          Add
                        </Button>
                      </HStack>
                    ))
                  )}
                </VStack>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onClose}>Done</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={() => memberToRemove && handleRemoveMember(memberToRemove.user_id)}
        title={`Remove ${memberToRemove?.name}?`}
        message={`Remove ${memberToRemove?.name} from "${channelName}"? They will no longer have access to this channel's messages.`}
        confirmLabel="Remove"
        variant="destructive"
        icon="user"
      />
    </>
  );
}
