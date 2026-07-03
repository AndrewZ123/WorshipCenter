'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Text, HStack, Button, VStack, Input, Flex,
  FormControl, FormLabel, Card, CardBody, useToast, IconButton,
  useColorModeValue, Spinner, Center, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter,
  Select, Textarea, useDisclosure, Menu, MenuButton, MenuList, MenuItem,
  Divider, Badge, Portal, Tabs, TabList, TabPanels, Tab, TabPanel,
  Skeleton, SimpleGrid, Progress,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import type { Service, ServiceItem, TeamMember, ServiceAssignment, ServiceStatus, Song, ServiceDebriefPopulated } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import Avatar from '@/components/ui/Avatar';
import { formatServiceDate } from '@/lib/formatDate';
import { apiUrl } from '@/lib/api-base';
import { supabase } from '@/lib/supabase';
import { ServiceChat } from '@/components/services/ServiceChat';
import ServiceSchedule from '@/components/services/ServiceSchedule';
import ServiceTasks from '@/components/services/ServiceTasks';
import ServiceMode from '@/components/services/ServiceMode';
import RehearsalTab from '@/components/services/RehearsalTab';
import ServiceDebriefForm from '@/components/services/ServiceDebriefForm';
import { generateServicePDF } from '@/components/services/ServicePrintView';

// Lucide icons
import { 
  ArrowLeft, MoreVertical, Copy, Trash2, Edit, Plus,
  Music, AlignLeft, Send, CheckCircle, Calendar, Clock, 
  BookOpen, UserCheck, MessageSquare, Calendar as CalendarIcon,
  ListMusic, Users, ListChecks, Monitor, Printer, CheckSquare,
  Star
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
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user, church } = useAuth();
  const store = useStore();
  const serviceId = params.id as string;
  const highlightedAssignmentId = searchParams.get('assignmentId');

  const [activeTab, setActiveTab] = useState(0);
  const [primaryTab, setPrimaryTab] = useState(0); // 0=Overview, 1=Plan, 2=Team
  const [service, setService] = useState<Service | null>(null);
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [taskStats, setTaskStats] = useState<{ total: number; done: number } | null>(null);
  const [editing, setEditing] = useState(false);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState<ServiceStatus>('draft');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  // Delete confirmation
  const deleteDisclosure = useDisclosure();

  // Service Mode (Live Dashboard)
  const [serviceModeOpen, setServiceModeOpen] = useState(false);

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
  const [itemAssignedTo, setItemAssignedTo] = useState('');
  
  // Add song modal state
  const addSongModal = useDisclosure();
  const [addSongId, setAddSongId] = useState<string | null>(null);
  
  // Add segment modal state
  const addSegmentModal = useDisclosure();
  const [addSegmentTitle, setAddSegmentTitle] = useState('');
  const [addSegmentNotes, setAddSegmentNotes] = useState('');
  const [addSegmentDuration, setAddSegmentDuration] = useState('');

  // Debrief state
  const [debriefEntries, setDebriefEntries] = useState<ServiceDebriefPopulated[]>([]);
  const debriefModal = useDisclosure();
  const [showDebriefForm, setShowDebriefForm] = useState(false);

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

  const getCountdownText = (dateStr: string) => {
    if (!dateStr) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    target.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 0) return `in ${diffDays} days`;
    const pastDays = Math.abs(diffDays);
    if (pastDays === 1) return 'Yesterday';
    return `${pastDays} days ago`;
  };

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
    
    if (!over || active.id === over.id || !church) {
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
        newItems.map((item, index) => store.serviceItems.update(item.id, church.id, { position: index }))
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

  // Load task stats for the overview dashboard
  useEffect(() => {
    if (!church || !serviceId) return;
    store.tasks.getTaskStats(serviceId, church.id).then(setTaskStats).catch(() => setTaskStats(null));
  }, [serviceId, church]);

  // Load debrief entries
  useEffect(() => {
    if (!church || !serviceId) return;
    store.debriefs.getByService(serviceId, church.id).then(setDebriefEntries).catch(() => {});
  }, [serviceId, church]);

  // Switch to Debrief tab if tab=debrief query param is present
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'debrief') {
      setActiveTab(6);
      setPrimaryTab(2);
    }
  }, [searchParams]);

  // Switch to Schedule tab if assignmentId is present
  useEffect(() => {
    if (highlightedAssignmentId) {
      setActiveTab(2);
      setPrimaryTab(2);
    }
  }, [highlightedAssignmentId]);

  const loadData = useCallback(async () => {
    if (!church) return;

    try {
      setLoading(true);
      const svc = await store.services.getById(serviceId, church.id);
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
        store.assignments.getByService(serviceId, church.id),
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
  }, [serviceId, church, toast, router, store]);

  const handleSave = async () => {
    if (!church) return;

    try {
      const prevStatus = service?.status;
      await store.services.update(serviceId, church.id, { title, date, time, status, notes });
      setEditing(false);
      await loadData();

      // Auto-prompt debrief when service is marked completed
      if (status === 'completed' && prevStatus !== 'completed') {
        setShowDebriefForm(true);
        // Notify assigned team members
        if (user && church) {
          try {
            await Promise.all(
              assignments
                .filter(a => a.team_member_id !== user.team_member_id)
                .map(a => {
                  const member = teamMembers.find(m => m.id === a.team_member_id);
                  if (!member?.user_id) return Promise.resolve();
                  return store.notifications.create({
                    church_id: church.id,
                    user_id: member.user_id,
                    type: 'debrief_request',
                    title: `Debrief requested — ${title || service?.title || ''}`,
                    message: `Please submit your debrief for ${title || service?.title || ''} on ${date || service?.date || ''}`,
                    service_id: serviceId,
                    read: false,
                    link_url: `/services/${serviceId}?tab=debrief`,
                  });
                })
            );
          } catch (e) {
            console.error('[Debrief] Failed to send notifications:', e);
          }
        }
      }

      toast({ title: 'Service updated', status: 'success', duration: 2000 });
    } catch (error) {
      console.error('Error saving service:', error);
      toast({ title: 'Error saving service', description: error instanceof Error ? error.message : 'Unknown error', status: 'error', duration: 3000 });
    }
  };

  const handleDelete = async () => {
    if (!church) return;

    try {
      await store.services.delete(serviceId, church.id);
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
      let emailCount = 0;

      const session = (await supabase.auth.getSession()).data.session;

      for (const assignment of assignments) {
        const member = churchMembers.find((m) => m.id === assignment.team_member_id);
        if (!member) continue;

        // In-app notification
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

        // Email
        if (member.email) {
          try {
            const res = await fetch(apiUrl('/api/notifications/send-invitation'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
              },
              body: JSON.stringify({
                assignmentId: assignment.id,
                churchId: church.id,
                serviceTitle: service?.title || '',
                serviceDate: service?.date || '',
                serviceTime: service?.time || '',
                memberName: member.name,
                memberEmail: member.email,
                role: assignment.role,
              }),
            });
            if (res.ok) emailCount++;
          } catch (e) {
            console.error('[Invite] Email failed:', e);
          }
        }
      }

      if (sentCount > 0) {
        toast({ title: 'Invitations sent!', description: `${sentCount} notification(s), ${emailCount} email(s) sent.`, status: 'success', duration: 3000 });
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
      await store.serviceItems.delete(itemId, church.id);
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
      const newService = await store.services.duplicate(serviceId, church.id, today);
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
    if (!church) return;
    
    try {
      const assignment = assignments.find(a => a.id === assignmentId);
      const member = assignment ? teamMembers.find(m => m.id === assignment.team_member_id) : null;
      const memberName = member?.name || 'Team member';
      
      await store.assignments.update(assignmentId, church.id, { status: newStatus });
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
      await store.assignments.delete(assignmentId, church.id);
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
    setItemAssignedTo(item.assigned_to || '');
    editItemModal.onOpen();
  };

  const handleSaveItem = async () => {
    if (!editingItem || !church) return;

    try {
      let newTitle = itemTitle;
      if (editingItem.type === 'song' && itemSongId) {
        const selectedSong = songs.find(s => s.id === itemSongId);
        if (selectedSong) {
          newTitle = selectedSong.title;
        }
      }

      await store.serviceItems.update(editingItem.id, church.id, {
        title: newTitle,
        notes: itemNotes || undefined,
        duration_minutes: itemDuration ? parseInt(itemDuration) : undefined,
        key: itemKey || undefined,
        song_id: editingItem.type === 'song' ? (itemSongId || undefined) : undefined,
        assigned_to: itemAssignedTo || null,
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
      
      // Send invitation email to the assigned member
      const member = teamMembers.find(m => m.id === assignMemberId);
      if (member?.email) {
        fetch(apiUrl('/api/notifications/send-invitation'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignmentId: '',
            churchId: church.id,
            serviceTitle: service?.title || '',
            serviceDate: service?.date || '',
            serviceTime: service?.time || '',
            memberName: member.name,
            memberEmail: member.email,
            role: assignRole,
          }),
        }).catch(err => console.error('[Invite] Failed to send:', err));
      }
      
      assignModal.onClose();
      setAssignMemberId('');
      setAssignRole('');
      await loadData();
      toast({ title: 'Team member assigned & notified', status: 'success', duration: 2000 });
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
      <Box p={{ base: '4', md: '8' }} maxW="900px" mx="auto">
        {/* Header Skeleton */}
        <Flex mb="6" gap="3" align="flex-start" direction={{ base: 'column', md: 'row' }}>
          <HStack spacing="3" flex="1">
            <Skeleton boxSize="40px" borderRadius="lg" />
            <VStack spacing="2" align="start">
              <Skeleton h="28px" w="240px" borderRadius="md" />
              <Skeleton h="16px" w="160px" borderRadius="md" />
            </VStack>
          </HStack>
        </Flex>

        {/* Tabs Skeleton */}
        <Card mb="6" bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor}>
          <Box px="4" pt="4" borderBottom="1px solid" borderColor={borderColor}>
            <HStack spacing="6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} h="32px" w="100px" borderRadius="md" />
              ))}
            </HStack>
          </Box>
          <CardBody p="6">
            <VStack spacing="4" align="stretch">
              {/* Tab content skeleton */}
              <Skeleton h="24px" w="120px" borderRadius="md" />
              <Skeleton h="80px" w="100%" borderRadius="lg" />
              <Skeleton h="80px" w="100%" borderRadius="lg" />
              <Skeleton h="80px" w="100%" borderRadius="lg" />
            </VStack>
          </CardBody>
        </Card>
      </Box>
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
        
        <HStack spacing="2">
          {!isReadOnly && (
            <Button
              size="sm"
              colorScheme="teal"
              variant="solid"
              onClick={() => setServiceModeOpen(true)}
              leftIcon={<Monitor size={16} />}
              fontWeight="600"
              isDisabled={items.length === 0}
            >
              Service Mode
            </Button>
          )}
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
              <MenuList borderRadius="xl" zIndex={50}>
                <MenuItem onClick={() => setEditing(true)} icon={<Edit size={16} />}>Edit Service</MenuItem>
                <MenuItem onClick={() => generateServicePDF({
                  service: service!,
                  items,
                  assignments,
                  teamMembers,
                  churchName: church?.name || 'Church',
                })} icon={<Printer size={16} />}>Export / Print PDF</MenuItem>
                <MenuItem onClick={handleDuplicateService} icon={<Copy size={16} />}>Duplicate</MenuItem>
                <Divider />
                <MenuItem color="red.500" onClick={deleteDisclosure.onOpen} icon={<Trash2 size={16} />}>Delete</MenuItem>
              </MenuList>
              </Portal>
            </Menu>
          )}
        </HStack>
      </Flex>

      {!loading && service && (
        <>
          {/* Tabs — Two-level navigation */}
          <Card mb="6" bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
            <Tabs onChange={setActiveTab} index={activeTab}>
              {/* Primary tab bar */}
              <Box px={{ base: 3, md: 5 }} pt={4}>
                <Flex
                  gap={1}
                  role="tablist"
                  overflowX="auto"
                  sx={{ '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}
                >
                  <Box
                    as="button"
                    role="tab"
                    onClick={() => { setPrimaryTab(0); setActiveTab(0); }}
                    px={{ base: 3, md: 5 }}
                    py={3}
                    borderRadius="lg"
                    fontSize="sm"
                    fontWeight="700"
                    letterSpacing="tight"
                    transition="all 0.15s"
                    bg={primaryTab === 0 ? 'teal.50' : 'transparent'}
                    color={primaryTab === 0 ? 'teal.700' : subtextColor}
                    _hover={{ bg: primaryTab === 0 ? 'teal.50' : hoverBg, color: primaryTab === 0 ? 'teal.700' : headingColor }}
                    _dark={{
                      bg: primaryTab === 0 ? 'teal.900' : 'transparent',
                      color: primaryTab === 0 ? 'teal.200' : subtextColor,
                      _hover: { bg: primaryTab === 0 ? 'teal.900' : 'whiteAlpha.100', color: primaryTab === 0 ? 'teal.200' : 'whiteAlpha.800' },
                    }}
                    flexShrink={0}
                  >
                    <HStack spacing={2.5}>
                      <CalendarIcon size={18} />
                      <Text>Overview</Text>
                    </HStack>
                  </Box>
                  <Box
                    as="button"
                    role="tab"
                    onClick={() => { setPrimaryTab(1); if (activeTab !== 1 && activeTab !== 3) setActiveTab(1); }}
                    px={{ base: 3, md: 5 }}
                    py={3}
                    borderRadius="lg"
                    fontSize="sm"
                    fontWeight="700"
                    letterSpacing="tight"
                    transition="all 0.15s"
                    bg={primaryTab === 1 ? 'teal.50' : 'transparent'}
                    color={primaryTab === 1 ? 'teal.700' : subtextColor}
                    _hover={{ bg: primaryTab === 1 ? 'teal.50' : hoverBg, color: primaryTab === 1 ? 'teal.700' : headingColor }}
                    _dark={{
                      bg: primaryTab === 1 ? 'teal.900' : 'transparent',
                      color: primaryTab === 1 ? 'teal.200' : subtextColor,
                      _hover: { bg: primaryTab === 1 ? 'teal.900' : 'whiteAlpha.100', color: primaryTab === 1 ? 'teal.200' : 'whiteAlpha.800' },
                    }}
                    flexShrink={0}
                  >
                    <HStack spacing={2.5}>
                      <ListMusic size={18} />
                      <Text>Plan ({items.length})</Text>
                    </HStack>
                  </Box>
                  <Box
                    as="button"
                    role="tab"
                    onClick={() => { setPrimaryTab(2); if (activeTab !== 2 && activeTab !== 4 && activeTab !== 5 && activeTab !== 6) setActiveTab(2); }}
                    px={{ base: 3, md: 5 }}
                    py={3}
                    borderRadius="lg"
                    fontSize="sm"
                    fontWeight="700"
                    letterSpacing="tight"
                    transition="all 0.15s"
                    bg={primaryTab === 2 ? 'teal.50' : 'transparent'}
                    color={primaryTab === 2 ? 'teal.700' : subtextColor}
                    _hover={{ bg: primaryTab === 2 ? 'teal.50' : hoverBg, color: primaryTab === 2 ? 'teal.700' : headingColor }}
                    _dark={{
                      bg: primaryTab === 2 ? 'teal.900' : 'transparent',
                      color: primaryTab === 2 ? 'teal.200' : subtextColor,
                      _hover: { bg: primaryTab === 2 ? 'teal.900' : 'whiteAlpha.100', color: primaryTab === 2 ? 'teal.200' : 'whiteAlpha.800' },
                    }}
                    flexShrink={0}
                  >
                    <HStack spacing={2.5}>
                      <Users size={18} />
                      <Text>Team</Text>
                    </HStack>
                  </Box>
                </Flex>

                {/* Secondary tab bar — Plan */}
                {primaryTab === 1 && (
                  <Flex mt={1} gap={1} role="tablist" borderBottom="1px solid" borderColor={borderColor} px={1}>
                    <Tab
                      flexShrink={0}
                      fontSize="sm"
                      fontWeight="500"
                      pb={3}
                      pt={2}
                      px={3}
                      color={activeTab === 1 ? 'teal.600' : subtextColor}
                      _selected={{ color: 'teal.600', borderBottom: '2px solid', borderBottomColor: 'teal.600' }}
                      _hover={{ color: 'teal.500' }}
                    >
                      <HStack spacing={1.5}>
                        <ListMusic size={14} />
                        <span>Items</span>
                      </HStack>
                    </Tab>
                    <Tab
                      flexShrink={0}
                      fontSize="sm"
                      fontWeight="500"
                      pb={3}
                      pt={2}
                      px={3}
                      color={activeTab === 3 ? 'teal.600' : subtextColor}
                      _selected={{ color: 'teal.600', borderBottom: '2px solid', borderBottomColor: 'teal.600' }}
                      _hover={{ color: 'teal.500' }}
                    >
                      <HStack spacing={1.5}>
                        <ListChecks size={14} />
                        <span>Tasks</span>
                      </HStack>
                    </Tab>
                  </Flex>
                )}

                {/* Secondary tab bar — Team */}
                {primaryTab === 2 && (
                  <Flex mt={1} gap={1} role="tablist" borderBottom="1px solid" borderColor={borderColor} px={1} overflowX="auto" sx={{ '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
                    <Tab
                      flexShrink={0}
                      fontSize="sm"
                      fontWeight="500"
                      pb={3}
                      pt={2}
                      px={3}
                      color={activeTab === 2 ? 'teal.600' : subtextColor}
                      _selected={{ color: 'teal.600', borderBottom: '2px solid', borderBottomColor: 'teal.600' }}
                      _hover={{ color: 'teal.500' }}
                    >
                      <HStack spacing={1.5}>
                        <Users size={14} />
                        <span>Schedule ({assignedCount})</span>
                      </HStack>
                    </Tab>
                    <Tab
                      flexShrink={0}
                      fontSize="sm"
                      fontWeight="500"
                      pb={3}
                      pt={2}
                      px={3}
                      color={activeTab === 4 ? 'teal.600' : subtextColor}
                      _selected={{ color: 'teal.600', borderBottom: '2px solid', borderBottomColor: 'teal.600' }}
                      _hover={{ color: 'teal.500' }}
                    >
                      <HStack spacing={1.5}>
                        <MessageSquare size={14} />
                        <span>Chat</span>
                      </HStack>
                    </Tab>
                    {user && (user.team_member_id || user.role !== 'team') && (
                      <Tab
                        flexShrink={0}
                        fontSize="sm"
                        fontWeight="500"
                        pb={3}
                        pt={2}
                        px={3}
                        color={activeTab === 5 ? 'teal.600' : subtextColor}
                        _selected={{ color: 'teal.600', borderBottom: '2px solid', borderBottomColor: 'teal.600' }}
                        _hover={{ color: 'teal.500' }}
                      >
                        <HStack spacing={1.5}>
                          <CheckSquare size={14} />
                          <span>Rehearsal</span>
                        </HStack>
                      </Tab>
                    )}
                    <Tab
                      flexShrink={0}
                      fontSize="sm"
                      fontWeight="500"
                      pb={3}
                      pt={2}
                      px={3}
                      color={activeTab === 6 ? 'teal.600' : subtextColor}
                      _selected={{ color: 'teal.600', borderBottom: '2px solid', borderBottomColor: 'teal.600' }}
                      _hover={{ color: 'teal.500' }}
                    >
                      <HStack spacing={1.5}>
                        <Star size={14} />
                        <span>Debrief ({debriefEntries.length})</span>
                      </HStack>
                    </Tab>
                  </Flex>
                )}

                {/* Bottom border when there's no secondary bar (Overview) */}
                {primaryTab === 0 && (
                  <Box borderBottom="1px solid" borderColor={borderColor} mt={1} />
                )}
              </Box>

              <TabPanels>
                {/* Overview Tab */}
                <TabPanel p="6">
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
                    <VStack spacing="6" align="stretch">
                      {/* Status + Countdown */}
                      <Flex justify="space-between" align="center" wrap="wrap" gap="2">
                        <HStack spacing="3">
                          <StatusBadge status={service.status} size="md" />
                          <Text fontSize="sm" color={subtextColor} fontWeight="500">
                            {getCountdownText(service.date)}
                          </Text>
                        </HStack>
                      </Flex>

                      {/* Quick Stats Cards */}
                      <SimpleGrid columns={{ base: 2, md: 4 }} spacing="4">
                        <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" boxShadow="none">
                          <CardBody py="3" px="4">
                            <Text fontSize="xs" color={subtextColor} fontWeight="600" textTransform="uppercase" letterSpacing="wide">Plan</Text>
                            <Text fontSize="2xl" fontWeight="bold" color={headingColor} mt="1">{items.length}</Text>
                            <Text fontSize="xs" color={subtextColor}>{items.length === 1 ? 'item' : 'items'}</Text>
                          </CardBody>
                        </Card>
                        <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" boxShadow="none">
                          <CardBody py="3" px="4">
                            <Text fontSize="xs" color={subtextColor} fontWeight="600" textTransform="uppercase" letterSpacing="wide">Songs</Text>
                            <Text fontSize="2xl" fontWeight="bold" color={headingColor} mt="1">{items.filter(i => i.type === 'song').length}</Text>
                            <Text fontSize="xs" color={subtextColor}>of {items.length} {items.length === 1 ? 'item' : 'items'}</Text>
                          </CardBody>
                        </Card>
                        <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" boxShadow="none">
                          <CardBody py="3" px="4">
                            <Text fontSize="xs" color={subtextColor} fontWeight="600" textTransform="uppercase" letterSpacing="wide">Team</Text>
                            <Text fontSize="2xl" fontWeight="bold" color={headingColor} mt="1">{assignments.filter(a => a.status === 'confirmed').length}</Text>
                            <Text fontSize="xs" color={subtextColor}>of {assignments.length} confirmed</Text>
                          </CardBody>
                        </Card>
                        <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" boxShadow="none">
                          <CardBody py="3" px="4">
                            <Text fontSize="xs" color={subtextColor} fontWeight="600" textTransform="uppercase" letterSpacing="wide">Duration</Text>
                            <Text fontSize="2xl" fontWeight="bold" color={headingColor} mt="1">{items.reduce((sum, i) => sum + (i.duration_minutes || 0), 0) || '—'}</Text>
                            <Text fontSize="xs" color={subtextColor}>{items.some(i => i.duration_minutes) ? 'minutes' : 'not set'}</Text>
                          </CardBody>
                        </Card>
                      </SimpleGrid>

                      {/* Schedule Snapshot */}
                      {assignments.length > 0 && (
                        <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" boxShadow="none">
                          <CardBody px="5" py="4">
                            <HStack mb="4" spacing="2">
                              <Users size={16} />
                              <Text fontSize="sm" fontWeight="600" color={headingColor}>Schedule ({assignments.length})</Text>
                              <Text fontSize="xs" color={subtextColor}>·</Text>
                              <Text fontSize="xs" color={subtextColor}>
                                {assignments.filter(a => a.status === 'confirmed').length} confirmed
                                {assignments.some(a => a.status === 'pending') && (
                                  <>, {assignments.filter(a => a.status === 'pending').length} pending</>
                                )}
                                {assignments.some(a => a.status === 'declined') && (
                                  <>, {assignments.filter(a => a.status === 'declined').length} declined</>
                                )}
                              </Text>
                            </HStack>
                            <VStack spacing="2" align="stretch">
                              {assignments.map((a: any) => (
                                <HStack key={a.id} spacing="3" py="1">
                                  <Avatar name={a.team_member?.name || 'Unknown'} src={a.team_member?.avatar_url} size="sm" />
                                  <Box flex="1" minW="0">
                                    <Text fontSize="sm" fontWeight="500" color={headingColor} noOfLines={1}>
                                      {a.team_member?.name || 'Unknown'}
                                    </Text>
                                    <Text fontSize="xs" color={subtextColor}>{a.role}</Text>
                                  </Box>
                                  <StatusBadge status={a.status} size="sm" />
                                </HStack>
                              ))}
                            </VStack>
                          </CardBody>
                        </Card>
                      )}

                      {/* Plan Snapshot */}
                      {items.length > 0 && (
                        <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" boxShadow="none">
                          <CardBody px="5" py="4">
                            <HStack mb="3" spacing="2">
                              <ListMusic size={16} />
                              <Text fontSize="sm" fontWeight="600" color={headingColor}>Service Order ({items.length})</Text>
                            </HStack>
                            <VStack spacing="1" align="stretch">
                              {items.map((item, i) => (
                                <HStack key={item.id} spacing="3" py="1.5" px="2" borderRadius="md" _hover={{ bg: hoverBg }}>
                                  <Text fontSize="xs" fontWeight="600" color="gray.400" w="20px" textAlign="right">{i + 1}.</Text>
                                  <Box
                                    minW="24px" h="24px" borderRadius="md"
                                    bg={item.type === 'song' ? 'teal.100' : 'gray.100'}
                                    display="flex" alignItems="center" justifyContent="center"
                                  >
                                    {item.type === 'song' ? <Music size={12} /> : <AlignLeft size={12} />}
                                  </Box>
                                  <Text fontSize="sm" fontWeight="500" color={itemTitleColor} flex="1" noOfLines={1}>{item.title}</Text>
                                  {item.type === 'song' && item.key && (
                                    <Badge colorScheme="teal" variant="subtle" fontSize="xs" flexShrink={0}>Key: {item.key}</Badge>
                                  )}
                                  {item.duration_minutes && (
                                    <Text fontSize="xs" color="gray.400" flexShrink={0}>{item.duration_minutes} min</Text>
                                  )}
                                </HStack>
                              ))}
                            </VStack>
                          </CardBody>
                        </Card>
                      )}

                      {/* Tasks Progress */}
                      {taskStats !== null && (
                        <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" boxShadow="none">
                          <CardBody px="5" py="4">
                            <HStack mb="3" spacing="2">
                              <CheckSquare size={16} />
                              <Text fontSize="sm" fontWeight="600" color={headingColor}>Tasks</Text>
                            </HStack>
                            {taskStats.total > 0 ? (
                              <>
                                <Progress
                                  value={taskStats.total > 0 ? (taskStats.done / taskStats.total) * 100 : 0}
                                  size="sm"
                                  colorScheme="teal"
                                  borderRadius="full"
                                  bg={borderColor}
                                />
                                <Text fontSize="xs" color={subtextColor} mt="2">{taskStats.done} of {taskStats.total} tasks complete</Text>
                              </>
                            ) : (
                              <Text fontSize="sm" color={subtextColor}>No tasks created</Text>
                            )}
                          </CardBody>
                        </Card>
                      )}

                      {/* Notes */}
                      <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" boxShadow="none">
                        <CardBody px="5" py="4">
                          <HStack mb="2" spacing="2">
                            <BookOpen size={16} />
                            <Text fontSize="sm" fontWeight="600" color={headingColor}>Notes</Text>
                          </HStack>
                          {notes ? (
                            <Text fontSize="sm" color={textColor} whiteSpace="pre-wrap">{notes}</Text>
                          ) : (
                            <Text fontSize="sm" color={emptyColor} fontStyle="italic">No notes added</Text>
                          )}
                        </CardBody>
                      </Card>
                    </VStack>
                  )}
                </TabPanel>

                {/* Plan Tab */}
                <TabPanel p="6">
                  <HStack justify="space-between" align="center" mb="4" flexWrap="wrap" gap="2">
                    <Text fontSize="lg" fontWeight="semibold" color={headingColor}>Service Order</Text>
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
                                  <VStack spacing="0" align="start" flex="1">
                                    <Text fontWeight="600" color={itemTitleColor}>{item.title}</Text>
                                    {item.assigned_to && (
                                      <HStack spacing="1">
                                        <UserCheck size={12} className="text-gray-400" />
                                        <Text fontSize="xs" color="gray.500">{item.assigned_to}</Text>
                                      </HStack>
                                    )}
                                  </VStack>

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
                                          <MenuList borderRadius="xl" zIndex={50}>
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
                </TabPanel>

                {/* Schedule Tab */}
                <TabPanel p="0">
                  {church ? (
                    <ServiceSchedule
                      service={service}
                      churchId={church.id}
                      currentUserId={user?.id || ''}
                      highlightedAssignmentId={highlightedAssignmentId}
                      onAssignmentsChange={async () => {
                        try {
                          const data = await store.assignments.getByService(serviceId, church.id);
                          setAssignments(data);
                        } catch {}
                      }}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-gray-500">Loading...</div>
                    </div>
                  )}
                </TabPanel>

                {/* Tasks Tab */}
                <TabPanel p="0">
                  {church ? (
                    <ServiceTasks
                      serviceId={serviceId}
                      churchId={church.id}
                      currentUserId={user?.id || ''}
                      isReadOnly={isReadOnly}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-gray-500">Loading...</div>
                    </div>
                  )}
                </TabPanel>

                {/* Chat Tab */}
                <TabPanel p="0">
                  {!church ? (
                    <div className="text-center py-12">
                      <div className="text-gray-500">Loading...</div>
                    </div>
                  ) : (
                    <ServiceChat
                      serviceId={serviceId}
                      churchId={church.id}
                      currentUser={user}
                    />
                  )}
                </TabPanel>

                {/* Rehearsal Tab */}
                {user && (user.team_member_id || user.role !== 'team') && (
                  <TabPanel p="0">
                    {church && (
                      <RehearsalTab
                        serviceId={serviceId}
                        churchId={church.id}
                        teamMemberId={user.team_member_id || null}
                        items={items}
                        isLeader={user.role !== 'team'}
                      />
                    )}
                  </TabPanel>
                )}

                {/* Debrief Tab */}
                <TabPanel p="6">
                  {church && (
                    <Box>
                      {/* Current user's debrief status */}
                      {user && (() => {
                        const myEntry = debriefEntries.find(e => e.user_id === user.id);
                        return (
                          <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" mb="6">
                            <CardBody>
                              <HStack justify="space-between" align="center" flexWrap="wrap" gap="3">
                                <Box>
                                  <Text fontSize="md" fontWeight="600" color={headingColor}>
                                    {myEntry ? 'Your Debrief' : 'Post-Service Debrief'}
                                  </Text>
                                  <Text fontSize="sm" color={subtextColor}>
                                    {myEntry
                                      ? `Submitted ${new Date(myEntry.created_at).toLocaleDateString()}`
                                      : 'Reflect on today\'s service — what worked, what didn\'t, and where you saw God.'}
                                  </Text>
                                </Box>
                                <Button
                                  size="sm"
                                  colorScheme="teal"
                                  onClick={() => setShowDebriefForm(true)}
                                  leftIcon={myEntry ? <Edit size={14} /> : <Star size={14} />}
                                  fontWeight="600"
                                >
                                  {myEntry ? 'Edit Debrief' : 'Submit Debrief'}
                                </Button>
                              </HStack>

                              {/* Show my entry summary if it exists */}
                              {myEntry && (
                                <VStack spacing="3" align="stretch" mt="4" pt="4" borderTop="1px solid" borderColor={borderColor}>
                                  <HStack spacing="4">
                                    {[
                                      { label: 'Engagement', value: myEntry.rating_engagement },
                                      { label: 'Flow', value: myEntry.rating_flow },
                                      { label: 'Tech', value: myEntry.rating_tech },
                                    ].map(r => (
                                      <Box key={r.label} textAlign="center">
                                        <Text fontSize="xs" color={subtextColor} fontWeight="600">{r.label}</Text>
                                        <HStack spacing="0.5" mt="1" justify="center">
                                          {Array.from({ length: r.value }).map((_, i) => (
                                            <Star key={i} size={14} fill="var(--chakra-colors-yellow-400)" color="var(--chakra-colors-yellow-400)" />
                                          ))}
                                        </HStack>
                                      </Box>
                                    ))}
                                  </HStack>
                                  {myEntry.what_went_well && (
                                    <Box>
                                      <Text fontSize="xs" fontWeight="600" color="green.500">What went well</Text>
                                      <Text fontSize="sm" color={textColor} noOfLines={3}>{myEntry.what_went_well}</Text>
                                    </Box>
                                  )}
                                </VStack>
                              )}
                            </CardBody>
                          </Card>
                        );
                      })()}

                      {/* All team entries (anyone can see) */}
                      {debriefEntries.length > 0 && (
                        <Box>
                          <Text fontSize="sm" fontWeight="600" color={headingColor} mb="3">
                            Team Debriefs ({debriefEntries.length})
                          </Text>
                          <VStack spacing="3" align="stretch">
                            {debriefEntries.map((entry) => (
                              <Card key={entry.id} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" boxShadow="none">
                                <CardBody px="4" py="3">
                                  <HStack spacing="3" mb="2">
                                    <Avatar name={entry.user?.name || 'Unknown'} src={entry.user?.avatar_url} size="sm" />
                                    <Box flex="1">
                                      <Text fontSize="sm" fontWeight="600" color={headingColor}>
                                        {entry.user?.name || 'Unknown'}
                                      </Text>
                                      <Text fontSize="xs" color={subtextColor}>
                                        {new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </Text>
                                    </Box>
                                    <HStack spacing="3">
                                      {[
                                        { label: 'E', value: entry.rating_engagement },
                                        { label: 'F', value: entry.rating_flow },
                                        { label: 'T', value: entry.rating_tech },
                                      ].map(r => (
                                        <Box key={r.label} textAlign="center">
                                          <Text fontSize="xs" fontWeight="bold" color={subtextColor}>{r.label}</Text>
                                          <Text fontSize="sm" fontWeight="700" color={headingColor}>{r.value}</Text>
                                        </Box>
                                      ))}
                                    </HStack>
                                  </HStack>
                                  <VStack spacing="2" align="stretch" ml="44px">
                                    {entry.what_went_well && (
                                      <Text fontSize="sm" color={textColor} noOfLines={2}>
                                        <Text as="span" fontWeight="600" color="green.500">✓ </Text>{entry.what_went_well}
                                      </Text>
                                    )}
                                    {entry.what_broke && (
                                      <Text fontSize="sm" color={textColor} noOfLines={2}>
                                        <Text as="span" fontWeight="600" color="orange.500">⚠ </Text>{entry.what_broke}
                                      </Text>
                                    )}
                                    {entry.what_to_change && (
                                      <Text fontSize="sm" color={textColor} noOfLines={2}>
                                        <Text as="span" fontWeight="600" color="blue.500">↻ </Text>{entry.what_to_change}
                                      </Text>
                                    )}
                                    {entry.saw_god_working && (
                                      <Text fontSize="sm" color={textColor} noOfLines={2}>
                                        <Text as="span" fontWeight="600" color="purple.500">♥ </Text>{entry.saw_god_working}
                                      </Text>
                                    )}
                                  </VStack>
                                </CardBody>
                              </Card>
                            ))}
                          </VStack>
                        </Box>
                      )}

                      {/* Empty state if no debriefs */}
                      {debriefEntries.length === 0 && (
                        <Box textAlign="center" py="10">
                          <Star size={40} style={{ margin: '0 auto', opacity: 0.3 }} />
                          <Text mt="3" fontSize="md" color={subtextColor}>No debriefs submitted yet</Text>
                          <Text fontSize="sm" color={subtextColor} mt="1">
                            Team members will be prompted to submit after the service is marked completed.
                          </Text>
                        </Box>
                      )}
                    </Box>
                  )}
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Card>

          {/* Notify Team Section - Show on all tabs */}
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

      {/* Service Mode (Live Dashboard) */}
      {service && church && (
        <ServiceMode
          service={service}
          items={items}
          isOpen={serviceModeOpen}
          onClose={async (timingData?: Array<{ itemId: string; actualSeconds: number }>) => {
            setServiceModeOpen(false);
            // Persist timing data if provided
            if (timingData && timingData.length > 0 && church) {
              try {
                await Promise.all(
                  timingData.map(td =>
                    store.serviceItems.update(td.itemId, church.id, { actual_duration_seconds: td.actualSeconds })
                  )
                );
              } catch (e) {
                console.error('[Timing] Failed to save timing data:', e);
              }
            }
          }}
        />
      )}

      {/* Debrief Form Modal */}
      {service && church && user && (
        <ServiceDebriefForm
          service={service}
          items={items}
          existingEntry={debriefEntries.find(e => e.user_id === user.id) ?? null}
          isOpen={showDebriefForm}
          onClose={() => setShowDebriefForm(false)}
          onSubmitted={async () => {
            const entries = await store.debriefs.getByService(serviceId, church.id);
            setDebriefEntries(entries);
          }}
        />
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
              
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Assigned To</FormLabel>
                <Input 
                  list="team-members-datalist"
                  value={itemAssignedTo} 
                  onChange={(e) => setItemAssignedTo(e.target.value)}
                  placeholder="Type any name or select from team"
                  borderRadius="lg"
                />
                <datalist id="team-members-datalist">
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.name} />
                  ))}
                </datalist>
                <Text fontSize="xs" color="gray.500" mt="1">Type any name (team members, guests, or roles)</Text>
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