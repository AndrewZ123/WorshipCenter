'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Heading, HStack, Button, VStack, Text, Badge,
  Input, FormLabel, FormControl, Select, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter,
  useDisclosure, Tabs, TabList, TabPanels, Tab, TabPanel,
  IconButton, useToast, Flex, useColorModeValue,
  Tag, TagLabel,
} from '@chakra-ui/react';
import { useDemo } from '@/lib/demo/context';
import type { ServiceTemplate } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { ArrowLeft, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type EditorItem = { id: string; type: 'song' | 'segment'; position: number; title: string; song_id: string | null; notes: string; duration_minutes: number | null; key: string | null };

const uuid = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

export default function DemoTemplateEditor() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { church, templates, songs, updateTemplate, deleteTemplate, createServiceFromTemplate } = useDemo();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<ServiceTemplate | null>(null);
  const [items, setItems] = useState<EditorItem[]>([]);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(0);
  const [time, setTime] = useState('09:00');

  const addSegmentModal = useDisclosure();
  const addSongModal = useDisclosure();
  const deleteItemConfirm = useDisclosure();
  const deleteTemplateConfirm = useDisclosure();
  const generateModal = useDisclosure();

  const [segTitle, setSegTitle] = useState('');
  const [segDuration, setSegDuration] = useState('');
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [genDate, setGenDate] = useState('');

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const slotBg = useColorModeValue('teal.50', 'gray.700');
  const emptyBg = useColorModeValue('gray.50', 'gray.700');
  const hoverBg = useColorModeValue('gray.100', 'gray.600');

  useEffect(() => {
    const t = templates.find(t => t.id === templateId);
    if (t) {
      setTemplate(t);
      setTitle(t.title);
      setDay(t.day_of_week);
      setTime(t.time);
      setItems(t.items.map(item => ({ ...item, id: uuid() })));
    } else {
      router.push('/demo/templates');
    }
  }, [templateId, templates, router]);

  const saveItems = (newItems: EditorItem[]) => {
    if (!church) return;
    setItems(newItems);
    updateTemplate(templateId, {
      items: newItems.map(({ id, ...rest }, idx) => ({ ...rest, position: idx })),
    });
  };

  const handleAddSongSlot = () => {
    const newItems = [...items, { id: uuid(), type: 'song' as const, position: items.length, title: 'Song Slot', song_id: null, notes: '', duration_minutes: 5, key: null }];
    saveItems(newItems);
    toast({ title: 'Song slot added', status: 'success', duration: 1500 });
  };

  const handleAddSegment = () => {
    if (!segTitle) return;
    const newItems = [...items, { id: uuid(), type: 'segment' as const, position: items.length, title: segTitle, song_id: null, notes: '', duration_minutes: segDuration ? parseInt(segDuration) : null, key: null }];
    saveItems(newItems);
    setSegTitle(''); setSegDuration('');
    addSegmentModal.onClose();
    toast({ title: 'Segment added', status: 'success', duration: 1500 });
  };

  const handleDeleteItem = () => {
    if (deleteItemId) {
      saveItems(items.filter(i => i.id !== deleteItemId));
      setDeleteItemId(null);
    }
  };

  const handleMoveItem = (itemId: string, direction: 'up' | 'down') => {
    const idx = items.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= items.length) return;
    const newItems = [...items];
    [newItems[idx], newItems[newIdx]] = [newItems[newIdx], newItems[idx]];
    saveItems(newItems);
  };

  const handleSaveSettings = () => {
    if (!church) return;
    updateTemplate(templateId, { title, day_of_week: day, time });
    toast({ title: 'Template settings saved', status: 'success', duration: 2000 });
  };

  const handleDelete = () => {
    if (!church) return;
    deleteTemplate(templateId);
    toast({ title: 'Template deleted', status: 'info', duration: 2000 });
    router.push('/demo/templates');
  };

  const handleGenerate = () => {
    if (!genDate) return;
    const svc = createServiceFromTemplate(templateId, genDate);
    if (svc) {
      toast({ title: 'Service created from template!', status: 'success', duration: 2000 });
      generateModal.onClose();
      setGenDate('');
      router.push(`/demo/services/${svc.id}`);
    }
  };

  const handleUpdateItem = (id: string, updates: Partial<EditorItem>) => {
    saveItems(items.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const totalDuration = items.reduce((sum, i) => sum + (i.duration_minutes || 0), 0);

  if (!template) {
    return <Box p="8" textAlign="center" color="gray.400"><Text>Loading template...</Text></Box>;
  }

  const getNextDateForDay = (dow: number) => {
    const d = new Date();
    const diff = ((dow - d.getDay()) + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  };

  return (
    <Box px={{ base: '4', md: '8' }} pt={{ base: '2', md: '8' }} pb={{ base: '4', md: '8' }} maxW="1100px" mx="auto">
      <HStack mb="6" spacing="3">
        <IconButton aria-label="Back" icon={<ArrowLeft size={20} />} variant="ghost" onClick={() => router.push('/demo/templates')} />
        <Box flex="1">
          <Heading size="lg" fontWeight="700" color={useColorModeValue('gray.800', 'white')}>Edit Template: {template.title}</Heading>
          <HStack mt="1" spacing="2">
            <Tag size="sm" colorScheme="teal" variant="subtle"><TagLabel>{DAYS[template.day_of_week]}</TagLabel></Tag>
            <Text color="gray.500" fontSize="sm">{template.time}</Text>
          </HStack>
        </Box>
        <Button variant="outline" size="sm" onClick={() => { setGenDate(getNextDateForDay(template.day_of_week)); generateModal.onOpen(); }}>Generate</Button>
        <Button variant="ghost" colorScheme="red" size="sm" onClick={deleteTemplateConfirm.onOpen}>Delete</Button>
      </HStack>

      <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={{ base: '4', md: '6' }}>
        <Tabs variant="soft-rounded" colorScheme="teal">
          <TabList mb="6" gap="2">
            <Tab fontWeight="600" fontSize="sm">Template Items ({items.length})</Tab>
            <Tab fontWeight="600" fontSize="sm">Settings</Tab>
          </TabList>

          <TabPanels>
            <TabPanel p="0">
              <Flex justify="space-between" align="center" mb="4" flexWrap="wrap" gap="3">
                <HStack spacing="2">
                  <Button size="sm" onClick={handleAddSongSlot} variant="outline">+ Add Song Slot</Button>
                  <Button size="sm" onClick={addSegmentModal.onOpen} variant="outline">+ Add Segment</Button>
                </HStack>
                <Text fontSize="sm" color="gray.500" fontWeight="600">Est. Duration: {totalDuration} min</Text>
              </Flex>

              {items.length === 0 ? (
                <Box textAlign="center" py="12" color="gray.400" bg={emptyBg} borderRadius="xl" border="1px dashed" borderColor={borderColor}>
                  <Text fontSize="lg" mb="1">No items yet</Text>
                  <Text fontSize="sm">Add song slots and segments to build your template</Text>
                </Box>
              ) : (
                <VStack spacing="2" align="stretch">
                  {items.map((item, index) => {
                    const isSlot = item.type === 'song';
                    return (
                      <Box
                        key={item.id}
                        bg={isSlot ? slotBg : cardBg}
                        border="1px solid"
                        borderColor={isSlot ? 'teal.200' : borderColor}
                        borderStyle={isSlot ? 'dashed' : 'solid'}
                        borderRadius="lg"
                        px={{ base: '3', md: '4' }}
                        py="3"
                        transition="all 0.15s"
                        _hover={{ shadow: 'sm' }}
                      >
                        <HStack spacing="3" mb={{ base: '2', md: '0' }}>
                          <Box flex="1" minW="0">
                            <Input
                              value={item.title}
                              onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                              variant="unstyled"
                              fontWeight="600"
                              color={isSlot ? 'gray.500' : 'inherit'}
                              fontSize="md"
                              px="1"
                              _focus={{ bg: hoverBg, borderRadius: 'md' }}
                            />
                          </Box>
                          <Badge colorScheme={isSlot ? 'teal' : 'orange'} variant="subtle" fontSize="xs" flexShrink={0} display={{ base: 'none', md: 'flex' }}>
                            {isSlot ? 'Song Slot' : 'Segment'}
                          </Badge>
                        </HStack>

                        <HStack spacing="2" justify="flex-end" pl={{ base: '44px', md: '0' }}>
                          <Badge colorScheme={isSlot ? 'teal' : 'orange'} variant="subtle" fontSize="xs" display={{ base: 'flex', md: 'none' }}>
                            {isSlot ? 'Song' : 'Segment'}
                          </Badge>

                          <HStack spacing="1" flexShrink={0}>
                            <Input
                              value={item.duration_minutes?.toString() || '0'}
                              onChange={(e) => handleUpdateItem(item.id, { duration_minutes: parseInt(e.target.value) || 0 })}
                              type="number"
                              size="sm"
                              w="50px"
                              px="1"
                              variant="unstyled"
                              _focus={{ bg: hoverBg, borderRadius: 'md' }}
                            />
                            <Text fontSize="sm" color="gray.400">min</Text>
                          </HStack>

                          <IconButton aria-label="Move up" icon={<ChevronUp size={14} />} size="sm" variant="ghost" isDisabled={index === 0} onClick={() => handleMoveItem(item.id, 'up')} />
                          <IconButton aria-label="Move down" icon={<ChevronDown size={14} />} size="sm" variant="ghost" isDisabled={index === items.length - 1} onClick={() => handleMoveItem(item.id, 'down')} />
                          <IconButton aria-label="Delete item" icon={<Trash2 size={16} />} size="sm" variant="ghost" colorScheme="red" onClick={() => { setDeleteItemId(item.id); deleteItemConfirm.onOpen(); }} />
                        </HStack>
                      </Box>
                    );
                  })}
                </VStack>
              )}
            </TabPanel>

            <TabPanel p="0">
              <VStack spacing="5" align="stretch" maxW="500px">
                <FormControl isRequired>
                  <FormLabel fontWeight="600">Template Title</FormLabel>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </FormControl>
                <HStack spacing="4">
                  <FormControl>
                    <FormLabel fontWeight="600">Default Day</FormLabel>
                    <Select value={day} onChange={(e) => setDay(parseInt(e.target.value))}>
                      {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontWeight="600">Default Time</FormLabel>
                    <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </FormControl>
                </HStack>
                <Button onClick={handleSaveSettings} alignSelf="flex-start" mt="2">Save Settings</Button>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>

      <Modal isOpen={addSegmentModal.isOpen} onClose={addSegmentModal.onClose} isCentered size="md">
        <ModalOverlay /><ModalContent borderRadius="xl"><ModalHeader fontWeight="700">Add Segment</ModalHeader><ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired><FormLabel fontWeight="600">Segment Title</FormLabel><Input value={segTitle} onChange={(e) => setSegTitle(e.target.value)} placeholder='e.g., "Welcome", "Sermon", "Offering"' /></FormControl>
              <FormControl><FormLabel fontWeight="600">Duration (min)</FormLabel><Input value={segDuration} onChange={(e) => setSegDuration(e.target.value)} placeholder="e.g., 5" type="number" /><Text fontSize="xs" color="gray.400">Used to estimate total service time.</Text></FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr="3" onClick={addSegmentModal.onClose}>Cancel</Button><Button onClick={handleAddSegment} isDisabled={!segTitle}>Add Segment</Button></ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={generateModal.isOpen} onClose={generateModal.onClose} isCentered size="md">
        <ModalOverlay /><ModalContent borderRadius="xl"><ModalHeader fontWeight="700">Generate Service</ModalHeader><ModalCloseButton />
          <ModalBody>
            <FormControl isRequired>
              <FormLabel fontWeight="600">Service Date</FormLabel>
              <Input type="date" value={genDate} onChange={(e) => setGenDate(e.target.value)} />
            </FormControl>
            <Text fontSize="sm" color="gray.500" mt="3">Creates a new draft service from this template.</Text>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr="3" onClick={generateModal.onClose}>Cancel</Button><Button onClick={handleGenerate} isDisabled={!genDate}>Generate</Button></ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog isOpen={deleteItemConfirm.isOpen} onClose={deleteItemConfirm.onClose} onConfirm={handleDeleteItem} title="Delete Item" message="Remove this item from the template?" confirmLabel="Delete" />
      <ConfirmDialog isOpen={deleteTemplateConfirm.isOpen} onClose={deleteTemplateConfirm.onClose} onConfirm={handleDelete} title="Delete Template" message="This will permanently delete this template." confirmLabel="Delete Template" />
    </Box>
  );
}
