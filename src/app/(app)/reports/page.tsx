'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/store';
import {
  Box, VStack, HStack, Text, Heading, Select, SimpleGrid,
  Stat, StatLabel, StatNumber, StatHelpText, Progress,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer, Badge, Spinner, Center,
  useColorModeValue, Card, CardBody, CardHeader, Button,
} from '@chakra-ui/react';
import { Calendar, Users, CheckCircle, XCircle, Clock, TrendingUp, CheckSquare, ChevronUp, ChevronDown } from 'lucide-react';
import SongUsageSection from '@/components/reports/SongUsageSection';
import { countServiceStatuses } from '@/lib/service-status';
import { formatShortDate } from '@/lib/formatDate';
import {
  buildAttendanceReport,
  formatServedFrequency,
  sortAttendanceRows,
  type AttendanceAssignment,
  type AttendanceMember,
  type AttendanceSortKey,
  type MemberAttendance,
} from '@/lib/reports/attendance';
import {
  computeBurnoutFlags,
  DEFAULT_BURNOUT_STREAK_WEEKS,
  formatBurnoutStreak,
  type BurnoutFlag,
} from '@/lib/reports/burnout';

interface ReportData {
  totalServices: number;
  totalAssignments: number;
  confirmedCount: number;
  declinedCount: number;
  pendingCount: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  memberParticipation: MemberAttendance[];
  burnoutFlags: BurnoutFlag[];
  upcomingPlanned: number;
  upcomingFinalized: number;
  pastServices: number;
}

type DateRange = '30d' | '90d' | '6m' | '1y' | 'all';

export default function ReportsPage() {
  const { user, church, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [range, setRange] = useState<DateRange>('90d');
  const [sort, setSort] = useState<{ key: AttendanceSortKey; direction: 'asc' | 'desc' }>({
    key: 'servedDateCount',
    direction: 'desc',
  });

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const labelColor = useColorModeValue('gray.600', 'gray.300');
  const mutedLabelColor = useColorModeValue('gray.500', 'gray.400');
  const tableHeaderColor = useColorModeValue('gray.600', 'gray.300');
  const progressTrackBg = useColorModeValue('gray.100', 'gray.700');
  const positiveColor = useColorModeValue('green.600', 'green.300');

  const loadData = useCallback(async () => {
    if (!church) {
      setLoading(false);
      return;
    }
    setLoadError(false);
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
      const assignmentRows: AttendanceAssignment[] = [];

      for (const svc of filteredServices) {
        const assignments = await db.assignments.getByService(svc.id, church.id);
        for (const a of assignments) {
          if (a.status === 'confirmed') totalConfirmed++;
          else if (a.status === 'declined') totalDeclined++;
          else totalPending++;

          assignmentRows.push({
            service_id: svc.id,
            team_member_id: a.team_member_id,
            status: a.status,
          });
        }
      }

      const allTasks = await db.tasks.getByChurch(church.id);
      const filteredTasks = startDate
        ? allTasks.filter((t) => new Date(t.created_at) >= startDate)
        : allTasks;
      const completedTasks = filteredTasks.filter((t) => t.status === 'done');

      const statusCounts = countServiceStatuses(filteredServices, now);
      const upcomingFinalized = statusCounts.upcomingFinalized;
      const upcomingPlanned = statusCounts.upcomingPlanned;

      const reportMembers: AttendanceMember[] = members.map((m) => ({
        id: m.id,
        name: m.name,
      }));
      const memberParticipation = buildAttendanceReport(
        filteredServices,
        assignmentRows,
        reportMembers,
        { asOf: now }
      );
      const burnoutFlags = computeBurnoutFlags(
        filteredServices,
        assignmentRows,
        reportMembers,
        { threshold: DEFAULT_BURNOUT_STREAK_WEEKS, asOf: now }
      );

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
        burnoutFlags,
        upcomingPlanned,
        upcomingFinalized,
        // Completed services count as completed regardless of date; past
        // non-completed services are also shown in this bucket.
        pastServices: statusCounts.completed + statusCounts.past,
      });
    } catch (err) {
      console.error('[Reports] Failed to load:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [church, range]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (authLoading) {
    return (
      <Center h="100dvh">
        <Spinner size="xl" color="teal.500" />
      </Center>
    );
  }

  // Auth finished but user/church never arrived — explain instead of spinning forever.
  if (!user || !church) {
    return (
      <Center h="100dvh">
        <VStack spacing={3} textAlign="center" px={6}>
          <Text fontWeight="600">Couldn&apos;t load your church data</Text>
          <Text fontSize="sm" color="gray.500">
            Check your internet connection and try refreshing the page.
          </Text>
          <Button size="sm" colorScheme="teal" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </VStack>
      </Center>
    );
  }

  // A failed fetch must not leave the "Loading reports..." spinner up forever.
  if (loadError) {
    return (
      <Center h="50vh">
        <VStack spacing={3} textAlign="center" px={6}>
          <Text fontWeight="600">Couldn&apos;t load reports</Text>
          <Text fontSize="sm" color="gray.500">
            Check your internet connection and try again.
          </Text>
          <Button size="sm" colorScheme="teal" onClick={() => loadData()}>
            Retry
          </Button>
        </VStack>
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
  const sortedMembers = sortAttendanceRows(data.memberParticipation, sort.key, sort.direction);

  const toggleSort = (key: AttendanceSortKey) => {
    setSort((previous) => (
      previous.key === key
        ? { key, direction: previous.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'name' ? 'asc' : 'desc' }
    ));
  };

  const sortIndicator = (key: AttendanceSortKey) => {
    if (sort.key !== key) return null;
    return sort.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const renderSortHeader = (label: string, key: AttendanceSortKey, numeric = false) => (
    <Th
      isNumeric={numeric}
      color={tableHeaderColor}
      cursor="pointer"
      userSelect="none"
      onClick={() => toggleSort(key)}
      title={`Sort by ${label.toLowerCase()}`}
    >
      <HStack spacing={1} justify={numeric ? 'flex-end' : 'flex-start'}>
        <Text>{label}</Text>
        {sortIndicator(key)}
      </HStack>
    </Th>
  );

  return (
    <Box w="full" mx="auto" px={{ base: 4, md: 6 }} pt={{ base: 2, md: 8 }} pb={{ base: 4, md: 8 }} maxW="1200px">
      <VStack align="start" spacing={1} mb={6}>
        <Heading size="lg">Service Reports & Analytics</Heading>
        <Text fontSize="sm" color={mutedLabelColor}>
          Track team participation, response rates, and task completion across your worship services.
        </Text>
      </VStack>

      <HStack justify="space-between" mb={6} flexWrap="wrap" spacing={4}>
        <Text fontSize="sm" color={labelColor}>Time period:</Text>
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
                <StatLabel fontSize="xs" color={mutedLabelColor}>Total Services</StatLabel>
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
                <StatLabel fontSize="xs" color={mutedLabelColor}>Confirm Rate</StatLabel>
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
                <StatLabel fontSize="xs" color={mutedLabelColor}>Decline Rate</StatLabel>
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
                <StatLabel fontSize="xs" color={mutedLabelColor}>Task Completion</StatLabel>
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

      {/* Volunteer Attendance Table */}
      <Card bg={cardBg} border="1px solid" borderColor={borderColor} shadow="sm" mb={6}>
        <CardHeader pb={2}>
          <HStack spacing={2}>
            <Users size={20} color="var(--chakra-colors-teal-500)" />
            <Heading size="sm">Volunteer Attendance</Heading>
          </HStack>
        </CardHeader>
        <CardBody pt={2}>
          {data.memberParticipation.length === 0 ? (
            <Text fontSize="sm" color="gray.400" textAlign="center" py={4}>
              No assignments in this period.
            </Text>
          ) : (
            <>
              <TableContainer overflowX="auto">
                <Table size="sm">
                  <Thead>
                    <Tr>
                      {renderSortHeader('Member', 'name')}
                      {renderSortHeader('Assigned', 'assignments', true)}
                      {renderSortHeader('Confirmed', 'confirmed', true)}
                      {renderSortHeader('Declined', 'declined', true)}
                      {renderSortHeader('Pending', 'pending', true)}
                      {renderSortHeader('Confirm Rate', 'confirmationRate')}
                      {renderSortHeader('Served', 'servedDateCount', true)}
                      {renderSortHeader('Avg Gap', 'averageGapDays', true)}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {sortedMembers.map((m) => (
                      <Tr key={m.memberId}>
                        <Td fontWeight="500">{m.name}</Td>
                        <Td isNumeric>{m.assignments}</Td>
                        <Td isNumeric>
                          <Text color={positiveColor} fontWeight="500">{m.confirmed}</Text>
                        </Td>
                        <Td isNumeric>
                          <Text color={m.declined > 0 ? 'red.500' : mutedLabelColor}>{m.declined}</Text>
                        </Td>
                        <Td isNumeric>
                          <Text color={m.pending > 0 ? 'yellow.600' : mutedLabelColor}>{m.pending}</Text>
                        </Td>
                        <Td>
                          <HStack spacing={2}>
                            <Progress
                              value={m.confirmationRate}
                              size="xs"
                              bg={progressTrackBg}
                              colorScheme={m.confirmationRate >= 75 ? 'green' : m.confirmationRate >= 50 ? 'yellow' : 'red'}
                              maxW="100px"
                            />
                            <Text fontSize="xs" color={mutedLabelColor} minW="40px">{m.confirmationRate}%</Text>
                          </HStack>
                        </Td>
                        <Td isNumeric title={formatServedFrequency(m)}>
                          <HStack spacing={1} justify="flex-end">
                            <Text fontWeight="500">{m.servedDateCount}</Text>
                            <Text fontSize="xs" color={mutedLabelColor}>of {m.totalServiceDates}</Text>
                          </HStack>
                        </Td>
                        <Td isNumeric>
                          <Text color={m.averageGapDays === null ? mutedLabelColor : undefined}>
                            {m.averageGapDays === null ? '—' : `${m.averageGapDays}d`}
                          </Text>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
              <Text mt={3} fontSize="xs" color={mutedLabelColor}>
                Served counts distinct service dates with a confirmed assignment on or before today.
                Average gap is the typical number of days between those dates.
              </Text>
            </>
          )}
        </CardBody>
      </Card>

      {/* Heavy Recent Schedule */}
      <Card bg={cardBg} border="1px solid" borderColor={borderColor} shadow="sm" mb={6}>
        <CardHeader pb={2}>
          <HStack spacing={2}>
            <Calendar size={20} color="var(--chakra-colors-orange-500)" />
            <Heading size="sm">Heavy Recent Schedule</Heading>
          </HStack>
        </CardHeader>
        <CardBody pt={2}>
          <Text fontSize="sm" color={mutedLabelColor} mb={data.burnoutFlags.length > 0 ? 3 : 0}>
            Volunteers with confirmed assignments in {DEFAULT_BURNOUT_STREAK_WEEKS} or more consecutive
            weeks. A calm heads-up to check in or rotate the schedule.
          </Text>
          {data.burnoutFlags.length === 0 ? (
            <Text fontSize="sm" color={mutedLabelColor}>
              No one has served {DEFAULT_BURNOUT_STREAK_WEEKS} weeks in a row right now.
            </Text>
          ) : (
            <VStack spacing={3} align="stretch">
              {data.burnoutFlags.map((flag) => (
                <HStack
                  key={flag.memberId}
                  justify="space-between"
                  align="flex-start"
                  spacing={3}
                  flexWrap="wrap"
                  border="1px solid"
                  borderColor={borderColor}
                  borderRadius="lg"
                  p={3}
                >
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="600">{flag.name}</Text>
                    <Text fontSize="xs" color={mutedLabelColor}>
                      {flag.dates.map((date) => formatShortDate(date)).join(' · ')}
                    </Text>
                  </VStack>
                  <Badge colorScheme="orange" variant="subtle" borderRadius="full" px={2}>
                    {formatBurnoutStreak(flag.streakWeeks)}
                  </Badge>
                </HStack>
              ))}
            </VStack>
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
                <Text fontSize="xs" color={mutedLabelColor} mb={1}>Completion Rate</Text>
                <Progress
                  value={taskCompletionRate}
                  size="md"
                  bg={progressTrackBg}
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