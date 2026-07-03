'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Text, SimpleGrid, Card, CardBody, HStack, VStack,
  Button, Flex, Divider, Spinner, Center, useColorModeValue, useToast,
  Tag, TagLabel, Collapse,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import type { Service, Song, TeamMember, ServiceItem, ServiceAssignment, ServiceTask, RehearsalStats } from '@/lib/types';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatServiceDate, formatShortDate, getGreeting } from '@/lib/formatDate';
import OnboardingChecklist from '@/components/onboarding/OnboardingChecklist';

// Lucide icons
import { 
  Calendar, Music, Users, Plus, Sparkles, BarChart2,
  Clock, ChevronRight, CheckSquare, ChevronDown, ChevronRight as ChevronRightIcon
} from 'lucide-react';

  // --- Helper Component to load async stats for each service ---
  function ServiceCard({ svc, onClick }: { svc: Service; onClick: () => void }) {
    const [stats, setStats] = useState({ songs: 0, duration: 0, assignments: 0 });
    const [rehearsalStats, setRehearsalStats] = useState<RehearsalStats[]>([]);
    const [showRehearsal, setShowRehearsal] = useState(false);
    const store = useStore();
    const { church, user } = useAuth();
    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.100', 'gray.700');
    const textColor = useColorModeValue('gray.800', 'white');
    const subtextColor = useColorModeValue('gray.500', 'gray.400');
    const hoverBg = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => {
    async function loadStats() {
      if (!church) return;
      try {
        const items = await store.serviceItems.getByService(svc.id);
        const assignments = await store.assignments.getByService(svc.id, church.id);
        setStats({
          songs: items.filter((i: ServiceItem) => i.type === 'song').length,
          duration: items.reduce((sum: number, i: ServiceItem) => sum + (i.duration_minutes || 0), 0),
          assignments: assignments.length,
        });
      } catch (error) {
        console.error('Error loading service stats:', error);
      }
    }
    loadStats();
  }, [svc.id, church]);

  // Load rehearsal stats for leaders
  useEffect(() => {
    async function loadRehearsalStats() {
      if (!church || user?.role === 'team') return;
      try {
        const s = await store.rehearsals.getStatsByService(svc.id, church.id);
        setRehearsalStats(s);
      } catch (error) {
        console.error('Error loading rehearsal stats:', error);
      }
    }
    if (stats.songs > 0) {
      loadRehearsalStats();
    }
  }, [svc.id, church, user, stats.songs]);

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
        borderColor: 'teal.200',
        transform: 'translateY(-1px)',
      }}
      transition="all 0.15s ease"
      onClick={onClick}
    >
      <CardBody>
        <Flex justify="space-between" align="start" flexWrap="wrap" gap="2">
          <Box>
            <HStack spacing="3" mb="1">
              <Text fontWeight="700" fontSize="lg" color={textColor}>{svc.title}</Text>
              <StatusBadge status={svc.status} size="sm" />
            </HStack>
            <HStack spacing="2" color={subtextColor}>
              <Clock size={14} />
              <Text fontSize="sm">{formatServiceDate(svc.date)} · {svc.time}</Text>
            </HStack>
          </Box>
          <HStack spacing="4" fontSize="sm" color={subtextColor}>
            <Text>{stats.songs} song{stats.songs !== 1 ? 's' : ''}</Text>
            {stats.duration > 0 && <Text>{stats.duration} min</Text>}
            <Text>{stats.assignments} assigned</Text>
          </HStack>
        </Flex>

        {/* Rehearsal Progress Section - Leaders/Admin only */}
        {rehearsalStats.length > 0 && (
          <Box mt="3" pt="3" borderTop="1px solid" borderColor={borderColor}>
            <HStack
              spacing="2"
              cursor="pointer"
              onClick={(e) => { e.stopPropagation(); setShowRehearsal(!showRehearsal); }}
              py="1"
              role="button"
              tabIndex={0}
            >
              {showRehearsal ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
              <Text fontSize="xs" fontWeight="700" color={subtextColor} textTransform="uppercase" letterSpacing="wide">
                Rehearsal Progress
              </Text>
            </HStack>
            <Collapse in={showRehearsal} animateOpacity>
              <VStack spacing="2" align="stretch" mt="2">
                {rehearsalStats.map(stat => (
                  <HStack key={stat.team_member_id} justify="space-between" fontSize="sm">
                    <Text color={textColor} fontWeight="500">{stat.member_name}</Text>
                    <Tag
                      size="sm"
                      colorScheme={stat.rehearsed_count === stat.total_songs ? 'green' : 'orange'}
                      borderRadius="full"
                    >
                      <TagLabel>{stat.rehearsed_count}/{stat.total_songs}</TagLabel>
                    </Tag>
                  </HStack>
                ))}
              </VStack>
            </Collapse>
          </Box>
        )}
      </CardBody>
    </Card>
  );
}

function StatBox({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number }>; label: string; value: number }) {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'white');
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
        transform: 'translateY(-1px)',
      }}
      transition="all 0.15s ease"
    >
      <CardBody p={{ base: '4', md: '5' }}>
        <VStack align="start" spacing="2">
          <Box 
            p="2" 
            borderRadius="lg" 
            bg={useColorModeValue('teal.50', 'rgba(13,148,136,0.15)')}
          >
            <Icon size={24} />
          </Box>
          <Text fontSize="2xl" fontWeight="700" color={textColor}>{value}</Text>
          <Text fontSize="sm" color={subtextColor}>{label}</Text>
        </VStack>
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const { user, church } = useAuth();
  const store = useStore();
  const router = useRouter();
  const toast = useToast();

  // Color mode values
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const emptyColor = useColorModeValue('gray.400', 'gray.500');

  const [services, setServices] = useState<Service[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [hasData, setHasData] = useState(false);
  const [dismissedPrompt, setDismissedPrompt] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!church || !user) return;

      try {
        setLoading(true);
        const svcs = await store.services.getByChurch(church.id);
        svcs.sort((a: Service, b: Service) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Team members can see all services (read-only view)
        setServices(svcs);
        const allSongs = await store.songs.getByChurch(church.id);
        setSongs(allSongs);
        setTeamMembers(await store.teamMembers.getByChurch(church.id));

        // Fetch this user's tasks (needs matching team member record)
        if (user?.team_member_id) {
          const tasks = await store.tasks.getMyTasks(church.id, user.team_member_id);
          setMyTasks(tasks);
        }

        setHasData(svcs.length > 0 || allSongs.length > 0 || teamMembers.length > 0);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        toast({
          title: 'Error loading data',
          description: 'Please try refreshing the page.',
          status: 'error',
          duration: 5000,
        });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [church, user, toast]);

  // Check localStorage for dismissed state
  useEffect(() => {
    const dismissed = localStorage.getItem('dashboard-prompt-dismissed');
    if (dismissed === 'true') {
      setDismissedPrompt(true);
    }
  }, []);

  const handleDismissPrompt = () => {
    setDismissedPrompt(true);
    localStorage.setItem('dashboard-prompt-dismissed', 'true');
  };

  const today = new Date().toISOString().split('T')[0];
  const thisWeekEnd = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (7 - d.getDay()));
    return d.toISOString().split('T')[0];
  })();

  const thisWeekServices = services.filter((s) => s.date >= today && s.date <= thisWeekEnd);
  const upcomingServices = services.filter((s) => s.date >= today).slice(0, 3);
  const recentServices = services.filter((s) => s.date < today).slice(0, 3);

  const firstName = user?.name?.split(' ')[0] || '';
  const greeting = getGreeting();

  if (loading) {
    return (
      <Center minH="50vh">
        <Spinner size="xl" color="teal.500" />
      </Center>
    );
  }

  return (
    <Box p={{ base: '4', md: '8' }} maxW="1100px" mx="auto">
      {/* Greeting Header */}
      <Box mb="8">
        <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
          {greeting}, {firstName} 👋
        </Text>
        <Text mt="1" fontSize="sm" color={subtextColor}>
          {church?.name} — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </Box>

      {/* Onboarding Checklist */}
      <OnboardingChecklist />

      {/* Stats Grid - Admin/Leader only */}
      {user?.role !== 'team' && (
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing="4" mb="8">
          <StatBox icon={Calendar} label="Total Services" value={services.length} />
          <StatBox icon={Music} label="Songs in Library" value={songs.length} />
          <StatBox icon={Users} label="Team Members" value={teamMembers.length} />
          <StatBox icon={Calendar} label="Upcoming This Week" value={thisWeekServices.length} />
        </SimpleGrid>
      )}

      {/* My Tasks Section */}
      {myTasks.length > 0 && (
        <Box mb="8">
          <Flex justify="space-between" align="center" mb="4">
            <Text fontSize="lg" fontWeight="600" color={textColor}>My Tasks</Text>
            <Button
              variant="ghost"
              size="sm"
              color="teal.600"
              rightIcon={<ChevronRight size={16} />}
              onClick={() => router.push('/tasks')}
            >
              View all
            </Button>
          </Flex>
          <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl" overflow="hidden">
            <CardBody p="0">
              {myTasks.slice(0, 5).map((task, i) => (
                <Box key={task.id}>
                  <HStack
                    px="5" py="3"
                    cursor="pointer"
                    _hover={{ bg: hoverBg }}
                    transition="all 0.15s ease"
                    onClick={() => router.push(`/services/${task.service_id}`)}
                    justify="space-between"
                  >
                    <HStack spacing="3">
                      <CheckSquare size={16} color="var(--chakra-colors-teal-600)" />
                      <Box>
                        <Text fontWeight="500" fontSize="sm" color={textColor}>{task.title}</Text>
                        <Text fontSize="xs" color={subtextColor}>
                          {task.services?.title} · {task.services?.date ? formatShortDate(task.services.date) : ''}
                        </Text>
                      </Box>
                    </HStack>
                    <StatusBadge status={task.status === 'done' ? 'confirmed' : 'pending'} size="sm" />
                  </HStack>
                  {i < Math.min(myTasks.length, 5) - 1 && <Divider />}
                </Box>
              ))}
            </CardBody>
          </Card>
        </Box>
      )}

      {/* Upcoming Services Section */}
      {upcomingServices.length > 0 && (
        <Box mb="8">
          <Flex justify="space-between" align="center" mb="4">
            <Text fontSize="lg" fontWeight="600" color={textColor}>Upcoming Services</Text>
            <Button
              variant="ghost"
              size="sm"
              color="teal.600"
              rightIcon={<ChevronRight size={16} />}
              onClick={() => router.push('/services')}
            >
              View all
            </Button>
          </Flex>
          <VStack spacing="3" align="stretch">
            {upcomingServices.map((svc) => (
              <ServiceCard key={svc.id} svc={svc} onClick={() => router.push(`/services/${svc.id}`)} />
            ))}
          </VStack>
        </Box>
      )}

      {/* This Week - only if no upcoming but has this week services */}
      {upcomingServices.length === 0 && thisWeekServices.length > 0 && (
        <Box mb="8">
          <Text fontSize="lg" fontWeight="600" color={textColor} mb="4">This Week</Text>
          <VStack spacing="3" align="stretch">
            {thisWeekServices.map((svc) => (
              <ServiceCard key={svc.id} svc={svc} onClick={() => router.push(`/services/${svc.id}`)} />
            ))}
          </VStack>
        </Box>
      )}

      {/* Empty State for Services */}
      {upcomingServices.length === 0 && thisWeekServices.length === 0 && (
        <Card 
          mb="8" 
          bg={cardBg} 
          border="1px solid" 
          borderColor={borderColor} 
          borderRadius="xl"
        >
          <CardBody textAlign="center" py="8">
            <Text fontSize="lg" mb="1" color={emptyColor}>
              {user?.role === 'team' ? "You aren't scheduled for any services this week." : "No upcoming services"}
            </Text>
            {user?.role !== 'team' && (
              <Button 
                mt="3" 
                size="sm" 
                colorScheme="teal"
                variant="outline"
                onClick={() => router.push('/services')}
                leftIcon={<Plus size={16} />}
              >
                Create Service
              </Button>
            )}
          </CardBody>
        </Card>
      )}

      {/* Quick Actions - Admin/Leader only */}
      {user?.role !== 'team' && (
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing="3" mb="8">
          <Button 
            variant="outline" 
            size="lg" 
            h="auto" 
            py="4"
            borderColor="gray.200"
            _hover={{ borderColor: 'teal.300', bg: 'gray.50' }}
            onClick={() => router.push('/services')}
          >
            <VStack spacing="1">
              <Calendar size={24} color="var(--chakra-colors-teal-600)" />
              <Text fontSize="sm" color={useColorModeValue('gray.700', 'gray.200')}>New Service</Text>
            </VStack>
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            h="auto" 
            py="4"
            borderColor="gray.200"
            _hover={{ borderColor: 'teal.300', bg: 'gray.50' }}
            onClick={() => router.push('/songs')}
          >
            <VStack spacing="1">
              <Music size={24} color="var(--chakra-colors-teal-600)" />
              <Text fontSize="sm" color={useColorModeValue('gray.700', 'gray.200')}>Add Song</Text>
            </VStack>
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            h="auto" 
            py="4"
            borderColor="gray.200"
            _hover={{ borderColor: 'teal.300', bg: 'gray.50' }}
            onClick={() => router.push('/team')}
          >
            <VStack spacing="1">
              <Users size={24} color="var(--chakra-colors-teal-600)" />
              <Text fontSize="sm" color={useColorModeValue('gray.700', 'gray.200')}>Add Member</Text>
            </VStack>
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            h="auto" 
            py="4"
            borderColor="gray.200"
            _hover={{ borderColor: 'teal.300', bg: 'gray.50' }}
            onClick={() => router.push('/usage')}
          >
            <VStack spacing="1">
              <BarChart2 size={24} color="var(--chakra-colors-teal-600)" />
              <Text fontSize="sm" color={useColorModeValue('gray.700', 'gray.200')}>Song Usage</Text>
            </VStack>
          </Button>
        </SimpleGrid>
      )}

      {/* Recent Completed */}
      {recentServices.length > 0 && (
        <Box>
          <Text fontSize="lg" fontWeight="600" color={textColor} mb="4">Recently Completed</Text>
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
                  px="5" py="4"
                  cursor="pointer"
                  _hover={{ bg: hoverBg }}
                  transition="all 0.15s ease"
                  onClick={() => router.push(`/services/${svc.id}`)}
                  justify="space-between"
                >
                  <HStack spacing="3">
                    <Text fontSize="sm" fontWeight="500" color="gray.400" minW="100px">
                      {formatShortDate(svc.date)}
                    </Text>
                    <Text fontWeight="600" color={textColor}>{svc.title}</Text>
                  </HStack>
                  <StatusBadge status={svc.status} size="sm" />
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