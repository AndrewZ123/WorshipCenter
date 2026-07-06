'use client';

import { useState } from 'react';
import {
  Box, VStack, HStack, Text, useColorModeValue, Divider, Badge,
  IconButton, Button, Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalCloseButton, ModalBody, ModalFooter, FormControl, FormLabel,
  Input, Textarea, Switch, useToast,
} from '@chakra-ui/react';
import { Trash2, Pencil, UserPlus, X } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ManageChannelMembersModal from './ManageChannelMembersModal';
import { db } from '@/lib/store';
import type { ChatChannel } from '@/lib/types';

interface MemberInfo {
  user_id: string;
  name: string;
  email?: string;
  avatar_url?: string;
  role: string;
}

interface ChannelInfoProps {
  channel: ChatChannel;
  members: MemberInfo[];
  isAdmin: boolean;
  onUpdateChannel?: (id: string, updates: { name?: string; description?: string; is_announcement?: boolean }) => void;
  onDeleteChannel?: (id: string) => void;
  churchId?: string;
  onMembersChanged?: (channelId: string) => void;
}

export default function ChannelInfo({
  channel, members, isAdmin, onUpdateChannel, onDeleteChannel,
  churchId, onMembersChanged,
}: ChannelInfoProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<MemberInfo | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editName, setEditName] = useState(channel.name);
  const [editDescription, setEditDescription] = useState(channel.description || '');
  const [editIsAnnouncement, setEditIsAnnouncement] = useState(channel.is_announcement);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const bgColor = useColorModeValue('white', 'gray.800');

  if (!channel) return null;

  const handleSaveEdit = async () => {
    if (!editName.trim() || !onUpdateChannel) return;
    setSaving(true);
    try {
      await onUpdateChannel(channel.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        is_announcement: editIsAnnouncement,
      });
      toast({ title: 'Channel updated', status: 'success', duration: 2000 });
      setEditOpen(false);
    } catch {
      toast({ title: 'Failed to update channel', status: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDeleteChannel) return;
    try {
      await onDeleteChannel(channel.id);
      toast({ title: 'Channel deleted', status: 'success', duration: 2000 });
    } catch {
      toast({ title: 'Failed to delete channel', status: 'error', duration: 3000 });
    }
  };

  const handleRemoveMember = async (member: MemberInfo) => {
    setRemovingId(member.user_id);
    try {
      await db.channels.removeMember(channel.id, member.user_id);
      toast({ title: `${member.name} removed from channel`, status: 'success', duration: 2000 });
      onMembersChanged?.(channel.id);
    } catch {
      toast({ title: 'Failed to remove member', status: 'error', duration: 3000 });
    } finally {
      setRemovingId(null);
      setRemoveConfirm(null);
    }
  };

  const handleMembersChanged = () => {
    onMembersChanged?.(channel.id);
  };

  const isGeneral = channel.name === 'General';

  return (
    <>
      <Box
        w="260px"
        borderLeft="1px solid"
        borderColor={borderColor}
        bg={bgColor}
        display={{ base: 'none', lg: 'block' }}
        overflowY="auto"
      >
        <Box p="4">
          <HStack justify="space-between" align="center" mb="1">
            <Text fontWeight="700" fontSize="sm" color={textColor}>About</Text>
            {isAdmin && (
              <HStack spacing="1">
                <IconButton
                  aria-label="Edit channel"
                  icon={<Pencil size={14} />}
                  size="xs"
                  variant="ghost"
                  colorScheme="gray"
                  onClick={() => {
                    setEditName(channel.name);
                    setEditDescription(channel.description || '');
                    setEditIsAnnouncement(channel.is_announcement);
                    setEditOpen(true);
                  }}
                />
                {!isGeneral && (
                  <IconButton
                    aria-label="Delete channel"
                    icon={<Trash2 size={14} />}
                    size="xs"
                    variant="ghost"
                    colorScheme="red"
                    onClick={() => setDeleteOpen(true)}
                  />
                )}
              </HStack>
            )}
          </HStack>
          <Text fontSize="sm" color={subtextColor}>
            {channel.description || 'No description'}
          </Text>
          <HStack spacing="1" mt="2" color={subtextColor}>
            <Badge variant="subtle" colorScheme={channel.is_announcement ? 'orange' : 'teal'} fontSize="xs">
              {channel.is_announcement ? 'Announcements' : channel.type === 'group' ? 'Private Group' : 'Channel'}
            </Badge>
          </HStack>
        </Box>
        <Divider />
        <Box p="4">
          <HStack justify="space-between" align="center" mb="3">
            <Text fontWeight="700" fontSize="sm" color={textColor}>
              Members ({members.length})
            </Text>
            {isAdmin && (
              <IconButton
                aria-label="Manage members"
                icon={<UserPlus size={14} />}
                size="xs"
                variant="ghost"
                colorScheme="teal"
                onClick={() => setMembersOpen(true)}
              />
            )}
          </HStack>
          <VStack spacing="2" align="stretch">
            {members.map((member) => (
              <HStack key={member.user_id} spacing="2">
                <Avatar name={member.name} src={member.avatar_url} size="sm" />
                <Box flex="1" minW="0">
                  <Text fontSize="sm" fontWeight="500" color={textColor} noOfLines={1}>
                    {member.name}
                  </Text>
                  <Text fontSize="xs" color={subtextColor}>{member.role}</Text>
                </Box>
                {isAdmin && members.length > 1 && (
                  <IconButton
                    aria-label={`Remove ${member.name}`}
                    icon={<X size={12} />}
                    size="xs"
                    variant="ghost"
                    colorScheme="red"
                    isLoading={removingId === member.user_id}
                    onClick={() => setRemoveConfirm(member)}
                  />
                )}
              </HStack>
            ))}
          </VStack>
        </Box>
      </Box>

      {/* Edit Channel Modal */}
      <Modal key={channel.id} isOpen={editOpen} onClose={() => setEditOpen(false)} size="md" isCentered>
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl" mx="4">
          <ModalHeader fontWeight="700">Edit Channel</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4" align="stretch">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Channel Name</FormLabel>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  borderRadius="lg"
                />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Description</FormLabel>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  borderRadius="lg"
                  rows={2}
                />
              </FormControl>
              <HStack justify="space-between">
                <Box>
                  <Text fontSize="sm" fontWeight="500">Announcement Channel</Text>
                  <Text fontSize="xs" color="gray.400">Only admins and leaders can post</Text>
                </Box>
                <Switch
                  isChecked={editIsAnnouncement}
                  onChange={(e) => setEditIsAnnouncement(e.target.checked)}
                  colorScheme="orange"
                />
              </HStack>
            </VStack>
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleSaveEdit} isLoading={saving} fontWeight="600">
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Channel Confirmation */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Channel"
        message={`Are you sure you want to delete "${channel.name}"? This will permanently remove the channel and all its messages. This cannot be undone.`}
        confirmLabel="Delete Channel"
        variant="destructive"
      />

      {/* Remove Member Confirmation */}
      <ConfirmDialog
        isOpen={!!removeConfirm}
        onClose={() => setRemoveConfirm(null)}
        onConfirm={() => removeConfirm && handleRemoveMember(removeConfirm)}
        title={`Remove ${removeConfirm?.name}?`}
        message={`Remove ${removeConfirm?.name} from "${channel.name}"? They will no longer see this channel's messages.`}
        confirmLabel="Remove"
        variant="destructive"
        icon="user"
      />

      {/* Manage Members Modal */}
      {churchId && (
        <ManageChannelMembersModal
          isOpen={membersOpen}
          onClose={() => setMembersOpen(false)}
          channelId={channel.id}
          channelName={channel.name}
          churchId={churchId}
          currentMembers={members}
          onMembersChanged={handleMembersChanged}
        />
      )}
    </>
  );
}
