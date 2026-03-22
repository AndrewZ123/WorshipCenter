'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Text, HStack, Button, Table, Thead, Tbody, Tr, Th, Td,
  Flex, useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalCloseButton, ModalFooter, FormControl,
  FormLabel, VStack, useToast, Badge, Card, CardBody, IconButton,
  Menu, MenuButton, MenuList, MenuItem, useColorModeValue, Spinner,
  Center, Input,
} from '@chakra-ui/react';
import { useDemo } from '@/lib/demo/context';
import type { TeamMember } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import { formatRelativeDate } from '@/lib/formatDate';

// Lucide icons
import { 
  Plus, MoreVertical, Users, Trash2, Link as LinkIcon
} from 'lucide-react';

export default function DemoTeamPage() {
  const { church, teamMembers, services, assignments, createTeamMember, deleteTeamMember } = useDemo();
  const router = useRouter();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [loading, setLoading] = useState(true);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteDisclosure = useDisclosure();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rolesStr, setRolesStr] = useState('');

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.900', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const headerBg = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => {
    setLoading(false);
  }, [teamMembers]);

  // Sort members alphabetically
  const sortedMembers = useMemo(() => {
    return [...teamMembers].sort((a, b) => a.name.localeCompare(b.name));
  }, [teamMembers]);

  // Calculate last scheduled date for each member
  const lastScheduledMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    
    sortedMembers.forEach((member) => {
      let latestDate: string | null = null;
      assignments.forEach((assignment) => {
        if (assignment.team_member_id === member.id) {
          const service = services.find((s) => s.id === assignment.service_id);
          if (service && (!latestDate || service.date > latestDate)) {
            latestDate = service.date;
          }
        }
      });
      map[member.id] = latestDate;
    });
    
    return map;
  }, [sortedMembers, assignments, services]);

  const handleCreate = async () => {
    if (!church || !name) return;
    createTeamMember({
      church_id: church.id,
      name,
      email,
      phone,
      roles: rolesStr.split(',').map((r) => r.trim()).filter(Boolean),
    });
    toast({ title: 'Team member added', status: 'success', duration: 2000 });
    setName(''); setEmail(''); setPhone(''); setRolesStr('');
    onClose();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    deleteTeamMember(deleteId);
    toast({ title: 'Team member removed', status: 'info', duration: 2000 });
    setDeleteId(null);
    deleteDisclosure.onClose();
  };

  const handleCopyInvite = (member: TeamMember) => {
    if (!church || !member.email) {
      toast({ title: 'Email required', description: 'This member needs an email address to generate an invite link.', status: 'error', duration: 3000 });
      return;
    }
    const baseUrl = window.location.origin;
    const inviteUrl = `${baseUrl}/join?e=${encodeURIComponent(member.email)}&c=${church.id}`;
    navigator.clipboard.writeText(inviteUrl);
    toast({ title: 'Invite link copied!', description: 'Send this link to the team member to activate their account.', status: 'success', duration: 3000 });
  };

  const formatLastScheduled = (d: string | null) => {
    if (!d) return 'Never scheduled';
    return formatRelativeDate(d);
  };

  if (loading) {
    return (
      <Center minH="50vh">
        <Spinner size="xl" color="teal.500" />
      </Center>
    );
  }

  return (
    <Box p={{ base: '4', md: '8' }} maxW="1100px" mx="auto">
      {/* Header */}
      <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} mb="6" flexWrap="wrap" gap="4" direction={{ base: 'column', md: 'row' }}>
        <Box>
          <Text fontSize="2xl" fontWeight="bold" color={textColor} letterSpacing="tight">Your Team</Text>
          <Text color={subtextColor} fontSize="sm" mt="1">Manage your worship team roster</Text>
        </Box>
        <Button 
          onClick={onOpen} 
          size="sm" 
          colorScheme="teal" 
          px="4" 
          py="2"
          fontWeight="600"
          leftIcon={<Plus size={16} />}
          w={{ base: 'full', md: 'auto' }}
        >
          Add Member
        </Button>
      </Flex>

      {sortedMembers.length === 0 ? (
        <EmptyState
          icon="users"
          title="No team members yet"
          description="Add your worship team so you can schedule and notify them."
          ctaLabel="Add Member"
          ctaOnClick={onOpen}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Box display={{ base: 'none', md: 'block' }} bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden" boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
            <Table variant="simple">
              <Thead bg={headerBg}>
                <Tr>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Name</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Role</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Email</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Last Scheduled</Th>
                  <Th w="60px"></Th>
                </Tr>
              </Thead>
              <Tbody>
                {sortedMembers.map((member) => (
                  <Tr 
                    key={member.id} 
                    cursor="pointer" 
                    _hover={{ bg: hoverBg }} 
                    transition="all 0.15s"
                    onClick={() => router.push(`/demo/team/${member.id}`)}
                    borderLeft="3px solid transparent"
                    sx={{ '&:hover': { borderLeftColor: 'teal.500' } }}
                  >
                    <Td>
                      <HStack spacing="3">
                        <Avatar name={member.name} size="sm" />
                        <Text fontWeight="600" color={textColor}>{member.name}</Text>
                      </HStack>
                    </Td>
                    <Td>
                      <HStack spacing="1" flexWrap="wrap">
                        {member.roles.slice(0, 2).map((role) => (
                          <Badge 
                            key={role} 
                            bg="slate.100" 
                            color="slate.600" 
                            fontSize="xs" 
                            borderRadius="full" 
                            px="2"
                            fontWeight="500"
                          >
                            {role}
                          </Badge>
                        ))}
                        {member.roles.length > 2 && (
                          <Text fontSize="xs" color="gray.400">+{member.roles.length - 2}</Text>
                        )}
                      </HStack>
                    </Td>
                    <Td color={subtextColor} fontSize="sm">{member.email || '—'}</Td>
                    <Td color={subtextColor} fontSize="sm">{formatLastScheduled(lastScheduledMap[member.id])}</Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      <Menu>
                        <MenuButton 
                          as={IconButton} 
                          icon={<MoreVertical size={16} />} 
                          variant="ghost" 
                          size="sm" 
                          aria-label="Actions"
                          color="gray.400"
                          _hover={{ color: 'gray.600', bg: 'gray.100' }}
                          minW="32px"
                        />
                        <MenuList borderRadius="xl" zIndex={50}>
                          <MenuItem
                            onClick={() => router.push(`/demo/team/${member.id}`)}
                            borderRadius="lg"
                          >
                            View Profile
                          </MenuItem>
                          <MenuItem 
                            icon={<LinkIcon size={16} />} 
                            onClick={() => handleCopyInvite(member)} 
                            isDisabled={!member.email}
                            borderRadius="lg"
                          >
                            Copy Invite Link
                          </MenuItem>
                          <MenuItem 
                            icon={<Trash2 size={16} />}
                            color="red.500" 
                            onClick={() => { setDeleteId(member.id); deleteDisclosure.onOpen(); }}
                            borderRadius="lg"
                            _hover={{ bg: 'red.50' }}
                          >
                            Remove
                          </MenuItem>
                        </MenuList>
                      </Menu>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          {/* Mobile cards */}
          <VStack display={{ base: 'flex', md: 'none' }} spacing="3" align="stretch">
            {sortedMembers.map((member) => (
              <Card 
                key={member.id} 
                bg={cardBg} 
                border="1px solid" 
                borderColor={borderColor} 
                borderRadius="xl" 
                cursor="pointer" 
                boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
                _hover={{ 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
                  transform: 'translateY(-1px)'
                }}
                transition="all 0.15s"
                onClick={() => router.push(`/demo/team/${member.id}`)}
                borderLeft="3px solid"
                borderLeftColor="teal.500"
              >
                <CardBody py="3" px="4">
                  <Flex justify="space-between" align="start">
                    <HStack spacing="3" flex="1" minW="0">
                      <Avatar name={member.name} size="sm" />
                      <Box minW="0">
                        <Text fontWeight="600" color={textColor} noOfLines={1}>{member.name}</Text>
                        <HStack spacing="1" mt="0.5" flexWrap="wrap">
                          {member.roles.slice(0, 2).map((role) => (
                            <Badge 
                              key={role} 
                              bg="slate.100" 
                              color="slate.600" 
                              fontSize="xs" 
                              borderRadius="full" 
                              px="2"
                              fontWeight="500"
                            >
                              {role}
                            </Badge>
                          ))}
                        </HStack>
                        <Text fontSize="xs" color="gray.400" mt="1">
                          {formatLastScheduled(lastScheduledMap[member.id])}
                        </Text>
                      </Box>
                    </HStack>
                    <Box onClick={(e) => e.stopPropagation()} flexShrink={0}>
                      <Menu>
                        <MenuButton 
                          as={IconButton} 
                          icon={<MoreVertical size={16} />} 
                          variant="ghost" 
                          size="sm" 
                          aria-label="Actions"
                          color="gray.400"
                          minW="32px"
                        />
                        <MenuList borderRadius="xl" zIndex={50}>
                          <MenuItem 
                            onClick={() => router.push(`/demo/team/${member.id}`)}
                            borderRadius="lg"
                          >
                            View Profile
                          </MenuItem>
                          <MenuItem 
                            icon={<LinkIcon size={16} />}
                            onClick={() => handleCopyInvite(member)} 
                            isDisabled={!member.email}
                            borderRadius="lg"
                          >
                            Copy Invite Link
                          </MenuItem>
                          <MenuItem 
                            icon={<Trash2 size={16} />}
                            color="red.500" 
                            onClick={() => { setDeleteId(member.id); deleteDisclosure.onOpen(); }}
                            borderRadius="lg"
                            _hover={{ bg: 'red.50' }}
                          >
                            Remove
                          </MenuItem>
                        </MenuList>
                      </Menu>
                    </Box>
                  </Flex>
                </CardBody>
              </Card>
            ))}
          </VStack>
        </>
      )}

      {/* Add Member Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
        <ModalOverlay />
        <ModalContent borderRadius="xl">
          <ModalHeader fontWeight="700">Add Team Member</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Name</FormLabel>
                <Input 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Full name"
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Email</FormLabel>
                <Input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="Optional - for invitations"
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Phone</FormLabel>
                <Input 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="Optional"
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Roles</FormLabel>
                <Input 
                  value={rolesStr} 
                  onChange={(e) => setRolesStr(e.target.value)} 
                  placeholder="Comma-separated, e.g., acoustic, vocals, drums"
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr="3" onClick={onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleCreate} isDisabled={!name} fontWeight="600">Add Member</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDisclosure.isOpen}
        onClose={deleteDisclosure.onClose}
        onConfirm={handleDelete}
        title="Remove Team Member?"
        message="They will no longer appear in your team or future service assignments."
        confirmLabel="Remove"
      />
    </Box>
  );
}