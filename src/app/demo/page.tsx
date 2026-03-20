'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Text, SimpleGrid, Card, CardBody, HStack, VStack,
  Badge, Button, Flex, Divider, useColorModeValue, Icon,
} from '@chakra-ui/react';
import { useDemo } from '@/lib/demo/context';
import { useStore } from '@/lib/StoreContext';
import type { Service, Song, TeamMember, ServiceItem, ServiceAssignment } from '@/lib/types';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatShortDate } from '@/lib/formatDate';

// Lucide icons
import { 
  Calendar, Music, Users, Plus, BarChart2, Sparkles, Clock
} from 'lucide-react';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

// Helper Component to load async stats for each service
function ServiceCard({ svc, onClick }: { svc: Service; onClick: () => void }) {
  const { serviceItems, assignments } = useDemo();
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  const stats = useMemo(() => {
    const items = serviceItems.filter((i: ServiceItem) => i.service_id === svc.id);
    const asgns = assignments.filter((a: ServiceAssignment) => a.service_id === svc.id);
    return {
      songs: items.filter((i: ServiceItem) => i.type === 'song').length,
      duration: items.reduce((sum: number, i: ServiceItem) => sum + (i.duration_minutes || 0), 0),
      assignments: asgns.length,
    };
  }, [svc.id, serviceItems, assignments]);

  return (
    <Card
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="xl"
      cursor="pointer"
      boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
      _hover={{ 
        boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        transform: 'translateY(-1px)',
        borderLeftColor: 'teal.500'
      }}
      transition="all 0.15s"
      onClick={onClick}
      borderLeft="3px solid transparent"
    >
      <CardBody p="4">
        <Flex justify="space-between" align="start" flexWrap="wrap" gap="2">
          <Box>
            <HStack spacing="3" mb="1">
              <Text fontWeight="600" fontSize="base" color={textColor}>{svc.title}</Text>
              <StatusBadge status={svc.status as 'draft' | 'published' | 'completed'} />
            </HStack>
            <HStack spacing="2" color={subtextColor}>
              <Calendar size={14} />
              <Text fontSize="sm">{formatShortDate(svc.date)} · {svc.time}</Text>
            </HStack>
          </Box>
          <HStack spacing="4" fontSize="sm" color={subtextColor}>
            <Text>{stats.songs} song{stats.songs !== 1 ? 's' : ''}</Text>
            {stats.duration > 0 && <Text>{stats.duration} min</Text>}
            <Text>{stats.assignments} assigned</Text>
          </HStack>
        </Flex>
      </CardBody>
    </Card>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.900', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  return (
    <Card 
      bg={cardBg} 
      border="1px solid" 
      borderColor={borderColor} 
      borderRadius="xl"
      boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
      _hover={{ 
        boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        transform: 'translateY(-1px)'
      }}
      transition="all 0.15s"
    >
      <CardBody p="4">
        <HStack spacing="4">
          <Box 
            p="2" 
            borderRadius="lg" 
            bg="teal.50"
            color="teal.600"
          >
            {icon}
          </Box>
          <Box>
            <Text fontSize="2xl" fontWeight="700" color={textColor}>{value}</Text>
            <Text fontSize="sm" color={subtextColor}>{label}</Text>
          </Box>
        </HStack>
      </CardBody>
    </Card>
  );
}

export default function DemoDashboardPage() {
  const { user, church, songs, teamMembers, services } = useDemo();
  const store = useStore();
  const router = useRouter();

  // Color mode values
  const textColor = useColorModeValue('gray.900', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const emptyColor = useColorModeValue('gray.400', 'gray.500');

  // Sort services by date
  const sortedServices = useMemo(() => {
    return [...services].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [services]);

  const today = new Date().toISOString().split('T')[0];
  const thisWeekEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (7 - d.getDay()));
    return d.toISOString().split('T')[0];
  }, []);

  const thisWeekServices = sortedServices.filter((s) => s.date >= today && s.date <= thisWeekEnd);
  const upcomingServices = sortedServices.filter((s) => s.date >= today).slice(0, 5);
  const recentServices = sortedServices.filter((s) => s.date < today).slice(0, 3);

  const formatDateLong = (d: string) => {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch { return d; }
  };

  return (
    <Box p={{ base: '4', md: '8' }} maxW="1100px" mx="auto">
      {/* Welcome Header */}
      <Box mb="8">
        <Text fontSize="2xl" fontWeight="bold" color={textColor} letterSpacing="tight">
          {getGreeting()}{user ? `, ${user.name.split(' ')[0]}` : ''} 👋
        </Text>
        <Text color={subtextColor} fontSize="sm" mt="1">
          {church?.name} — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </Box>

      {/* Stats Grid - 2x2 */}
      <SimpleGrid columns={{ base: 2, md: 2 }} spacing="4" mb="8">
        <StatBox 
          icon={<Calendar size={20} />} 
          label="Total Services" 
          value={services.length} 
        />
        <StatBox 
          icon={<Music size={20} />} 
          label="Songs in Library" 
          value={songs.length} 
        />
        <StatBox 
          icon={<Users size={20} />} 
          label="Team Members" 
          value={teamMembers.length} 
        />
        <StatBox 
          icon={<Clock size={20} />} 
          label="Upcoming This Week" 
          value={thisWeekServices.length} 
        />
      </SimpleGrid>

      {/* This Week */}
      <Box mb="8">
        <Flex justify="space-between" align="center" mb="4">
          <Text fontSize="lg" fontWeight="semibold" color={textColor}>This Week</Text>
        </Flex>
        {thisWeekServices.length === 0 ? (
          <Card 
            bg={cardBg} 
            border="1px solid" 
            borderColor={borderColor} 
            borderRadius="xl"
            boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
          >
            <CardBody textAlign="center" py="8">
              <Text fontSize="sm" color={emptyColor} mb="3">No services this week</Text>
              <Button 
                size="sm" 
                colorScheme="teal" 
                onClick={() => router.push('/demo/services')}
                leftIcon={<Plus size={16} />}
                fontWeight="600"
              >
                Create Service
              </Button>
            </CardBody>
          </Card>
        ) : (
          <VStack spacing="3" align="stretch">
            {thisWeekServices.map((svc) => (
              <ServiceCard key={svc.id} svc={svc} onClick={() => router.push(`/demo/services/${svc.id}`)} />
            ))}
          </VStack>
        )}
      </Box>

      {/* Quick Actions */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing="3" mb="8">
        <Button 
          variant="outline" 
          size="lg" 
          h="auto" 
          py="4" 
          onClick={() => router.push('/demo/services')}
          borderColor="gray.200"
          _hover={{ borderColor: 'teal.300', bg: 'teal.50' }}
          borderRadius="xl"
        >
          <VStack spacing="1">
            <Calendar size={20} className="text-teal-600" />
            <Text fontSize="sm" color="gray.600">New Service</Text>
          </VStack>
        </Button>
        <Button 
          variant="outline" 
          size="lg" 
          h="auto" 
          py="4" 
          onClick={() => router.push('/demo/songs')}
          borderColor="gray.200"
          _hover={{ borderColor: 'teal.300', bg: 'teal.50' }}
          borderRadius="xl"
        >
          <VStack spacing="1">
            <Music size={20} className="text-teal-600" />
            <Text fontSize="sm" color="gray.600">Add Song</Text>
          </VStack>
        </Button>
        <Button 
          variant="outline" 
          size="lg" 
          h="auto" 
          py="4" 
          onClick={() => router.push('/demo/team')}
          borderColor="gray.200"
          _hover={{ borderColor: 'teal.300', bg: 'teal.50' }}
          borderRadius="xl"
        >
          <VStack spacing="1">
            <Users size={20} className="text-teal-600" />
            <Text fontSize="sm" color="gray.600">Add Member</Text>
          </VStack>
        </Button>
        <Button 
          variant="outline" 
          size="lg" 
          h="auto" 
          py="4" 
          onClick={() => router.push('/demo/usage')}
          borderColor="gray.200"
          _hover={{ borderColor: 'teal.300', bg: 'teal.50' }}
          borderRadius="xl"
        >
          <VStack spacing="1">
            <BarChart2 size={20} className="text-teal-600" />
            <Text fontSize="sm" color="gray.600">Song Usage</Text>
          </VStack>
        </Button>
      </SimpleGrid>

      {/* Upcoming Services */}
      {upcomingServices.length > 0 && (
        <Box mb="8">
          <Text fontSize="lg" fontWeight="semibold" color={textColor} mb="4">Upcoming</Text>
          <Box 
            bg={cardBg} 
            borderRadius="xl" 
            border="1px solid" 
            borderColor={borderColor} 
            overflow="hidden"
            boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
          >
            {upcomingServices.map((svc, i) => (
              <Box key={svc.id}>
                <HStack
                  px="5" py="3"
                  cursor="pointer"
                  _hover={{ bg: hoverBg }}
                  transition="all 0.15s"
                  onClick={() => router.push(`/demo/services/${svc.id}`)}
                  justify="space-between"
                  borderLeft="3px solid transparent"
                  sx={{
                    '&:hover': { borderLeftColor: 'teal.500' }
                  }}
                >
                  <HStack spacing="3">
                    <Text fontSize="sm" fontWeight="500" color={subtextColor} minW="100px">{formatDateLong(svc.date)}</Text>
                    <Text fontWeight="600" color={textColor}>{svc.title}</Text>
                  </HStack>
                  <StatusBadge status={svc.status as 'draft' | 'published' | 'completed'} />
                </HStack>
                {i < upcomingServices.length - 1 && <Divider />}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Recent Completed */}
      {recentServices.length > 0 && (
        <Box>
          <Text fontSize="lg" fontWeight="semibold" color={textColor} mb="4">Recently Completed</Text>
          <Box 
            bg={cardBg} 
            borderRadius="xl" 
            border="1px solid" 
            borderColor={borderColor} 
            overflow="hidden"
            boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
          >
            {recentServices.map((svc, i) => (
              <Box key={svc.id}>
                <HStack
                  px="5" py="3"
                  cursor="pointer"
                  _hover={{ bg: hoverBg }}
                  transition="all 0.15s"
                  onClick={() => router.push(`/demo/services/${svc.id}`)}
                  justify="space-between"
                  borderLeft="3px solid transparent"
                  sx={{
                    '&:hover': { borderLeftColor: 'teal.500' }
                  }}
                >
                  <HStack spacing="3">
                    <Text fontSize="sm" fontWeight="500" color={subtextColor} minW="100px">{formatDateLong(svc.date)}</Text>
                    <Text fontWeight="600" color={textColor}>{svc.title}</Text>
                  </HStack>
                  <StatusBadge status={svc.status as 'draft' | 'published' | 'completed'} />
                </HStack>
                {i < recentServices.length - 1 && <Divider />}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}