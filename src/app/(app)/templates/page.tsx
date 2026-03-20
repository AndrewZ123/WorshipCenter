'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Heading, HStack, Button, VStack, Text, Flex, Input,
  FormControl, FormLabel, Card, CardBody, useToast, useDisclosure,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalCloseButton, ModalFooter, Select, Tag, TagLabel,
  IconButton, SimpleGrid, Badge, useColorModeValue,
  Spinner, Center,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import type { ServiceTemplate } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

export default function TemplatesPage() {
  const { church } = useAuth();
  const store = useStore();
  const router = useRouter();
  const toast = useToast();
  const createModal = useDisclosure();
  const generateModal = useDisclosure();
  const deleteConfirm = useDisclosure();

  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [generateTemplateId, setGenerateTemplateId] = useState<string | null>(null);
  const [generateDate, setGenerateDate] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');

  useEffect(() => {
    if (church) loadTemplates();
  }, [church]);

  const loadTemplates = async () => {
    if (!church) return;
    try {
      setLoading(true);
      setTemplates(await store.templates.getByChurch(church.id));
    } catch (error) {
      console.error('Error loading templates:', error);
      toast({ title: 'Error loading data', status: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!church || !title) return;
    await store.templates.create({
      church_id: church.id,
      title,
      time,
      day_of_week: dayOfWeek,
      items: [
        { type: 'segment', position: 0, title: 'Welcome & Announcements', song_id: null, notes: '', duration_minutes: 5, key: null },
        { type: 'segment', position: 1, title: 'Worship Set', song_id: null, notes: '', duration_minutes: 25, key: null },
        { type: 'segment', position: 2, title: 'Sermon', song_id: null, notes: '', duration_minutes: 30, key: null },
        { type: 'segment', position: 3, title: 'Closing', song_id: null, notes: '', duration_minutes: 5, key: null },
      ],
      roles: ['worship_leader', 'vocals', 'acoustic', 'keys', 'bass', 'drums', 'sound'],
    });
    toast({ title: 'Template created', status: 'success', duration: 2000 });
    setTitle(''); setTime('09:00'); setDayOfWeek(0);
    createModal.onClose();
    await loadTemplates();
  };

  const handleGenerate = async () => {
    if (!generateTemplateId || !generateDate) return;
    const svc = await store.templates.createServiceFromTemplate(generateTemplateId, generateDate);
    if (svc) {
      toast({ title: 'Service created from template!', description: 'Items and roles have been pre-filled.', status: 'success', duration: 3000 });
      generateModal.onClose();
      setGenerateTemplateId(null);
      setGenerateDate('');
      router.push(`/services/${svc.id}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await store.templates.delete(deleteId);
      toast({ title: 'Template deleted', status: 'info', duration: 2000 });
      setDeleteId(null);
      await loadTemplates();
    } catch (error) {
      toast({ title: 'Error deleting template', status: 'error', duration: 3000 });
    }
  };

  const getNextDateForDay = (dayOfWeek: number): string => {
    const d = new Date();
    const diff = ((dayOfWeek - d.getDay()) + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <Center minH="50vh">
        <Spinner size="xl" color="brand.500" />
      </Center>
    );
  }

  return (
    <Box p={{ base: '4', md: '8' }} maxW="1100px" mx="auto">
      <Flex justify="space-between" align="center" mb="6" flexWrap="wrap" gap="4">
        <HStack spacing="3">
          <IconButton aria-label="Back" icon={<BackIcon />} variant="ghost" onClick={() => router.push('/services')} />
          <Box>
            <Heading size="lg" fontWeight="700">Service Templates</Heading>
            <Text color="gray.500" mt="1">Create recurring service patterns to quickly generate new services</Text>
          </Box>
        </HStack>
        <Button onClick={createModal.onOpen} size="lg">+ New Template</Button>
      </Flex>

      {templates.length === 0 ? (
        <Box textAlign="center" py="16" color="gray.400" bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} px="8">
          <Text fontSize="lg" mb="2">No templates yet</Text>
          <Text fontSize="sm" mb="4">Create a template to quickly generate services with pre-filled segments and roles</Text>
          <Button onClick={createModal.onOpen} variant="outline">Create First Template</Button>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing="4">
          {templates.map((template) => (
            <Card key={template.id} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl" _hover={{ shadow: 'md' }} transition="all 0.15s">
              <CardBody>
                <HStack justify="space-between" mb="3">
                  <Box>
                    <Text fontWeight="700" fontSize="lg">{template.title}</Text>
                    <HStack spacing="2" mt="1">
                      <Tag size="sm" colorScheme="brand" variant="subtle">
                        <TagLabel>{DAYS[template.day_of_week]}</TagLabel>
                      </Tag>
                      <Text fontSize="sm" color="gray.500">{template.time}</Text>
                    </HStack>
                  </Box>
                </HStack>

                <VStack spacing="1" align="stretch" mb="3">
                  <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase">Segments</Text>
                  {template.items.map((item, i) => (
                    <HStack key={i} spacing="2">
                      <Badge variant="subtle" colorScheme={item.type === 'song' ? 'brand' : 'orange'} fontSize="10px">
                        {item.type === 'song' ? '♫' : '▪'}
                      </Badge>
                      <Text fontSize="sm">{item.title}</Text>
                      {item.duration_minutes && <Text fontSize="xs" color="gray.400">{item.duration_minutes}m</Text>}
                    </HStack>
                  ))}
                </VStack>

                <Text fontSize="xs" color="gray.500" mb="3">
                  {template.roles.length} roles configured
                </Text>

                <HStack spacing="2">
                  <Button
                    size="sm"
                    flex="1"
                    onClick={() => {
                      setGenerateTemplateId(template.id);
                      setGenerateDate(getNextDateForDay(template.day_of_week));
                      generateModal.onOpen();
                    }}
                  >
                    Generate Service
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    colorScheme="red"
                    onClick={() => { setDeleteId(template.id); deleteConfirm.onOpen(); }}
                  >
                    Delete
                  </Button>
                </HStack>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {/* Create Template Modal */}
      <Modal isOpen={createModal.isOpen} onClose={createModal.onClose} isCentered size="md">
        <ModalOverlay />
        <ModalContent borderRadius="xl">
          <ModalHeader fontWeight="700">New Service Template</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired>
                <FormLabel fontWeight="600">Template Name</FormLabel>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='e.g., "Sunday Morning Worship"' />
              </FormControl>
              <HStack w="full" spacing="4">
                <FormControl>
                  <FormLabel fontWeight="600">Day of Week</FormLabel>
                  <Select value={dayOfWeek} onChange={(e) => setDayOfWeek(parseInt(e.target.value))}>
                    {DAYS.map((day, i) => <option key={i} value={i}>{day}</option>)}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontWeight="600">Time</FormLabel>
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </FormControl>
              </HStack>
              <Text fontSize="sm" color="gray.500">
                A default structure (Welcome, Worship Set, Sermon, Closing) will be created. You can customize it later.
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr="3" onClick={createModal.onClose}>Cancel</Button>
            <Button onClick={handleCreate} isDisabled={!title}>Create Template</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Generate Service Modal */}
      <Modal isOpen={generateModal.isOpen} onClose={generateModal.onClose} isCentered size="md">
        <ModalOverlay />
        <ModalContent borderRadius="xl">
          <ModalHeader fontWeight="700">Generate Service from Template</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired>
                <FormLabel fontWeight="600">Service Date</FormLabel>
                <Input type="date" value={generateDate} onChange={(e) => setGenerateDate(e.target.value)} />
              </FormControl>
              <Text fontSize="sm" color="gray.500">
                A new draft service will be created with all segments and roles from the template pre-filled.
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr="3" onClick={generateModal.onClose}>Cancel</Button>
            <Button onClick={handleGenerate} isDisabled={!generateDate}>Generate</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog isOpen={deleteConfirm.isOpen} onClose={deleteConfirm.onClose} onConfirm={handleDelete} title="Delete Template" message="This will permanently delete this template. Existing services created from it will not be affected." confirmLabel="Delete" />
    </Box>
  );
}
