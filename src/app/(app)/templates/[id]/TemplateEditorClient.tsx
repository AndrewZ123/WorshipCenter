'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Heading, HStack, Button, VStack, Text, Badge,
  Input, FormLabel, FormControl, Select, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter,
  useDisclosure, Tabs, TabList, TabPanels, Tab, TabPanel,
  IconButton, useToast, Flex, FormHelperText, useColorModeValue,
  Tag, TagLabel, Editable, EditableInput, EditablePreview,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import type { ServiceTemplate, ServiceItem } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import SortableItem from '@/components/ui/SortableItem';

// Lucide icons
import { 
  ArrowLeft, Trash2
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

const uuid = () => Math.random().toString(36).substring(2) + Date.now().toString(36);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ========== Main Client Component ==========
type EditorItem = Omit<ServiceItem, 'id' | 'service_id'> & { id: string };

export default function TemplateEditorClient() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { church } = useAuth();
  const store = useStore();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<ServiceTemplate | null>(null);
  const [items, setItems] = useState<EditorItem[]>([]);
  
  // Settings tab
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(0);
  const [time, setTime] = useState('09:00');

  const addSegmentModal = useDisclosure();
  const deleteItemConfirm = useDisclosure();
  const deleteTemplateConfirm = useDisclosure();

  const [segTitle, setSegTitle] = useState('');
  const [segDuration, setSegDuration] = useState('');
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const itemBg = useColorModeValue('gray.50', 'gray.700');
  const slotBg = useColorModeValue('brand.50', 'gray.700');
  const emptyBg = useColorModeValue('gray.50', 'gray.700');
  const hoverBg = useColorModeValue('gray.100', 'gray.600');

  const loadData = useCallback(async () => {
    if (!church) return;
    const t = await store.templates.getById(templateId);
    if (t) {
      setTemplate(t);
      setTitle(t.title);
      setDay(t.day_of_week);
      setTime(t.time);
      // Give them temporary random IDs for local state
      setItems((t.items as ServiceItem[]).map((item) => ({ ...item, id: uuid() })));
    }
  }, [church, templateId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Configure dnd-kit sensors with mobile-optimized settings for reliable drag handling
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      
      const newItems = arrayMove(items, oldIndex, newIndex);
      await saveItems(newItems);
    }
  };

  if (!template) {
    return <Box p="8" textAlign="center" color="gray.400"><Text>Loading template...</Text></Box>;
  }

  const saveItems = async (newItems: EditorItem[]) => {
    setItems(newItems);
    await store.templates.update(templateId, {
      items: newItems.map(({ id, ...rest }, idx) => ({ ...rest, position: idx }))
    });
  };

  const handleAddSongSlot = () => {
    const newItems: EditorItem[] = [
      ...items,
      { id: uuid(), type: 'song', position: items.length, title: 'Song Slot', song_id: null, notes: '', duration_minutes: 5, key: null }
    ];
    saveItems(newItems);
    toast({ title: 'Song slot added', status: 'success', duration: 1500 });
  };

  const handleAddSegment = () => {
    if (!segTitle) return;
    const newItems: EditorItem[] = [
      ...items,
      { id: uuid(), type: 'segment', position: items.length, title: segTitle, song_id: null, notes: '', duration_minutes: segDuration ? parseInt(segDuration) : null, key: null }
    ];
    saveItems(newItems);
    setSegTitle(''); setSegDuration('');
    addSegmentModal.onClose();
    toast({ title: 'Segment added', status: 'success', duration: 1500 });
  };

  const handleDeleteItem = () => {
    if (deleteItemId) {
      const newItems = items.filter(i => i.id !== deleteItemId);
      saveItems(newItems);
      setDeleteItemId(null);
    }
  };

  const handleSaveSettings = async () => {
    await store.templates.update(templateId, { title, day_of_week: day, time });
    toast({ title: 'Template settings saved', status: 'success', duration: 2000 });
    await loadData();
  };

  const handleDeleteTemplate = async () => {
    await store.templates.delete(templateId);
    toast({ title: 'Template deleted', status: 'info', duration: 2000 });
    router.push('/services');
  };

  const handleUpdateItem = async (id: string, updates: Partial<EditorItem>) => {
    const newItems = items.map(i => i.id === id ? { ...i, ...updates } : i);
    await saveItems(newItems);
  };

  const totalDuration = items.reduce((sum, i) => sum + (i.duration_minutes || 0), 0);

  return (
    <Box p={{ base: '4', md: '8' }} maxW="1100px" mx="auto">
      <HStack mb="6" spacing="3">
        <IconButton aria-label="Back" icon={<ArrowLeft size={20} />} variant="ghost" onClick={() => router.push('/services')} />
        <Box flex="1">
          <Heading size="lg" fontWeight="700">Edit Template: {template.title}</Heading>
          <HStack mt="1" spacing="2">
            <Tag size="sm" colorScheme="brand" variant="subtle"><TagLabel>{DAYS[template.day_of_week]}</TagLabel></Tag>
            <Text color="gray.500" fontSize="sm">{template.time}</Text>
          </HStack>
        </Box>
        <Button variant="ghost" colorScheme="red" size="sm" onClick={deleteTemplateConfirm.onOpen}>Delete Template</Button>
      </HStack>

      <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={{ base: '4', md: '6' }}>
        <Tabs variant="soft-rounded" colorScheme="brand">
          <TabList mb="6" gap="2">
            <Tab fontWeight="600" fontSize="sm">Template Items ({items.length})</Tab>
            <Tab fontWeight="600" fontSize="sm">Settings</Tab>
          </TabList>
          
          <TabPanels>
            {/* Tab 1: Template Items */}
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
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={items} strategy={verticalListSortingStrategy}>
                    <VStack spacing="2" align="stretch">
                      {items.map((item, index) => {
                        const isSlot = item.type === 'song';
                        return (
                          <SortableItem key={item.id} id={item.id}>
                            <Box 
                              bg={isSlot ? slotBg : cardBg} 
                              border="1px solid" 
                              borderColor={isSlot ? 'brand.200' : borderColor} 
                              borderStyle={isSlot ? 'dashed' : 'solid'}
                              borderRadius="lg" 
                              px={{ base: '3', md: '4' }} 
                              py="3"
                              transition="all 0.15s"
                              _hover={{ shadow: 'sm' }}
                              w="full"
                            >
                              {/* Main row: Title + Badge */}
                              <HStack spacing="3" mb={{ base: '2', md: '0' }}>
                                {/* Title - Editable, full width */}
                                <Box flex="1" minW="0">
                                  <Editable value={item.title} onChange={(val) => handleUpdateItem(item.id, { title: val })} submitOnBlur>
                                    <EditablePreview fontWeight="600" color={isSlot ? 'gray.500' : 'inherit'} cursor="text" _hover={{ bg: hoverBg }} px="1" borderRadius="md" wordBreak="break-word" />
                                    <EditableInput fontWeight="600" px="1" />
                                  </Editable>
                                </Box>
                                
                                {/* Type badge - hidden on mobile */}
                                <Badge colorScheme={item.type === 'song' ? 'brand' : 'orange'} variant="subtle" fontSize="xs" flexShrink={0} display={{ base: 'none', md: 'flex' }}>
                                  {item.type === 'song' ? 'Song Slot' : 'Segment'}
                                </Badge>
                              </HStack>
                              
                              {/* Actions row: Badge (mobile) + Duration + Delete */}
                              <HStack spacing="2" justify="flex-end" pl={{ base: '44px', md: '0' }}>
                                {/* Type badge - mobile only */}
                                <Badge colorScheme={item.type === 'song' ? 'brand' : 'orange'} variant="subtle" fontSize="xs" display={{ base: 'flex', md: 'none' }}>
                                  {item.type === 'song' ? 'Song' : 'Segment'}
                                </Badge>
                                
                                {/* Duration - Editable */}
                                <HStack spacing="1" flexShrink={0}>
                                  <Editable value={item.duration_minutes?.toString() || '0'} onChange={(val) => handleUpdateItem(item.id, { duration_minutes: parseInt(val) || 0 })} submitOnBlur>
                                    <EditablePreview fontSize="sm" color="gray.400" cursor="text" _hover={{ bg: hoverBg }} px={1} borderRadius="md" />
                                    <EditableInput type="number" fontSize="sm" w="50px" px={1} mb="-1px" />
                                  </Editable>
                                  <Text fontSize="sm" color="gray.400">min</Text>
                                </HStack>
                                
                                {/* Delete button */}
                                <IconButton 
                                  aria-label="Delete item" 
                                  icon={<Trash2 size={16} />} 
                                  size="sm" 
                                  variant="ghost" 
                                  colorScheme="red" 
                                  onClick={() => { setDeleteItemId(item.id); deleteItemConfirm.onOpen(); }}
                                />
                              </HStack>
                            </Box>
                          </SortableItem>
                        );
                      })}
                    </VStack>
                  </SortableContext>
                </DndContext>
              )}
            </TabPanel>

            {/* Tab 2: Settings */}
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

      {/* Add Segment Modal */}
      <Modal isOpen={addSegmentModal.isOpen} onClose={addSegmentModal.onClose} isCentered size="md">
        <ModalOverlay /><ModalContent borderRadius="xl"><ModalHeader fontWeight="700">Add Segment</ModalHeader><ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired><FormLabel fontWeight="600">Segment Title</FormLabel><Input value={segTitle} onChange={(e) => setSegTitle(e.target.value)} placeholder='e.g., "Welcome", "Sermon", "Offering"' /></FormControl>
              <FormControl><FormLabel fontWeight="600">Duration (min)</FormLabel><Input value={segDuration} onChange={(e) => setSegDuration(e.target.value)} placeholder="e.g., 5" type="number" /><FormHelperText fontSize="xs" color="gray.400">Used to estimate total service time.</FormHelperText></FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr="3" onClick={addSegmentModal.onClose}>Cancel</Button><Button onClick={handleAddSegment} isDisabled={!segTitle}>Add Segment</Button></ModalFooter>
        </ModalContent>
      </Modal>

      {/* Confirms */}
      <ConfirmDialog isOpen={deleteItemConfirm.isOpen} onClose={deleteItemConfirm.onClose} onConfirm={handleDeleteItem} title="Delete Item" message="Remove this item from the template?" confirmLabel="Delete" />
      <ConfirmDialog isOpen={deleteTemplateConfirm.isOpen} onClose={deleteTemplateConfirm.onClose} onConfirm={handleDeleteTemplate} title="Delete Template" message="This will permanently delete this template. Existing services are not affected." confirmLabel="Delete Template" />
    </Box>
  );
}