'use client';

import { useState, useMemo } from 'react';
import { useDemo } from '@/lib/demo/context';
import {
  Box, VStack, HStack, Text, Heading, Select, SimpleGrid,
  Stat, StatLabel, StatNumber, StatHelpText, Progress,
  Table, Thead, Tbody, Tr, Th, Td, Badge,
  useColorModeValue, Card, CardBody, CardHeader,
} from '@chakra-ui/react';
import { Calendar, Users, CheckCircle, XCircle, Clock, TrendingUp, CheckSquare } from 'lucide-react';

interface MemberStat {
  name: string;
  assignments: number;
  confirmed: number;
  declined: number;
}

type DateRange = '30d' | '90d' | '6m' | '1y' | 'all';

export default function DemoReportsPage() {
  const { services, teamMembers, assignments } = useDemo();
  const [range, setRange] = useState<DateRange>('90d');

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');

  const data = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;
    if (range === '30d') startDate = new Date(now.getTime() - 30 * 86400000);
    else if (range === '90d') startDate = new Date(now.getTime() - 90 * 86400000);
    else if (range === '6m') startDate = new Date(now.getTime() - 180 * 86400000);
    else if (range === '1y') startDate = new Date(now.getTime() - 365 * 86400000);

    const filteredServices = startDate
      ? services.filter((s: any) => new Date(s.date) >= startDate)
      : services;

    let totalConfirmed = 0;
    let totalDeclined = 0;
    let totalPending = 0;
    const memberStats: Record<string, MemberStat> = {};

    for (const a of assignments) {
      const svc = services.find((s: any) => s.id === (a as any).service_id);
      if (!svc || (startDate && new Date(svc.date) < startDate)) continue;

      if ((a as any).status === 'confirmed') totalConfirmed++;
      else if ((a as any).status === 'declined') totalDeclined++;
      else totalPending++;

      const memberId = (a as any).team_member_id;
      if (memberId) {
        if (!memberStats[memberId]) {
          memberStats[memberId] = { name: '', assignments: 0, confirmed: 0, declined: 0 };
        }
        memberStats[memberId].assignments++;
        if ((a as any).status === 'confirmed') memberStats[memberId].confirmed++;
        else if ((a as any).status === 'declined') memberStats[memberId].declined++;
      }
    }

    const upcoming = filteredServices.filter((s: any) => new Date(s.date) >= now);
    const past = filteredServices.filter((s: any) => new Date(s.date) < now);
    const upcomingFinalized = upcoming.filter((s: any) => s.is_finalized || s.status === 'finalized').length;
    const upcomingPlanned = upcoming.length - upcomingFinalized;

    const memberParticipation = teamMembers
      .map((m: any) => ({
        name: m.name,
        assignments: memberStats[m.id]?.assignments || 0,
        confirmed: memberStats[m.id]?.confirmed || 0,
        declined: memberStats[m.id]?.declined || 0,
      }))
      .filter((m) => m.assignments > 0)
      .sort((a, b) => b.assignments - a.assignments);

    return {
      totalServices: filteredServices.length,
      totalAssignments: totalConfirmed + totalDeclined + totalPending,
      confirmedCount: totalConfirmed,
      declinedCount: totalDeclined,
      pendingCount: totalPending,
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      memberParticipation,
      upcomingPlanned,
      upcomingFinalized,
      pastServices: past.length,
    };
  }, [services, teamMembers, assignments, range]);

  const confirmRate = data.totalAssignments > 0 ? Math.round((data.confirmedCount / data.totalAssignments) * 100) : 0;
  const declineRate = data.totalAssignments > 0 ? Math.round((data.declinedCount / data.totalAssignments) * 100) : 0;
  const taskCompletionRate = data.totalTasks > 0 ? Math.round((data.completedTasks / data.totalTasks) * 100) : 0;

  return (
    <Box maxW="1200px" mx="auto" px={{ base: 4, md: 6 }} py={{ base: 4, md: 8 }}>
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
            <Box overflowX="auto">
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
            </Box>
          )}
        </CardBody>
      </Card>

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
    </Box>
  );
}