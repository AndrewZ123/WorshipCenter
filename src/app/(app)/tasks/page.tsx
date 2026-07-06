'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Text, HStack, VStack, Card, CardBody, useToast,
  useColorModeValue, Spinner, Center, Badge, Checkbox, IconButton,
  Heading,
  Tabs, TabList, TabPanels, Tab, TabPanel, Input, InputGroup, InputLeftElement,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import ServiceDetailClient from '@/app/(app)/services/[id]/ServiceDetailClient';
import type { ServiceTask } from '@/lib/types';
import EmptyState from '@/components/ui/EmptyState';
import { formatServiceDate } from '@/lib/formatDate';
import { CheckSquare, Search, Calendar, ArrowRight } from 'lucide-react';

type EnrichedTask = ServiceTask & {
  service?: { date: string; title: string } | null;
};

export default function MyTasksPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, church } = useAuth();
  const store = useStore();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<EnrichedTask[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const headingColor = useColorModeValue('gray.900', 'white');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const iconColor = useColorModeValue('gray.400', 'gray.500');
  const tabActiveColor = useColorModeValue('teal.600', 'teal.300');
  const tabInactiveColor = useColorModeValue('gray.500', 'gray.400');
  const arrowHoverBg = useColorModeValue('teal.50', 'rgba(13,148,136,0.15)');
  const arrowHoverColor = useColorModeValue('teal.600', 'teal.300');

  const loadTasks = useCallback(async () => {
    if (!church || !user || !user.team_member_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const allTasks = await store.tasks.getMyTasks(church.id, user.team_member_id);
      // getMyTasks already returns tasks enriched with services(date, title)
      setTasks(allTasks as EnrichedTask[]);
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast({ title: 'Error loading tasks', status: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  }, [church, user, store, toast]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleToggleComplete = async (taskId: string, currentStatus: string) => {
    if (!church || !user) return;

    try {
      await store.tasks.toggleDone(taskId, church.id, user.id);
      await loadTasks();
      toast({
        title: currentStatus !== 'done' ? 'Task completed!' : 'Task reopened',
        status: 'success',
        duration: 1500,
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({ title: 'Error updating task', status: 'error', duration: 3000 });
    }
  };

  // Filter tasks
  const filtered = tasks.filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.service?.title || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const myPending = filtered.filter((t) => t.status !== 'done');
  const myCompleted = filtered.filter((t) => t.status === 'done');

  if (loading) {
    return (
      <Center minH="60vh">
        <Spinner size="xl" color="teal.500" />
      </Center>
    );
  }

  if (selectedServiceId) {
    return <ServiceDetailClient serviceId={selectedServiceId} onBack={() => setSelectedServiceId(null)} />;
  }

  return (
    <Box px={{ base: '4', md: '8' }} pt={{ base: '2', md: '8' }} pb={{ base: '4', md: '8' }} maxW="1100px" mx="auto">
      {/* Header */}
      <VStack spacing="2" align="start" mb="6">
        <Heading size="lg" color={headingColor}>My Tasks</Heading>
        <Text color={subtextColor} fontSize="sm">
          Tasks assigned to you across all services.
        </Text>
      </VStack>

      {/* Search */}
      <InputGroup mb="6">
        <InputLeftElement pointerEvents="none">
          <Search size={16} color={iconColor} />
        </InputLeftElement>
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          borderRadius="lg"
          bg={cardBg}
        />
      </InputGroup>

      {/* Tabs */}
      <Tabs onChange={setActiveTab} index={activeTab}>
        <TabList borderBottom="1px solid" borderColor={borderColor}>
          <Tab
            fontSize="sm"
            fontWeight="600"
            color={activeTab === 0 ? tabActiveColor : tabInactiveColor}
            _selected={{ color: tabActiveColor, borderBottom: '2px solid', borderBottomColor: tabActiveColor }}
          >
            To Do ({myPending.length})
          </Tab>
          <Tab
            fontSize="sm"
            fontWeight="600"
            color={activeTab === 1 ? tabActiveColor : tabInactiveColor}
            _selected={{ color: tabActiveColor, borderBottom: '2px solid', borderBottomColor: tabActiveColor }}
          >
            Completed ({myCompleted.length})
          </Tab>
        </TabList>

        <TabPanels>
          {/* To Do Tab */}
          <TabPanel px="0">
            {myPending.length === 0 ? (
              <EmptyState
                icon="check"
                title="All caught up!"
                description="You have no pending tasks. Great job!"
              />
            ) : (
              <VStack spacing="2" align="stretch">
                {myPending
                  .sort((a, b) => a.position - b.position)
                  .map((task) => (
                    <Card
                      key={task.id}
                      bg={cardBg}
                      borderRadius="lg"
                      border="1px solid"
                      borderColor={borderColor}
                      _hover={{ boxShadow: 'md', borderColor: 'teal.200' }}
                      transition="all 0.15s ease"
                      cursor="pointer"
                      onClick={() => task.service_id && setSelectedServiceId(task.service_id)}
                    >
                      <CardBody py="3">
                        <HStack spacing="3" align="start">
                          <Checkbox
                            isChecked={false}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleComplete(task.id, task.status);
                            }}
                            colorScheme="teal"
                            size="lg"
                            mt="1"
                          />
                          <Box flex="1">
                            <Text fontWeight="600" color={headingColor} fontSize="sm">
                              {task.title}
                            </Text>
                            {task.notes && (
                              <Text fontSize="xs" color={subtextColor} mt="1" noOfLines={2}>
                                {task.notes}
                              </Text>
                            )}
                            <HStack spacing="3" mt="2" flexWrap="wrap">
                              {task.service && (
                                <HStack spacing="1">
                                  <Calendar size={12} color={iconColor} />
                                  <Text fontSize="xs" color={subtextColor}>
                                    {formatServiceDate(task.service.date)} · {task.service.title}
                                  </Text>
                                </HStack>
                              )}
                              {task.assigned_role && (
                                <Badge colorScheme="teal" variant="subtle" fontSize="xs">
                                  {task.assigned_role}
                                </Badge>
                              )}
                            </HStack>
                          </Box>
                          <IconButton
                            aria-label="Open service"
                            icon={<ArrowRight size={16} />}
                            size="sm"
                            variant="ghost"
                            color={iconColor}
                            _hover={{ color: arrowHoverColor, bg: arrowHoverBg }}
                          />
                        </HStack>
                      </CardBody>
                    </Card>
                  ))}
              </VStack>
            )}
          </TabPanel>

          {/* Completed Tab */}
          <TabPanel px="0">
            {myCompleted.length === 0 ? (
              <EmptyState
                icon="check"
                title="No completed tasks"
                description="Completed tasks will appear here."
              />
            ) : (
              <VStack spacing="2" align="stretch">
                {myCompleted.map((task) => (
                  <Card
                    key={task.id}
                    bg={cardBg}
                    borderRadius="lg"
                    border="1px solid"
                    borderColor={borderColor}
                    opacity={0.7}
                    cursor="pointer"
                    onClick={() => task.service_id && setSelectedServiceId(task.service_id)}
                  >
                    <CardBody py="3">
                      <HStack spacing="3" align="start">
                        <Checkbox
                          isChecked
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleComplete(task.id, task.status);
                          }}
                          colorScheme="teal"
                          size="lg"
                          mt="1"
                        />
                        <Box flex="1">
                          <Text fontWeight="600" color={subtextColor} fontSize="sm" textDecoration="line-through">
                            {task.title}
                          </Text>
                          {task.service && (
                            <HStack spacing="1" mt="1">
                                  <Calendar size={12} color={iconColor} />
                              <Text fontSize="xs" color={subtextColor}>
                                {formatServiceDate(task.service.date)} · {task.service.title}
                              </Text>
                            </HStack>
                          )}
                        </Box>
                      </HStack>
                    </CardBody>
                  </Card>
                ))}
              </VStack>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}