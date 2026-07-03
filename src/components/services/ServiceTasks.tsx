'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  SimpleGrid,
  Text,
  Button,
  IconButton,
  Input,
  Textarea,
  FormControl,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  useToast,
  Checkbox,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Portal,
  Progress,
  Badge,
  Skeleton,
  SkeletonText,
  Select,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  CheckSquare,
  Plus,
  MoreVertical,
  Trash2,
  Pencil,
  User,
  ListChecks,
  Sparkles,
  Flag,
  Calendar,
  Link2,
  AlertCircle,
} from 'lucide-react';
import { db } from '@/lib/store';
import type { ServiceTask, TeamMember, TaskPriority } from '@/lib/types';

interface ServiceTasksProps {
  serviceId: string;
  churchId: string;
  currentUserId: string;
  isReadOnly?: boolean;
}

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; bg: string; label: string; borderColor: string }> = {
  urgent: { color: 'red.600', bg: 'red.50', label: 'Urgent', borderColor: 'red.400' },
  high: { color: 'orange.600', bg: 'orange.50', label: 'High', borderColor: 'orange.400' },
  medium: { color: 'blue.600', bg: 'blue.50', label: 'Medium', borderColor: 'blue.300' },
  low: { color: 'gray.500', bg: 'gray.50', label: 'Low', borderColor: 'gray.300' },
};

export default function ServiceTasks({
  serviceId,
  churchId,
  currentUserId,
  isReadOnly = false,
}: ServiceTasksProps) {
  const toast = useToast();
  const taskBorderColor = useColorModeValue('gray.200', 'gray.700');
  const doneTaskBg = useColorModeValue('teal.50', 'rgba(13,148,136,0.1)');
  const overdueTaskBg = useColorModeValue('red.50', 'rgba(220,38,38,0.1)');
  const defaultTaskBg = useColorModeValue('white', 'gray.800');
  const progressBg = useColorModeValue('gray.100', 'gray.700');
  const iconBoxBg = useColorModeValue('teal.100', 'rgba(13,148,136,0.2)');
  const emptyBg = useColorModeValue('gray.50', 'gray.800');
  const emptyBorder = useColorModeValue('gray.200', 'gray.700');
  const skeletonBorder = useColorModeValue('gray.200', 'gray.700');
  const skeletonBg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const doneTextColor = useColorModeValue('gray.400', 'gray.500');
  const mutedText = useColorModeValue('gray.500', 'gray.400');
  const mutedIcon = useColorModeValue('gray.400', 'gray.500');
  const actionColor = useColorModeValue('gray.400', 'gray.500');
  const actionHoverBg = useColorModeValue('gray.100', 'gray.600');
  const actionHoverColor = useColorModeValue('gray.600', 'gray.300');
  const doneBorder = useColorModeValue('teal.200', 'rgba(13,148,136,0.3)');
  const overdueBorder = useColorModeValue('red.200', 'rgba(220,38,38,0.3)');
  const [tasks, setTasks] = useState<ServiceTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<ServiceTask | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskDependsOn, setNewTaskDependsOn] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await db.tasks.getByService(serviceId, churchId);
      setTasks(data || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [serviceId, churchId]);

  const loadTeamMembers = useCallback(async () => {
    try {
      const data = await db.teamMembers.getByChurch(churchId);
      setTeamMembers(data || []);
    } catch (err) {
      console.error('Failed to load team members:', err);
    }
  }, [churchId]);

  useEffect(() => {
    loadTasks();
    loadTeamMembers();
  }, [loadTasks, loadTeamMembers]);

  // Check if a task's dependency is completed
  const isDependencyMet = (task: ServiceTask): boolean => {
    if (!task.depends_on_task_id) return true;
    const dependency = tasks.find((t) => t.id === task.depends_on_task_id);
    return !dependency || dependency.status === 'done';
  };

  // Check if a task is overdue
  const isOverdue = (task: ServiceTask): boolean => {
    if (!task.due_date || task.status === 'done') return false;
    return new Date(task.due_date) < new Date();
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a task title.',
        status: 'warning',
        duration: 3000,
      });
      return;
    }
    try {
      const payload = {
        service_id: serviceId,
        church_id: churchId,
        template_id: null,
        title: newTaskTitle.trim(),
        notes: newTaskNotes.trim(),
        assigned_team_member_id: newTaskAssignee || null,
        assigned_role: null,
        position: tasks.length,
        status: 'pending' as const,
        priority: newTaskPriority,
        due_date: newTaskDueDate || null,
        depends_on_task_id: newTaskDependsOn || null,
        completed_at: null,
        completed_by: null,
        due_offset_minutes: null,
      };
      const created = await db.tasks.create(payload);
      if (created) {
        setTasks([...tasks, created]);
      }
      setNewTaskTitle('');
      setNewTaskNotes('');
      setNewTaskAssignee('');
      setNewTaskPriority('medium');
      setNewTaskDueDate('');
      setNewTaskDependsOn('');
      onClose();
      toast({ title: 'Task added', status: 'success', duration: 2000 });
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to add task', status: 'error', duration: 3000 });
    }
  };

  const handleToggleDone = async (task: ServiceTask) => {
    if (isReadOnly) return;
    // Block completion if dependency isn't met
    if (!isDependencyMet(task)) {
      const depTask = tasks.find((t) => t.id === task.depends_on_task_id);
      toast({
        title: 'Cannot complete task',
        description: `This task depends on "${depTask?.title}", which must be completed first.`,
        status: 'warning',
        duration: 4000,
      });
      return;
    }
    try {
      const updated = await db.tasks.toggleDone(task.id, churchId, currentUserId);
      if (updated) {
        setTasks(tasks.map((t) => (t.id === task.id ? updated : t)));
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to update task', status: 'error', duration: 3000 });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await db.tasks.delete(taskId, churchId);
      setTasks(tasks.filter((t) => t.id !== taskId));
      toast({ title: 'Task deleted', status: 'success', duration: 2000 });
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to delete task', status: 'error', duration: 3000 });
    }
  };

  const handleUpdateTask = async () => {
    if (!editingTask) return;
    try {
      const updated = await db.tasks.update(editingTask.id, churchId, {
        title: editingTask.title,
        notes: editingTask.notes,
        assigned_team_member_id: editingTask.assigned_team_member_id,
        priority: editingTask.priority,
        due_date: editingTask.due_date,
        depends_on_task_id: editingTask.depends_on_task_id,
      });
      if (updated) {
        setTasks(tasks.map((t) => (t.id === editingTask.id ? updated : t)));
      }
      setEditingTask(null);
      onClose();
      toast({ title: 'Task updated', status: 'success', duration: 2000 });
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to update task', status: 'error', duration: 3000 });
    }
  };

  const openAddModal = () => {
    setEditingTask(null);
    setNewTaskTitle('');
    setNewTaskNotes('');
    setNewTaskAssignee('');
    setNewTaskPriority('medium');
    setNewTaskDueDate('');
    setNewTaskDependsOn('');
    onOpen();
  };

  const openEditModal = (task: ServiceTask) => {
    setEditingTask({ ...task });
    onOpen();
  };

  // Sort tasks: urgent first, then by due date, then by position
  const sortedTasks = [...tasks].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return a.position - b.position;
  });

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
  const overdueCount = tasks.filter(isOverdue).length;

  const getMemberName = (id: string | null) => {
    if (!id) return null;
    const m = teamMembers.find((m) => m.id === id);
    return m?.name || null;
  };

  const getTaskTitle = (id: string | null) => {
    if (!id) return null;
    const t = tasks.find((t) => t.id === id);
    return t?.title || null;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffHours / 24);
    if (diffHours < 0) return `Overdue by ${Math.abs(diffDays)}d`;
    if (diffHours < 24) return `Due in ${diffHours}h`;
    if (diffDays === 1) return 'Due tomorrow';
    return `Due ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  return (
    <Box p="6">
      {/* Header */}
      <HStack justify="space-between" align="center" mb="4" flexWrap="wrap" gap="2">
        <HStack spacing="3">
          <Box
            w="36px"
            h="36px"
            borderRadius="lg"
            bg={iconBoxBg}
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <ListChecks size={20} color={iconBoxBg === 'teal.100' ? '#0D9488' : '#5EEAD4'} />
          </Box>
          <Box>
            <Text fontSize="lg" fontWeight="700">
              Tasks & Checklists
            </Text>
            <Text fontSize="sm" color="gray.500">
              {doneCount} of {tasks.length} completed
              {overdueCount > 0 && (
                <Text as="span" color="red.500" fontWeight="600"> · {overdueCount} overdue</Text>
              )}
            </Text>
          </Box>
        </HStack>
        {!isReadOnly && (
          <Button
            size="sm"
            colorScheme="teal"
            leftIcon={<Plus size={16} />}
            onClick={openAddModal}
            fontWeight="600"
          >
            Add Task
          </Button>
        )}
      </HStack>

      {/* Progress bar */}
      {tasks.length > 0 && (
        <Box mb="4">
          <Progress
            value={progress}
            size="sm"
            colorScheme="teal"
            borderRadius="full"
            bg={progressBg}
          />
        </Box>
      )}

      {/* Tasks list */}
      {loading ? (
        <VStack spacing="3" align="stretch">
          {[1, 2, 3].map((i) => (
            <Box
              key={i}
              p="4"
              borderRadius="lg"
              border="1px solid"
              borderColor={skeletonBorder}
              bg={skeletonBg}
            >
              <Skeleton h="20px" w="60%" mb="2" />
              <SkeletonText noOfLines={1} spacing="2" skeletonHeight="2" />
            </Box>
          ))}
        </VStack>
      ) : tasks.length === 0 ? (
        <Box
          p="8"
          borderRadius="xl"
          border="2px dashed"
          borderColor={emptyBorder}
          bg={emptyBg}
          textAlign="center"
        >
          <Sparkles size={32} color={mutedIcon} style={{ margin: '0 auto 8px' }} />
          <Text fontWeight="600" color={textColor} mb="1">
            No tasks yet
          </Text>
          <Text fontSize="sm" color={mutedText}>
            {isReadOnly
              ? 'Tasks will appear here once they are added.'
              : 'Add tasks to track preparations, checklists, and to-dos for this service.'}
          </Text>
        </Box>
      ) : (
        <VStack spacing="2" align="stretch">
          {sortedTasks.map((task) => {
            const isDone = task.status === 'done';
            const assigneeName = getMemberName(task.assigned_team_member_id);
            const depMet = isDependencyMet(task);
            const overdue = isOverdue(task);
            const depTitle = getTaskTitle(task.depends_on_task_id);
            const prConfig = PRIORITY_CONFIG[task.priority || 'medium'];

            return (
              <Box
                key={task.id}
                p="4"
                borderRadius="lg"
                border="1px solid"
                borderColor={isDone ? doneBorder : overdue ? overdueBorder : taskBorderColor}
                borderLeft="4px solid"
                borderLeftColor={isDone ? 'transparent' : prConfig.borderColor}
                bg={isDone ? doneTaskBg : overdue ? overdueTaskBg : defaultTaskBg}
                transition="all 0.15s ease"
                _hover={!isReadOnly ? { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } : {}}
              >
                <HStack spacing="3" align="start">
                  {/* Checkbox */}
                  <Tooltip
                    label={!depMet ? `Blocked by: ${depTitle}` : ''}
                    isDisabled={depMet || isDone}
                    placement="top"
                  >
                    <Checkbox
                      isChecked={isDone}
                      onChange={() => handleToggleDone(task)}
                      isDisabled={isReadOnly || (!depMet && !isDone)}
                      colorScheme="teal"
                      mt="2px"
                    />
                  </Tooltip>

                  {/* Content */}
                  <VStack spacing="1" align="start" flex="1">
                    <HStack spacing="2" flexWrap="wrap">
                      <Text
                        fontWeight="600"
                        color={isDone ? doneTextColor : textColor}
                        textDecoration={isDone ? 'line-through' : 'none'}
                      >
                        {task.title}
                      </Text>
                      {/* Priority Badge */}
                      {task.priority && (
                        <Badge
                          colorScheme={task.priority === 'urgent' ? 'red' : task.priority === 'high' ? 'orange' : task.priority === 'low' ? 'gray' : 'blue'}
                          variant="subtle"
                          fontSize="xs"
                          textTransform="capitalize"
                        >
                          <HStack spacing="1" display="inline-flex">
                            <Flag size={9} />
                            <Text>{prConfig.label}</Text>
                          </HStack>
                        </Badge>
                      )}
                    </HStack>
                    {task.notes && (
                      <Text fontSize="sm" color={mutedText}>
                        {task.notes}
                      </Text>
                    )}
                    <HStack spacing="3" mt="1" flexWrap="wrap">
                      {assigneeName && (
                        <HStack spacing="1">
                          <User size={12} color="var(--chakra-colors-gray-400)" />
                          <Text fontSize="xs" color={mutedText}>{assigneeName}</Text>
                        </HStack>
                      )}
                      {task.due_date && (
                        <HStack spacing="1">
                          <Calendar size={12} color={overdue ? 'var(--chakra-colors-red-500)' : 'var(--chakra-colors-gray-400)'} />
                          <Text
                            fontSize="xs"
                            color={overdue ? 'red.500' : 'gray.500'}
                            fontWeight={overdue ? '600' : 'normal'}
                          >
                            {formatDate(task.due_date)}
                          </Text>
                        </HStack>
                      )}
                      {depTitle && (
                        <Tooltip label={`Depends on: ${depTitle}`} placement="top">
                          <HStack spacing="1">
                            <Link2 size={12} color={depMet ? 'var(--chakra-colors-gray-400)' : 'var(--chakra-colors-orange-500)'} />
                            <Text
                              fontSize="xs"
                              color={depMet ? 'gray.400' : 'orange.600'}
                              textDecoration={depMet ? 'line-through' : 'none'}
                            >
                              Blocked
                            </Text>
                          </HStack>
                        </Tooltip>
                      )}
                      {!depMet && !isDone && (
                        <HStack spacing="1">
                          <AlertCircle size={12} color="var(--chakra-colors-orange-500)" />
                          <Text fontSize="xs" color="orange.600">Waiting on dependency</Text>
                        </HStack>
                      )}
                      {isDone && (
                        <Badge colorScheme="teal" variant="subtle" fontSize="xs">
                          Done
                        </Badge>
                      )}
                    </HStack>
                  </VStack>

                  {/* Actions */}
                  {!isReadOnly && (
                    <Menu>
                      <MenuButton
                        as={IconButton}
                        icon={<MoreVertical size={16} />}
                        size="sm"
                        variant="ghost"
                        color={actionColor}
                        _hover={{ color: actionHoverColor, bg: actionHoverBg }}
                      />
                      <Portal>
                        <MenuList borderRadius="xl" zIndex={50}>
                          <MenuItem
                            icon={<Pencil size={14} />}
                            onClick={() => openEditModal(task)}
                          >
                            Edit
                          </MenuItem>
                          <MenuItem
                            icon={<Trash2 size={14} />}
                            color="red.500"
                            onClick={() => handleDeleteTask(task.id)}
                          >
                            Delete
                          </MenuItem>
                        </MenuList>
                      </Portal>
                    </Menu>
                  )}
                </HStack>
              </Box>
            );
          })}
        </VStack>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalOverlay />
        <ModalContent borderRadius="xl">
          <ModalHeader>
            {editingTask ? 'Edit Task' : 'Add Task'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4" align="stretch">
              <FormControl isRequired>
                <Text fontSize="sm" fontWeight="600" mb="1">Title</Text>
                <Input
                  value={editingTask ? editingTask.title : newTaskTitle}
                  onChange={(e) =>
                    editingTask
                      ? setEditingTask({ ...editingTask, title: e.target.value })
                      : setNewTaskTitle(e.target.value)
                  }
                  placeholder="e.g. Prepare slides for opening song"
                  borderRadius="lg"
                />
              </FormControl>
              <FormControl>
                <Text fontSize="sm" fontWeight="600" mb="1">Notes (optional)</Text>
                <Textarea
                  value={editingTask ? editingTask.notes : newTaskNotes}
                  onChange={(e) =>
                    editingTask
                      ? setEditingTask({ ...editingTask, notes: e.target.value })
                      : setNewTaskNotes(e.target.value)
                  }
                  placeholder="Add details..."
                  borderRadius="lg"
                  rows={2}
                />
              </FormControl>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing="4">
                <FormControl>
                  <Text fontSize="sm" fontWeight="600" mb="1">Assign to (optional)</Text>
                  <Select
                    value={editingTask ? editingTask.assigned_team_member_id || '' : newTaskAssignee}
                    onChange={(e) =>
                      editingTask
                        ? setEditingTask({ ...editingTask, assigned_team_member_id: e.target.value || null })
                        : setNewTaskAssignee(e.target.value)
                    }
                    borderRadius="lg"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <Text fontSize="sm" fontWeight="600" mb="1">Priority</Text>
                  <Select
                    value={editingTask ? editingTask.priority || 'medium' : newTaskPriority}
                    onChange={(e) =>
                      editingTask
                        ? setEditingTask({ ...editingTask, priority: e.target.value as TaskPriority })
                        : setNewTaskPriority(e.target.value as TaskPriority)
                    }
                    borderRadius="lg"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </Select>
                </FormControl>
              </SimpleGrid>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing="4">
                <FormControl>
                  <Text fontSize="sm" fontWeight="600" mb="1">Due date (optional)</Text>
                  <Input
                    type="datetime-local"
                    value={editingTask ? (editingTask.due_date ? editingTask.due_date.slice(0, 16) : '') : newTaskDueDate}
                    onChange={(e) =>
                      editingTask
                        ? setEditingTask({ ...editingTask, due_date: e.target.value ? new Date(e.target.value).toISOString() : null })
                        : setNewTaskDueDate(e.target.value)
                    }
                    borderRadius="lg"
                  />
                </FormControl>
                <FormControl>
                  <Text fontSize="sm" fontWeight="600" mb="1">Depends on (optional)</Text>
                  <Select
                    value={editingTask ? editingTask.depends_on_task_id || '' : newTaskDependsOn}
                    onChange={(e) =>
                      editingTask
                        ? setEditingTask({ ...editingTask, depends_on_task_id: e.target.value || null })
                        : setNewTaskDependsOn(e.target.value)
                    }
                    borderRadius="lg"
                  >
                    <option value="">No dependency</option>
                    {tasks
                      .filter((t) => t.id !== editingTask?.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                  </Select>
                </FormControl>
              </SimpleGrid>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr="3" onClick={onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="teal"
              onClick={editingTask ? handleUpdateTask : handleAddTask}
              leftIcon={<CheckSquare size={16} />}
            >
              {editingTask ? 'Save Changes' : 'Add Task'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}