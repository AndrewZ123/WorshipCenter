'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Text, HStack, Button, VStack, Input, Flex,
  FormControl, FormLabel, Card, CardBody, useToast, IconButton,
  useColorModeValue, Spinner, Center, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter,
  Select, Textarea, useDisclosure, Menu, MenuButton, MenuList, MenuItem,
  Divider, Badge, Portal,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import type { Service, ServiceItem, TeamMember, ServiceAssignment, ServiceStatus, Song } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import Avatar from '@/components/ui/Avatar';
import { formatServiceDate } from '@/lib/formatDate';

// Lucide icons
import { 
  ArrowLeft, MoreVertical, Copy, Trash2, Edit, Plus,
  Music, AlignLeft, Send, CheckCircle,
  Calendar, Clock, BookOpen, UserCheck
} from 'lucide-react';

// dnd-kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import SortableItem from '@/components/ui/SortableItem';

export default function ServiceDetailClient() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { user, church } = useAuth();
  const store = useStore();
  const serviceId = params.id as string;

  const [service, setService] = useState<Service | null>(null);
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [editing, setEditing] = useState(false);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState<ServiceStatus>('draft');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  // Delete confirmation
  const deleteDisclosure = useDisclosure();

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
  
  // Add song modal state
  const addSongModal = useDisclosure();
  const [addSongId, setAddSongId] = useState<string | null>(null);
  
  // Add segment modal state
  const addSegmentModal = useDisclosure();
  const [addSegmentTitle, setAddSegmentTitle] = useState('');
  const [addSegmentNotes, setAddSegmentNotes] = useState('');
  const [addSegmentDuration, setAddSegmentDuration] = useState('');

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const itemBg = useColorModeValue('gray.50', 'gray.700');
  const headingColor = useColorModeValue('gray.900', 'white');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const emptyColor = useColorModeValue('gray.400', 'gray.500');
  const itemTitleColor = useColorModeValue('gray.800', 'white');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  
  // Team members have read-only access
  const isReadOnly = user?.role === 'team';

  const roleLabel = (r: string) => r.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  // Configure drag-and-drop sensors with mobile-optimized settings
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // Must drag 10px before activating (prevents accidental drags on mobile)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end event
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Optimistically update local state
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);

    // Persist to database
    try {
      await Promise.all(
        newItems.map((item, index) => store.serviceItems.update(item.id, { position: index }))
      );
      toast({ title: 'Order updated', status: 'success', duration: 1500 });
    } catch (error) {
      console.error('Error updating order:', error);
      toast({ title: 'Error updating order', status: 'error', duration: 2000 });
      // Reload data on error
      await loadData();
    }
  };

  useEffect(() => {
    loadData();
  }, [serviceId]);

  const loadData = useCallback(async () => {
    if (!church) return;

    try {
      setLoading(true);
      const svc = await store.services.getById(serviceId);
      if (svc) {
        setService(svc);
        setTitle(svc.title);
        setDate(svc.date);
        setTime(svc.time);
        setStatus(svc.status);
        setNotes(svc.notes);
      } else {
        router.push('/services');
        return;
      }

      const [itemsData, assignmentsData, songsData] = await Promise.all([
        store.serviceItems.getByService(serviceId),
        store.assignments.getByService(serviceId),
        store.songs.getByChurch(church.id),
      ]);
      setItems(itemsData.sort((a, b) => a.position - b.position));
      setAssignments(assignmentsData);
      setSongs(songsData);

      const members = await store.teamMembers.getByChurch(church.id);
      setTeamMembers(members);
    } catch (error) {
      console.error('Error loading service:', error);
      toast({ title: 'Error loading data', description: 'Please refresh the page.', status: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  }, [serviceId, church, toast, router]);

  const handleSave = async () => {
    if (!church) return;

    try {
      await store.services.update(serviceId, { title, date, time, status, notes });
      setEditing(false);
      await loadData();
      toast({ title: 'Service updated', status: 'success', duration: 2000 });
    } catch (error) {
      console.error('Error saving service:', error);
      toast({ title: 'Error saving service', description: error instanceof Error ? error.message : 'Unknown error', status: 'error', duration: 3000 });
    }
  };

  const handleDelete = async () => {
    if (!church) return;

    try {
      await store.services.delete(serviceId);
      router.push('/services');
      toast({ title: 'Service deleted', status: 'info', duration: 2000 });
    } catch (error) {
      console.error('Error deleting service:', error);
      toast({ title: 'Error deleting service', description: error instanceof Error ? error.message : 'Unknown error', status: 'error', duration: 3000 });
    }
  };

  const handleSendInvites = async () => {
    if (!church || !user) return;

    try {
      const churchMembers = await store.teamMembers.getByChurch(church.id);
      let sentCount = 0;

      for (const assignment of assignments) {
        const member = churchMembers.find((m) => m.id === assignment.team_member_id);
        if (member && member.email) {
          await store.notifications.create({
            church_id: church.id,
            user_id: user.id,
            type: 'invitation',
            title: 'Service Invitation',
            message: `You've been invited to ${service?.title} on ${date} as ${roleLabel(assignment.role)}`,
            service_id: serviceId,
            read: false,
          });
          sentCount++;
        }
      }

      if (sentCount > 0) {
        toast({ title: 'Invitations sent!', description: `${sentCount} notification(s) created.`, status: 'success', duration: 3000 });
      } else {
        toast({ title: 'No invites to send', description: 'All team members have already been invited or have no email.', status: 'warning', duration: 3000 });
      }
    } catch (error) {
      console.error('Error sending invitations:', error);
      toast({ title: 'Error sending invitations', description: error instanceof Error ? error.message : 'Unknown error', status: 'error', duration: 3000 });
    }
  };

  const handleAddSong = () => {
    setAddSongId(null);
    addSongModal.onOpen();
  };

  const handleAddSegment = () => {
    setAddSegmentTitle('');
    setAddSegmentNotes('');
    setAddSegmentDuration('');
    addSegmentModal.onOpen();
  };
  
  const handleSaveAddSong = async () => {
    if (!church || !addSongId) return;
    
    try {
      const selectedSong = songs.find(s => s.id === addSongId);
      if (!selectedSong) {
        toast({ title: 'Song not found', status: 'error', duration: 3000 });
        return;
      }
      
      const newPosition = items.length;
      await store.serviceItems.create({
        service_id: serviceId,
        type: 'song',
        title: selectedSong.title,
        song_id: addSongId,
        key: selectedSong.default_key || null,
        duration_minutes: null,
        position: newPosition,
        notes: '',
      });
      
      addSongModal.onClose();
      setAddSongId(null);
      await loadData();
      toast({ title: 'Song added to service', status: 'success', duration: 2000 });
    } catch (error) {
      console.error('Error adding song:', error);
      toast({ title: 'Error adding song', description: error instanceof Error ? error.message : 'Unknown error', status: 'error', duration: 3000 });
    }
  };
  
  const handleSaveAddSegment = async () => {
    if (!church || !addSegmentTitle) return;
    
    try {
      const newPosition = items.length;
      await store.serviceItems.create({
        service_id: serviceId,
        type: 'segment',
        title: addSegmentTitle,
        notes: addSegmentNotes || '',
        duration_minutes: addSegmentDuration ? parseInt(addSegmentDuration) : null,
        position: newPosition,
        song_id: null,
        key: null,
      });
      
      addSegmentModal.onClose();
      setAddSegmentTitle('');
      setAddSegmentNotes('');
      setAddSegmentDuration('');
      await loadData();
      toast({ title: 'Segment added to service', status: 'success', duration: 2000 });
    } catch (error) {
      console.error('Error adding segment:', error);
      toast({ title: 'Error adding segment', description: error instanceof Error ? error.message : 'Unknown error', status: 'error', duration: 3000 });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!church || !service) return;

    try {
      await store.serviceItems.delete(itemId);
      await loadData();
      toast({ title: 'Item removed', status: 'info', duration: 2000 });
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({ title: 'Error deleting item', description: error instanceof Error ? error.message : 'Unknown error', status: 'error', duration: 3000 });
    }
  };

  const handleDuplicateService = async () => {
    if (!church || !service) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const newService = await store.services.duplicate(serviceId, today);
      if (newService) {
        router.push(`/services/${newService.id}`);
      } else {
        toast({ title: 'Error duplicating service', status: 'error', duration: 3000 });
      }
    } catch (error) {
      console.error('Error duplicating service:', error);
      toast({ title: 'Error duplicating service', description: error instanceof Error ? error.message : 'Unknown error', status: 'error', duration: 3000 });
    }
  };

  const handleUpdateAssignmentStatus = async (assignmentId: string, newStatus: ServiceAssignment['status']) => {
    try {
      const assignment = assignments.find(a => a.id === assignmentId);
      const member = assignment ? teamMembers.find(m => m.id === assignment.team_member_id) : null;
      const memberName = member?.name || 'Team member';
      
      await store.assignments.update(assignmentId, { status: newStatus });
      if (newStatus === 'confirmed' || newStatus === 'declined') {
        await store.notifications.create({
          church_id: church!.id,
          user_id: user!.id,
          type: 'status_change',
          title: `Assignment ${newStatus}`,
          message: `${memberName} ${newStatus} the invitation for ${service?.title || 'this service'}`,
          service_id: serviceId,
          read: false,
        });
      }
      await loadData();
      toast({ title: 'Status updated', status: 'success', duration: 2000 });
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast({ title: 'Error updating assignment', description: error instanceof Error ? error.message : 'Unknown error', status: 'error', duration: 3000 });
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!church || !service) return;

    try {
      await store.assignments.delete(assignmentId);
      await loadData();
      toast({ title: 'Assignment removed', status: 'info', duration: 2000 });
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast({ title: 'Error removing assignment', description: error instanceof Error ? error.message : 'Unknown error', status: 'error', duration: 3000 });
    }
  };

  const openEditItem = (item: ServiceItem) => {
    setEditingItem(item);
    setItemTitle(item.title);
    setItemNotes(item.notes || '');
    setItemDuration(item.duration_minutes?.toString() || '');
    setItemKey(item.key || '');
    setItemSongId(item.song_id || null);
    editItemModal.onOpen();
  };

  const handleSaveItem = async () => {
    if (!editingItem) return;

    try {
      let newTitle = itemTitle;
      if (editingItem.type === 'song' && itemSongId) {
        const selectedSong = songs.find(s => s.id === itemSongId);
        if (selectedSong) {
          newTitle = selectedSong.title;
        }
      }

      await store.serviceItems.update(editingItem.id, {
        title: newTitle,
        notes: itemNotes || undefined,
        duration_minutes: itemDuration ? parseInt(itemDuration) : undefined,
        key: itemKey || undefined,
        song_id: editingItem.type === 'song' ? (itemSongId || undefined) : undefined,
      });
      
      editItemModal.onClose();
      await loadData();
      toast({ title: 'Item updated', status: 'success', duration: 2000 });
    } catch (error) {
      console.error('Error updating item:', error);
      toast({ title: 'Error updating item', description: error instanceof Error ? error.message : 'Unknown error', status: 'error', duration: 3000 });
    }
  };

  const handleAssignTeamMember = async () => {
    if (!church || !assignMemberId || !assignRole) return;
    
    try {
      await store.assignments.create({
        service_id: serviceId,
        team_member_id: assignMemberId,
        role: assignRole,
        status: 'pending',
      });
      
      assignModal.onClose();
      setAssignMemberId('');
      setAssignRole('');
      await loadData();
      toast({ title: 'Team member assigned', status: 'success', duration: 2000 });
    } catch (error) {
      console.error('Error assigning team member:', error);
      toast({ title: 'Error assigning team member', description: error instanceof Error ? error.message : 'Unknown error', status: 'error', duration: 3000 });
    }
  };

  const assignedCount = assignments.length;
  
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

  if (loading) {
    return (
      <Center minH="50vh">
        <Spinner size="xl" color="teal.500" />
      </Center>
    );
  }

  return (
    <Box p={{ base: '4', md: '8' }} maxW="900px" mx="auto">
      {/* Header */}
      <Flex mb="6" gap="3" align="flex-start" direction={{ base: 'column', md: 'row' }}>
        <HStack spacing="3" flex="1">
          <IconButton 
            aria-label="Back" 
            icon={<ArrowLeft size={20} />} 
            variant="ghost" 
            onClick={() => router.push('/services')} 
            minW="44px"
            color="gray.500"
            _hover={{ color: 'gray.700', bg: 'gray.100' }}
          />
          <Box>
            <Text fontSize="2xl" fontWeight="bold" color={headingColor} letterSpacing="tight">
              {service?.title || 'Service Detail'}
            </Text>
            <HStack spacing="2" mt="1" color={subtextColor}>
              <Calendar size={14} />
              <Text fontSize="sm">{formatServiceDate(service?.date || '')}</Text>
              <Text fontSize="sm">·</Text>
              <Clock size={14} />
              <Text fontSize="sm">{service?.time}</Text>
            </HStack>
          </Box>
        </HStack>
        
        {!editing && !isReadOnly && (
          <Menu>
            <MenuButton 
              as={IconButton} 
              icon={<MoreVertical size={20} />} 
              variant="ghost"
              aria-label="Actions"
              color="gray.400"
              _hover={{ color: 'gray.600', bg: 'gray.100' }}
            />
            <Portal>
              <MenuList borderRadius="xl">
                <MenuItem onClick={() => setEditing(true)} icon={<Edit size={16} />}>Edit Service</MenuItem>
                <MenuItem onClick={handleDuplicateService} icon={<Copy size={16} />}>Duplicate</MenuItem>
                <Divider />
                <MenuItem color="red.500" onClick={deleteDisclosure.onOpen} icon={<Trash2 size={16} />}>Delete</MenuItem>
              </MenuList>
            </Portal>
          </Menu>
        )}
      </Flex>

      {!loading && service && (
        <>
          {/* Info Card */}
          <Card mb="6" bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
            <CardBody>
              {editing ? (
                <VStack spacing="4" align="stretch">
                  <FormControl isRequired>
                    <FormLabel fontWeight="600" fontSize="sm">Title</FormLabel>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} borderRadius="lg" />
                  </FormControl>
                  <HStack spacing="4">
                    <FormControl>
                      <FormLabel fontWeight="600" fontSize="sm">Date</FormLabel>
                      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} borderRadius="lg" />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontWeight="600" fontSize="sm">Time</FormLabel>
                      <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} borderRadius="lg" />
                    </FormControl>
                  </HStack>
                  <FormControl>
                    <FormLabel fontWeight="600" fontSize="sm">Status</FormLabel>
                    <Select value={status} onChange={(e) => setStatus(e.target.value as ServiceStatus)} borderRadius="lg">
                      <option value="draft">Draft</option>
                      <option value="finalized">Finalized</option>
                      <option value="completed">Completed</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontWeight="600" fontSize="sm">Notes</FormLabel>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." borderRadius="lg" rows={3} />
                  </FormControl>
                  <HStack>
                    <Button colorScheme="teal" onClick={handleSave} fontWeight="600">Save Changes</Button>
                    <Button variant="ghost" onClick={() => { setEditing(false); loadData(); }}>Cancel</Button>
                  </HStack>
                </VStack>
              ) : (
                <VStack spacing="4" align="stretch">
                  <HStack justify="space-between" align="center">
                    <HStack spacing="4">
                      <StatusBadge status={service.status} size="md" />
                      {notes && (
                        <HStack spacing="2" color={subtextColor}>
                          <BookOpen size={16} />
                          <Text fontSize="sm">{notes}</Text>
                        </HStack>
                      )}
                    </HStack>
                  </HStack>
                  {!notes && (
                    <Text color={emptyColor} fontSize="sm" fontStyle="italic">No notes added</Text>
                  )}
                </VStack>
              )}
            </CardBody>
          </Card>

          {/* Service Order Section */}
          <HStack justify="space-between" align="center" mb="4" flexWrap="wrap" gap="2">
            <Text fontSize="lg" fontWeight="semibold" color={headingColor}>Service Order ({items.length} items)</Text>
            {!isReadOnly && (
              <HStack spacing="2">
                <Button size="sm" variant="outline" colorScheme="teal" onClick={handleAddSong} leftIcon={<Music size={14} />}>Add Song</Button>
                <Button size="sm" variant="outline" colorScheme="teal" onClick={handleAddSegment} leftIcon={<AlignLeft size={14} />}>Add Segment</Button>
              </HStack>
            )}
          </HStack>

          {items.length === 0 ? (
            <EmptyState
              icon="music"
              title="No items in service order"
              description="Add songs and segments to build your service plan."
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <VStack spacing="2" align="stretch">
                  {items.map((item, index) => (
                    <SortableItem
                      key={item.id}
                      id={item.id}
                    >
                      <Box
                        bg={cardBg}
                        border="1px solid"
                        borderColor={borderColor}
                        borderRadius="lg"
                        px={{ base: '3', md: '4' }}
                        py="3"
                        boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
                        transition="all 0.15s ease"
                        borderLeft="3px solid"
                        borderLeftColor={item.type === 'song' ? 'teal.500' : 'gray.300'}
                        _hover={{
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
                          transform: 'translateY(-1px)',
                        }}
                      >
                        <HStack spacing="3">
                          {/* Icon */}
                          <Box
                            minW="32px"
                            h="32px"
                            borderRadius="lg"
                            bg={item.type === 'song' ? 'teal.100' : 'gray.100'}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            {item.type === 'song' ? (
                              <Music size={16} className="text-teal-600" />
                            ) : (
                              <AlignLeft size={16} className="text-gray-500" />
                            )}
                          </Box>

                          {/* Position */}
                          <Text fontSize="sm" fontWeight="600" color="gray.400" w="20px">{index + 1}.</Text>

                          {/* Title */}
                          <Text fontWeight="600" flex="1" color={itemTitleColor}>{item.title}</Text>

                          {/* Key badge for songs */}
                          {item.type === 'song' && item.key && (
                            <Badge colorScheme="teal" variant="subtle" fontSize="xs">Key: {item.key}</Badge>
                          )}

                          {/* Duration */}
                          {item.duration_minutes && (
                            <Text fontSize="xs" color="gray.400">{item.duration_minutes} min</Text>
                          )}

                          {/* Actions */}
                          {!isReadOnly ? (
                            <HStack spacing="1">
                              <Menu>
                                <MenuButton
                                  as={IconButton}
                                  icon={<MoreVertical size={16} />}
                                  size="sm"
                                  variant="ghost"
                                  color="gray.400"
                                  _hover={{ color: 'gray.600', bg: 'gray.100' }}
                                />
                                <Portal>
                                  <MenuList borderRadius="xl">
                                    <MenuItem onClick={() => openEditItem(item)}>Edit</MenuItem>
                                    <MenuItem color="red.500" onClick={() => handleDeleteItem(item.id)}>Delete</MenuItem>
                                  </MenuList>
                                </Portal>
                              </Menu>
                            </HStack>
                          ) : (
                            <IconButton
                              aria-label="View details"
                              icon={<MoreVertical size={16} />}
                              size="sm"
                              variant="ghost"
                              color="gray.400"
                              _hover={{ color: 'gray.600', bg: 'gray.100' }}
                              onClick={() => openEditItem(item)}
                            />
                          )}
                        </HStack>
                      </Box>
                    </SortableItem>
                  ))}
                </VStack>
              </SortableContext>
            </DndContext>
          )}

          {/* Team Assignments Section */}
          <Card mt="6" mb="6" bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
            <CardBody>
              <HStack justify="space-between" align="center" mb="4">
                <Text fontSize="lg" fontWeight="semibold" color={headingColor}>Team Assignments ({assignedCount})</Text>
                {!isReadOnly && (
                  <Button size="sm" variant="outline" colorScheme="teal" onClick={assignModal.onOpen} leftIcon={<Plus size={14} />}>
                    Assign Member
                  </Button>
                )}
              </HStack>
              
              {assignedCount === 0 ? (
                <EmptyState
                  icon="user-check"
                  title="No one assigned yet"
                  description="Assign team members to this service to send invitations."
                  ctaLabel="Assign Member"
                  ctaOnClick={assignModal.onOpen}
                />
              ) : (
                <VStack spacing="2" align="stretch">
                  {assignments.map((a) => {
                    const member = teamMembers.find(m => m.id === a.team_member_id);
                    return (
                      <HStack 
                        key={a.id} 
                        bg={hoverBg} 
                        borderRadius="lg" 
                        px="3" 
                        py="2"
                      >
                        <Avatar name={member?.name || 'Unknown'} size="sm" />
                        <Text fontWeight="500" flex="1" color={itemTitleColor}>{member?.name || 'Unknown'}</Text>
                        <Badge variant="subtle" colorScheme="gray" fontSize="xs">{roleLabel(a.role)}</Badge>
                        <StatusBadge status={a.status} size="sm" />
                        
                        {!isReadOnly ? (
                          <Menu>
                            <MenuButton 
                              as={IconButton}
                              icon={<MoreVertical size={16} />}
                              size="sm"
                              variant="ghost"
                              color="gray.400"
                              _hover={{ color: 'gray.600', bg: 'gray.100' }}
                            />
                            <Portal>
                              <MenuList borderRadius="xl">
                                {a.status === 'pending' && (
                                  <>
                                    <MenuItem onClick={() => handleUpdateAssignmentStatus(a.id, 'confirmed')} icon={<CheckCircle size={16} />}>Confirm</MenuItem>
                                    <MenuItem onClick={() => handleUpdateAssignmentStatus(a.id, 'declined')} color="red.500">Decline</MenuItem>
                                  </>
                                )}
                                {a.status === 'confirmed' && (
                                  <MenuItem onClick={() => handleUpdateAssignmentStatus(a.id, 'pending')}>Set Pending</MenuItem>
                                )}
                                {a.status === 'declined' && (
                                  <MenuItem onClick={() => handleUpdateAssignmentStatus(a.id, 'pending')}>Reinvite</MenuItem>
                                )}
                                <Divider />
                                <MenuItem color="red.500" onClick={() => handleDeleteAssignment(a.id)} icon={<Trash2 size={16} />}>Remove</MenuItem>
                              </MenuList>
                            </Portal>
                          </Menu>
                        ) : null}
                      </HStack>
                    );
                  })}
                </VStack>
              )}
            </CardBody>
          </Card>

          {/* Notify Team Section */}
          {!isReadOnly && (
            <Card mb="6" bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
              <CardBody>
                <HStack justify="space-between" align="center" flexWrap="wrap" gap="3">
                  <Box>
                    <Text fontSize="lg" fontWeight="semibold" color={headingColor}>Notify Team</Text>
                    <Text color={subtextColor} fontSize="sm">
                      Send notification emails to all assigned team members.
                    </Text>
                  </Box>
                  <Button
                    size="sm"
                    colorScheme="teal"
                    onClick={handleSendInvites}
                    leftIcon={<Send size={16} />}
                    isDisabled={assignments.length === 0}
                    fontWeight="600"
                  >
                    Send Invitations
                  </Button>
                </HStack>
              </CardBody>
            </Card>
          )}
        </>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDisclosure.isOpen}
        onClose={deleteDisclosure.onClose}
        onConfirm={handleDelete}
        title="Delete Service?"
        message="This will permanently delete this service, including all items, assignments, and song usage data."
        confirmLabel="Delete Service"
        variant="destructive"
      />

      {/* Edit Item Modal */}
      <Modal isOpen={editItemModal.isOpen} onClose={editItemModal.onClose} isCentered size="md">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl" mx="4">
          <ModalHeader fontWeight="700">Edit {editingItem?.type === 'song' ? 'Song' : 'Segment'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              {editingItem?.type === 'song' && (
                <FormControl>
                  <FormLabel fontWeight="600" fontSize="sm">Change Song</FormLabel>
                  <Select 
                    value={itemSongId || ''} 
                    onChange={(e) => setItemSongId(e.target.value || null)}
                    placeholder="Select a song"
                    borderRadius="lg"
                  >
                    {songs.map(song => (
                      <option key={song.id} value={song.id}>
                        {song.title} {song.artist ? `- ${song.artist}` : ''}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              )}
              
              {editingItem?.type === 'segment' && (
                <FormControl isRequired>
                  <FormLabel fontWeight="600" fontSize="sm">Title</FormLabel>
                  <Input 
                    value={itemTitle} 
                    onChange={(e) => setItemTitle(e.target.value)}
                    placeholder="e.g., Announcements, Sermon, Offering"
                    borderRadius="lg"
                  />
                </FormControl>
              )}
              
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Key {editingItem?.type === 'song' ? '(Music)' : ''}</FormLabel>
                <Select 
                  value={itemKey} 
                  onChange={(e) => setItemKey(e.target.value)}
                  placeholder="Select key"
                  borderRadius="lg"
                >
                  {['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'].map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Duration (minutes)</FormLabel>
                <Input 
                  type="number" 
                  value={itemDuration} 
                  onChange={(e) => setItemDuration(e.target.value)}
                  placeholder="e.g., 5"
                  borderRadius="lg"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Notes</FormLabel>
                <Textarea 
                  value={itemNotes} 
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Any additional notes for this item..."
                  rows={3}
                  borderRadius="lg"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={editItemModal.onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleSaveItem} fontWeight="600">Save Changes</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Assign Team Member Modal */}
      <Modal isOpen={assignModal.isOpen} onClose={assignModal.onClose} isCentered size="md">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl" mx="4">
          <ModalHeader fontWeight="700">Assign Team Member</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Team Member</FormLabel>
                <Select 
                  value={assignMemberId} 
                  onChange={(e) => setAssignMemberId(e.target.value)}
                  placeholder="Select a team member"
                  borderRadius="lg"
                >
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Role</FormLabel>
                <Select 
                  value={assignRole} 
                  onChange={(e) => setAssignRole(e.target.value)}
                  placeholder="Select a role"
                  borderRadius="lg"
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
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={assignModal.onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleAssignTeamMember} isDisabled={!assignMemberId || !assignRole} fontWeight="600">Assign</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Song Modal */}
      <Modal isOpen={addSongModal.isOpen} onClose={addSongModal.onClose} isCentered size="md">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl" mx="4">
          <ModalHeader fontWeight="700">Add Song to Service</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Select a Song</FormLabel>
                <Select 
                  value={addSongId || ''} 
                  onChange={(e) => setAddSongId(e.target.value || null)}
                  placeholder="Search and select a song"
                  borderRadius="lg"
                >
                  {songs.map(song => (
                    <option key={song.id} value={song.id}>
                      {song.title} {song.artist ? `- ${song.artist}` : ''}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={addSongModal.onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleSaveAddSong} isDisabled={!addSongId} fontWeight="600">Add Song</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Segment Modal */}
      <Modal isOpen={addSegmentModal.isOpen} onClose={addSegmentModal.onClose} isCentered size="md">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl" mx="4">
          <ModalHeader fontWeight="700">Add Segment to Service</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Title</FormLabel>
                <Input 
                  value={addSegmentTitle} 
                  onChange={(e) => setAddSegmentTitle(e.target.value)}
                  placeholder="e.g., Announcements, Sermon, Offering"
                  borderRadius="lg"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Duration (minutes)</FormLabel>
                <Input 
                  type="number" 
                  value={addSegmentDuration} 
                  onChange={(e) => setAddSegmentDuration(e.target.value)}
                  placeholder="e.g., 10"
                  borderRadius="lg"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Notes</FormLabel>
                <Textarea 
                  value={addSegmentNotes} 
                  onChange={(e) => setAddSegmentNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={3}
                  borderRadius="lg"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={addSegmentModal.onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleSaveAddSegment} isDisabled={!addSegmentTitle} fontWeight="600">Add Segment</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
