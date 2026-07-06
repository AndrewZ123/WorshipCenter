'use client';

import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, Button, FormControl, FormLabel, Input,
  Box, VStack, HStack, Switch, Text, useToast, Textarea,
} from '@chakra-ui/react';
import { db } from '@/lib/store';
import type { User } from '@/lib/types';

interface ChannelCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  churchId: string;
  userId: string;
  onCreated: () => void;
}

export default function ChannelCreateModal({ isOpen, onClose, churchId, userId, onCreated }: ChannelCreateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const toast = useToast();

  useEffect(() => {
    if (isOpen && churchId) {
      db.users.getByChurch(churchId).then(setUsers);
    }
  }, [isOpen, churchId]);

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'Channel name is required', status: 'error', duration: 2000 });
      return;
    }
    setLoading(true);
    try {
      const channel = await db.channels.create({
        church_id: churchId,
        name: name.trim(),
        description: description.trim() || undefined,
        is_announcement: isAnnouncement,
        is_private: isPrivate,
      });

      if (isPrivate && selectedMembers.length > 0) {
        await Promise.all(selectedMembers.map((uid) => db.channels.addMember(channel.id, uid)));
      }

      toast({ title: 'Channel created', status: 'success', duration: 2000 });
      setName('');
      setDescription('');
      setIsAnnouncement(false);
      setIsPrivate(false);
      setSelectedMembers([]);
      onClose();
      onCreated();
    } catch (error) {
      toast({ title: 'Failed to create channel', status: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay backdropBlur="sm" />
      <ModalContent borderRadius="2xl" mx="4">
        <ModalHeader fontWeight="700">Create Channel</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing="4" align="stretch">
            <FormControl isRequired>
              <FormLabel fontWeight="600" fontSize="sm">Channel Name</FormLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., worship-band, announcements"
                borderRadius="lg"
              />
            </FormControl>
            <FormControl>
              <FormLabel fontWeight="600" fontSize="sm">Description</FormLabel>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this channel for?"
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
                isChecked={isAnnouncement}
                onChange={(e) => setIsAnnouncement(e.target.checked)}
                colorScheme="orange"
              />
            </HStack>
            <HStack justify="space-between">
              <Box>
                <Text fontSize="sm" fontWeight="500">Private Channel</Text>
                <Text fontSize="xs" color="gray.400">Only selected members can see it</Text>
              </Box>
              <Switch
                isChecked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                colorScheme="teal"
              />
            </HStack>
            {isPrivate && users.length > 0 && (
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Members</FormLabel>
                <VStack spacing="1" align="stretch" maxH="200px" overflowY="auto">
                  {users.map((u) => (
                    <HStack
                      key={u.id}
                      p="2"
                      borderRadius="md"
                      cursor="pointer"
                      _hover={{ bg: 'gray.50' }}
                      onClick={() => toggleMember(u.id)}
                    >
                      <Text fontSize="sm" flex="1">{u.name}</Text>
                      <Text fontSize="xs" color="gray.400">{u.role}</Text>
                      {selectedMembers.includes(u.id) && (
                        <Text fontSize="xs" color="teal.500" fontWeight="600">Selected</Text>
                      )}
                    </HStack>
                  ))}
                </VStack>
              </FormControl>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter gap="2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button colorScheme="teal" onClick={handleCreate} isLoading={loading} fontWeight="600">
            Create
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
