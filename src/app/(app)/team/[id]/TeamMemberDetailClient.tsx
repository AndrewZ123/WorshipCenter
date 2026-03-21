'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Text, HStack, Button, VStack, Input,
  FormControl, FormLabel, Card, CardBody, useToast, IconButton,
  Badge, Table, Thead, Tbody, Tr, Th, Td,
  Spinner, Center, Flex, useColorModeValue, Menu, MenuButton, MenuList, MenuItem,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import type { TeamMember, Service } from '@/lib/types';
import EmptyState from '@/components/ui/EmptyState';
import Avatar from '@/components/ui/Avatar';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatShortDate } from '@/lib/formatDate';

// Lucide icons
import { 
  ArrowLeft, MoreVertical, Edit, Trash2, Mail, Phone, Briefcase, Calendar
} from 'lucide-react';

const roleLabel = (r: string) => r.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// ========== Main Client Component ==========
export default function TeamMemberDetailClient() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { church } = useAuth();
  const store = useStore();
  const memberId = params.id as string;

  const [member, setMember] = useState<TeamMember | null>(null);
  const [editing, setEditing] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rolesStr, setRolesStr] = useState('');

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const headingColor = useColorModeValue('gray.900', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  const loadData = useCallback(async () => {
    if (!church) return;
    try {
      setLoading(true);
      const m = await store.teamMembers.getById(memberId, church.id);
      setMember(m);
      if (m) {
        setName(m.name);
        setEmail(m.email);
        setPhone(m.phone);
        setRolesStr(m.roles.join(', '));
      }
      setServices(await store.services.getByChurch(church.id));
    } catch (error) {
      console.error('Error loading member:', error);
      toast({ title: 'Error loading data', description: 'Please refresh the page.', status: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  }, [church, memberId, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const [recentAssignments, setRecentAssignments] = useState<{ service: Service; role: string; status: string }[]>([]);

  useEffect(() => {
    async function loadAssignments() {
      const results: { service: Service; role: string; status: string }[] = [];
      for (const svc of services) {
        const svcAssignments = await store.assignments.getByService(svc.id, church?.id || '');
        svcAssignments
          .filter((a) => a.team_member_id === memberId)
          .forEach((a) => {
            results.push({ service: svc, role: a.role, status: a.status });
          });
      }
      results.sort((a, b) => new Date(b.service.date).getTime() - new Date(a.service.date).getTime());
      setRecentAssignments(results.slice(0, 5));
    }
    if (services.length > 0 && church) loadAssignments();
  }, [services, memberId, church]);

  if (loading) {
    return (
      <Center minH="50vh">
        <Spinner size="xl" color="teal.500" />
      </Center>
    );
  }

  if (!member) {
    return (
      <Box p="8" textAlign="center" color="gray.400">
        <Text>Team member not found</Text>
      </Box>
    );
  }

  const handleSave = async () => {
    if (!church) return;
    await store.teamMembers.update(memberId, church.id, {
      name,
      email,
      phone,
      roles: rolesStr.split(',').map((r) => r.trim()).filter(Boolean),
    });
    setEditing(false);
    await loadData();
    toast({ title: 'Member updated', status: 'success', duration: 2000 });
  };

  return (
    <Box p={{ base: '4', md: '8' }} maxW="800px" mx="auto">
      {/* Header */}
      <Flex mb="6" gap="3" align="flex-start" direction={{ base: 'column', md: 'row' }}>
        <HStack spacing="3" flex="1">
          <IconButton 
            aria-label="Back" 
            icon={<ArrowLeft size={20} />} 
            variant="ghost" 
            onClick={() => router.push('/team')}
            minW="44px"
            color="gray.500"
            _hover={{ color: 'gray.700', bg: 'gray.100' }}
          />
          <Box>
            <Text fontSize="2xl" fontWeight="bold" color={headingColor} letterSpacing="tight">{member.name}</Text>
            <HStack spacing="2" mt="1">
              {member.roles.slice(0, 3).map((role) => (
                <Badge key={role} variant="subtle" colorScheme="gray" fontSize="xs" borderRadius="full" px="2">{role}</Badge>
              ))}
              {member.roles.length > 3 && (
                <Badge variant="subtle" colorScheme="gray" fontSize="xs" borderRadius="full" px="2">+{member.roles.length - 3}</Badge>
              )}
            </HStack>
          </Box>
        </HStack>
        
        {!editing && (
          <Menu>
            <MenuButton 
              as={IconButton} 
              icon={<MoreVertical size={20} />} 
              variant="ghost"
              aria-label="Actions"
              color="gray.400"
              _hover={{ color: 'gray.600', bg: 'gray.100' }}
            />
            <MenuList borderRadius="xl">
              <MenuItem onClick={() => setEditing(true)}><HStack><Edit size={16} /><Text>Edit</Text></HStack></MenuItem>
            </MenuList>
          </Menu>
        )}
      </Flex>

      {/* Profile Card with Avatar */}
      <Card mb="6" bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
        <CardBody>
          {editing ? (
            <VStack spacing="4" align="stretch">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Name</FormLabel>
                <Input value={name} onChange={(e) => setName(e.target.value)} borderRadius="lg" />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Email</FormLabel>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} borderRadius="lg" />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Phone</FormLabel>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} borderRadius="lg" />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Roles</FormLabel>
                <Input value={rolesStr} onChange={(e) => setRolesStr(e.target.value)} placeholder="Comma-separated" borderRadius="lg" />
              </FormControl>
              <Flex gap="3" justify="flex-end">
                <Button variant="ghost" onClick={() => { setEditing(false); loadData(); }}>Cancel</Button>
                <Button colorScheme="teal" onClick={handleSave} fontWeight="600">Save Changes</Button>
              </Flex>
            </VStack>
          ) : (
            <VStack spacing="4" align="stretch">
              {/* Avatar centered */}
              <Flex justify="center" mb="2">
                <Avatar name={member.name} size="xl" />
              </Flex>
              
              {/* Info rows */}
              <HStack spacing="3">
                <Mail size={16} className="text-gray-400" />
                <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase" w="60px">Email</Text>
                <Text fontSize="sm" color={subtextColor}>{member.email || 'Not provided'}</Text>
              </HStack>
              <HStack spacing="3">
                <Phone size={16} className="text-gray-400" />
                <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase" w="60px">Phone</Text>
                <Text fontSize="sm" color={subtextColor}>{member.phone || 'Not provided'}</Text>
              </HStack>
              <HStack spacing="3">
                <Briefcase size={16} className="text-gray-400" />
                <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase" w="60px">Roles</Text>
                <HStack spacing="1" flexWrap="wrap">
                  {member.roles.length > 0 ? member.roles.map((role) => (
                    <Badge key={role} variant="subtle" colorScheme="teal" fontSize="xs" borderRadius="full" px="2">{role}</Badge>
                  )) : <Text fontSize="sm" color="gray.400">No roles assigned</Text>}
                </HStack>
              </HStack>
            </VStack>
          )}
        </CardBody>
      </Card>

      {/* Recent Services */}
      <Text fontSize="lg" fontWeight="semibold" color={headingColor} mb="4">Recent Services</Text>
      
      {recentAssignments.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="Never scheduled"
          description="This team member hasn't been assigned to any services yet."
          ctaLabel="Go to Services"
          ctaOnClick={() => router.push('/services')}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <Box display={{ base: 'none', md: 'block' }} bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden" boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
            <Table variant="simple" size="sm">
              <Thead bg={useColorModeValue('gray.50', 'gray.700')}>
                <Tr>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Date</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Service</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Role</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {recentAssignments.map((a, i) => (
                  <Tr 
                    key={i} 
                    cursor="pointer"
                    transition="all 0.15s"
                    onClick={() => router.push(`/services/${a.service.id}`)}
                    sx={{ borderLeft: '3px solid transparent' }}
                    _hover={{ 
                      bg: hoverBg,
                      borderLeftColor: 'teal.500',
                    }}
                  >
                    <Td fontSize="sm">{formatShortDate(a.service.date)}</Td>
                    <Td fontSize="sm">
                      <Text color="teal.600" fontWeight="500" _hover={{ textDecoration: 'underline' }}>{a.service.title}</Text>
                    </Td>
                    <Td fontSize="sm" color={subtextColor}>{roleLabel(a.role)}</Td>
                    <Td>
                      <StatusBadge status={a.status as 'confirmed' | 'declined' | 'pending'} />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          {/* Mobile Cards */}
          <VStack spacing="3" align="stretch" display={{ base: 'flex', md: 'none' }}>
            {recentAssignments.map((a, i) => (
              <Box
                key={i}
                bg={cardBg}
                borderRadius="xl"
                border="1px solid"
                borderColor={borderColor}
                p="4"
                cursor="pointer"
                onClick={() => router.push(`/services/${a.service.id}`)}
                boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
                _hover={{ 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
                  transform: 'translateY(-1px)'
                }}
                transition="all 0.15s"
                borderLeft="3px solid"
                borderLeftColor="teal.500"
              >
                <HStack justify="space-between" mb="2">
                  <Text color="teal.600" fontWeight="600" noOfLines={1}>{a.service.title}</Text>
                  <Text fontSize="sm" color={subtextColor}>{formatShortDate(a.service.date)}</Text>
                </HStack>
                <HStack spacing="3">
                  <Text fontSize="sm" color={subtextColor}>{roleLabel(a.role)}</Text>
                  <StatusBadge status={a.status as 'confirmed' | 'declined' | 'pending'} />
                </HStack>
              </Box>
            ))}
          </VStack>
        </>
      )}
    </Box>
  );
}