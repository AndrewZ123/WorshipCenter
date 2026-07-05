'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Heading, HStack, Button, VStack, Text, Input, Flex,
  FormControl, FormLabel, Card, CardBody, useToast, IconButton,
  Badge, useColorModeValue, Spinner, Center, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter,
  Select, Textarea, useDisclosure, Tabs, TabList, TabPanels, Tab, TabPanel,
  Divider, Checkbox, Tag, TagLabel, Progress,
} from '@chakra-ui/react';
import { useDemo } from '@/lib/demo/context';
import type { Service, ServiceItem, TeamMember, ServiceAssignment, ServiceStatus, Song } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';
import { formatShortDate, formatRelativeDate } from '@/lib/formatDate';
import {
  ArrowLeft, Trash2, Copy, Calendar, Clock, Users, ListMusic, MessageCircle,
  CheckSquare, Star, Music, CheckCheck, Send, ChevronUp, ChevronDown
} from 'lucide-react';

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

export default function DemoServiceDetailClient() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const {
    church, user, services, serviceItems, assignments, teamMembers, songs,
    tasks, rehearsalLogs, chatMessages, debriefs,
    updateService, deleteService, duplicateService, createServiceItem,
    updateServiceItem, deleteServiceItem, reorderServiceItems,
    createAssignment, updateAssignment, deleteAssignment,
    createTask, updateTask, deleteTask, toggleTask,
    markRehearsed, markAllRehearsed, getRehearsalStats,
    upsertDebrief, getDebriefByService, createChatMessage,
  } = useDemo();
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
  const [activeTab, setActiveTab] = useState(0);

  const editItemModal = useDisclosure();
  const [editingItem, setEditingItem] = useState<ServiceItem | null>(null);
  const assignModal = useDisclosure();
  const [assignMemberId, setAssignMemberId] = useState('');
  const [assignRole, setAssignRole] = useState<string>('');
  const [itemTitle, setItemTitle] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [itemDuration, setItemDuration] = useState('');
  const [itemKey, setItemKey] = useState('');
  const [itemSongId, setItemSongId] = useState<string | null>(null);

  // Chat state
  const [chatInput, setChatInput] = useState('');

  // Debrief state
  const [debriefRatingEng, setDebriefRatingEng] = useState(0);
  const [debriefRatingFlow, setDebriefRatingFlow] = useState(0);
  const [debriefRatingTech, setDebriefRatingTech] = useState(0);
  const [debriefWentWell, setDebriefWentWell] = useState('');
  const [debriefBroke, setDebriefBroke] = useState('');
  const [debriefChange, setDebriefChange] = useState('');
  const [debriefGod, setDebriefGod] = useState('');

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const itemBg = useColorModeValue('gray.50', 'gray.700');
  const headingColor = useColorModeValue('gray.800', 'white');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const emptyColor = useColorModeValue('gray.400', 'gray.500');
  const itemTitleColor = useColorModeValue('gray.800', 'white');

  const STATUS_COLORS: Record<string, string> = { draft: 'gray', finalized: 'blue', completed: 'green' };
  const ASSIGNMENT_STATUS_COLORS: Record<string, string> = { pending: 'teal', confirmed: 'green', declined: 'red' };
  const roleLabel = (r: string) => r.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const ROLES = [
    { value: 'worship_leader', label: 'Worship Leader' }, { value: 'lead_vocalist', label: 'Lead Vocalist' },
    { value: 'background_vocalist', label: 'Background Vocalist' }, { value: 'acoustic_guitar', label: 'Acoustic Guitar' },
    { value: 'electric_guitar', label: 'Electric Guitar' }, { value: 'bass_guitar', label: 'Bass Guitar' },
    { value: 'drums', label: 'Drums' }, { value: 'keyboard', label: 'Keyboard/Piano' },
    { value: 'sound_tech', label: 'Sound Tech' }, { value: 'media_tech', label: 'Media Tech' },
  ];

  useEffect(() => { loadData(); }, [serviceId, services, serviceItems, assignments]);

  const loadData = useCallback(() => {
    const svc = services.find(s => s.id === serviceId);
    if (svc) {
      setService(svc);
      setTitle(svc.title); setDate(svc.date); setTime(svc.time);
      setStatus(svc.status); setNotes(svc.notes);
    } else { router.push('/demo/services'); return; }
    setItems(serviceItems.filter(si => si.service_id === serviceId).sort((a, b) => a.position - b.position));
    setServiceAssignments(assignments.filter(a => a.service_id === serviceId));
    setLoading(false);
  }, [serviceId, services, serviceItems, assignments, router]);

  const handleSave = () => { updateService(serviceId, { title, date, time, status, notes }); setEditing(false); loadData(); toast({ title: 'Service updated', status: 'success', duration: 2000 }); };
  const handleDelete = () => { deleteService(serviceId); router.push('/demo/services'); toast({ title: 'Service deleted', status: 'info', duration: 2000 }); };
  const handleDeleteItem = (itemId: string) => { deleteServiceItem(itemId); loadData(); toast({ title: 'Item removed', status: 'info', duration: 2000 }); };

  const handleReorderItem = (itemId: string, direction: 'up' | 'down') => {
    const idx = items.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= items.length) return;
    const newItems = [...items];
    [newItems[idx], newItems[newIdx]] = [newItems[newIdx], newItems[idx]];
    setItems(newItems);
    newItems.forEach((item, i) => updateServiceItem(item.id, { position: i }));
    toast({ title: 'Order updated', status: 'success', duration: 1500 });
  };

  const handleDuplicateService = () => {
    const today = new Date().toISOString().split('T')[0];
    const ns = duplicateService(serviceId, today);
    if (ns) router.push(`/demo/services/${ns.id}`);
    else toast({ title: 'Error duplicating service', status: 'error', duration: 3000 });
  };

  const openEditItem = (item: ServiceItem) => {
    setEditingItem(item); setItemTitle(item.title); setItemNotes(item.notes || '');
    setItemDuration(item.duration_minutes?.toString() || ''); setItemKey(item.key || '');
    setItemSongId(item.song_id || null); editItemModal.onOpen();
  };

  const handleSaveItem = () => {
    if (!editingItem) return;
    let newTitle = itemTitle;
    if (editingItem.type === 'song' && itemSongId) {
      const ss = songs.find(s => s.id === itemSongId);
      if (ss) newTitle = ss.title;
    }
    updateServiceItem(editingItem.id, {
      title: newTitle, notes: itemNotes || undefined,
      duration_minutes: itemDuration ? parseInt(itemDuration) : undefined,
      key: itemKey || undefined,
      song_id: editingItem.type === 'song' ? (itemSongId || undefined) : undefined,
    });
    editItemModal.onClose(); loadData(); toast({ title: 'Item updated', status: 'success', duration: 2000 });
  };

  const handleAssignTeamMember = () => {
    if (!assignMemberId || !assignRole) return;
    createAssignment({ service_id: serviceId, team_member_id: assignMemberId, role: assignRole, status: 'pending' });
    assignModal.onClose(); setAssignMemberId(''); setAssignRole(''); loadData();
    toast({ title: 'Team member assigned', status: 'success', duration: 2000 });
  };

  const updateAssignmentStatus = (id: string, status: ServiceAssignment['status']) => {
    updateAssignment(id, { status }); loadData(); toast({ title: 'Status updated', status: 'success', duration: 2000 });
  };

  // Service tasks
  const serviceTasks = useMemo(() => tasks.filter(t => t.service_id === serviceId).sort((a, b) => a.position - b.position), [tasks, serviceId]);
  const serviceSongItems = useMemo(() => items.filter(i => i.type === 'song' && i.song_id), [items]);
  const rehearsalStats = useMemo(() => getRehearsalStats(serviceId), [serviceId, rehearsalLogs]);

  // Chat messages for this service
  const serviceChatMessages = useMemo(() => chatMessages.filter(m => m.church_id === church?.id), [chatMessages, church]);

  // Debrief
  const existingDebrief = useMemo(() => getDebriefByService(serviceId), [serviceId, debriefs]);

  const handleSendChat = () => {
    if (!chatInput.trim() || !user?.id || !church?.id) return;
    createChatMessage({ church_id: church.id, user_id: user.id, content: chatInput.trim() });
    setChatInput('');
  };

  const handleSubmitDebrief = () => {
    if (!church || !user) return;
    upsertDebrief({
      service_id: serviceId, user_id: user.id, church_id: church.id,
      rating_engagement: debriefRatingEng || existingDebrief?.rating_engagement || 3,
      rating_flow: debriefRatingFlow || existingDebrief?.rating_flow || 3,
      rating_tech: debriefRatingTech || existingDebrief?.rating_tech || 3,
      what_went_well: debriefWentWell || existingDebrief?.what_went_well || '',
      what_broke: debriefBroke || existingDebrief?.what_broke || '',
      what_to_change: debriefChange || existingDebrief?.what_to_change || '',
      saw_god_working: debriefGod || existingDebrief?.saw_god_working || '',
      timing_data: [],
    });
    toast({ title: 'Debrief saved!', status: 'success', duration: 2000 });
  };

  const handleToggleTask = (taskId: string) => {
    toggleTask(taskId, user?.id || '');
    loadData();
  };

  const handleMarkRehearsed = (songId: string, rehearsed: boolean) => {
    const userTeamMember = teamMembers.find(tm => tm.user_id === user?.id || tm.name === user?.name);
    if (userTeamMember) {
      markRehearsed(serviceId, userTeamMember.id, songId, rehearsed);
      loadData();
    }
  };

  if (loading) return <Center minH="50vh"><Spinner size="xl" color="teal.500" /></Center>;
  if (!service) return null;

  const isCompleted = service.status === 'completed';

  return (
    <Box px={{ base: '4', md: '8' }} pt={{ base: '2', md: '8' }} pb={{ base: '4', md: '8' }} maxW="1100px" mx="auto">
      {/* Header */}
      <Flex mb="4" gap="3" align="flex-start" direction={{ base: 'column', md: 'row' }}>
        <HStack spacing="3" w={{ base: 'full', md: 'auto' }}>
          <IconButton aria-label="Back" icon={<ArrowLeft size={20} />} variant="ghost" onClick={() => router.push('/demo/services')} minW="44px" />
          <Box flex="1">
            <Heading size="lg" fontWeight="700" color={headingColor}>{service.title}</Heading>
            <HStack spacing="2" mt="1">
              <Clock size={14} color={subtextColor} />
              <Text fontSize="sm" color={subtextColor}>{formatDate(service.date)} · {service.time}</Text>
              <Badge colorScheme={STATUS_COLORS[service.status]} variant="subtle" fontSize="xs">{service.status}</Badge>
            </HStack>
          </Box>
        </HStack>
        <HStack spacing="2">
          <Button size="sm" variant="outline" leftIcon={<Copy size={14} />} onClick={handleDuplicateService}>Duplicate</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit'}</Button>
          <Button size="sm" variant="ghost" colorScheme="red" onClick={handleDelete}>Delete</Button>
        </HStack>
      </Flex>

      {/* Edit panel */}
      {editing && (
        <Card mb="4" bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor}>
          <CardBody>
            <VStack spacing="4" align="stretch">
              <HStack spacing="4">
                <FormControl><FormLabel fontWeight="600" fontSize="sm">Title</FormLabel><Input value={title} onChange={e => setTitle(e.target.value)} size="sm" /></FormControl>
                <FormControl><FormLabel fontWeight="600" fontSize="sm">Status</FormLabel><Select value={status} onChange={e => setStatus(e.target.value as ServiceStatus)} size="sm"><option value="draft">Draft</option><option value="finalized">Finalized</option><option value="completed">Completed</option></Select></FormControl>
              </HStack>
              <HStack spacing="4">
                <FormControl><FormLabel fontWeight="600" fontSize="sm">Date</FormLabel><Input type="date" value={date} onChange={e => setDate(e.target.value)} size="sm" /></FormControl>
                <FormControl><FormLabel fontWeight="600" fontSize="sm">Time</FormLabel><Input type="time" value={time} onChange={e => setTime(e.target.value)} size="sm" /></FormControl>
              </HStack>
              <FormControl><FormLabel fontWeight="600" fontSize="sm">Notes</FormLabel><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." size="sm" /></FormControl>
              <Button size="sm" colorScheme="teal" onClick={handleSave}>Save Changes</Button>
            </VStack>
          </CardBody>
        </Card>
      )}

      {/* Tabs */}
      <Card bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} boxShadow="0 1px 3px rgba(0,0,0,0.06)">
        <Box px={{ base: 3, md: 5 }} pt={4}>
          <Flex gap={1} role="tablist" overflowX="auto" sx={{ '&::-webkit-scrollbar': { display: 'none' } }}>
            <TabButton icon={<ListMusic size={16} />} label={`Plan (${items.length})`} active={activeTab === 0} onClick={() => setActiveTab(0)} />
            <TabButton icon={<Users size={16} />} label={`People (${serviceAssignments.length})`} active={activeTab === 1} onClick={() => setActiveTab(1)} />
            <TabButton icon={<CheckSquare size={16} />} label={`Tasks (${serviceTasks.length})`} active={activeTab === 2} onClick={() => setActiveTab(2)} />
            <TabButton icon={<Music size={16} />} label="Rehearsal" active={activeTab === 3} onClick={() => setActiveTab(3)} />
            <TabButton icon={<MessageCircle size={16} />} label="Chat" active={activeTab === 4} onClick={() => setActiveTab(4)} />
            <TabButton icon={<Star size={16} />} label="Debrief" active={activeTab === 5} onClick={() => setActiveTab(5)} />
          </Flex>
        </Box>
        <Divider mt={3} />

        {/* Tab Panels */}
        {activeTab === 0 && (
          <Box p={{ base: 4, md: 6 }}>
            <Flex justify="space-between" align="center" mb="4" flexWrap="wrap" gap="2">
              <Text fontWeight="600" fontSize="sm" color={subtextColor}>Service Order ({items.length} items)</Text>
              <HStack spacing="2">
                <Button size="xs" variant="outline" onClick={() => {
                  const lastPos = items.length;
                  createServiceItem({ service_id: serviceId, type: 'song', position: lastPos, title: 'New Song', song_id: null, notes: '', duration_minutes: 5, key: null });
                  loadData(); toast({ title: 'Song slot added', status: 'success', duration: 1500 });
                }}>+ Song</Button>
                <Button size="xs" variant="outline" onClick={() => {
                  const lastPos = items.length;
                  createServiceItem({ service_id: serviceId, type: 'segment', position: lastPos, title: 'New Segment', song_id: null, notes: '', duration_minutes: null, key: null });
                  loadData(); toast({ title: 'Segment added', status: 'success', duration: 1500 });
                }}>+ Segment</Button>
              </HStack>
            </Flex>
            {items.length === 0 ? (
              <Box textAlign="center" py="8" color={emptyColor} bg={itemBg} borderRadius="xl" border="1px dashed" borderColor={borderColor}>
                <Text>No items yet. Add songs and segments to build your service.</Text>
              </Box>
            ) : (
              <VStack spacing="2" align="stretch">
                {items.map((item, i) => (
                  <Box key={item.id} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" px={{ base: '3', md: '4' }} py="3" _hover={{ shadow: 'sm' }} transition="all 0.15s">
                    <HStack spacing="3">
                      <Box minW="28px" h="28px" borderRadius="full" bg={itemBg} display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
                        <Text fontSize="sm" fontWeight="600" color="gray.500">{i + 1}</Text>
                      </Box>
                      <Text fontWeight="600" flex="1" wordBreak="break-word" color={itemTitleColor}>{item.title}</Text>
                      <Badge variant="outline" colorScheme={item.type === 'song' ? 'teal' : 'gray'} fontSize="xs" flexShrink={0}>{item.type}</Badge>
                      {item.type === 'song' && item.key && <Text fontSize="xs" color="gray.500">Key: {item.key}</Text>}
                      <IconButton aria-label="Move up" icon={<ChevronUp size={14} />} size="sm" variant="ghost" isDisabled={i === 0} onClick={() => handleReorderItem(item.id, 'up')} />
                      <IconButton aria-label="Move down" icon={<ChevronDown size={14} />} size="sm" variant="ghost" isDisabled={i === items.length - 1} onClick={() => handleReorderItem(item.id, 'down')} />
                      <IconButton aria-label="Edit" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>} size="sm" variant="ghost" colorScheme="teal" onClick={() => openEditItem(item)} />
                      <IconButton aria-label="Delete" icon={<Trash2 size={14} />} size="sm" variant="ghost" colorScheme="red" onClick={() => handleDeleteItem(item.id)} />
                    </HStack>
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
        )}

        {activeTab === 1 && (
          <Box p={{ base: 4, md: 6 }}>
            <Flex justify="space-between" align="center" mb="4">
              <Text fontWeight="600" fontSize="sm" color={subtextColor}>Team Assignments ({serviceAssignments.length})</Text>
              <Button size="xs" variant="outline" onClick={assignModal.onOpen}>+ Assign</Button>
            </Flex>
            {serviceAssignments.length === 0 ? (
              <Box textAlign="center" py="8" color={emptyColor}><Text>No team members assigned yet.</Text></Box>
            ) : (
              <VStack spacing="2" align="stretch">
                {serviceAssignments.map(a => {
                  const member = teamMembers.find(m => m.id === a.team_member_id);
                  return (
                    <Box key={a.id} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" px="4" py="3">
                      <HStack spacing="3">
                        <Avatar name={member?.name || 'Unknown'} size="sm" />
                        <Text fontWeight="600" flex="1" color={itemTitleColor}>{member?.name || 'Unknown'}</Text>
                        <Badge variant="outline" colorScheme="teal" fontSize="xs">{roleLabel(a.role)}</Badge>
                        <Badge variant="solid" colorScheme={ASSIGNMENT_STATUS_COLORS[a.status] || 'gray'} fontSize="xs">{a.status}</Badge>
                        {a.status === 'pending' && (
                          <>
                            <Button size="xs" colorScheme="green" onClick={() => updateAssignmentStatus(a.id, 'confirmed')}>Confirm</Button>
                            <Button size="xs" variant="outline" colorScheme="red" onClick={() => updateAssignmentStatus(a.id, 'declined')}>Decline</Button>
                          </>
                        )}
                        {a.status === 'confirmed' && <Button size="xs" variant="outline" onClick={() => updateAssignmentStatus(a.id, 'pending')}>Set Pending</Button>}
                        {a.status === 'declined' && <Button size="xs" variant="outline" onClick={() => updateAssignmentStatus(a.id, 'pending')}>Reinvite</Button>}
                        <IconButton aria-label="Remove" icon={<Trash2 size={14} />} size="sm" variant="ghost" colorScheme="red" onClick={() => { deleteAssignment(a.id); loadData(); }} />
                      </HStack>
                    </Box>
                  );
                })}
              </VStack>
            )}
          </Box>
        )}

        {activeTab === 2 && (
          <Box p={{ base: 4, md: 6 }}>
            <Flex justify="space-between" align="center" mb="4">
              <Text fontWeight="600" fontSize="sm" color={subtextColor}>Tasks ({serviceTasks.filter(t => t.status !== 'done').length} remaining)</Text>
            </Flex>
            {serviceTasks.length === 0 ? (
              <Box textAlign="center" py="8" color={emptyColor}>
                <Text>No tasks for this service.</Text>
              </Box>
            ) : (
              <VStack spacing="2" align="stretch">
                {serviceTasks.map(task => (
                  <Box key={task.id} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" px="4" py="3">
                    <HStack spacing="3">
                      <Checkbox isChecked={task.status === 'done'} onChange={() => handleToggleTask(task.id)} colorScheme="teal" />
                      <Box flex="1">
                        <Text fontWeight="600" fontSize="sm" color={task.status === 'done' ? subtextColor : headingColor} textDecoration={task.status === 'done' ? 'line-through' : 'none'}>{task.title}</Text>
                        {task.notes && <Text fontSize="xs" color={subtextColor}>{task.notes}</Text>}
                      </Box>
                      {task.assigned_role && <Badge colorScheme="teal" variant="subtle" fontSize="xs">{task.assigned_role}</Badge>}
                      {task.priority === 'urgent' && <Badge colorScheme="red" variant="subtle" fontSize="xs">Urgent</Badge>}
                    </HStack>
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
        )}

        {activeTab === 3 && (
          <Box p={{ base: 4, md: 6 }}>
            <Flex justify="space-between" align="center" mb="4">
              <Text fontWeight="600" fontSize="sm" color={subtextColor}>Rehearsal Progress</Text>
            </Flex>
            {serviceSongItems.length === 0 ? (
              <Box textAlign="center" py="8" color={emptyColor}><Text>No songs in this service to rehearse.</Text></Box>
            ) : (
              <VStack spacing="4" align="stretch">
                {rehearsalStats.map(stat => (
                  <Box key={stat.team_member_id} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" px="4" py="3">
                    <HStack justify="space-between" mb="2">
                      <Text fontWeight="600" fontSize="sm" color={headingColor}>{stat.member_name}</Text>
                      <Tag size="sm" colorScheme={stat.rehearsed_count === stat.total_songs ? 'green' : 'orange'} borderRadius="full">
                        <TagLabel>{stat.rehearsed_count}/{stat.total_songs}</TagLabel>
                      </Tag>
                    </HStack>
                    <Progress value={(stat.rehearsed_count / stat.total_songs) * 100} size="sm" colorScheme={stat.rehearsed_count === stat.total_songs ? 'green' : 'orange'} borderRadius="full" />
                  </Box>
                ))}
                {rehearsalStats.length === 0 && serviceAssignments.map(a => {
                  const member = teamMembers.find(m => m.id === a.team_member_id);
                  const memberLogs = rehearsalLogs.filter(l => l.service_id === serviceId && l.team_member_id === a.team_member_id);
                  const rehearsedCount = memberLogs.filter(l => l.rehearsed).length;
                  return (
                    <Box key={a.id} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" px="4" py="3">
                      <HStack justify="space-between" mb="2">
                        <Text fontWeight="600" fontSize="sm" color={headingColor}>{member?.name || 'Unknown'}</Text>
                        <Tag size="sm" colorScheme={rehearsedCount === serviceSongItems.length ? 'green' : 'orange'} borderRadius="full">
                          <TagLabel>{rehearsedCount}/{serviceSongItems.length}</TagLabel>
                        </Tag>
                      </HStack>
                      <Progress value={serviceSongItems.length > 0 ? (rehearsedCount / serviceSongItems.length) * 100 : 0} size="sm" colorScheme={rehearsedCount === serviceSongItems.length ? 'green' : 'orange'} borderRadius="full" />
                      <VStack spacing="1" mt="3" align="stretch">
                        {serviceSongItems.map(si => {
                          const log = memberLogs.find(l => l.song_id === si.song_id);
                          const isRehearsed = log?.rehearsed || false;
                          const song = songs.find(s => s.id === si.song_id);
                          return (
                            <HStack key={si.id} spacing="2">
                              <Checkbox isChecked={isRehearsed} onChange={() => markRehearsed(serviceId, a.team_member_id, si.song_id!, !isRehearsed)} colorScheme="teal" size="sm" />
                              <Text fontSize="sm" color={textColor}>{song?.title || si.title}</Text>
                            </HStack>
                          );
                        })}
                      </VStack>
                    </Box>
                  );
                })}
              </VStack>
            )}
          </Box>
        )}

        {activeTab === 4 && (
          <Box p={{ base: 4, md: 6 }}>
            <Text fontWeight="600" fontSize="sm" color={subtextColor} mb="4">Service Discussion</Text>
            <VStack spacing="3" align="stretch" maxH="400px" overflowY="auto" mb="4">
              {serviceChatMessages.length === 0 ? (
                <Text textAlign="center" color={emptyColor} py="4">No messages yet.</Text>
              ) : (
                serviceChatMessages.map(msg => {
                  const isOwn = msg.user_id === user?.id;
                  return (
                    <Flex key={msg.id} justify={isOwn ? 'flex-end' : 'flex-start'}>
                      <Box maxW="75%" bg={isOwn ? 'teal.500' : itemBg} color={isOwn ? 'white' : textColor} borderRadius="lg" px="4" py="2">
                        {!isOwn && <Text fontSize="xs" fontWeight="600" mb="1">{msg.user?.name || 'Unknown'}</Text>}
                        <Text fontSize="sm">{msg.content}</Text>
                        <Text fontSize="10px" color={isOwn ? 'whiteAlpha.600' : subtextColor} textAlign="right" mt="1">{formatRelativeDate(msg.created_at)}</Text>
                      </Box>
                    </Flex>
                  );
                })
              )}
            </VStack>
            <HStack spacing="2">
              <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message..." size="sm" borderRadius="lg" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }} />
              <IconButton aria-label="Send" icon={<Send size={16} />} size="sm" colorScheme="teal" isDisabled={!chatInput.trim()} onClick={handleSendChat} />
            </HStack>
          </Box>
        )}

        {activeTab === 5 && (
          <Box p={{ base: 4, md: 6 }}>
            <Text fontWeight="600" fontSize="sm" color={subtextColor} mb="4">
              {existingDebrief ? 'Edit Debrief' : 'Submit Debrief'}
            </Text>
            {!isCompleted ? (
              <Box textAlign="center" py="8" color={emptyColor}>
                <Text>Debriefs can be submitted after the service is marked as completed.</Text>
              </Box>
            ) : (
              <VStack spacing="4" align="stretch">
                <Text fontWeight="600" fontSize="sm" color={headingColor}>Ratings</Text>
                <HStack spacing="4">
                  {[
                    { label: 'Engagement', val: debriefRatingEng || existingDebrief?.rating_engagement || 3, set: setDebriefRatingEng },
                    { label: 'Flow', val: debriefRatingFlow || existingDebrief?.rating_flow || 3, set: setDebriefRatingFlow },
                    { label: 'Technical', val: debriefRatingTech || existingDebrief?.rating_tech || 3, set: setDebriefRatingTech },
                  ].map(r => (
                    <Box key={r.label} textAlign="center">
                      <Text fontSize="xs" color={subtextColor} mb="1">{r.label}</Text>
                      <HStack spacing="1">
                        {[1, 2, 3, 4, 5].map(v => (
                          <Star key={v} size={18} fill={v <= r.val ? 'var(--chakra-colors-yellow-400)' : 'none'} color={v <= r.val ? 'var(--chakra-colors-yellow-400)' : 'gray.300'} style={{ cursor: 'pointer' }} onClick={() => r.set(v)} />
                        ))}
                      </HStack>
                    </Box>
                  ))}
                </HStack>
                <FormControl><FormLabel fontWeight="600" fontSize="sm">What went well</FormLabel><Textarea value={debriefWentWell || existingDebrief?.what_went_well || ''} onChange={e => setDebriefWentWell(e.target.value)} placeholder="What went well this service?" size="sm" /></FormControl>
                <FormControl><FormLabel fontWeight="600" fontSize="sm">What broke</FormLabel><Textarea value={debriefBroke || existingDebrief?.what_broke || ''} onChange={e => setDebriefBroke(e.target.value)} placeholder="What could be improved?" size="sm" /></FormControl>
                <FormControl><FormLabel fontWeight="600" fontSize="sm">What to change</FormLabel><Textarea value={debriefChange || existingDebrief?.what_to_change || ''} onChange={e => setDebriefChange(e.target.value)} placeholder="What would you change for next time?" size="sm" /></FormControl>
                <Button size="sm" colorScheme="teal" onClick={handleSubmitDebrief}>
                  {existingDebrief ? 'Update Debrief' : 'Submit Debrief'}
                </Button>
              </VStack>
            )}
          </Box>
        )}
      </Card>

      {/* Edit Item Modal */}
      <Modal isOpen={editItemModal.isOpen} onClose={editItemModal.onClose} isCentered size="md">
        <ModalOverlay /><ModalContent borderRadius="xl" mx="4">
          <ModalHeader fontWeight="700">Edit {editingItem?.type === 'song' ? 'Song' : 'Segment'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              {editingItem?.type === 'song' && (
                <FormControl><FormLabel fontWeight="600">Change Song</FormLabel>
                  <Select value={itemSongId || ''} onChange={e => setItemSongId(e.target.value || null)} placeholder="Select a song">
                    {songs.map(s => <option key={s.id} value={s.id}>{s.title} {s.artist ? `- ${s.artist}` : ''}</option>)}
                  </Select>
                </FormControl>
              )}
              {editingItem?.type === 'segment' && (
                <FormControl isRequired><FormLabel fontWeight="600">Title</FormLabel><Input value={itemTitle} onChange={e => setItemTitle(e.target.value)} placeholder="e.g., Announcements, Sermon" /></FormControl>
              )}
              <FormControl><FormLabel fontWeight="600">Key</FormLabel>
                <Select value={itemKey} onChange={e => setItemKey(e.target.value)} placeholder="Select key">
                  {['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'].map(k => <option key={k} value={k}>{k}</option>)}
                </Select>
              </FormControl>
              <FormControl><FormLabel fontWeight="600">Duration (min)</FormLabel><Input type="number" value={itemDuration} onChange={e => setItemDuration(e.target.value)} placeholder="e.g., 5" /></FormControl>
              <FormControl><FormLabel fontWeight="600">Notes</FormLabel><Textarea value={itemNotes} onChange={e => setItemNotes(e.target.value)} placeholder="Any additional notes..." rows={3} /></FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr="3" onClick={editItemModal.onClose}>Cancel</Button><Button onClick={handleSaveItem}>Save</Button></ModalFooter>
        </ModalContent>
      </Modal>

      {/* Assign Team Member Modal */}
      <Modal isOpen={assignModal.isOpen} onClose={assignModal.onClose} isCentered size="md">
        <ModalOverlay /><ModalContent borderRadius="xl" mx="4">
          <ModalHeader fontWeight="700">Assign Team Member</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired><FormLabel fontWeight="600">Team Member</FormLabel>
                <Select value={assignMemberId} onChange={e => setAssignMemberId(e.target.value)} placeholder="Select a team member">
                  {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
              </FormControl>
              <FormControl isRequired><FormLabel fontWeight="600">Role</FormLabel>
                <Select value={assignRole} onChange={e => setAssignRole(e.target.value)} placeholder="Select a role">
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr="3" onClick={assignModal.onClose}>Cancel</Button><Button onClick={handleAssignTeamMember} isDisabled={!assignMemberId || !assignRole}>Assign</Button></ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

function TabButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  const activeBg = useColorModeValue('teal.50', 'teal.900');
  const activeColor = useColorModeValue('teal.700', 'teal.200');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const headingColor = useColorModeValue('gray.800', 'white');
  return (
    <Box as="button" role="tab" onClick={onClick} px={{ base: 3, md: 4 }} py={2.5} borderRadius="lg" fontSize="sm" fontWeight="700" transition="all 0.15s"
      bg={active ? activeBg : 'transparent'} color={active ? activeColor : subtextColor}
      _hover={{ bg: active ? activeBg : hoverBg, color: active ? activeColor : headingColor }} flexShrink={0}
    >
      {icon}
      <Text as="span" ml="2">{label}</Text>
    </Box>
  );
}
