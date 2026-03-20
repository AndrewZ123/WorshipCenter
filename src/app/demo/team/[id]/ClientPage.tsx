'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Heading, HStack, Button, VStack, Text, Input,
  FormControl, FormLabel, Card, CardBody, useToast, IconButton,
  Tag, TagLabel, Wrap, WrapItem, Table, Thead, Tbody, Tr, Th, Td, Badge,
  Spinner, Center, Flex, useColorModeValue,
} from '@chakra-ui/react';
import { useDemo } from '@/lib/demo/context';
import type { TeamMember, Service } from '@/lib/types';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

const roleLabel = (r: string) => r.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export default function DemoTeamMemberDetailClient() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { teamMembers, services, assignments, updateTeamMember } = useDemo();
  const memberId = params.id as string;

  const [member, setMember] = useState<TeamMember | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edit form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rolesStr, setRolesStr] = useState('');

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const headingColor = useColorModeValue('gray.800', 'white');
  const emptyColor = useColorModeValue('gray.400', 'gray.500');
  const tableBg = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => {
    const m = teamMembers.find(m => m.id === memberId);
    setMember(m || null);
    if (m) {
      setName(m.name);
      setEmail(m.email || '');
      setPhone(m.phone || '');
      setRolesStr(m.roles.join(', '));
    }
    setLoading(false);
  }, [memberId, teamMembers]);

  // Get recent assignments for this member
  const recentAssignments = useMemo(() => {
    const results: { service: Service; role: string; status: string }[] = [];
    
    for (const svc of services) {
      const svcAssignments = assignments.filter(a => a.service_id === svc.id && a.team_member_id === memberId);
      svcAssignments.forEach((a) => {
        results.push({ service: svc, role: a.role, status: a.status });
      });
    }
    
    results.sort((a, b) => new Date(b.service.date).getTime() - new Date(a.service.date).getTime());
    return results.slice(0, 5);
  }, [services, assignments, memberId]);

  if (loading) {
    return (
      <Center minH="50vh">
        <Spinner size="xl" color="brand.500" />
      </Center>
    );
  }

  if (!member) {
    return (
      <Box p="8" textAlign="center" color={emptyColor}>
        <Text>Team member not found</Text>
      </Box>
    );
  }

  const handleSave = async () => {
    updateTeamMember(memberId, {
      name,
      email,
      phone,
      roles: rolesStr.split(',').map((r) => r.trim()).filter(Boolean),
    });
    setEditing(false);
    const m = teamMembers.find(m => m.id === memberId);
    if (m) setMember({ ...m, name, email, phone, roles: rolesStr.split(',').map((r) => r.trim()).filter(Boolean) });
    toast({ title: 'Member updated', status: 'success', duration: 2000 });
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return d;
    }
  };

  return (
    <Box p={{ base: '4', md: '8' }} maxW="800px" mx="auto">
      <HStack mb="6" spacing="3">
        <IconButton
          aria-label="Back to team"
          icon={<BackIcon />}
          variant="ghost"
          onClick={() => router.push('/demo/team')}
        />
        <Box flex="1">
          <Heading size="lg" fontWeight="700" color={headingColor}>{member.name}</Heading>
          {member.roles.length > 0 && (
            <Wrap mt="1" spacing="2">
              {member.roles.map((role) => (
                <WrapItem key={role}>
                  <Tag variant="subtle" colorScheme="brand" size="sm">
                    <TagLabel>{role}</TagLabel>
                  </Tag>
                </WrapItem>
              ))}
            </Wrap>
          )}
        </Box>
        {!editing && (
          <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
        )}
      </HStack>

      <Card mb="6" bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor}>
        <CardBody>
          {editing ? (
            <VStack spacing="4" align="stretch">
              <FormControl isRequired>
                <FormLabel fontWeight="600">Name</FormLabel>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600">Email</FormLabel>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600">Phone</FormLabel>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600">Roles</FormLabel>
                <Input value={rolesStr} onChange={(e) => setRolesStr(e.target.value)} placeholder="Comma-separated" />
              </FormControl>
              <HStack>
                <Button onClick={handleSave}>Save</Button>
                <Button variant="ghost" onClick={() => { 
                  setEditing(false); 
                  const m = teamMembers.find(m => m.id === memberId);
                  if (m) {
                    setName(m.name);
                    setEmail(m.email || '');
                    setPhone(m.phone || '');
                    setRolesStr(m.roles.join(', '));
                  }
                }}>Cancel</Button>
              </HStack>
            </VStack>
          ) : (
            <VStack spacing="3" align="stretch">
              <HStack justify="space-between">
                <Text fontWeight="600" color="gray.600">Email</Text>
                <Text>{member.email || '—'}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontWeight="600" color="gray.600">Phone</Text>
                <Text>{member.phone || '—'}</Text>
              </HStack>
            </VStack>
          )}
        </CardBody>
      </Card>

      {/* Recent Services (clickable links) */}
      <Box>
        <Heading size="md" fontWeight="700" color={headingColor} mb="4">Recent Services</Heading>
        {recentAssignments.length === 0 ? (
          <Box textAlign="center" py="8" color={emptyColor} bg={cardBg} borderRadius="xl" border="1px dashed" borderColor={borderColor}>
            <Text fontSize="sm">No assignments yet</Text>
          </Box>
        ) : (
          <>
            {/* Desktop Table */}
            <Box display={{ base: 'none', md: 'block' }} bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden">
              <Table variant="simple" size="sm">
                <Thead bg={tableBg}>
                  <Tr>
                    <Th>Date</Th>
                    <Th>Service</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {recentAssignments.map((a, i) => (
                    <Tr
                      key={i}
                      cursor="pointer"
                      _hover={{ bg: hoverBg }}
                      onClick={() => router.push(`/demo/services/${a.service.id}`)}
                    >
                      <Td fontSize="sm">{formatDate(a.service.date)}</Td>
                      <Td fontSize="sm">
                        <Text color="brand.600" fontWeight="500" _hover={{ textDecoration: 'underline' }}>
                          {a.service.title}
                        </Text>
                      </Td>
                      <Td fontSize="sm">{roleLabel(a.role)}</Td>
                      <Td>
                        <Badge
                          colorScheme={a.status === 'confirmed' ? 'green' : a.status === 'declined' ? 'red' : 'yellow'}
                          variant="subtle"
                          fontSize="xs"
                        >
                          {a.status}
                        </Badge>
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
                  borderRadius="lg"
                  border="1px solid"
                  borderColor={borderColor}
                  p="4"
                  cursor="pointer"
                  onClick={() => router.push(`/demo/services/${a.service.id}`)}
                  _hover={{ shadow: 'sm' }}
                >
                  <HStack justify="space-between" mb="2">
                    <Text color="brand.600" fontWeight="600" noOfLines={1}>{a.service.title}</Text>
                    <Text fontSize="sm" color="gray.500">{formatDate(a.service.date)}</Text>
                  </HStack>
                  <HStack spacing="3">
                    <Text fontSize="sm" color="gray.600">{roleLabel(a.role)}</Text>
                    <Badge
                      colorScheme={a.status === 'confirmed' ? 'green' : a.status === 'declined' ? 'red' : 'yellow'}
                      variant="subtle"
                      fontSize="xs"
                    >
                      {a.status}
                    </Badge>
                  </HStack>
                </Box>
              ))}
            </VStack>
          </>
        )}
      </Box>
    </Box>
  );
}