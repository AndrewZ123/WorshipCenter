'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Text, HStack, VStack, Card, CardBody, useToast,
  useColorModeValue, Spinner, Center, Badge, Checkbox, IconButton,
  Heading, Input, InputGroup, InputLeftElement,
} from '@chakra-ui/react';
import { useDemo } from '@/lib/demo/context';
import EmptyState from '@/components/ui/EmptyState';
import { formatShortDate } from '@/lib/formatDate';
import { Search, Calendar, ArrowRight } from 'lucide-react';

export default function DemoTasksPage() {
  const { user, church, tasks, services, teamMembers, updateTask } = useDemo();
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const headingColor = useColorModeValue('gray.900', 'white');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const iconColor = useColorModeValue('gray.400', 'gray.500');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  // Get current team member matching this user
  const currentTeamMemberId = user?.team_member_id || (teamMembers.find(tm => tm.name === user?.name)?.id);

  const enrichedTasks = useMemo(() => {
    const relevantTasks = currentTeamMemberId
      ? tasks.filter(t => t.assigned_team_member_id === currentTeamMemberId)
      : tasks;
    return relevantTasks.map(t => {
      const service = services.find(s => s.id === t.service_id);
      const member = t.assigned_team_member_id ? teamMembers.find(tm => tm.id === t.assigned_team_member_id) : null;
      return { ...t, service: service ? { date: service.date, title: service.title } : null, assigned_member: member };
    });
  }, [tasks, services, teamMembers, currentTeamMemberId]);

  const filteredTasks = useMemo(() => {
    let result = enrichedTasks;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.service?.title || '').toLowerCase().includes(q)
      );
    }
    result = result.filter(t => showCompleted ? t.status === 'done' : t.status !== 'done');
    return result.sort((a, b) => a.position - b.position);
  }, [enrichedTasks, search, showCompleted]);

  const pendingCount = enrichedTasks.filter(t => t.status !== 'done').length;
  const completedCount = enrichedTasks.filter(t => t.status === 'done').length;

  const handleToggle = (taskId: string, currentStatus: string) => {
    updateTask(taskId, {
      status: currentStatus === 'done' ? 'pending' : 'done',
      completed_at: currentStatus !== 'done' ? new Date().toISOString() : null,
      completed_by: currentStatus !== 'done' ? (user?.id || null) : null,
    });
    toast({
      title: currentStatus !== 'done' ? 'Task completed!' : 'Task reopened',
      status: 'success',
      duration: 1500,
    });
  };

  return (
    <Box px={{ base: '4', md: '8' }} pb={{ base: '4', md: '8' }} maxW="900px" mx="auto">
      <VStack spacing="2" align="start" mb="6">
        <Heading size="lg" color={headingColor}>My Tasks</Heading>
        <Text color={subtextColor} fontSize="sm">
          Tasks assigned to you across all services.
        </Text>
      </VStack>

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

      {/* Toggle tabs */}
      <HStack spacing="2" mb="4">
        <Box
          as="button"
          px="4" py="2"
          borderRadius="lg"
          fontSize="sm"
          fontWeight="600"
          bg={!showCompleted ? 'teal.50' : 'transparent'}
          color={!showCompleted ? 'teal.700' : subtextColor}
          onClick={() => setShowCompleted(false)}
          _hover={{ bg: !showCompleted ? 'teal.50' : hoverBg }}
        >
          To Do ({pendingCount})
        </Box>
        <Box
          as="button"
          px="4" py="2"
          borderRadius="lg"
          fontSize="sm"
          fontWeight="600"
          bg={showCompleted ? 'teal.50' : 'transparent'}
          color={showCompleted ? 'teal.700' : subtextColor}
          onClick={() => setShowCompleted(true)}
          _hover={{ bg: showCompleted ? 'teal.50' : hoverBg }}
        >
          Completed ({completedCount})
        </Box>
      </HStack>

      {filteredTasks.length === 0 ? (
        <EmptyState
          icon="check"
          title={showCompleted ? 'No completed tasks' : 'All caught up!'}
          description={showCompleted ? 'Completed tasks will appear here.' : 'You have no pending tasks. Great job!'}
        />
      ) : (
        <VStack spacing="2" align="stretch">
          {filteredTasks.map((task) => (
            <Card
              key={task.id}
              bg={cardBg}
              borderRadius="lg"
              border="1px solid"
              borderColor={borderColor}
              _hover={{ boxShadow: 'md', borderColor: 'teal.200' }}
              transition="all 0.15s"
              cursor="pointer"
              onClick={() => task.service_id && router.push(`/demo/services/${task.service_id}`)}
              opacity={task.status === 'done' ? 0.7 : 1}
            >
              <CardBody py="3">
                <HStack spacing="3" align="start">
                  <Checkbox
                    isChecked={task.status === 'done'}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggle(task.id, task.status);
                    }}
                    colorScheme="teal"
                    size="lg"
                    mt="1"
                  />
                  <Box flex="1">
                    <Text
                      fontWeight="600"
                      color={task.status === 'done' ? subtextColor : headingColor}
                      fontSize="sm"
                      textDecoration={task.status === 'done' ? 'line-through' : 'none'}
                    >
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
                            {formatShortDate(task.service.date)} · {task.service.title}
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
                    _hover={{ color: 'teal.600', bg: 'teal.50' }}
                  />
                </HStack>
              </CardBody>
            </Card>
          ))}
        </VStack>
      )}
    </Box>
  );
}
