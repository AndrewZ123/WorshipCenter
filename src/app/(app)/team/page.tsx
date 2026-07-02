'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api-base';
import {
  Box, Text, HStack, Button, Table, Thead, Tbody, Tr, Th, Td,
  Flex, useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalCloseButton, ModalFooter, FormControl,
  FormLabel, VStack, useToast, Badge, Input,
  Card, CardBody, IconButton, Menu, MenuButton, MenuList, MenuItem,
  useColorModeValue, Spinner, Center,
  Tabs, TabList, Tab, TabPanels, TabPanel, Textarea,
  SimpleGrid, AvatarGroup,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import type { TeamMember, Service, MemberGroup, MemberGroupMember } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import Avatar from '@/components/ui/Avatar';

// Lucide icons
import { 
  Plus, MoreVertical, Link2, Trash2, Users, Calendar, Mail,
  CheckCircle2, Clock, UserPlus
} from 'lucide-react';

export default function TeamPage() {
  const { church, user } = useAuth();
  const store = useStore();
  const router = useRouter();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [lastScheduledMap, setLastScheduledMap] = useState<Record<string, string | null>>({});

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteDisclosure = useDisclosure();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rolesStr, setRolesStr] = useState('');
  const [loading, setLoading] = useState(true);

  // Groups state
  const [groups, setGroups] = useState<any[]>([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const deleteGroupDisclosure = useDisclosure();
  const [tabIndex, setTabIndex] = useState(0);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const headingColor = useColorModeValue('gray.900', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  
  // Team members have read-only access
  const isReadOnly = user?.role === 'team';

  const loadMembers = async () => {
    if (!church) return;
    try {
      setLoading(true);
      const all = await store.teamMembers.getByChurch(church.id);
      all.sort((a, b) => a.name.localeCompare(b.name));
      setMembers(all);
      setServices(await store.services.getByChurch(church.id));
    } catch (error) {
      console.error('Error loading team:', error);
      toast({ title: 'Error loading data', status: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    if (!church) return;
    try {
      const all = await store.memberGroups.getByChurch(church.id);
      setGroups(all || []);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const handleCreateGroup = async () => {
    if (!church || !groupName) return;
    await store.memberGroups.create({ church_id: church.id, name: groupName, description: groupDesc });
    toast({ title: 'Group created', status: 'success', duration: 2000 });
    setGroupName(''); setGroupDesc(''); setGroupModalOpen(false);
    await loadGroups();
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupId || !church) return;
    await store.memberGroups.delete(deleteGroupId, church.id);
    toast({ title: 'Group deleted', status: 'info', duration: 2000 });
    setDeleteGroupId(null); await loadGroups();
  };

  const handleToggleGroupMember = async (groupId: string, memberId: string, isInGroup: boolean) => {
    if (!church) return;
    if (isInGroup) {
      await store.memberGroups.removeMember(groupId, memberId);
    } else {
      await store.memberGroups.addMember(groupId, memberId);
    }
    await loadGroups();
    if (selectedGroup?.id === groupId) {
      const updated = await store.memberGroups.getById(groupId, church.id);
      setSelectedGroup(updated);
    }
  };

  useEffect(() => { if (church) { loadMembers(); loadGroups(); } }, [church]);

  useEffect(() => {
    async function loadAssignments() {
      if (!church) return;
      const map: Record<string, string | null> = {};
      
      for (const m of members) {
        let latestDate: string | null = null;
        for (const svc of services) {
          const assignments = await store.assignments.getByService(svc.id, church.id);
          if (assignments.some((a) => a.team_member_id === m.id)) {
            if (!latestDate || svc.date > latestDate) latestDate = svc.date;
          }
        }
        map[m.id] = latestDate;
      }
      setLastScheduledMap(map);
    }
    
    if (members.length > 0 && services.length > 0 && church) {
      loadAssignments();
    }
  }, [members, services, church]);

  const handleCreate = async () => {
    if (!church || !name) return;
    const member = await store.teamMembers.create({ church_id: church.id, name, email, phone, roles: rolesStr.split(',').map((r) => r.trim()).filter(Boolean) });
    toast({ title: 'Team member added', status: 'success', duration: 2000 });
    
    // Send invitation email if email is provided
    if (email) {
      try {
        const response = await fetch(apiUrl('/api/notifications/send-team-invitation'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamMemberId: member.id, churchId: church.id })
        });
        
        // Clone the response before reading to avoid "body already consumed" error
        const clonedResponse = response.clone();
        
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          // Use cloned response to get text if JSON parsing fails
          try {
            await clonedResponse.text();
          } catch (textError) {
            // Silently handle text error
          }
          toast({ 
            title: 'Email warning', 
            description: 'Team member added, but there was an issue sending the invitation email',
            status: 'warning',
            duration: 5000 
          });
          return;
        }
        
        if (data.success) {
          if (data.emailSent) {
            toast({ 
              title: 'Invitation sent!', 
              description: `Email sent to ${email}`, 
              status: 'success',
              duration: 3000 
            });
          } else {
            toast({ 
              title: 'Email service not configured', 
              description: data.emailError || 'Please copy the invite link manually',
              status: 'warning',
              duration: 5000 
            });
          }
        } else {
          toast({ 
            title: 'Email warning', 
            description: data.error || 'There was an issue sending the invitation email',
            status: 'warning',
            duration: 5000 
          });
        }
      } catch (error) {
        toast({ 
          title: 'Email warning', 
          description: 'Team member added, but there was an issue sending the invitation email',
          status: 'warning',
          duration: 5000 
        });
      }
    }
    
    setName(''); setEmail(''); setPhone(''); setRolesStr('');
    onClose(); await loadMembers();
  };

  const handleDelete = async () => {
    if (!deleteId || !church) return;
    await store.teamMembers.delete(deleteId, church.id);
    toast({ title: 'Team member removed', status: 'info', duration: 2000 });
    setDeleteId(null); await loadMembers();
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

  const handleSendInvitation = async (member: TeamMember) => {
    if (!church || !member.email) {
      toast({ title: 'Email required', description: 'This member needs an email address to send an invitation.', status: 'error', duration: 3000 });
      return;
    }

    try {
      const response = await fetch(apiUrl('/api/notifications/send-team-invitation'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamMemberId: member.id, churchId: church.id })
      });
      
      // Clone the response before reading to avoid "body already consumed" error
      const clonedResponse = response.clone();
      
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        // Use cloned response to get text if JSON parsing fails
        try {
          await clonedResponse.text();
        } catch (textError) {
          // Silently handle text error
        }
        toast({ 
          title: 'Email warning', 
          description: 'There was an issue sending the invitation email',
          status: 'warning',
          duration: 5000 
        });
        return;
      }
      
      if (data.alreadyVerified) {
        toast({ 
          title: 'Already verified', 
          description: 'This team member has already accepted their invitation and verified their account.',
          status: 'info',
          duration: 4000 
        });
      } else if (data.success) {
        if (data.emailSent) {
          toast({ 
            title: 'Invitation sent!', 
            description: `Email sent to ${member.email}`, 
            status: 'success',
            duration: 3000 
          });
        } else {
          toast({ 
            title: 'Email service not configured', 
            description: data.emailError || 'Please copy the invite link manually',
            status: 'warning',
            duration: 5000 
          });
        }
      } else {
        toast({ 
          title: 'Failed to send invitation', 
          description: data.error || 'Please try again or use copy invite link',
          status: 'error',
          duration: 3000 
        });
      }
    } catch (error) {
      toast({ 
        title: 'Failed to send invitation', 
        description: 'Please use copy invite link instead',
        status: 'error',
        duration: 3000 
      });
    }
  };

  const formatRelativeDate = (d: string | null) => {
    if (!d) return 'Never scheduled';
    try {
      const date = new Date(d + 'T00:00:00');
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 14) return '1 week ago';
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 60) return '1 month ago';
      return `${Math.floor(diffDays / 30)} months ago`;
    } catch { 
      return d; 
    }
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
          <Text fontSize="2xl" fontWeight="bold" color={headingColor} letterSpacing="tight">Your Team</Text>
          <Text color={subtextColor} fontSize="sm" mt="1">Manage your worship team roster</Text>
        </Box>
        {!isReadOnly && (
          <Button 
            onClick={onOpen} 
            size="sm" 
            colorScheme="teal" 
            fontWeight="600"
            leftIcon={<Plus size={16} />}
            px="4"
            py="2"
          >
            Add Member
          </Button>
        )}
      </Flex>

      <Tabs index={tabIndex} onChange={(i) => setTabIndex(i)} colorScheme="teal" variant="soft-rounded" mb="6">
        <TabList gap="2">
          <Tab fontSize="sm" fontWeight="600">Members</Tab>
          <Tab fontSize="sm" fontWeight="600">Groups</Tab>
        </TabList>
      </Tabs>

      {tabIndex === 0 && members.length === 0 ? (
        <EmptyState
          icon="users"
          title="No team members yet"
          description="Add your worship team so you can schedule and notify them."
          ctaLabel="Add Member"
          ctaOnClick={onOpen}
        />
      ) : tabIndex === 0 ? (
        <>
          {/* Desktop table */}
          <Box display={{ base: 'none', md: 'block' }} bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden" boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
            <Table variant="simple">
              <Thead bg={useColorModeValue('gray.50', 'gray.700')}>
                <Tr>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Name</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Roles</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Email</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Last Scheduled</Th>
                  <Th w="50px"></Th>
                </Tr>
              </Thead>
              <Tbody>
                {members.map((member) => (
                  <Tr 
                    key={member.id} 
                    cursor="pointer"
                    transition="all 0.15s"
                    onClick={() => router.push(`/team/${member.id}`)}
                    sx={{ borderLeft: '3px solid transparent' }}
                    _hover={{ 
                      bg: hoverBg,
                      borderLeftColor: 'teal.500',
                    }}
                  >
                    <Td>
                      <HStack spacing="3">
                        <Avatar name={member.name} src={member.avatar_url} size="sm" />
                        <HStack spacing="2" align="center">
                          <Text fontWeight="600" color={headingColor}>{member.name}</Text>
                          {member.user_id ? (
                            <CheckCircle2 size={14} color="green.500" />
                          ) : (
                            <Clock size={14} color="gray.400" />
                          )}
                        </HStack>
                      </HStack>
                    </Td>
                    <Td>
                      <HStack spacing="1" flexWrap="wrap">
                        {member.roles.slice(0, 3).map((role) => (
                          <Badge key={role} variant="subtle" colorScheme="gray" fontSize="xs" borderRadius="full" px="2">{role}</Badge>
                        ))}
                        {member.roles.length > 3 && (
                          <Badge variant="subtle" colorScheme="gray" fontSize="xs" borderRadius="full" px="2">+{member.roles.length - 3}</Badge>
                        )}
                      </HStack>
                    </Td>
                    <Td color={subtextColor} fontSize="sm">{member.email || '—'}</Td>
                    <Td>
                      <HStack spacing="2">
                        <Calendar size={14} className="text-gray-400" />
                        <Text color={subtextColor} fontSize="sm">{formatRelativeDate(lastScheduledMap[member.id])}</Text>
                      </HStack>
                    </Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      {!isReadOnly ? (
                        <Menu>
                          <MenuButton 
                            as={IconButton} 
                            icon={<MoreVertical size={16} />} 
                            variant="ghost" 
                            size="sm" 
                            aria-label="Actions"
                            color="gray.400"
                            _hover={{ color: 'gray.600', bg: 'gray.100' }}
                          />
                          <MenuList borderRadius="xl" zIndex={50}>
                            <MenuItem onClick={() => router.push(`/team/${member.id}`)}>View Profile</MenuItem>
                            <MenuItem onClick={() => handleCopyInvite(member)} isDisabled={!member.email || !!member.user_id}>
                              <HStack><Link2 size={16} /><Text>Copy Invite Link</Text></HStack>
                            </MenuItem>
                            <MenuItem onClick={() => handleSendInvitation(member)} isDisabled={!member.email || !!member.user_id}>
                              <HStack><Mail size={16} /><Text>Send Invite Email</Text></HStack>
                            </MenuItem>
                            <MenuItem color="red.500" onClick={() => { setDeleteId(member.id); deleteDisclosure.onOpen(); }}>
                              <HStack><Trash2 size={16} /><Text>Remove</Text></HStack>
                            </MenuItem>
                          </MenuList>
                        </Menu>
                      ) : (
                        <IconButton
                          as="a"
                          href={`/team/${member.id}`}
                          icon={<MoreVertical size={16} />}
                          variant="ghost"
                          size="sm"
                          aria-label="View profile"
                          color="gray.400"
                          _hover={{ color: 'gray.600', bg: 'gray.100' }}
                        />
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          {/* Mobile cards */}
          <VStack display={{ base: 'flex', md: 'none' }} spacing="3" align="stretch">
            {members.map((member) => (
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
                onClick={() => router.push(`/team/${member.id}`)}
                borderLeft="3px solid"
                borderLeftColor="teal.500"
              >
                <CardBody py="3" px="4">
                  <Flex justify="space-between" align="start">
                    <HStack spacing="3" flex="1">
                      <Avatar name={member.name} size="md" />
                      <Box>
                        <HStack spacing="2" align="center">
                          <Text fontWeight="600" color={headingColor}>{member.name}</Text>
                          {member.user_id ? (
                            <CheckCircle2 size={14} color="green.500" />
                          ) : (
                            <Clock size={14} color="gray.400" />
                          )}
                        </HStack>
                        <HStack spacing="1" mt="1" flexWrap="wrap">
                          {member.roles.slice(0, 2).map((role) => (
                            <Badge key={role} variant="subtle" colorScheme="gray" fontSize="xs" borderRadius="full" px="2">{role}</Badge>
                          ))}
                          {member.roles.length > 2 && (
                            <Badge variant="subtle" colorScheme="gray" fontSize="xs" borderRadius="full" px="2">+{member.roles.length - 2}</Badge>
                          )}
                        </HStack>
                        <HStack spacing="2" mt="2">
                          <Calendar size={12} className="text-gray-400" />
                          <Text fontSize="xs" color="gray.400">{formatRelativeDate(lastScheduledMap[member.id])}</Text>
                        </HStack>
                      </Box>
                    </HStack>
                    <Box onClick={(e) => e.stopPropagation()}>
                      {!isReadOnly ? (
                        <Menu>
                          <MenuButton 
                            as={IconButton} 
                            icon={<MoreVertical size={16} />} 
                            variant="ghost" 
                            size="sm" 
                            aria-label="Actions"
                            color="gray.400"
                            _hover={{ color: 'gray.600', bg: 'gray.100' }}
                          />
                          <MenuList borderRadius="xl" zIndex={50}>
                            <MenuItem onClick={() => router.push(`/team/${member.id}`)}>View Profile</MenuItem>
                            <MenuItem onClick={() => handleCopyInvite(member)} isDisabled={!member.email || !!member.user_id}>
                              <HStack><Link2 size={16} /><Text>Copy Invite Link</Text></HStack>
                            </MenuItem>
                            <MenuItem onClick={() => handleSendInvitation(member)} isDisabled={!member.email || !!member.user_id}>
                              <HStack><Mail size={16} /><Text>Send Invite Email</Text></HStack>
                            </MenuItem>
                            <MenuItem color="red.500" onClick={() => { setDeleteId(member.id); deleteDisclosure.onOpen(); }}>
                              <HStack><Trash2 size={16} /><Text>Remove</Text></HStack>
                            </MenuItem>
                          </MenuList>
                        </Menu>
                      ) : (
                        <IconButton
                          as="a"
                          href={`/team/${member.id}`}
                          icon={<MoreVertical size={16} />}
                          variant="ghost"
                          size="sm"
                          aria-label="View profile"
                          color="gray.400"
                          _hover={{ color: 'gray.600', bg: 'gray.100' }}
                        />
                      )}
                    </Box>
                  </Flex>
                </CardBody>
              </Card>
            ))}
          </VStack>
        </>
      ) : (
        /* ─── Groups Tab ─── */
        <Box>
          <Flex justify="space-between" align="center" mb="4" flexWrap="wrap" gap="2">
            <Text color={subtextColor} fontSize="sm">Organize members into groups for easier scheduling</Text>
            {!isReadOnly && (
              <Button leftIcon={<Plus size={16} />} size="sm" colorScheme="teal" variant="outline" onClick={() => setGroupModalOpen(true)}>
                Create Group
              </Button>
            )}
          </Flex>

          {groups.length === 0 ? (
            <EmptyState
              icon="users"
              title="No groups yet"
              description="Create groups like 'Worship Band', 'Vocalists', or 'AV Team' to organize members."
              ctaLabel="Create Group"
              ctaOnClick={() => setGroupModalOpen(true)}
            />
          ) : (
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing="4">
              {groups.map((group) => {
                const memberIds: string[] = (group.member_group_members || []).map((m: any) => m.team_member_id);
                const groupMembers = members.filter((m) => memberIds.includes(m.id));
                return (
                  <Card key={group.id} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl" boxShadow="0 1px 3px rgba(0,0,0,0.06)">
                    <CardBody>
                      <Flex justify="space-between" align="start" mb="2">
                        <Box>
                          <Text fontWeight="700" color={headingColor} fontSize="md">{group.name}</Text>
                          {group.description && (
                            <Text fontSize="sm" color={subtextColor} mt="1">{group.description}</Text>
                          )}
                        </Box>
                        {!isReadOnly && (
                          <Menu>
                            <MenuButton as={IconButton} icon={<MoreVertical size={16} />} variant="ghost" size="sm" aria-label="Actions" />
                            <MenuList borderRadius="xl">
                              <MenuItem onClick={() => setSelectedGroup(group)}>Manage Members</MenuItem>
                              <MenuItem color="red.500" onClick={() => { setDeleteGroupId(group.id); deleteGroupDisclosure.onOpen(); }}>
                                <HStack><Trash2 size={16} /><Text>Delete Group</Text></HStack>
                              </MenuItem>
                            </MenuList>
                          </Menu>
                        )}
                      </Flex>
                      <HStack spacing="1" mt="3" flexWrap="wrap">
                        {groupMembers.length > 0 ? (
                          <AvatarGroup size="sm" max={5}>
                            {groupMembers.map((m) => (
                              <Avatar key={m.id} name={m.name} src={m.avatar_url} size="sm" />
                            ))}
                          </AvatarGroup>
                        ) : (
                          <Badge variant="subtle" colorScheme="gray" fontSize="xs">No members</Badge>
                        )}
                      </HStack>
                      <Text fontSize="xs" color={subtextColor} mt="2">
                        {groupMembers.length} {groupMembers.length === 1 ? 'member' : 'members'}
                      </Text>
                    </CardBody>
                  </Card>
                );
              })}
            </SimpleGrid>
          )}

          {/* Manage Members Modal */}
          <Modal isOpen={!!selectedGroup} onClose={() => setSelectedGroup(null)} isCentered size="md">
            <ModalOverlay backdropBlur="sm" />
            <ModalContent borderRadius="2xl" mx="4">
              <ModalHeader fontWeight="700">Manage: {selectedGroup?.name}</ModalHeader>
              <ModalCloseButton />
              <ModalBody maxH="60vh" overflowY="auto">
                <VStack spacing="2" align="stretch">
                  {members.map((member) => {
                    const memberIds: string[] = (selectedGroup?.member_group_members || []).map((m: any) => m.team_member_id);
                    const isInGroup = memberIds.includes(member.id);
                    return (
                      <Flex key={member.id} justify="space-between" align="center" p="2" borderRadius="lg" _hover={{ bg: hoverBg }}>
                        <HStack spacing="2">
                          <Avatar name={member.name} src={member.avatar_url} size="sm" />
                          <Text fontSize="sm" fontWeight="500" color={headingColor}>{member.name}</Text>
                        </HStack>
                        <Button
                          size="xs"
                          variant={isInGroup ? 'solid' : 'outline'}
                          colorScheme={isInGroup ? 'red' : 'teal'}
                          onClick={() => handleToggleGroupMember(selectedGroup!.id, member.id, isInGroup)}
                          isDisabled={isReadOnly}
                        >
                          {isInGroup ? 'Remove' : 'Add'}
                        </Button>
                      </Flex>
                    );
                  })}
                </VStack>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" onClick={() => setSelectedGroup(null)}>Done</Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </Box>
      )}

      {/* Create Group Modal */}
      <Modal isOpen={groupModalOpen} onClose={() => setGroupModalOpen(false)} isCentered size="md">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl" mx="4">
          <ModalHeader fontWeight="700">Create Group</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Group Name</FormLabel>
                <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g., Worship Band" borderRadius="lg" />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Description</FormLabel>
                <Textarea value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} placeholder="Optional" borderRadius="lg" rows={2} />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={() => setGroupModalOpen(false)}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleCreateGroup} isDisabled={!groupName} fontWeight="600">Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Group Confirm */}
      <ConfirmDialog
        isOpen={deleteGroupDisclosure.isOpen}
        onClose={deleteGroupDisclosure.onClose}
        onConfirm={handleDeleteGroup}
        title="Delete Group?"
        message="Members will remain on your team but will no longer be in this group."
        confirmLabel="Delete"
        variant="destructive"
      />

      {/* Add Member Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl" mx="4">
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
                />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Email</FormLabel>
                <Input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="Optional"
                  borderRadius="lg"
                />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Phone</FormLabel>
                <Input 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="Optional"
                  borderRadius="lg"
                />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Roles</FormLabel>
                <Input 
                  value={rolesStr} 
                  onChange={(e) => setRolesStr(e.target.value)} 
                  placeholder="Comma-separated (e.g., Vocalist, Guitarist, Keys)"
                  borderRadius="lg"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleCreate} isDisabled={!name} fontWeight="600">Add Member</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog 
        isOpen={deleteDisclosure.isOpen} 
        onClose={deleteDisclosure.onClose} 
        onConfirm={handleDelete} 
        title="Remove Team Member?" 
        message="They will no longer appear in your team or future service assignments." 
        confirmLabel="Remove"
        variant="destructive"
      />
    </Box>
  );
}