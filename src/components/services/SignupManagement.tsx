'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Text, VStack, HStack, Button, useToast, Spinner, Center,
  Card, CardBody, useColorModeValue, Tag, TagLabel, TagCloseButton,
  Flex, Badge, Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalBody, ModalCloseButton, ModalFooter, FormControl, FormLabel,
  Input, Select, useDisclosure, Switch, IconButton, SimpleGrid,
} from '@chakra-ui/react';
import { useStore } from '@/lib/StoreContext';
import { supabase } from '@/lib/supabase';
import { apiUrl } from '@/lib/api-base';
import type { ServiceRolePosition, SignupRequestPopulated } from '@/lib/types';
import { Plus, CheckCircle, XCircle, UserPlus, Trash2, Settings } from 'lucide-react';

const ROLE_OPTIONS = [
  'worship_leader', 'vocals', 'acoustic', 'electric', 'keys', 'bass', 'drums',
  'sound', 'media', 'lighting', 'choir', 'pastor', 'hospitality',
];

interface Props {
  serviceId: string;
  churchId: string;
}

export default function SignupManagement({ serviceId, churchId }: Props) {
  const store = useStore();
  const toast = useToast();
  const addModal = useDisclosure();

  const [positions, setPositions] = useState<ServiceRolePosition[]>([]);
  const [signupRequests, setSignupRequests] = useState<SignupRequestPopulated[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const [newRole, setNewRole] = useState('');
  const [newMax, setNewMax] = useState(1);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [pos, reqs] = await Promise.all([
        store.rolePositions.getByService(serviceId, churchId),
        store.signupRequests.getByService(serviceId, churchId),
      ]);
      setPositions(pos);
      setSignupRequests(reqs);
    } catch (error) {
      console.error('[SignupManagement] Error loading:', error);
    } finally {
      setLoading(false);
    }
  }, [serviceId, churchId, store]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddPosition = async () => {
    if (!newRole) return;
    try {
      const exists = positions.find(p => p.role === newRole);
      if (exists) {
        toast({ title: 'Position already exists', status: 'warning', duration: 2000 });
        return;
      }
      await store.rolePositions.create({
        service_id: serviceId,
        role: newRole,
        max_volunteers: newMax,
        signup_enabled: true,
        church_id: churchId,
      });
      toast({ title: 'Position added', status: 'success', duration: 2000 });
      setNewRole('');
      setNewMax(1);
      addModal.onClose();
      await loadData();
    } catch (error) {
      toast({ title: 'Error adding position', status: 'error', duration: 3000 });
    }
  };

  const handleToggleSignup = async (position: ServiceRolePosition) => {
    try {
      await store.rolePositions.update(position.id, churchId, {
        signup_enabled: !position.signup_enabled,
      });
      setPositions(prev => prev.map(p =>
        p.id === position.id ? { ...p, signup_enabled: !p.signup_enabled } : p
      ));
    } catch (error) {
      toast({ title: 'Error updating position', status: 'error', duration: 3000 });
    }
  };

  const handleRemovePosition = async (positionId: string) => {
    try {
      const ok = await store.rolePositions.delete(positionId, churchId);
      if (ok) {
        setPositions(prev => prev.filter(p => p.id !== positionId));
        toast({ title: 'Position removed', status: 'info', duration: 2000 });
      }
    } catch (error) {
      toast({ title: 'Error removing position', status: 'error', duration: 3000 });
    }
  };

  const handleApprove = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(apiUrl(`/api/signup/${requestId}/approve`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to approve');
      }

      toast({ title: 'Signup approved!', description: 'Assignment created.', status: 'success', duration: 3000 });
      await loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, status: 'error', duration: 3000 });
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(apiUrl(`/api/signup/${requestId}/decline`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to decline');
      }

      toast({ title: 'Signup declined', status: 'info', duration: 3000 });
      await loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, status: 'error', duration: 3000 });
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return <Center py="10"><Spinner color="teal.500" /></Center>;
  }

  const pendingRequests = signupRequests.filter(r => r.status === 'pending');

  return (
    <Box>
      {/* Positions */}
      <Flex justify="space-between" align="center" mb="4">
        <Text fontWeight="600" fontSize="md">Role Positions</Text>
        <Button size="sm" colorScheme="teal" leftIcon={<Plus size={14} />} onClick={addModal.onOpen} borderRadius="lg" fontWeight="600">
          Add Position
        </Button>
      </Flex>

      {positions.length === 0 ? (
        <Card bg={cardBg} border="1px dashed" borderColor={borderColor} borderRadius="lg" mb="6">
          <CardBody textAlign="center" py="6">
            <Text fontSize="sm" color={subtextColor}>No positions defined. Add positions to allow volunteer signups.</Text>
          </CardBody>
        </Card>
      ) : (
        <VStack spacing="2" align="stretch" mb="6">
          {positions.map((pos) => (
            <Card key={pos.id} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" size="sm">
              <CardBody py="3" px="4">
                <Flex direction={{ base: 'column', md: 'row' }} align={{ base: 'stretch', md: 'center' }} justify="space-between" gap="2">
                  <HStack spacing="3">
                    <Tag colorScheme="teal" variant="subtle" borderRadius="full" size="sm">
                      <TagLabel>{pos.role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</TagLabel>
                    </Tag>
                    <Text fontSize="sm" color={subtextColor}>Max: {pos.max_volunteers}</Text>
                  </HStack>
                  <HStack spacing="3">
                    <HStack spacing="2">
                      <Text fontSize="xs" color={subtextColor}>Signups</Text>
                      <Switch
                        size="sm"
                        isChecked={pos.signup_enabled}
                        onChange={() => handleToggleSignup(pos)}
                        colorScheme="teal"
                      />
                    </HStack>
                    <IconButton
                      aria-label="Remove position"
                      icon={<Trash2 size={14} />}
                      size="xs"
                      variant="ghost"
                      color="gray.400"
                      _hover={{ color: 'red.500' }}
                      onClick={() => handleRemovePosition(pos.id)}
                    />
                  </HStack>
                </Flex>
              </CardBody>
            </Card>
          ))}
        </VStack>
      )}

      {/* Pending Signup Requests */}
      <Text fontWeight="600" fontSize="md" mb="4">
        Pending Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
      </Text>

      {pendingRequests.length === 0 ? (
        <Card bg={cardBg} border="1px dashed" borderColor={borderColor} borderRadius="lg" mb="6">
          <CardBody textAlign="center" py="6">
            <UserPlus size={32} style={{ margin: '0 auto', opacity: 0.3, display: 'block' }} />
            <Text fontSize="sm" color={subtextColor} mt="2">No pending signup requests</Text>
          </CardBody>
        </Card>
      ) : (
        <VStack spacing="3" align="stretch" mb="6">
          {pendingRequests.map((req) => (
            <Card key={req.id} bg={cardBg} border="1px solid" borderColor="yellow.200" borderRadius="lg">
              <CardBody py="3" px="4">
                <Flex direction={{ base: 'column', md: 'row' }} align={{ base: 'stretch', md: 'center' }} justify="space-between" gap="3">
                  <Box flex="1">
                    <HStack spacing="2">
                      <Text fontWeight="600" fontSize="sm" color={textColor}>
                        {req.team_member?.name || req.name || 'Unknown'}
                      </Text>
                      <Tag size="sm" colorScheme="teal" variant="subtle" borderRadius="full">
                        <TagLabel>{req.role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</TagLabel>
                      </Tag>
                      <Badge colorScheme="yellow" borderRadius="full" px="2" fontSize="xs">Pending</Badge>
                    </HStack>
                    {!req.team_member && (
                      <Text fontSize="xs" color={subtextColor} mt="1">
                        {req.email}{req.phone ? ` · ${req.phone}` : ''} — New member
                      </Text>
                    )}
                    <Text fontSize="xs" color={subtextColor}>
                      Requested {new Date(req.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  </Box>
                  <HStack spacing="2">
                    <Button
                      size="sm"
                      colorScheme="green"
                      leftIcon={<CheckCircle size={14} />}
                      isLoading={processing === req.id}
                      onClick={() => handleApprove(req.id)}
                      borderRadius="lg"
                      fontWeight="600"
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      colorScheme="red"
                      leftIcon={<XCircle size={14} />}
                      isLoading={processing === req.id}
                      onClick={() => handleDecline(req.id)}
                      borderRadius="lg"
                    >
                      Decline
                    </Button>
                  </HStack>
                </Flex>
              </CardBody>
            </Card>
          ))}
        </VStack>
      )}

      {/* Past Requests (approved/declined) */}
      {signupRequests.filter(r => r.status !== 'pending').length > 0 && (
        <Box>
          <Text fontWeight="600" fontSize="sm" mb="3" color={subtextColor}>Past Requests</Text>
          <VStack spacing="2" align="stretch">
            {signupRequests.filter(r => r.status !== 'pending').slice(0, 20).map((req) => (
              <Card key={req.id} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" size="sm">
                <CardBody py="2" px="4">
                  <HStack justify="space-between">
                    <HStack spacing="2">
                      {req.status === 'approved' && <CheckCircle size={14} color="var(--chakra-colors-green-500)" />}
                      {req.status === 'declined' && <XCircle size={14} color="var(--chakra-colors-red-500)" />}
                      <Text fontSize="sm" color={textColor}>
                        {req.team_member?.name || req.name || 'Unknown'} — {req.role}
                      </Text>
                    </HStack>
                    <Badge
                      colorScheme={req.status === 'approved' ? 'green' : 'red'}
                      borderRadius="full"
                      px="2"
                      fontSize="xs"
                      textTransform="capitalize"
                    >
                      {req.status}
                    </Badge>
                  </HStack>
                </CardBody>
              </Card>
            ))}
          </VStack>
        </Box>
      )}

      {/* Add Position Modal */}
      <Modal isOpen={addModal.isOpen} onClose={addModal.onClose} isCentered size="sm">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl">
          <ModalHeader fontWeight="700">Add Position</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Role</FormLabel>
                <Select value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Select role" borderRadius="lg">
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Max Volunteers</FormLabel>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={newMax}
                  onChange={(e) => setNewMax(parseInt(e.target.value) || 1)}
                  borderRadius="lg"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={addModal.onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleAddPosition} isDisabled={!newRole} fontWeight="600">Add</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
