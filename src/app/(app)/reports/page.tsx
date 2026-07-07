'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/store';
import {
  Box, VStack, HStack, Text, Heading, Select, SimpleGrid,
  Stat, StatLabel, StatNumber, StatHelpText, Progress,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer, Badge, Spinner, Center,
  useColorModeValue, Card, CardBody, CardHeader,
} from '@chakra-ui/react';
import { Calendar, Users, CheckCircle, XCircle, Clock, TrendingUp, CheckSquare, BarChart3 } from 'lucide-react';
import SongUsageSection from '@/components/reports/SongUsageSection';

interface MemberStat {
  name: string;
  assignments: number;
  confirmed: number;
  declined: number;
}

interface ReportData {
  totalServices: number;
  totalAssignments: number;
  confirmedCount: number;
  declinedCount: number;
  pendingCount: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  memberParticipation: MemberStat[];
  upcomingPlanned: number;
  upcomingFinalized: number;
  pastServices: number;
}

type DateRange = '30d' | '90d' | '6m' | '1y' | 'all';

export default function ReportsPage() {
  const { user, church } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [range, setRange] = useState<DateRange>('90d');

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');

  const loadData = useCallback(async () => {
    if (!church) return;
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date | null = null;
      if (range === '30d') startDate = new Date(now.getTime() - 30 * 86400000);
      else if (range === '90d') startDate = new Date(now.getTime() - 90 * 86400000);
      else if (range === '6m') startDate = new Date(now.getTime() - 180 * 86400000);
      else if (range === '1y') startDate = new Date(now.getTime() - 365 * 86400000);

      const services = await db.services.getByChurch(church.id);
      const filteredServices = startDate
        ? services.filter((s) => new Date(s.date) >= startDate)
        : services;

      const members = await db.teamMembers.getByChurch(church.id);

      let totalConfirmed = 0;
      let totalDeclined = 0;
      let totalPending = 0;
      const memberStats: Record<string, MemberStat> = {};

      for (const svc of filteredServices) {
        const assignments = await db.assignments.getByService(svc.id, church.id);
        for (const a of assignments) {
          if (a.status === 'confirmed') totalConfirmed++;
          else if (a.status === 'declined') totalDeclined++;
          else totalPending++;

          if (a.team_member_id) {
            if (!memberStats[a.team_member_id]) {
              memberStats[a.team_member_id] = { name: '', assignments: 0, confirmed: 0, declined: 0 };
            }
            memberStats[a.team_member_id].assignments++;
            if (a.status === 'confirmed') memberStats[a.team_member_id].confirmed++;
            else if (a.status === 'declined') memberStats[a.team_member_id].declined++;
          }
        }
      }

      const allTasks = await db.tasks.getByChurch(church.id);
      const filteredTasks = startDate
        ? allTasks.filter((t) => new Date(t.created_at) >= startDate)
        : allTasks;
      const completedTasks = filteredTasks.filter((t) => t.status === 'done');

      const upcoming = filteredServices.filter((s) => new Date(s.date) >= now);
      const past = filteredServices.filter((s) => new Date(s.date) < now);
      const upcomingFinalized = upcoming.filter((s) => (s as any).is_finalized || (s as any).status === 'finalized').length;
      const upcomingPlanned = upcoming.length - upcomingFinalized;

      const memberParticipation = members
        .map((m) => ({
          name: m.name,
          assignments: memberStats[m.id]?.assignments || 0,
          confirmed: memberStats[m.id]?.confirmed || 0,
          declined: memberStats[m.id]?.declined || 0,
        }))
        .filter((m) => m.assignments > 0)
        .sort((a, b) => b.assignments - a.assignments);

      setData({
        totalServices: filteredServices.length,
        totalAssignments: totalConfirmed + totalDeclined + totalPending,
        confirmedCount: totalConfirmed,
        declinedCount: totalDeclined,
        pendingCount: totalPending,
        totalTasks: filteredTasks.length,
        completedTasks: completedTasks.length,
        pendingTasks: filteredTasks.length - completedTasks.length,
        memberParticipation,
        upcomingPlanned,
        upcomingFinalized,
        pastServices: past.length,
      });
    } catch (err) {
      console.error('[Reports] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [church, range]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!user || !church) {
    return (
      <Center h="100dvh">
        <Spinner size="xl" color="teal.500" />
      </Center>
    );
  }

  if (loading || !data) {
    return (
      <Center h="50vh">
        <VStack spacing={4}>
          <Spinner size="xl" color="teal.500" />
          <Text color="gray.500">Loading reports...</Text>
        </VStack>
      </Center>
    );
  }

  const confirmRate = data.totalAssignments > 0 ? Math.round((data.confirmedCount / data.totalAssignments) * 100) : 0;
  const declineRate = data.totalAssignments > 0 ? Math.round((data.declinedCount / data.totalAssignments) * 100) : 0;
  const taskCompletionRate = data.totalTasks > 0 ? Math.round((data.completedTasks / data.totalTasks) * 100) : 0;

  return (
    <Box w="full" mx="auto" px={{ base: 4, md: 6 }} pt={{ base: 2, md: 8 }} pb={{ base: 4, md: 8 }} maxW="1200px">
      <VStack align="start" spacing={1} mb={6}>
        <Heading size="lg">Service Reports & Analytics</Heading>
        <Text fontSize="sm" color="gray.500">
          Track team participation, response rates, and task completion across your worship services.
        </Text>
      </VStack>

      <HStack justify="space-between" mb={6} flexWrap="wrap" spacing={4}>
        <Text fontSize="sm" color="gray.600">Time period:</Text>
        <Select value={range} onChange={(e) => setRange(e.target.value as DateRange)} maxW="220px" size="sm">
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="6m">Last 6 months</option>
          <option value="1y">Last year</option>
          <option value="all">All time</option>
        </Select>
      </HStack>

      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4} mb={8}>
        {/* Total Services */}
        <Card bg={cardBg} border="1px solid" borderColor={borderColor} shadow="sm">
          <CardBody>
            <HStack justify="space-between">
              <Stat>
                <StatLabel fontSize="xs" color="gray.500">Total Services</StatLabel>
                <StatNumber fontSize="2xl">{data.totalServices}</StatNumber>
                <StatHelpText fontSize="xs" mb={0}>
                  {data.upcomingPlanned} planned · {data.upcomingFinalized} finalized
                </StatHelpText>
              </Stat>
              <Calendar size={28} color="var(--chakra-colors-teal-500)" />
            </HStack>
          </CardBody>
        </Card>

        {/* Confirm Rate */}
        <Card bg={cardBg} border="1px solid" borderColor={borderColor} shadow="sm">
          <CardBody>
            <HStack justify="space-between">
              <Stat>
                <StatLabel fontSize="xs" color="gray.500">Confirm Rate</StatLabel>
                <StatNumber fontSize="2xl">{confirmRate}%</StatNumber>
                <StatHelpText fontSize="xs" mb={0}>
                  {data.confirmedCount} of {data.totalAssignments} assignments
                </StatHelpText>
              </Stat>
              <CheckCircle size={28} color="var(--chakra-colors-green-500)" />
            </HStack>
          </CardBody>
        </Card>

        {/* Decline Rate */}
        <Card bg={cardBg} border="1px solid" borderColor={borderColor} shadow="sm">
          <CardBody>
            <HStack justify="space-between">
              <Stat>
                <StatLabel fontSize="xs" color="gray.500">Decline Rate</StatLabel>
                <StatNumber fontSize="2xl">{declineRate}%</StatNumber>
                <StatHelpText fontSize="xs" mb={0}>
                  {data.declinedCount} declined
                </StatHelpText>
              </Stat>
              <XCircle size={28} color="var(--chakra-colors-red-500)" />
            </HStack>
          </CardBody>
        </Card>

        {/* Task Completion */}
        <Card bg={cardBg} border="1px solid" borderColor={borderColor} shadow="sm">
          <CardBody>
            <HStack justify="space-between">
              <Stat>
                <StatLabel fontSize="xs" color="gray.500">Task Completion</StatLabel>
                <StatNumber fontSize="2xl">{taskCompletionRate}%</StatNumber>
                <StatHelpText fontSize="xs" mb={0}>
                  {data.completedTasks} of {data.totalTasks} tasks
                </StatHelpText>
              </Stat>
              <CheckSquare size={28} color="var(--chakra-colors-blue-500)" />
            </HStack>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Team Participation Table */}
      <Card bg={cardBg} border="1px solid" borderColor={borderColor} shadow="sm" mb={6}>
        <CardHeader pb={2}>
          <HStack spacing={2}>
            <Users size={20} color="var(--chakra-colors-teal-500)" />
            <Heading size="sm">Team Participation</Heading>
          </HStack>
        </CardHeader>
        <CardBody pt={2}>
          {data.memberParticipation.length === 0 ? (
            <Text fontSize="sm" color="gray.400" textAlign="center" py={4}>
              No assignments in this period.
            </Text>
          ) : (
            <TableContainer>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Member</Th>
                    <Th isNumeric>Assigned</Th>
                    <Th isNumeric>Confirmed</Th>
                    <Th isNumeric>Declined</Th>
                    <Th>Confirm Rate</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {data.memberParticipation.map((m) => {
                    const rate = m.assignments > 0 ? Math.round((m.confirmed / m.assignments) * 100) : 0;
                    return (
                      <Tr key={m.name}>
                        <Td fontWeight="500">{m.name}</Td>
                        <Td isNumeric>{m.assignments}</Td>
                        <Td isNumeric>
                          <Text color="green.600" fontWeight="500">{m.confirmed}</Text>
                        </Td>
                        <Td isNumeric>
                          <Text color={m.declined > 0 ? 'red.500' : 'gray.400'}>{m.declined}</Text>
                        </Td>
                        <Td>
                          <HStack spacing={2}>
                            <Progress
                              value={rate}
                              size="xs"
                              colorScheme={rate >= 75 ? 'green' : rate >= 50 ? 'yellow' : 'red'}
                              maxW="100px"
                            />
                            <Text fontSize="xs" color="gray.500" minW="40px">{rate}%</Text>
                          </HStack>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </CardBody>
      </Card>

      {/* Status Breakdown + Task Health */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
        <Card bg={cardBg} border="1px solid" borderColor={borderColor} shadow="sm">
          <CardHeader pb={2}>
            <HStack spacing={2}>
              <TrendingUp size={20} color="var(--chakra-colors-blue-500)" />
              <Heading size="sm">Service Status Breakdown</Heading>
            </HStack>
          </CardHeader>
          <CardBody pt={2}>
            <VStack spacing={3} align="stretch">
              <HStack justify="space-between">
                <HStack spacing={2}>
                  <Clock size={16} color="var(--chakra-colors-gray-400)" />
                  <Text fontSize="sm">Planned (upcoming)</Text>
                </HStack>
                <Badge colorScheme="gray">{data.upcomingPlanned}</Badge>
              </HStack>
              <HStack justify="space-between">
                <HStack spacing={2}>
                  <CheckCircle size={16} color="var(--chakra-colors-teal-500)" />
                  <Text fontSize="sm">Finalized (upcoming)</Text>
                </HStack>
                <Badge colorScheme="teal">{data.upcomingFinalized}</Badge>
              </HStack>
              <HStack justify="space-between">
                <HStack spacing={2}>
                  <Calendar size={16} color="var(--chakra-colors-gray-500)" />
                  <Text fontSize="sm">Completed (past)</Text>
                </HStack>
                <Badge colorScheme="blue">{data.pastServices}</Badge>
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        <Card bg={cardBg} border="1px solid" borderColor={borderColor} shadow="sm">
          <CardHeader pb={2}>
            <HStack spacing={2}>
              <CheckSquare size={20} color="var(--chakra-colors-purple-500)" />
              <Heading size="sm">Task Health</Heading>
            </HStack>
          </CardHeader>
          <CardBody pt={2}>
            <VStack spacing={3} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="sm">Completed Tasks</Text>
                <Badge colorScheme="green">{data.completedTasks}</Badge>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="sm">Pending Tasks</Text>
                <Badge colorScheme="yellow">{data.pendingTasks}</Badge>
              </HStack>
              <Box pt={2}>
                <Text fontSize="xs" color="gray.500" mb={1}>Completion Rate</Text>
                <Progress
                  value={taskCompletionRate}
                  size="md"
                  colorScheme={taskCompletionRate >= 75 ? 'green' : taskCompletionRate >= 50 ? 'yellow' : 'red'}
                />
              </Box>
            </VStack>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Song Usage Section */}
      <Box mt="10" pt="6" borderTop="1px solid" borderColor={borderColor}>
        <SongUsageSection />
      </Box>
    </Box>
  );
}