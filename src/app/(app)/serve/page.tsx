'use client';

import React, { useState, useEffect } from 'react';
import {
  Box, Text, VStack, HStack, Button, useToast, Spinner, Center,
  Card, CardBody, useColorModeValue, Select, Flex, Tag, TagLabel,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalCloseButton, ModalFooter, FormControl, FormLabel, Input,
  useDisclosure, SimpleGrid, Badge,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import { supabase } from '@/lib/supabase';
import { apiUrl } from '@/lib/api-base';
import type { ServiceRolePosition, SignupRequest, SignupRequestPopulated } from '@/lib/types';
import { Calendar, Clock, Users, UserPlus, CheckCircle, AlertCircle, XCircle, Filter } from 'lucide-react';

const ROLE_OPTIONS = [
  'worship_leader', 'vocals', 'acoustic', 'electric', 'keys', 'bass', 'drums',
  'sound', 'media', 'lighting', 'choir', 'pastor', 'hospitality',
];

interface OpenPosition extends ServiceRolePosition {
  services: {
    id: string;
    title: string;
    date: string;
    time: string;
    status: string;
  };
  filled: number;
  pending: number;
}

export default function ServePage() {
  const { user, church } = useAuth();
  const store = useStore();
  const toast = useToast();
  const signupModal = useDisclosure();
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [myRequests, setMyRequests] = useState<SignupRequestPopulated[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [signingUp, setSigningUp] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<OpenPosition | null>(null);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => {
    if (church) loadData();
  }, [church]);

  const loadData = async () => {
    if (!church) return;
    try {
      setLoading(true);
      const rawPositions = await store.rolePositions.getOpenForChurch(church.id);
      const enriched: OpenPosition[] = await Promise.all(
        rawPositions.map(async (pos) => {
          const filled = await store.rolePositions.getFilledCount(pos.service_id, pos.role);
          const pending = await store.signupRequests.getPendingCountForRole(pos.service_id, pos.role);
          return { ...pos, filled, pending };
        })
      );
      setPositions(enriched.filter(p => (p.filled + p.pending) < p.max_volunteers));

      if (user?.team_member_id) {
        const requests = await store.signupRequests.getByTeamMember(user.team_member_id, church.id);
        setMyRequests(requests);
      }
    } catch (error) {
      console.error('Error loading serve data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (position: OpenPosition) => {
    if (!church || !user) return;
    setSigningUp(position.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const body: any = {
        serviceId: position.service_id,
        role: position.role,
        churchId: church.id,
      };

      if (user.team_member_id) {
        body.teamMemberId = user.team_member_id;
      } else {
        body.name = newName || user.name;
        body.email = newEmail || user.email;
        body.phone = newPhone || '';
      }

      const response = await fetch(apiUrl('/api/signup/request'), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sign up');
      }

      toast({
        title: 'Signed up!',
        description: 'Your request has been submitted for approval.',
        status: 'success',
      });

      signupModal.onClose();
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign up',
        status: 'error',
      });
    } finally {
      setSigningUp(null);
    }
  };

  const openSignupModal = (position: OpenPosition) => {
    setSelectedPosition(position);
    if (!user?.team_member_id) {
      setNewName(user?.name || '');
      setNewEmail(user?.email || '');
      setNewPhone('');
    }
    signupModal.onOpen();
  };

  const filteredPositions = roleFilter === 'all'
    ? positions
    : positions.filter(p => p.role === roleFilter);

  const getAvailableSlots = (pos: OpenPosition) => pos.max_volunteers - pos.filled - pos.pending;

  if (loading) {
    return (
      <Center minH="50vh">
        <Spinner size="xl" color="teal.500" />
      </Center>
    );
  }

  return (
    <Box p={{ base: '4', md: '8' }} pt={{ base: '2', md: '8' }} maxW="900px" w="full" mx="auto">
      <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} mb="6" flexWrap="wrap" gap="4">
        <Box>
          <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">Serve</Text>
          <Text mt="1" fontSize="sm" color={subtextColor}>
            Find open positions and sign up to serve
          </Text>
        </Box>
      </Flex>

      {/* My Requests */}
      {myRequests.length > 0 && (
        <Box mb="6">
          <Text fontWeight="600" fontSize="sm" mb="3" color={subtextColor}>
            My Signup Requests
          </Text>
          <VStack spacing="2" align="stretch">
            {myRequests.map((req) => (
              <Card key={req.id} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" size="sm">
                <CardBody py="3" px="4">
                  <HStack justify="space-between">
                    <HStack spacing="3">
                      {req.status === 'approved' && <CheckCircle size={18} color="var(--chakra-colors-green-500)" />}
                      {req.status === 'pending' && <AlertCircle size={18} color="var(--chakra-colors-yellow-500)" />}
                      {req.status === 'declined' && <XCircle size={18} color="var(--chakra-colors-red-500)" />}
                      <Box>
                        <Text fontWeight="600" fontSize="sm" color={textColor}>
                          {req.role} — {req.service?.title || 'Service'}
                        </Text>
                        <Text fontSize="xs" color={subtextColor}>
                          {req.service?.date}
                        </Text>
                      </Box>
                    </HStack>
                    <Badge
                      colorScheme={req.status === 'approved' ? 'green' : req.status === 'pending' ? 'yellow' : 'red'}
                      borderRadius="full"
                      px="3"
                      py="1"
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

      {/* Filters */}
      <HStack mb="4" spacing="3">
        <Filter size={16} color="var(--chakra-colors-gray-400)" />
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          w="200px"
          size="sm"
          borderRadius="lg"
        >
          <option value="all">All Roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
          ))}
        </Select>
      </HStack>

      {/* Open Positions */}
      {filteredPositions.length === 0 ? (
        <Center py="16">
          <VStack spacing="3">
            <UserPlus size={48} color="var(--chakra-colors-gray-300)" />
            <Text fontWeight="600" color={subtextColor}>No open positions right now</Text>
            <Text fontSize="sm" color={subtextColor} textAlign="center" maxW="400px">
              Check back later for open positions to sign up for. You can also check your services page for upcoming events.
            </Text>
          </VStack>
        </Center>
      ) : (
        <VStack spacing="3" align="stretch">
          {filteredPositions.map((pos) => (
            <Card
              key={pos.id}
              bg={cardBg}
              border="1px solid"
              borderColor={borderColor}
              borderRadius="xl"
              boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
              _hover={{ borderColor: 'teal.200', transform: 'translateY(-1px)' }}
              transition="all 0.15s ease"
            >
              <CardBody py="4" px="5">
                <Flex direction={{ base: 'column', md: 'row' }} align={{ base: 'stretch', md: 'center' }} justify="space-between" gap="3">
                  <Box flex="1">
                    <HStack spacing="3" mb="1">
                      <Text fontWeight="700" fontSize="md" color={textColor}>
                        {pos.services.title}
                      </Text>
                      <Tag size="sm" colorScheme="teal" variant="subtle" borderRadius="full">
                        <TagLabel>{pos.role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</TagLabel>
                      </Tag>
                    </HStack>
                    <HStack spacing="4" mt="1" color={subtextColor}>
                      <HStack spacing="1.5">
                        <Calendar size={14} />
                        <Text fontSize="sm">{pos.services.date}</Text>
                      </HStack>
                      <HStack spacing="1.5">
                        <Clock size={14} />
                        <Text fontSize="sm">{pos.services.time}</Text>
                      </HStack>
                      <HStack spacing="1.5">
                        <Users size={14} />
                        <Text fontSize="sm">
                          {pos.filled + pos.pending}/{pos.max_volunteers} filled
                        </Text>
                      </HStack>
                    </HStack>
                  </Box>
                  <Button
                    colorScheme="teal"
                    size="sm"
                    leftIcon={<UserPlus size={16} />}
                    isLoading={signingUp === pos.id}
                    onClick={() => openSignupModal(pos)}
                    borderRadius="lg"
                    fontWeight="600"
                    flexShrink={0}
                    w={{ base: 'full', md: 'auto' }}
                  >
                    Sign Up
                  </Button>
                </Flex>
              </CardBody>
            </Card>
          ))}
        </VStack>
      )}

      {/* Signup Confirmation Modal */}
      <Modal isOpen={signupModal.isOpen} onClose={signupModal.onClose} isCentered size="md">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl">
          <ModalHeader fontWeight="700">Sign Up for Position</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedPosition && (
              <VStack spacing="4" align="stretch">
                <Box bg="teal.50" borderRadius="lg" p="4" border="1px solid" borderColor="teal.100">
                  <Text fontWeight="600" fontSize="sm" color="teal.800">
                    {selectedPosition.services.title}
                  </Text>
                  <HStack spacing="3" mt="1" color="teal.600" fontSize="sm">
                    <Text>{selectedPosition.services.date}</Text>
                    <Text>·</Text>
                    <Text>{selectedPosition.services.time}</Text>
                    <Text>·</Text>
                    <Text>{selectedPosition.role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
                  </HStack>
                </Box>

                {!user?.team_member_id ? (
                  <>
                    <Text fontSize="sm" color={subtextColor}>
                      Please provide your contact information to sign up.
                    </Text>
                    <FormControl isRequired>
                      <FormLabel fontWeight="600" fontSize="sm">Name</FormLabel>
                      <Input value={newName} onChange={(e) => setNewName(e.target.value)} borderRadius="lg" />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel fontWeight="600" fontSize="sm">Email</FormLabel>
                      <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} borderRadius="lg" />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontWeight="600" fontSize="sm">Phone</FormLabel>
                      <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} borderRadius="lg" placeholder="Optional" />
                    </FormControl>
                  </>
                ) : (
                  <Text fontSize="sm" color={subtextColor}>
                    You are signing up as <strong>{user.name}</strong>. An admin will review and confirm your request.
                  </Text>
                )}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={signupModal.onClose}>Cancel</Button>
            <Button
              colorScheme="teal"
              onClick={() => selectedPosition && handleSignup(selectedPosition)}
              isLoading={signingUp !== null}
              isDisabled={!selectedPosition || (!user?.team_member_id && (!newName || !newEmail))}
              fontWeight="600"
            >
              Submit Request
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
