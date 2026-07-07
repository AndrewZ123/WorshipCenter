'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Text, HStack, Button, Table, Thead, Tbody, Tr, Th, Td,
  Input, useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalCloseButton, ModalFooter, FormControl,
  FormLabel, VStack, Flex, useToast, IconButton, Spinner, Center,
  Card, CardBody, Menu, MenuButton, MenuList, MenuItem,
  useColorModeValue, Select, Tag, TagLabel, Collapse,
  Divider, SimpleGrid,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/lib/PermissionsContext';
import { useStore } from '@/lib/StoreContext';
import type { Service, ServiceTemplate, ServiceDebriefPopulated } from '@/lib/types';
import ServiceDetailClient from './[id]/ServiceDetailClient';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import Avatar from '@/components/ui/Avatar';
import { formatServiceDate } from '@/lib/formatDate';

// Lucide icons
import { 
  Plus, ChevronDown, ChevronRight, Calendar, Clock, MoreVertical,
  Copy, Trash2, Repeat, CalendarPlus, Star, MessageSquare,
  CheckCircle, AlertTriangle, RefreshCw, Heart, ExternalLink
} from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ServicesPage() {
  const { church, user } = useAuth();
  const permissions = usePermissions();
  const store = useStore();
  const router = useRouter();
  const toast = useToast();
  const createModal = useDisclosure();
  const [services, setServices] = useState<Service[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [loading, setLoading] = useState(true);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteDisclosure = useDisclosure();

  // Duplicate
  const dupDisclosure = useDisclosure();
  const [dupSourceId, setDupSourceId] = useState<string | null>(null);
  const [dupDate, setDupDate] = useState('');
  const [dupTitle, setDupTitle] = useState('');

  // Debriefs
  const [debriefs, setDebriefs] = useState<(ServiceDebriefPopulated & { service?: { title: string; date: string } })[]>([]);
  const [showDebriefs, setShowDebriefs] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedServiceTab, setSelectedServiceTab] = useState<string | undefined>(undefined);
  const [showTemplates, setShowTemplates] = useState(false);
  const templateCreateModal = useDisclosure();
  const generateModal = useDisclosure();
  const deleteTemplateConfirm = useDisclosure();
  const [tplTitle, setTplTitle] = useState('');
  const [tplTime, setTplTime] = useState('09:00');
  const [tplDay, setTplDay] = useState(0);
  const [generateTemplateId, setGenerateTemplateId] = useState<string | null>(null);
  const [generateDate, setGenerateDate] = useState('');
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const emptyColor = useColorModeValue('gray.400', 'gray.500');
  const templatesBg = useColorModeValue('gray.50', 'gray.900');
  const theadBg = useColorModeValue('gray.50', 'gray.900');
  
  // Volunteers have read-only access
  const isReadOnly = permissions.isVolunteer;

  useEffect(() => { if (church) loadData(); }, [church, permissions.isVolunteer]);

  const loadData = async () => {
    if (!church) return;
    try {
      setLoading(true);
      let all: Service[];

      if (permissions.isVolunteer && user?.team_member_id) {
        // Volunteers only see services they are assigned to
        const assignments = await store.assignments.getByTeamMember(user.team_member_id, church.id);
        const serviceIds = new Set<string>();
        for (const a of assignments) {
          if (a.service_id) serviceIds.add(a.service_id);
        }
        const tasks = await store.tasks.getMyTasks(church.id, user.team_member_id);
        for (const t of tasks) {
          if (t.service_id) serviceIds.add(t.service_id);
        }
        const allSvc = await store.services.getByChurch(church.id);
        all = allSvc.filter((s: Service) => serviceIds.has(s.id));
      } else {
        all = await store.services.getByChurch(church.id);
      }

      all.sort((a: Service, b: Service) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setServices(all);
      setTemplates(await store.templates.getByChurch(church.id));
      store.debriefs.getByChurch(church.id, { limit: 20 }).then(setDebriefs).catch(() => {});
    } catch (error) {
      console.error('Error loading services:', error);
      toast({ title: 'Error loading data', status: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!church || !title || !date) return;
    try {
      await store.services.create({ church_id: church.id, title, date, time, status: 'draft', notes: '' });
      toast({ title: 'Service created', status: 'success', duration: 2000 });
      setTitle(''); setDate(''); setTime('09:00');
      createModal.onClose();
      await loadData();
    } catch (error) {
      toast({ title: 'Error creating service', status: 'error', duration: 3000 });
    }
  };

  const handleDelete = async () => {
    if (!deleteId || !church) return;
    try {
      await store.services.delete(deleteId, church.id);
      toast({ title: 'Service deleted', status: 'info', duration: 2000 });
      setDeleteId(null);
      await loadData();
    } catch (error) {
      toast({ title: 'Error deleting service', status: 'error', duration: 3000 });
    }
  };

  const handleDuplicate = async () => {
    if (!dupSourceId || !dupDate || !church) return;
    try {
      const newSvc = await store.services.duplicate(dupSourceId, church.id, dupDate, dupTitle || undefined);
      if (newSvc) {
        toast({ title: 'Service duplicated', description: 'Items and team assignments copied.', status: 'success', duration: 2000 });
        dupDisclosure.onClose();
        setDupSourceId(null);
        setDupDate('');
        setDupTitle('');
        await loadData();
      }
    } catch (error) {
      toast({ title: 'Error duplicating service', status: 'error', duration: 3000 });
    }
  };

  // Template handlers
  const handleCreateTemplate = async () => {
    if (!church || !tplTitle) return;
    try {
      await store.templates.create({
        church_id: church.id, title: tplTitle, time: tplTime, day_of_week: tplDay,
        items: [
          { type: 'segment', position: 0, title: 'Welcome & Announcements', song_id: null, notes: '', duration_minutes: 5, key: null },
          { type: 'segment', position: 1, title: 'Worship Set', song_id: null, notes: '', duration_minutes: 25, key: null },
          { type: 'segment', position: 2, title: 'Sermon', song_id: null, notes: '', duration_minutes: 30, key: null },
          { type: 'segment', position: 3, title: 'Closing', song_id: null, notes: '', duration_minutes: 5, key: null },
        ],
        roles: ['worship_leader', 'vocals', 'acoustic', 'keys', 'bass', 'drums', 'sound'],
      });
      toast({ title: 'Template created', status: 'success', duration: 2000 });
      setTplTitle(''); setTplTime('09:00'); setTplDay(0);
      templateCreateModal.onClose();
      await loadData();
    } catch (error) {
      toast({ title: 'Error creating template', status: 'error', duration: 3000 });
    }
  };

  const handleGenerate = async () => {
    if (!generateTemplateId || !generateDate || !church) return;
    try {
      const svc = await store.templates.createServiceFromTemplate(generateTemplateId, church.id, generateDate);
      if (svc) {
        toast({ title: 'Service created from template!', status: 'success', duration: 3000 });
        generateModal.onClose();
        setGenerateTemplateId(null);
        setGenerateDate('');
        setSelectedServiceId(svc.id);
      }
    } catch (error) {
      toast({ title: 'Error generating service', status: 'error', duration: 3000 });
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId || !church) return;
    try {
      await store.templates.delete(deleteTemplateId, church.id);
      toast({ title: 'Template deleted', status: 'info', duration: 2000 });
      setDeleteTemplateId(null);
      await loadData();
    } catch (error) {
      toast({ title: 'Error deleting template', status: 'error', duration: 3000 });
    }
  };

  const getNextDateForDay = (day: number): string => {
    const d = new Date();
    const diff = ((day - d.getDay()) + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <Center minH="50vh">
        <Spinner size="xl" color="teal.500" />
      </Center>
    );
  }

  if (selectedServiceId) {
    return (
      <ServiceDetailClient
        serviceId={selectedServiceId}
        onBack={() => { setSelectedServiceId(null); setSelectedServiceTab(undefined); }}
        initialTab={selectedServiceTab}
      />
    );
  }

  return (
    <Box p={{ base: '4', md: '8' }} pt={{ base: '2', md: '8' }} maxW="1100px" w="full" mx="auto" overflowX="hidden">
      {/* Page Header */}
      <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} mb="6" flexWrap="wrap" gap="4" direction={{ base: 'column', md: 'row' }}>
        <Box>
          <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">Services</Text>
          <Text mt="1" fontSize="sm" color={subtextColor}>Plan and manage your worship services</Text>
        </Box>
        {!isReadOnly && (
          <Box w={{ base: 'full', md: 'auto' }}>
            {templates.length > 0 ? (
              <Menu>
                <MenuButton 
                  as={Button} 
                  size="sm" 
                  colorScheme="teal" 
                  w={{ base: 'full', md: 'auto' }} 
                  rightIcon={<ChevronDown size={16} />}
                  px="4"
                  py="2"
                  borderRadius="lg"
                  fontWeight="600"
                >
                  <HStack spacing="2">
                    <Plus size={16} />
                    <span>Create Service</span>
                  </HStack>
                </MenuButton>
                <MenuList borderRadius="xl" zIndex={50}>
                  <MenuItem onClick={createModal.onOpen} fontWeight="500" icon={<Plus size={16} />}>Blank Service</MenuItem>
                  <Divider my="2" />
                  <Text px="3" py="1" fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase">From Template</Text>
                  {templates.map(tpl => (
                    <MenuItem key={tpl.id} onClick={() => {
                      setGenerateTemplateId(tpl.id);
                      setGenerateDate(getNextDateForDay(tpl.day_of_week));
                      generateModal.onOpen();
                    }} icon={<Repeat size={16} />}>
                      {tpl.title}
                    </MenuItem>
                  ))}
                </MenuList>
              </Menu>
            ) : (
              <Button 
                onClick={createModal.onOpen} 
                size="sm" 
                colorScheme="teal"
                w={{ base: 'full', md: 'auto' }}
                px="4"
                py="2"
                borderRadius="lg"
                fontWeight="600"
                leftIcon={<Plus size={16} />}
              >
                Create Service
              </Button>
            )}
          </Box>
        )}
      </Flex>

      {/* Recurring Templates Section - Admin/Leader only */}
      {!isReadOnly && (
        <Box mb="6">
          <HStack
          spacing="2" 
          cursor="pointer" 
          onClick={() => setShowTemplates(!showTemplates)}
          py="2" px="1" 
          role="button" 
          tabIndex={0}
          borderRadius="lg"
          _hover={{ bg: hoverBg }}
          transition="all 0.15s ease"
        >
          {showTemplates ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Text fontWeight="600" fontSize="sm" color={subtextColor}>
            Recurring Templates {templates.length > 0 && `(${templates.length})`}
          </Text>
        </HStack>

        <Collapse in={showTemplates} animateOpacity>
          <Box mt="2" bg={templatesBg} borderRadius="xl" p="4">
            {templates.length === 0 ? (
              <Card bg={cardBg} border="1px dashed" borderColor={borderColor} borderRadius="lg">
                <CardBody textAlign="center" py="6">
                  <Text fontSize="sm" color={emptyColor} mb="3">No templates yet - save time by creating a recurring service pattern</Text>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    colorScheme="teal"
                    onClick={templateCreateModal.onOpen}
                    leftIcon={<Plus size={16} />}
                  >
                    New Template
                  </Button>
                </CardBody>
              </Card>
            ) : (
              <VStack spacing="2" align="stretch">
                {templates.map((tpl) => (
                  <Flex
                    key={tpl.id}
                    direction={{ base: 'column', md: 'row' }}
                    align={{ base: 'stretch', md: 'center' }}
                    justify="space-between"
                    gap="2"
                    bg={cardBg} 
                    border="1px solid" 
                    borderColor={borderColor}
                    borderRadius="lg" 
                    px="4" 
                    py="3" 
                    cursor="pointer"
                    boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
                    _hover={{ 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
                      borderColor: 'teal.200',
                      transform: 'translateY(-1px)',
                    }}
                    transition="all 0.15s ease"
                    onClick={() => router.push(`/templates/${tpl.id}`)}
                  >
                    <HStack spacing="3" minW="0" flex="1">
                      <Tag size="sm" colorScheme="teal" variant="subtle" flexShrink={0} borderRadius="full">
                        <TagLabel>{DAYS[tpl.day_of_week]}</TagLabel>
                      </Tag>
                      <Text fontWeight="600" color={textColor} noOfLines={1}>{tpl.title}</Text>
                      <HStack spacing="1" color={subtextColor}>
                        <Clock size={14} />
                        <Text fontSize="sm">{tpl.time}</Text>
                      </HStack>
                      <Text fontSize="xs" color={subtextColor} flexShrink={0}>{tpl.items.length} items</Text>
                    </HStack>
                    <HStack spacing="2" justify={{ base: 'flex-end', md: 'flex-start' }} onClick={(e) => e.stopPropagation()}>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        colorScheme="teal"
                        onClick={() => {
                          setGenerateTemplateId(tpl.id);
                          setGenerateDate(getNextDateForDay(tpl.day_of_week));
                          generateModal.onOpen();
                        }}
                        leftIcon={<CalendarPlus size={14} />}
                      >
                        Generate
                      </Button>
                      <IconButton
                        aria-label="Delete template" 
                        size="sm" 
                        variant="ghost" 
                        color="gray.400"
                        _hover={{ color: 'red.500', bg: 'red.50' }}
                        icon={<Trash2 size={14} />}
                        onClick={() => { setDeleteTemplateId(tpl.id); deleteTemplateConfirm.onOpen(); }}
                      />
                    </HStack>
                  </Flex>
                ))}
                <Button 
                  size="sm" 
                  variant="ghost" 
                  alignSelf="start" 
                  colorScheme="teal"
                  onClick={templateCreateModal.onOpen}
                  leftIcon={<Plus size={16} />}
                >
                  New Template
                </Button>
              </VStack>
            )}
          </Box>
        </Collapse>
      </Box>
      )}

      <Divider mb="6" />

      {/* Services List */}
      {services.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No services yet"
          description="Create your first service to get started planning Sunday."
          ctaLabel="Create Service"
          ctaOnClick={createModal.onOpen}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Box display={{ base: 'none', md: 'block' }} bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden" boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
            <Table variant="simple">
              <Thead bg={theadBg}>
                <Tr>
                  <Th fontWeight="600" fontSize="xs" textTransform="uppercase" letterSpacing="wide">Date</Th>
                  <Th fontWeight="600" fontSize="xs" textTransform="uppercase" letterSpacing="wide">Title</Th>
                  <Th fontWeight="600" fontSize="xs" textTransform="uppercase" letterSpacing="wide">Time</Th>
                  <Th fontWeight="600" fontSize="xs" textTransform="uppercase" letterSpacing="wide">Status</Th>
                  <Th w="60px"></Th>
                </Tr>
              </Thead>
              <Tbody>
                {services.map((service) => (
                  <Tr 
                    key={service.id} 
                    cursor="pointer" 
                    _hover={{ bg: hoverBg }} 
                    transition="background 0.15s ease" 
                    onClick={() => setSelectedServiceId(service.id)}
                    borderLeft="3px solid transparent"
                    _focusWithin={{ borderLeftColor: 'teal.500' }}
                    sx={{ '&:hover': { borderLeftColor: 'teal.300' } }}
                  >
                    <Td fontWeight="500" color={textColor}>
                      <HStack spacing="2">
                        <Calendar size={14} color="var(--chakra-colors-gray-400)" />
                        <span>{formatServiceDate(service.date)}</span>
                      </HStack>
                    </Td>
                    <Td fontWeight="600" color={textColor}>{service.title}</Td>
                    <Td color={subtextColor}>{service.time}</Td>
                    <Td><StatusBadge status={service.status} size="sm" /></Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      {!isReadOnly && (
                        <Menu>
                          <MenuButton 
                            as={IconButton} 
                            icon={<MoreVertical size={16} />} 
                            variant="ghost" 
                            size="sm" 
                            aria-label="Actions"
                        color={subtextColor}
                        _hover={{ color: textColor, bg: hoverBg }}
                          />
                          <MenuList borderRadius="xl" zIndex={50}>
                            <MenuItem onClick={() => { setDupSourceId(service.id); setDupTitle(service.title); setDupDate(''); dupDisclosure.onOpen(); }} icon={<Copy size={16} />}>Duplicate</MenuItem>
                            <MenuItem color="red.500" onClick={() => { setDeleteId(service.id); deleteDisclosure.onOpen(); }} icon={<Trash2 size={16} />}>Delete</MenuItem>
                          </MenuList>
                        </Menu>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          {/* Mobile cards */}
          <VStack display={{ base: 'flex', md: 'none' }} spacing="3" align="stretch">
            {services.map((service) => (
              <Card 
                key={service.id} 
                bg={cardBg} 
                border="1px solid" 
                borderColor={borderColor} 
                borderRadius="xl" 
                cursor="pointer" 
                boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
                _hover={{ 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
                  borderColor: 'teal.200',
                  transform: 'translateY(-1px)',
                }}
                transition="all 0.15s ease" 
                onClick={() => setSelectedServiceId(service.id)}
              >
                <CardBody py="3" px="4">
                  <Flex justify="space-between" align="start">
                    <Box>
                      <Text fontWeight="600" fontSize="md" color={textColor}>{service.title}</Text>
                      <HStack spacing="2" mt="1" color={subtextColor}>
                        <Calendar size={14} />
                        <Text fontSize="sm">{formatServiceDate(service.date)}</Text>
                        <Text fontSize="sm">·</Text>
                        <Clock size={14} />
                        <Text fontSize="sm">{service.time}</Text>
                      </HStack>
                    </Box>
                    <HStack spacing="2">
                      <StatusBadge status={service.status} size="sm" />
                      {!isReadOnly && (
                        <Box onClick={(e) => e.stopPropagation()}>
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
                              <MenuItem onClick={() => { setDupSourceId(service.id); setDupTitle(service.title); setDupDate(''); dupDisclosure.onOpen(); }} icon={<Copy size={16} />}>Duplicate</MenuItem>
                              <MenuItem color="red.500" onClick={() => { setDeleteId(service.id); deleteDisclosure.onOpen(); }} icon={<Trash2 size={16} />}>Delete</MenuItem>
                            </MenuList>
                          </Menu>
                        </Box>
                      )}
                    </HStack>
                  </Flex>
                </CardBody>
              </Card>
            ))}
          </VStack>
        </>
      )}

      {/* Recent Debriefs Section */}
      <Box mb="6">
        <HStack
          spacing="2"
          cursor="pointer"
          onClick={() => setShowDebriefs(!showDebriefs)}
          py="2" px="1"
          role="button"
          tabIndex={0}
          borderRadius="lg"
          _hover={{ bg: hoverBg }}
          transition="all 0.15s ease"
        >
          {showDebriefs ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Star size={16} />
          <Text fontWeight="600" fontSize="sm" color={subtextColor}>
            Recent Debriefs {debriefs.length > 0 && `(${debriefs.length})`}
          </Text>
        </HStack>

        <Collapse in={showDebriefs} animateOpacity>
          <Box mt="2" bg={templatesBg} borderRadius="xl" p="4">
            {debriefs.length === 0 ? (
              <Card bg={cardBg} border="1px dashed" borderColor={borderColor} borderRadius="lg">
                <CardBody textAlign="center" py="6">
                  <Text fontSize="sm" color={emptyColor} mb="3">
                    No debriefs yet — they appear after services are marked completed and team members submit them.
                  </Text>
                  <Button
                    size="sm"
                    variant="outline"
                    colorScheme="teal"
                    onClick={() => router.push('/services/debriefs')}
                    leftIcon={<ExternalLink size={14} />}
                  >
                    View Service Log
                  </Button>
                </CardBody>
              </Card>
            ) : (
              <>
                <VStack spacing="2" align="stretch">
                  {debriefs.slice(0, 10).map((entry) => (
                    <HStack
                      key={entry.id}
                      bg={cardBg}
                      border="1px solid"
                      borderColor={borderColor}
                      borderRadius="lg"
                      px="4"
                      py="3"
                      spacing="3"
                      cursor="pointer"
                      onClick={() => router.push(`/services/${entry.service_id}?tab=debrief`)}
                      _hover={{ borderColor: 'teal.200' }}
                      transition="all 0.15s ease"
                    >
                      <Avatar name={entry.user?.name || 'Unknown'} src={entry.user?.avatar_url} size="sm" />
                      <Box flex="1" minW="0">
                        <HStack spacing="2">
                          <Text fontWeight="600" fontSize="sm" color={textColor} noOfLines={1}>
                            {entry.service?.title || 'Service'}
                          </Text>
                          {entry.service?.date && (
                            <Text fontSize="xs" color={subtextColor}>{entry.service.date}</Text>
                          )}
                        </HStack>
                        <Text fontSize="xs" color={subtextColor}>
                          {entry.user?.name || 'Unknown'}
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
                            <Text fontSize="sm" fontWeight="700" color={textColor}>{r.value}</Text>
                          </Box>
                        ))}
                      </HStack>
                      {entry.what_broke && (
                        <AlertTriangle size={14} color="var(--chakra-colors-orange-400)" />
                      )}
                    </HStack>
                  ))}
                </VStack>
                {debriefs.length > 10 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    colorScheme="teal"
                    mt="2"
                    onClick={() => router.push('/services/debriefs')}
                    leftIcon={<ExternalLink size={14} />}
                  >
                    View all {debriefs.length} debriefs
                  </Button>
                )}
              </>
            )}
          </Box>
        </Collapse>
      </Box>

      {/* Modals */}

      {/* Create Service */}
      <Modal isOpen={createModal.isOpen} onClose={createModal.onClose} isCentered size="md">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl">
          <ModalHeader fontWeight="700">Create Service</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Service Title</FormLabel>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='e.g., "Sunday 9AM Worship"' borderRadius="lg" />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Date</FormLabel>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} borderRadius="lg" />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Time</FormLabel>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} borderRadius="lg" />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={createModal.onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleCreate} isDisabled={!title || !date} fontWeight="600">Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Duplicate Service */}
      <Modal isOpen={dupDisclosure.isOpen} onClose={dupDisclosure.onClose} isCentered size="md">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl">
          <ModalHeader fontWeight="700">Duplicate Service</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Title</FormLabel>
                <Input value={dupTitle} onChange={(e) => setDupTitle(e.target.value)} borderRadius="lg" />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">New Date</FormLabel>
                <Input type="date" value={dupDate} onChange={(e) => setDupDate(e.target.value)} borderRadius="lg" />
              </FormControl>
              <Text fontSize="sm" color="gray.500">All songs, segments, and team assignments will be copied.</Text>
            </VStack>
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={dupDisclosure.onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleDuplicate} isDisabled={!dupDate} fontWeight="600">Duplicate</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Create Template */}
      <Modal isOpen={templateCreateModal.isOpen} onClose={templateCreateModal.onClose} isCentered size="md">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl">
          <ModalHeader fontWeight="700">New Service Template</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Template Name</FormLabel>
                <Input value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} placeholder='e.g., "Sunday Morning Worship"' borderRadius="lg" />
              </FormControl>
              <HStack w="full" spacing="4">
                <FormControl>
                  <FormLabel fontWeight="600" fontSize="sm">Day</FormLabel>
                  <Select value={tplDay} onChange={(e) => setTplDay(parseInt(e.target.value))} borderRadius="lg">
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontWeight="600" fontSize="sm">Time</FormLabel>
                  <Input type="time" value={tplTime} onChange={(e) => setTplTime(e.target.value)} borderRadius="lg" />
                </FormControl>
              </HStack>
              <Text fontSize="sm" color="gray.500">A default structure (Welcome, Worship Set, Sermon, Closing) will be created.</Text>
            </VStack>
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={templateCreateModal.onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleCreateTemplate} isDisabled={!tplTitle} fontWeight="600">Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Generate from Template */}
      <Modal isOpen={generateModal.isOpen} onClose={generateModal.onClose} isCentered size="md">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl">
          <ModalHeader fontWeight="700">Generate Service from Template</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Service Date</FormLabel>
                <Input type="date" value={generateDate} onChange={(e) => setGenerateDate(e.target.value)} borderRadius="lg" />
              </FormControl>
              <Text fontSize="sm" color="gray.500">A new draft service will be created with all segments pre-filled.</Text>
            </VStack>
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={generateModal.onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleGenerate} isDisabled={!generateDate} fontWeight="600">Generate</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Confirm Dialogs */}
      <ConfirmDialog 
        isOpen={deleteDisclosure.isOpen} 
        onClose={deleteDisclosure.onClose} 
        onConfirm={handleDelete} 
        title="Delete Service?" 
        message="This will permanently delete this service, including all items, assignments, and song usage data." 
        confirmLabel="Delete Service" 
        variant="destructive"
      />
      <ConfirmDialog 
        isOpen={deleteTemplateConfirm.isOpen} 
        onClose={deleteTemplateConfirm.onClose} 
        onConfirm={handleDeleteTemplate} 
        title="Delete Template?" 
        message="This will permanently delete this template. Existing services are not affected." 
        confirmLabel="Delete"
        variant="destructive"
      />
    </Box>
  );
}