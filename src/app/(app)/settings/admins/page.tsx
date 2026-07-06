'use client';

import { useState, useEffect } from 'react';
import {
  Box, Text, HStack, VStack, Button, Table, Thead, Tbody, Tr, Th, Td,
  Flex, useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalCloseButton, ModalFooter, FormControl,
  FormLabel, useToast, Badge, Switch, Spinner, Center,
  useColorModeValue, Card, CardBody, Divider, Icon,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Plus, Shield, Trash2 } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { AdminPermission, User } from '@/lib/types';

const SCOPES = [
  { key: 'manage_services', label: 'Services' },
  { key: 'manage_songs', label: 'Songs' },
  { key: 'manage_team', label: 'Team' },
  { key: 'manage_templates', label: 'Templates' },
  { key: 'manage_settings', label: 'Settings' },
  { key: 'manage_billing', label: 'Billing' },
  { key: 'manage_chat', label: 'Chat' },
  { key: 'manage_admins', label: 'Admin Management' },
] as const;

export default function AdminsPage() {
  const { user, church } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { isOpen: addOpen, onOpen: onAddOpen, onClose: onAddClose } = useDisclosure();
  const deleteDisclosure = useDisclosure();

  const [admins, setAdmins] = useState<(AdminPermission & { user?: Partial<User> })[]>([]);
  const [churchUsers, setChurchUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [editingPerms, setEditingPerms] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const headingColor = useColorModeValue('gray.900', 'white');

  const loadAdmins = async () => {
    if (!church) return;
    try {
      const data = await db.adminPermissions.getByChurch(church.id);
      setAdmins(data || []);
    } catch (error) {
      console.error('Error loading admins:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (church) loadAdmins();
  }, [church]);

  useEffect(() => {
    if (addOpen && church) {
      db.users.getByChurch(church.id).then(setChurchUsers);
    }
  }, [addOpen, church]);

  const handleAddAdmin = async () => {
    if (!church || !selectedUserId) return;
    setSaving(true);
    try {
      await db.adminPermissions.promoteToAdmin(selectedUserId, church.id);
      toast({ title: 'Admin added', status: 'success', duration: 2000 });
      onAddClose();
      setSelectedUserId('');
      await loadAdmins();
    } catch (error) {
      toast({ title: 'Failed to add admin', status: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAdmin = async () => {
    if (!church || !deleteId) return;
    if (deleteId === user?.id) {
      toast({ title: 'Cannot remove yourself', description: 'Ask another admin to remove you.', status: 'error', duration: 3000 });
      setDeleteId(null);
      return;
    }
    try {
      await db.adminPermissions.demoteFromAdmin(deleteId, church.id);
      toast({ title: 'Admin removed', status: 'info', duration: 2000 });
      setDeleteId(null);
      await loadAdmins();
    } catch (error) {
      toast({ title: 'Failed to remove admin', status: 'error', duration: 3000 });
    }
  };

  const handleToggleScope = async (adminUserId: string, scope: string, value: boolean) => {
    if (!church) return;
    const current = admins.find(a => a.user_id === adminUserId);
    if (!current) return;
    // Optimistic update
    setEditingPerms(prev => ({ ...prev, [`${adminUserId}.${scope}`]: value }));
    try {
      await db.adminPermissions.upsert(adminUserId, church.id, { [scope]: value } as any);
    } catch (error) {
      // Revert
      setEditingPerms(prev => ({ ...prev, [`${adminUserId}.${scope}`]: !value }));
      toast({ title: 'Failed to update permission', status: 'error', duration: 2000 });
    }
  };

  const getScopeValue = (admin: any, scope: string): boolean => {
    const key = `${admin.user_id}.${scope}`;
    if (key in editingPerms) return editingPerms[key];
    return admin[scope] ?? true;
  };

  if (loading) {
    return (
      <Center minH="50vh">
        <Spinner size="xl" color="teal.500" />
      </Center>
    );
  }

  return (
    <Box px={{ base: '4', md: '8' }} pt={{ base: '2', md: '8' }} pb={{ base: '4', md: '8' }} maxW="1100px" mx="auto">
      <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} mb="6" flexWrap="wrap" gap="4" direction={{ base: 'column', md: 'row' }}>
        <Box>
          <Text fontSize="2xl" fontWeight="bold" color={headingColor} letterSpacing="tight">Admin Management</Text>
          <Text color={subtextColor} fontSize="sm" mt="1">Manage church administrators and their permissions</Text>
        </Box>
        <Button
          onClick={onAddOpen}
          size="sm"
          colorScheme="teal"
          fontWeight="600"
          leftIcon={<Plus size={16} />}
          px="4"
        >
          Add Admin
        </Button>
      </Flex>

      {admins.length === 0 ? (
        <Box textAlign="center" py="12">
          <Shield size={48} style={{ margin: '0 auto', color: 'var(--chakra-colors-gray-300)' }} />
          <Text mt="4" fontSize="lg" fontWeight="600" color="gray.500">No admins yet</Text>
          <Text fontSize="sm" color="gray.400" mt="1">Add your first admin to delegate management tasks.</Text>
        </Box>
      ) : (
        <Box bg={bgColor} borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden">
          <Table variant="simple">
            <Thead bg={useColorModeValue('gray.50', 'gray.700')}>
              <Tr>
                <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Admin</Th>
                {SCOPES.slice(0, 4).map((scope) => (
                  <Th key={scope.key} fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">{scope.label}</Th>
                ))}
                <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">More</Th>
                <Th w="50px"></Th>
              </Tr>
            </Thead>
            <Tbody>
              {admins.map((admin) => {
                const adminUser = (admin as any).users;
                return (
                  <Tr key={admin.user_id} _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}>
                    <Td>
                      <HStack spacing="3">
                        <Avatar name={adminUser?.name || 'Admin'} src={adminUser?.avatar_url} size="sm" />
                        <Box>
                          <Text fontWeight="600" fontSize="sm" color={textColor}>{adminUser?.name || 'Unknown'}</Text>
                          <Text fontSize="xs" color={subtextColor}>{adminUser?.email || ''}</Text>
                        </Box>
                        {admin.user_id === user?.id && (
                          <Badge variant="subtle" colorScheme="teal" fontSize="xs" borderRadius="full" px="2">You</Badge>
                        )}
                      </HStack>
                    </Td>
                    {SCOPES.slice(0, 4).map((scope) => (
                      <Td key={scope.key}>
                        <Switch
                          size="sm"
                          colorScheme="teal"
                          isChecked={getScopeValue(admin, scope.key)}
                          onChange={(e) => handleToggleScope(admin.user_id, scope.key, e.target.checked)}
                        />
                      </Td>
                    ))}
                    <Td>
                      <HStack spacing="1">
                        {SCOPES.slice(4).map((scope) => (
                          <Box key={scope.key} p="1">
                            <Switch
                              size="sm"
                              colorScheme="teal"
                              isChecked={getScopeValue(admin, scope.key)}
                              onChange={(e) => handleToggleScope(admin.user_id, scope.key, e.target.checked)}
                            />
                          </Box>
                        ))}
                      </HStack>
                    </Td>
                    <Td>
                      <Button
                        size="xs"
                        variant="ghost"
                        color="red.400"
                        leftIcon={<Trash2 size={12} />}
                        onClick={() => { setDeleteId(admin.user_id); deleteDisclosure.onOpen(); }}
                        isDisabled={admin.user_id === user?.id}
                      >
                        Remove
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </Box>
      )}

      {/* Add Admin Modal */}
      <Modal isOpen={addOpen} onClose={onAddClose} isCentered size="md">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl" mx="4">
          <ModalHeader fontWeight="700">Add Admin</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isRequired>
              <FormLabel fontWeight="600" fontSize="sm">Select User</FormLabel>
              <VStack spacing="2" maxH="300px" overflowY="auto">
                {churchUsers
                  .filter((u) => u.role !== 'admin')
                  .map((u) => (
                    <Flex
                      key={u.id}
                      p="3"
                      borderRadius="lg"
                      border="1px solid"
                      borderColor={selectedUserId === u.id ? 'teal.300' : borderColor}
                      bg={selectedUserId === u.id ? 'teal.50' : 'transparent'}
                      cursor="pointer"
                      w="full"
                      align="center"
                      justify="space-between"
                      onClick={() => setSelectedUserId(u.id)}
                      _hover={{ borderColor: 'teal.200' }}
                    >
                      <HStack spacing="3">
                        <Avatar name={u.name} src={u.avatar_url} size="sm" />
                        <Box>
                          <Text fontSize="sm" fontWeight="500" color={textColor}>{u.name}</Text>
                          <Text fontSize="xs" color={subtextColor}>{u.email}</Text>
                        </Box>
                      </HStack>
                      <Badge variant="subtle" colorScheme="gray" fontSize="xs">{u.role}</Badge>
                    </Flex>
                  ))}
              </VStack>
            </FormControl>
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={onAddClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleAddAdmin} isLoading={saving} isDisabled={!selectedUserId} fontWeight="600">
              Make Admin
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        isOpen={deleteDisclosure.isOpen}
        onClose={deleteDisclosure.onClose}
        onConfirm={handleRemoveAdmin}
        title="Remove Admin?"
        message="This user will be demoted to Leader role. Their admin permissions will be removed."
        confirmLabel="Demote to Leader"
        variant="destructive"
      />
    </Box>
  );
}
