'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Text, HStack, Button, Table, Thead, Tbody, Tr, Th, Td,
  Input, useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalCloseButton, ModalFooter, FormControl,
  FormLabel, VStack, Flex, useToast, IconButton, Spinner, Center,
  Card, CardBody, Menu, MenuButton, MenuList, MenuItem,
  useColorModeValue, Select, Tag, TagLabel, Collapse,
  Divider, Badge,
} from '@chakra-ui/react';
import { useDemo } from '@/lib/demo/context';
import type { Service, ServiceTemplate } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { formatServiceDate } from '@/lib/formatDate';

// Lucide icons
import { 
  Plus, MoreVertical, ChevronDown, ChevronRight, Calendar, 
  Clock, Trash2, Copy, Sparkles
} from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function DemoServicesPage() {
  const { church, services, templates, createService, deleteService, duplicateService, createServiceFromTemplate, createTemplate, deleteTemplate } = useDemo();
  const router = useRouter();
  const toast = useToast();
  const createModal = useDisclosure();
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteDisclosure = useDisclosure();

  // Duplicate
  const dupDisclosure = useDisclosure();
  const [dupSourceId, setDupSourceId] = useState<string | null>(null);
  const [dupDate, setDupDate] = useState('');
  const [dupTitle, setDupTitle] = useState('');

  // Templates
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
  const textColor = useColorModeValue('gray.900', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const emptyColor = useColorModeValue('gray.400', 'gray.500');
  const sectionBg = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => { setLoading(false); }, [services]);

  // Sort services by date
  const sortedServices = useMemo(() => {
    return [...services].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [services]);

  const handleCreate = async () => {
    if (!church || !title || !date) return;
    try {
      const newService = createService({ church_id: church.id, title, date, time, status: 'draft', notes: '' });
      if (newService) {
        toast({ title: 'Service created', status: 'success', duration: 2000 });
        setTitle(''); setDate(''); setTime('09:00');
        createModal.onClose();
        router.push(`/demo/services/${newService.id}`);
      }
    } catch (error) {
      toast({ title: 'Error creating service', status: 'error', duration: 3000 });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      deleteService(deleteId);
      toast({ title: 'Service deleted', status: 'info', duration: 2000 });
      setDeleteId(null);
      deleteDisclosure.onClose();
    } catch (error) {
      toast({ title: 'Error deleting service', status: 'error', duration: 3000 });
    }
  };

  const handleDuplicate = async () => {
    if (!dupSourceId || !dupDate) return;
    try {
      const newSvc = duplicateService(dupSourceId, dupDate, dupTitle || undefined);
      if (newSvc) {
        toast({ title: 'Service duplicated', description: 'Items and team assignments copied.', status: 'success', duration: 2000 });
        dupDisclosure.onClose();
        setDupSourceId(null);
        setDupDate('');
        setDupTitle('');
      }
    } catch (error) {
      toast({ title: 'Error duplicating service', status: 'error', duration: 3000 });
    }
  };

  // Template handlers
  const handleCreateTemplate = async () => {
    if (!church || !tplTitle) return;
    try {
      createTemplate({
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
    } catch (error) {
      toast({ title: 'Error creating template', status: 'error', duration: 3000 });
    }
  };

  const handleGenerate = async () => {
    if (!generateTemplateId || !generateDate) return;
    try {
      const svc = createServiceFromTemplate(generateTemplateId, generateDate);
      if (svc) {
        toast({ title: 'Service created from template!', status: 'success', duration: 3000 });
        generateModal.onClose();
        setGenerateTemplateId(null);
        setGenerateDate('');
        router.push(`/demo/services/${svc.id}`);
      }
    } catch (error) {
      toast({ title: 'Error generating service', status: 'error', duration: 3000 });
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;
    try {
      deleteTemplate(deleteTemplateId);
      toast({ title: 'Template deleted', status: 'info', duration: 2000 });
      setDeleteTemplateId(null);
      deleteTemplateConfirm.onClose();
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

  return (
    <Box p={{ base: '4', md: '8' }} maxW="1100px" mx="auto">
      {/* Header */}
      <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} mb="6" flexWrap="wrap" gap="4" direction={{ base: 'column', md: 'row' }}>
        <Box>
          <Text fontSize="2xl" fontWeight="bold" color={textColor} letterSpacing="tight">Services</Text>
          <Text color={subtextColor} fontSize="sm" mt="1">Plan and manage your worship services</Text>
        </Box>
        <Box w={{ base: 'full', md: 'auto' }}>
          {templates.length > 0 ? (
            <Menu>
              <MenuButton 
                as={Button} 
                size="sm" 
                colorScheme="teal" 
                px="4" 
                py="2" 
                fontWeight="600"
                rightIcon={<ChevronDown size={16} />}
                w={{ base: 'full', md: 'auto' }}
              >
                <HStack spacing="2">
                  <Plus size={16} />
                  <Text>Create Service</Text>
                </HStack>
              </MenuButton>
              <MenuList borderRadius="xl" zIndex={50}>
                <MenuItem onClick={createModal.onOpen} fontWeight="500" borderRadius="lg">Blank Service</MenuItem>
                <Divider my="2" />
                <Text px="3" py="1" fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase">From Template</Text>
                {templates.map((tpl: ServiceTemplate) => (
                  <MenuItem 
                    key={tpl.id} 
                    onClick={() => {
                      setGenerateTemplateId(tpl.id);
                      setGenerateDate(getNextDateForDay(tpl.day_of_week));
                      generateModal.onOpen();
                    }}
                    borderRadius="lg"
                  >
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
              px="4" 
              py="2"
              fontWeight="600"
              leftIcon={<Plus size={16} />}
              w={{ base: 'full', md: 'auto' }}
            >
              Create Service
            </Button>
          )}
        </Box>
      </Flex>

      {/* Templates Section */}
      <Box mb="6">
        <HStack
          spacing="2" 
          cursor="pointer" 
          onClick={() => setShowTemplates(!showTemplates)}
          py="2" px="1" 
          role="button" 
          tabIndex={0}
          _hover={{ color: 'teal.600' }}
          transition="all 0.15s"
        >
          {showTemplates ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Text fontWeight="600" fontSize="sm" color={subtextColor}>
            Recurring Templates {templates.length > 0 && `(${templates.length})`}
          </Text>
        </HStack>

        <Collapse in={showTemplates} animateOpacity>
          <Box mt="2" bg={sectionBg} borderRadius="xl" p="4">
            {templates.length === 0 ? (
              <Box textAlign="center" py="4">
                <Text fontSize="sm" color={emptyColor} mb="3">No templates yet - save time by creating a recurring service pattern</Text>
                <Button 
                  size="sm" 
                  variant="outline" 
                  borderColor="teal.300"
                  color="teal.600"
                  _hover={{ bg: 'teal.50', borderColor: 'teal.400' }}
                  onClick={templateCreateModal.onOpen}
                >
                  + New Template
                </Button>
              </Box>
            ) : (
              <VStack spacing="2" align="stretch">
                {templates.map((tpl: ServiceTemplate) => (
                  <HStack
                    key={tpl.id}
                    bg={cardBg} 
                    border="1px solid" 
                    borderColor={borderColor}
                    borderRadius="lg" 
                    px="4" 
                    py="3" 
                    justify="space-between"
                    flexWrap={{ base: 'wrap', md: 'nowrap' }} 
                    gap="2"
                    boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
                    _hover={{ 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
                      transform: 'translateY(-1px)'
                    }}
                    transition="all 0.15s"
                  >
                    <HStack spacing="3" flex="1" minW="0">
                      <Badge 
                        bg="teal.100" 
                        color="teal.700" 
                        borderRadius="full" 
                        px="2" 
                        fontSize="xs" 
                        fontWeight="600"
                        flexShrink={0}
                      >
                        {DAYS[tpl.day_of_week]}
                      </Badge>
                      <Text fontWeight="600" color={textColor} noOfLines={1}>{tpl.title}</Text>
                      <Text fontSize="sm" color={subtextColor} flexShrink={0}>{tpl.time}</Text>
                      <Text fontSize="xs" color="gray.400" flexShrink={0}>{tpl.items.length} items</Text>
                    </HStack>
                    <HStack spacing="2" flexShrink={0}>
                      <Button 
                        size="xs" 
                        variant="ghost" 
                        color="teal.600"
                        _hover={{ bg: 'teal.50' }}
                        onClick={() => {
                          setGenerateTemplateId(tpl.id);
                          setGenerateDate(getNextDateForDay(tpl.day_of_week));
                          generateModal.onOpen();
                        }}
                        borderRadius="lg"
                      >
                        Generate
                      </Button>
                      <IconButton
                        aria-label="Delete template" 
                        size="xs" 
                        variant="ghost" 
                        color="gray.400"
                        icon={<Trash2 size={14} />}
                        _hover={{ color: 'red.500', bg: 'red.50' }}
                        onClick={() => { setDeleteTemplateId(tpl.id); deleteTemplateConfirm.onOpen(); }}
                        minW="32px"
                      />
                    </HStack>
                  </HStack>
                ))}
                <Button 
                  size="xs" 
                  variant="ghost" 
                  alignSelf="start" 
                  color="gray.500"
                  _hover={{ color: 'teal.600', bg: 'teal.50' }}
                  leftIcon={<Plus size={14} />}
                  onClick={templateCreateModal.onOpen}
                  borderRadius="lg"
                >
                  New Template
                </Button>
              </VStack>
            )}
          </Box>
        </Collapse>
      </Box>

      {/* Services List */}
      {sortedServices.length === 0 ? (
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
              <Thead bg={useColorModeValue('gray.50', 'gray.700')}>
                <Tr>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Date</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Title</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Time</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Status</Th>
                  <Th w="60px"></Th>
                </Tr>
              </Thead>
              <Tbody>
                {sortedServices.map((service) => (
                  <Tr 
                    key={service.id} 
                    cursor="pointer" 
                    _hover={{ bg: hoverBg }} 
                    transition="all 0.15s"
                    onClick={() => router.push(`/demo/services/${service.id}`)}
                    borderLeft="3px solid transparent"
                    sx={{ '&:hover': { borderLeftColor: 'teal.500' } }}
                  >
                    <Td fontWeight="500">
                      <HStack spacing="2">
                        <Calendar size={14} className="text-gray-400" />
                        <Text>{formatServiceDate(service.date)}</Text>
                      </HStack>
                    </Td>
                    <Td fontWeight="600" color={textColor}>{service.title}</Td>
                    <Td color={subtextColor}>{service.time}</Td>
                    <Td><StatusBadge status={service.status as 'draft' | 'published' | 'completed'} /></Td>
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
                            icon={<Copy size={16} />} 
                            onClick={() => { setDupSourceId(service.id); setDupTitle(service.title); setDupDate(''); dupDisclosure.onOpen(); }}
                            borderRadius="lg"
                          >
                            Duplicate
                          </MenuItem>
                          <MenuItem 
                            icon={<Trash2 size={16} />} 
                            color="red.500" 
                            onClick={() => { setDeleteId(service.id); deleteDisclosure.onOpen(); }}
                            borderRadius="lg"
                            _hover={{ bg: 'red.50' }}
                          >
                            Delete
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
            {sortedServices.map((service) => (
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
                  transform: 'translateY(-1px)'
                }}
                transition="all 0.15s"
                onClick={() => router.push(`/demo/services/${service.id}`)}
                borderLeft="3px solid"
                borderLeftColor="teal.500"
              >
                <CardBody py="3" px="4">
                  <Flex justify="space-between" align="start">
                    <Box>
                      <HStack spacing="2" mb="1">
                        <Text fontWeight="600" color={textColor}>{service.title}</Text>
                        <StatusBadge status={service.status as 'draft' | 'published' | 'completed'} />
                      </HStack>
                      <HStack spacing="2" color={subtextColor}>
                        <Calendar size={12} />
                        <Text fontSize="sm">{formatServiceDate(service.date)}</Text>
                        <Text fontSize="sm">·</Text>
                        <Clock size={12} />
                        <Text fontSize="sm">{service.time}</Text>
                      </HStack>
                    </Box>
                    <Box onClick={(e) => e.stopPropagation()}>
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
                            icon={<Copy size={16} />}
                            onClick={() => { setDupSourceId(service.id); setDupTitle(service.title); setDupDate(''); dupDisclosure.onOpen(); }}
                            borderRadius="lg"
                          >
                            Duplicate
                          </MenuItem>
                          <MenuItem 
                            icon={<Trash2 size={16} />}
                            color="red.500" 
                            onClick={() => { setDeleteId(service.id); deleteDisclosure.onOpen(); }}
                            borderRadius="lg"
                            _hover={{ bg: 'red.50' }}
                          >
                            Delete
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

      {/* Modals */}
      <Modal isOpen={createModal.isOpen} onClose={createModal.onClose} isCentered size="md">
        <ModalOverlay />
        <ModalContent borderRadius="xl">
          <ModalHeader fontWeight="700">Create Service</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Service Title</FormLabel>
                <Input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder='e.g., "Sunday 9AM Worship"'
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Date</FormLabel>
                <Input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Time</FormLabel>
                <Input 
                  type="time" 
                  value={time} 
                  onChange={(e) => setTime(e.target.value)}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr="3" onClick={createModal.onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleCreate} isDisabled={!title || !date} fontWeight="600">Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={dupDisclosure.isOpen} onClose={dupDisclosure.onClose} isCentered size="md">
        <ModalOverlay />
        <ModalContent borderRadius="xl">
          <ModalHeader fontWeight="700">Duplicate Service</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Title</FormLabel>
                <Input 
                  value={dupTitle} 
                  onChange={(e) => setDupTitle(e.target.value)}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">New Date</FormLabel>
                <Input 
                  type="date" 
                  value={dupDate} 
                  onChange={(e) => setDupDate(e.target.value)}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </FormControl>
              <Text fontSize="sm" color="gray.500">All songs, segments, and team assignments will be copied.</Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr="3" onClick={dupDisclosure.onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleDuplicate} isDisabled={!dupDate} fontWeight="600">Duplicate</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={templateCreateModal.isOpen} onClose={templateCreateModal.onClose} isCentered size="md">
        <ModalOverlay />
        <ModalContent borderRadius="xl">
          <ModalHeader fontWeight="700">New Service Template</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Template Name</FormLabel>
                <Input 
                  value={tplTitle} 
                  onChange={(e) => setTplTitle(e.target.value)} 
                  placeholder='e.g., "Sunday Morning Worship"'
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </FormControl>
              <HStack w="full" spacing="4">
                <FormControl>
                  <FormLabel fontWeight="600" fontSize="sm">Day</FormLabel>
                  <Select 
                    value={tplDay} 
                    onChange={(e) => setTplDay(parseInt(e.target.value))}
                    borderRadius="lg"
                  >
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontWeight="600" fontSize="sm">Time</FormLabel>
                  <Input 
                    type="time" 
                    value={tplTime} 
                    onChange={(e) => setTplTime(e.target.value)}
                    borderRadius="lg"
                    border="1px solid"
                    borderColor="gray.200"
                    _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                  />
                </FormControl>
              </HStack>
              <Text fontSize="sm" color="gray.500">A default structure (Welcome, Worship Set, Sermon, Closing) will be created.</Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr="3" onClick={templateCreateModal.onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleCreateTemplate} isDisabled={!tplTitle} fontWeight="600">Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={generateModal.isOpen} onClose={generateModal.onClose} isCentered size="md">
        <ModalOverlay />
        <ModalContent borderRadius="xl">
          <ModalHeader fontWeight="700">Generate Service from Template</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Service Date</FormLabel>
                <Input 
                  type="date" 
                  value={generateDate} 
                  onChange={(e) => setGenerateDate(e.target.value)}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </FormControl>
              <Text fontSize="sm" color="gray.500">A new draft service will be created with all segments pre-filled.</Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr="3" onClick={generateModal.onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleGenerate} isDisabled={!generateDate} fontWeight="600">Generate</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog 
        isOpen={deleteDisclosure.isOpen} 
        onClose={deleteDisclosure.onClose} 
        onConfirm={handleDelete} 
        title="Delete Service?" 
        message="This will permanently delete this service, including all items, assignments, and song usage data." 
        confirmLabel="Delete Service" 
      />
      <ConfirmDialog 
        isOpen={deleteTemplateConfirm.isOpen} 
        onClose={deleteTemplateConfirm.onClose} 
        onConfirm={handleDeleteTemplate} 
        title="Delete Template?" 
        message="This will permanently delete this template. Existing services are not affected." 
        confirmLabel="Delete" 
      />
    </Box>
  );
}