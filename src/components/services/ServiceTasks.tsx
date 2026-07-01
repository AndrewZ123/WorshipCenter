'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
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
} from 'lucide-react';
import { db } from '@/lib/store';
import type { ServiceTask, TeamMember } from '@/lib/types';

interface ServiceTasksProps {
  serviceId: string;
  churchId: string;
  currentUserId: string;
  isReadOnly?: boolean;
}

export default function ServiceTasks({
  serviceId,
  churchId,
  currentUserId,
  isReadOnly = false,
}: ServiceTasksProps) {
  const toast = useToast();
  const [tasks, setTasks] = useState<ServiceTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<ServiceTask | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
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
      onClose();
      toast({ title: 'Task added', status: 'success', duration: 2000 });
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to add task', status: 'error', duration: 3000 });
    }
  };

  const handleToggleDone = async (task: ServiceTask) => {
    if (isReadOnly) return;
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
    onOpen();
  };

  const openEditModal = (task: ServiceTask) => {
    setEditingTask(task);
    onOpen();
  };

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  const getMemberName = (id: string | null) => {
    if (!id) return null;
    const m = teamMembers.find((m) => m.id === id);
    return m?.name || null;
  };

  return (
    <Box>
      {/* Header */}
      <HStack justify="space-between" align="center" mb="4" flexWrap="wrap" gap="2">
        <HStack spacing="3">
          <Box
            w="36px"
            h="36px"
            borderRadius="lg"
            bg="teal.100"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <ListChecks size={20} className="text-teal-600" />
          </Box>
          <Box>
            <Text fontSize="lg" fontWeight="700">
              Tasks & Checklists
            </Text>
            <Text fontSize="sm" color="gray.500">
              {doneCount} of {tasks.length} completed
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
            bg="gray.100"
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
              borderColor="gray.200"
              bg="white"
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
          borderColor="gray.200"
          bg="gray.50"
          textAlign="center"
        >
          <Sparkles size={32} className="mx-auto text-gray-300 mb-2" />
          <Text fontWeight="600" color="gray.600" mb="1">
            No tasks yet
          </Text>
          <Text fontSize="sm" color="gray.500">
            {isReadOnly
              ? 'Tasks will appear here once they are added.'
              : 'Add tasks to track preparations, checklists, and to-dos for this service.'}
          </Text>
        </Box>
      ) : (
        <VStack spacing="2" align="stretch">
          {tasks.map((task) => {
            const isDone = task.status === 'done';
            const assigneeName = getMemberName(task.assigned_team_member_id);
            return (
              <Box
                key={task.id}
                p="4"
                borderRadius="lg"
                border="1px solid"
                borderColor={isDone ? 'teal.200' : 'gray.200'}
                bg={isDone ? 'teal.50' : 'white'}
                transition="all 0.15s ease"
                _hover={!isReadOnly ? { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } : {}}
              >
                <HStack spacing="3" align="start">
                  {/* Checkbox */}
                  <Checkbox
                    isChecked={isDone}
                    onChange={() => handleToggleDone(task)}
                    isDisabled={isReadOnly}
                    colorScheme="teal"
                    mt="2px"
                  />

                  {/* Content */}
                  <VStack spacing="1" align="start" flex="1">
                    <Text
                      fontWeight="600"
                      color={isDone ? 'gray.400' : 'gray.800'}
                      textDecoration={isDone ? 'line-through' : 'none'}
                    >
                      {task.title}
                    </Text>
                    {task.notes && (
                      <Text fontSize="sm" color="gray.500">
                        {task.notes}
                      </Text>
                    )}
                    <HStack spacing="3" mt="1" flexWrap="wrap">
                      {assigneeName && (
                        <HStack spacing="1">
                          <User size={12} className="text-gray-400" />
                          <Text fontSize="xs" color="gray.500">{assigneeName}</Text>
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
                        color="gray.400"
                        _hover={{ color: 'gray.600', bg: 'gray.100' }}
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
              <FormControl>
                <Text fontSize="sm" fontWeight="600" mb="1">Assign to (optional)</Text>
                <Input
                  as="select"
                  value={editingTask ? editingTask.assigned_team_member_id || '' : newTaskAssignee}
                  onChange={(e) =>
                    editingTask
                      ? setEditingTask({ ...editingTask, assigned_team_member_id: e.target.value || null })
                      : setNewTaskAssignee(e.target.value)
                  }
                  borderRadius="lg"
                  sx={{ cursor: 'pointer' }}
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Input>
              </FormControl>
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