'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Heading, HStack, Button, VStack, Text, Input, Flex,
  FormControl, FormLabel, Card, CardBody, useToast, IconButton,
  Badge, useColorModeValue, Spinner, Center, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter,
  Select, Textarea, useDisclosure,
} from '@chakra-ui/react';
import { useDemo } from '@/lib/demo/context';
import type { Service, ServiceItem, TeamMember, ServiceAssignment, ServiceStatus, Song } from '@/lib/types';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

export default function DemoServiceDetailClient() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { church, services, serviceItems, assignments, teamMembers, songs, updateService, deleteService, duplicateService, updateServiceItem, deleteServiceItem, createAssignment, updateAssignment, deleteAssignment } = useDemo();
  const serviceId = params.id as string;

  const [service, setService] = useState<Service | null>(null);
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [serviceAssignments, setServiceAssignments] = useState<ServiceAssignment[]>([]);
  const [editing, setEditing] = useState(false);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState<ServiceStatus>('draft');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  // Item editing modal state
  const editItemModal = useDisclosure();
  const [editingItem, setEditingItem] = useState<ServiceItem | null>(null);
  
  // Assign team member modal state
  const assignModal = useDisclosure();
  const [assignMemberId, setAssignMemberId] = useState('');
  const [assignRole, setAssignRole] = useState<string>('');
  const [itemTitle, setItemTitle] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [itemDuration, setItemDuration] = useState('');
  const [itemKey, setItemKey] = useState('');
  const [itemSongId, setItemSongId] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const itemBg = useColorModeValue('gray.50', 'gray.700');
  const headingColor = useColorModeValue('gray.800', 'white');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const emptyColor = useColorModeValue('gray.400', 'gray.500');
  const itemTitleColor = useColorModeValue('gray.800', 'white');

  const STATUS_COLORS: Record<Service['status'], string> = {
    draft: 'gray',
    finalized: 'blue',
    completed: 'green',
  };
  
  const ASSIGNMENT_STATUS_COLORS: Record<string, string> = {
    pending: 'brand',
    confirmed: 'green',
    declined: 'red',
  };

  const roleLabel = (r: string) => r.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  useEffect(() => {
    loadData();
  }, [serviceId, services, serviceItems, assignments]);

  const loadData = useCallback(() => {
    const svc = services.find(s => s.id === serviceId);
    if (svc) {
      setService(svc);
      setTitle(svc.title);
      setDate(svc.date);
      setTime(svc.time);
      setStatus(svc.status);
      setNotes(svc.notes);
    } else {
      router.push('/demo/services');
      return;
    }

    const itemsData = serviceItems.filter(si => si.service_id === serviceId).sort((a, b) => a.position - b.position);
    setItems(itemsData);

    const assignmentsData = assignments.filter(a => a.service_id === serviceId);
    setServiceAssignments(assignmentsData);

    setLoading(false);
  }, [serviceId, services, serviceItems, assignments, router]);

  const handleSave = async () => {
    updateService(serviceId, { title, date, time, status, notes });
    setEditing(false);
    loadData();
    toast({ title: 'Service updated', status: 'success', duration: 2000 });
  };

  const handleDelete = async () => {
    deleteService(serviceId);
    router.push('/demo/services');
    toast({ title: 'Service deleted', status: 'info', duration: 2000 });
  };

  const handleSendInvites = async () => {
    toast({ title: 'Demo Mode', description: 'In the full app, email invitations would be sent to all assigned team members.', status: 'info', duration: 3000 });
  };

  const handleDeleteItem = async (itemId: string) => {
    deleteServiceItem(itemId);
    loadData();
    toast({ title: 'Item removed', status: 'info', duration: 2000 });
  };

  const handleMoveItem = async (itemId: string, direction: 'up' | 'down') => {
    const currentIndex = items.findIndex(i => i.id === itemId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    // Swap items in the array
    const newItems = [...items];
    [newItems[currentIndex], newItems[newIndex]] = [newItems[newIndex], newItems[currentIndex]];
    
    // Update state immediately for responsive UI
    setItems(newItems);
    
    // Update positions
    newItems.forEach((item, index) => {
      updateServiceItem(item.id, { position: index });
    });
    
    toast({ title: 'Order updated', status: 'success', duration: 1500 });
  };

  const handleDuplicateService = async () => {
    const today = new Date().toISOString().split('T')[0];
    const newService = duplicateService(serviceId, today);
    if (newService) {
      router.push(`/demo/services/${newService.id}`);
    } else {
      toast({ title: 'Error duplicating service', status: 'error', duration: 3000 });
    }
  };

  const handleUpdateAssignmentStatus = async (assignmentId: string, newStatus: ServiceAssignment['status']) => {
    updateAssignment(assignmentId, { status: newStatus });
    loadData();
    toast({ title: 'Status updated', status: 'success', duration: 2000 });
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    deleteAssignment(assignmentId);
    loadData();
    toast({ title: 'Assignment removed', status: 'info', duration: 2000 });
  };

  // Open edit modal for an item
  const openEditItem = (item: ServiceItem) => {
    setEditingItem(item);
    setItemTitle(item.title);
    setItemNotes(item.notes || '');
    setItemDuration(item.duration_minutes?.toString() || '');
    setItemKey(item.key || '');
    setItemSongId(item.song_id || null);
    editItemModal.onOpen();
  };

  // Save item edits
  const handleSaveItem = async () => {
    if (!editingItem) return;

    // If song changed, update title to match song
    let newTitle = itemTitle;
    if (editingItem.type === 'song' && itemSongId) {
      const selectedSong = songs.find(s => s.id === itemSongId);
      if (selectedSong) {
        newTitle = selectedSong.title;
      }
    }

    updateServiceItem(editingItem.id, {
      title: newTitle,
      notes: itemNotes || undefined,
      duration_minutes: itemDuration ? parseInt(itemDuration) : undefined,
      key: itemKey || undefined,
      song_id: editingItem.type === 'song' ? (itemSongId || undefined) : undefined,
    });
    
    editItemModal.onClose();
    loadData();
    toast({ title: 'Item updated', status: 'success', duration: 2000 });
  };

  const assignedCount = serviceAssignments.length;
  
  // Available roles for assignment
  const ROLES = [
    { value: 'worship_leader', label: 'Worship Leader' },
    { value: 'lead_vocalist', label: 'Lead Vocalist' },
    { value: 'background_vocalist', label: 'Background Vocalist' },
    { value: 'acoustic_guitar', label: 'Acoustic Guitar' },
    { value: 'electric_guitar', label: 'Electric Guitar' },
    { value: 'bass_guitar', label: 'Bass Guitar' },
    { value: 'drums', label: 'Drums' },
    { value: 'keyboard', label: 'Keyboard/Piano' },
    { value: 'sound_tech', label: 'Sound Tech' },
    { value: 'media_tech', label: 'Media Tech' },
  ];
  
  // Handle assigning a team member
  const handleAssignTeamMember = async () => {
    if (!assignMemberId || !assignRole) return;
    
    createAssignment({
      service_id: serviceId,
      team_member_id: assignMemberId,
      role: assignRole,
      status: 'pending',
    });
    
    assignModal.onClose();
    setAssignMemberId('');
    setAssignRole('');
    loadData();
    toast({ title: 'Team member assigned', status: 'success', duration: 2000 });
  };

  return (
    <Box p={{ base: '4', md: '8' }} maxW="800px" mx="auto">
      <Flex mb="6" gap="3" align="flex-start" direction={{ base: 'column', md: 'row' }}>
        <HStack spacing="3" w={{ base: 'full', md: 'auto' }}>
          <IconButton aria-label="Back" icon={<BackIcon />} variant="ghost" onClick={() => router.push('/demo/services')} minW="44px" />
          <Box flex="1">
            <Heading size="lg" fontWeight="700" color={headingColor}>{service?.title || 'Service Detail'}</Heading>
          </Box>
        </HStack>
        {!editing && (
          <HStack spacing="2" w={{ base: 'full', md: 'auto' }} justify={{ base: 'flex-end', md: 'flex-start' }}>
            <Button variant="outline" onClick={() => setEditing(true)} size={{ base: 'sm', md: 'md' }}>Edit</Button>
            <Button variant="ghost" colorScheme="red" size={{ base: 'sm', md: 'sm' }} onClick={handleDelete}>Delete</Button>
          </HStack>
        )}
      </Flex>

      {loading && (
        <Center minH="50vh">
          <Spinner size="xl" color="brand.500" />
        </Center>
      )}

      {!loading && service && (
        <>
          <Card mb="6" bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor}>
            <CardBody>
              <VStack spacing="4" align="stretch">
                <HStack justify="space-between">
                  <Text fontWeight="600" color={textColor}>{formatDate(service.date)} · {service.time}</Text>
                  <Badge colorScheme={STATUS_COLORS[service.status] || 'gray'} variant="subtle" fontSize="xs">
                    {service.status}
                  </Badge>
                </HStack>
                {editing ? (
                  <VStack spacing="4" align="stretch">
                    <FormControl isRequired>
                      <FormLabel fontWeight="600">Title</FormLabel>
                      <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontWeight="600">Date</FormLabel>
                      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontWeight="600">Time</FormLabel>
                      <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontWeight="600">Status</FormLabel>
                      <Select value={status} onChange={(e) => setStatus(e.target.value as ServiceStatus)}>
                        <option value="draft">Draft</option>
                        <option value="finalized">Finalized</option>
                        <option value="completed">Completed</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel fontWeight="600">Notes</FormLabel>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes" />
                    </FormControl>
                    <HStack>
                      <Button onClick={handleSave}>Save</Button>
                      <Button variant="ghost" onClick={() => { setEditing(false); loadData(); }}>Cancel</Button>
                    </HStack>
                  </VStack>
                ) : (
                  <VStack spacing="4" align="stretch">
                    <Text fontWeight="600" color={textColor}>{status}</Text>
                    <Text color={subtextColor}>{notes || 'No notes'}</Text>
                  </VStack>
                )}
              </VStack>
            </CardBody>
          </Card>

          <HStack justify="space-between" align="center" mb="4" flexWrap="wrap" gap="2">
            <Heading size="md" fontWeight="700" color={headingColor}>Service Order ({items.length} items)</Heading>
            <HStack spacing="2">
              <Button size="sm" variant="outline" onClick={() => toast({ title: 'Demo Mode', description: 'Add songs via the Songs page in the full app.', status: 'info' })}>+ Add Song</Button>
              <Button size="sm" variant="outline" onClick={() => toast({ title: 'Demo Mode', description: 'Add segments in the full app.', status: 'info' })}>+ Add Segment</Button>
              {items.length > 0 && (
                <Button size="sm" variant="ghost" onClick={handleDuplicateService}>
                  Duplicate
                </Button>
              )}
            </HStack>
          </HStack>

          {items.length === 0 ? (
            <Box textAlign="center" py="8" color={emptyColor} bg={cardBg} borderRadius="xl" border="1px dashed" borderColor={borderColor}>
              <Text>No items in service order yet.</Text>
              <Text fontSize="sm" mt="1">Add songs and segments to build your service</Text>
            </Box>
          ) : (
            <VStack spacing="3" align="stretch">
              {items.map((item, index) => (
                <Box 
                  key={item.id} 
                  bg={cardBg} 
                  border="1px solid" 
                  borderColor={borderColor} 
                  borderRadius="lg" 
                  px={{ base: '3', md: '4' }} 
                  py="3"
                  shadow="sm"
                  transition="all 0.15s"
                  _hover={{ shadow: 'md' }}
                >
                  {/* Main row: Position + Title + Badge */}
                  <HStack spacing="3" mb={{ base: '2', md: '0' }}>
                    {/* Position number */}
                    <Box 
                      minW="28px" 
                      h="28px" 
                      borderRadius="full" 
                      bg={itemBg}
                      display="flex" 
                      alignItems="center" 
                      justifyContent="center"
                      flexShrink={0}
                    >
                      <Text fontSize="sm" fontWeight="600" color="gray.500">{index + 1}</Text>
                    </Box>
                    
                    {/* Title - full width, no truncation */}
                    <Text fontWeight="600" flex="1" wordBreak="break-word" color={itemTitleColor}>{item.title}</Text>
                    
                    {/* Type badge - hidden on mobile, shown on desktop */}
                    <Badge variant="outline" colorScheme={item.type === 'song' ? 'brand' : 'gray'} fontSize="xs" flexShrink={0} display={{ base: 'none', md: 'flex' }}>
                      {item.type}
                    </Badge>
                  </HStack>
                  
                  {/* Actions row: Badge (mobile) + Edit + Move/Delete buttons */}
                  <HStack spacing="2" justify="flex-end" pl={{ base: '44px', md: '0' }}>
                    {/* Type badge - shown on mobile only */}
                    <Badge variant="outline" colorScheme={item.type === 'song' ? 'brand' : 'gray'} fontSize="xs" display={{ base: 'flex', md: 'none' }}>
                      {item.type}
                    </Badge>
                    
                    {/* Key display for songs */}
                    {item.type === 'song' && item.key && (
                      <Text fontSize="xs" color="gray.500" fontWeight="500">Key: {item.key}</Text>
                    )}
                    
                    <Box flex="1" />
                    
                    {/* Edit button */}
                    <IconButton
                      aria-label="Edit item"
                      icon={<EditIcon />}
                      size="sm"
                      variant="ghost"
                      colorScheme="brand"
                      onClick={() => openEditItem(item)}
                    />
                    
                    {/* Delete button */}
                    <IconButton
                      aria-label="Delete item"
                      icon={<TrashIcon />}
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      onClick={() => handleDeleteItem(item.id)}
                    />
                  </HStack>
                </Box>
              ))}
            </VStack>
          )}

          <Card mt="6" mb="6" bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor}>
            <CardBody>
              <HStack justify="space-between" align="center" mb="4">
                <Heading size="md" fontWeight="700" color={headingColor}>Team Assignments ({assignedCount})</Heading>
                <Button size="sm" variant="outline" onClick={assignModal.onOpen}>
                  + Assign Member
                </Button>
              </HStack>
              {assignedCount === 0 ? (
                <Box textAlign="center" py="6" color={emptyColor}>
                  <Text>No team members assigned yet.</Text>
                </Box>
              ) : (
                <VStack spacing="3" align="stretch">
                  {serviceAssignments.map((a) => {
                    const member = teamMembers.find(m => m.id === a.team_member_id);
                    return (
                      <Box 
                        key={a.id} 
                        bg={cardBg} 
                        border="1px solid" 
                        borderColor={borderColor} 
                        borderRadius="lg" 
                        px={{ base: '3', md: '4' }} 
                        py="3"
                      >
                        {/* Row 1: Name + Role + Status */}
                        <HStack spacing="3" mb={{ base: '2', md: '0' }}>
                          <Text fontWeight="600" flex="1" color={itemTitleColor}>{member?.name || 'Unknown'}</Text>
                          <Badge variant="outline" colorScheme="brand" fontSize="xs">
                            {roleLabel(a.role)}
                          </Badge>
                          <Badge 
                            variant="solid" 
                            colorScheme={ASSIGNMENT_STATUS_COLORS[a.status] || 'gray'} 
                            fontSize="xs"
                          >
                            {a.status}
                          </Badge>
                        </HStack>
                        
                        {/* Row 2: Actions */}
                        <HStack spacing="2" justify="flex-end" mt={{ base: '2', md: '0' }}>
                          {a.status === 'pending' && (
                            <>
                              <Button
                                size="xs"
                                colorScheme="green"
                                onClick={() => handleUpdateAssignmentStatus(a.id, 'confirmed')}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                colorScheme="red"
                                onClick={() => handleUpdateAssignmentStatus(a.id, 'declined')}
                              >
                                Decline
                              </Button>
                            </>
                          )}
                          {a.status === 'confirmed' && (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => handleUpdateAssignmentStatus(a.id, 'pending')}
                            >
                              Set Pending
                            </Button>
                          )}
                          {a.status === 'declined' && (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => handleUpdateAssignmentStatus(a.id, 'pending')}
                            >
                              Reinvite
                            </Button>
                          )}
                          <IconButton
                            aria-label="Remove assignment"
                            icon={<TrashIcon />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => handleDeleteAssignment(a.id)}
                          />
                        </HStack>
                      </Box>
                    );
                  })}
                </VStack>
              )}
            </CardBody>
          </Card>

          <Card mb="6" bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor}>
            <CardBody>
              <HStack justify="space-between" align="center" flexWrap="wrap" gap="3">
                <Box>
                  <Heading size="md" fontWeight="700" color={headingColor}>Invitations</Heading>
                  <Text color={subtextColor} fontSize="sm">
                    Send notification emails to all assigned team members.
                  </Text>
                </Box>
                <Button
                  size="sm"
                  onClick={handleSendInvites}
                  leftIcon={<CheckIcon />}
                  isDisabled={serviceAssignments.length === 0}
                >
                  Send Invitations
                </Button>
              </HStack>
            </CardBody>
          </Card>
        </>
      )}

      {/* Edit Item Modal */}
      <Modal isOpen={editItemModal.isOpen} onClose={editItemModal.onClose} isCentered size="md">
        <ModalOverlay />
        <ModalContent borderRadius="xl" mx="4">
          <ModalHeader fontWeight="700">
            Edit {editingItem?.type === 'song' ? 'Song' : 'Segment'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              {/* For songs: show song selector */}
              {editingItem?.type === 'song' && (
                <FormControl>
                  <FormLabel fontWeight="600">Change Song</FormLabel>
                  <Select 
                    value={itemSongId || ''} 
                    onChange={(e) => setItemSongId(e.target.value || null)}
                    placeholder="Select a song"
                  >
                    {songs.map(song => (
                      <option key={song.id} value={song.id}>
                        {song.title} {song.artist ? `- ${song.artist}` : ''}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              )}
              
              {/* For segments: allow title editing */}
              {editingItem?.type === 'segment' && (
                <FormControl isRequired>
                  <FormLabel fontWeight="600">Title</FormLabel>
                  <Input 
                    value={itemTitle} 
                    onChange={(e) => setItemTitle(e.target.value)}
                    placeholder="e.g., Announcements, Sermon, Offering"
                  />
                </FormControl>
              )}
              
              <FormControl>
                <FormLabel fontWeight="600">Key {editingItem?.type === 'song' ? '(Music)' : ''}</FormLabel>
                <Select 
                  value={itemKey} 
                  onChange={(e) => setItemKey(e.target.value)}
                  placeholder="Select key"
                >
                  {['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'].map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl>
                <FormLabel fontWeight="600">Duration (minutes)</FormLabel>
                <Input 
                  type="number" 
                  value={itemDuration} 
                  onChange={(e) => setItemDuration(e.target.value)}
                  placeholder="e.g., 5"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel fontWeight="600">Notes</FormLabel>
                <Textarea 
                  value={itemNotes} 
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Any additional notes for this item..."
                  rows={3}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr="3" onClick={editItemModal.onClose}>Cancel</Button>
            <Button onClick={handleSaveItem}>Save Changes</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Assign Team Member Modal */}
      <Modal isOpen={assignModal.isOpen} onClose={assignModal.onClose} isCentered size="md">
        <ModalOverlay />
        <ModalContent borderRadius="xl" mx="4">
          <ModalHeader fontWeight="700">Assign Team Member</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired>
                <FormLabel fontWeight="600">Team Member</FormLabel>
                <Select 
                  value={assignMemberId} 
                  onChange={(e) => setAssignMemberId(e.target.value)}
                  placeholder="Select a team member"
                >
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel fontWeight="600">Role</FormLabel>
                <Select 
                  value={assignRole} 
                  onChange={(e) => setAssignRole(e.target.value)}
                  placeholder="Select a role"
                >
                  {ROLES.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr="3" onClick={assignModal.onClose}>Cancel</Button>
            <Button onClick={handleAssignTeamMember} isDisabled={!assignMemberId || !assignRole}>
              Assign
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}