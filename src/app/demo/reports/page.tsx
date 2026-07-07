'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDemo } from '@/lib/demo/context';
import {
  Box, VStack, HStack, Text, Heading, Select, SimpleGrid,
  Stat, StatLabel, StatNumber, StatHelpText, Progress,
  Table, Thead, Tbody, Tr, Th, Td, Badge, Button, Input, Flex,
  useColorModeValue, Card, CardBody, CardHeader, Divider, Tooltip, useToast,
  Spinner, Center,
} from '@chakra-ui/react';
import type { SongUsage, ServiceItem } from '@/lib/types';
import EmptyState from '@/components/ui/EmptyState';
import { formatShortDate } from '@/lib/formatDate';
import { Calendar, Users, CheckCircle, XCircle, Clock, TrendingUp, CheckSquare, Download, BarChart2, Music, X } from 'lucide-react';

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
    <Box maxW="1200px" mx="auto" px={{ base: 4, md: 6 }} pt={{ base: 2, md: 8 }} pb={{ base: 4, md: 8 }}>
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

      {/* Song Usage Section */}
      <DemoSongUsageSection />
    </Box>
  );
}

function DemoSongUsageSection() {
  const { songs, services, songUsage, serviceItems } = useDemo();
  const router = useRouter();
  const toast = useToast();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.900', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  const rows = useMemo(() => {
    let filtered = songUsage;
    if (dateFrom) filtered = filtered.filter((u: SongUsage) => u.date >= dateFrom);
    if (dateTo) filtered = filtered.filter((u: SongUsage) => u.date <= dateTo);

    return filtered
      .map((u: SongUsage) => {
        const song = songs.find((s) => s.id === u.song_id);
        const service = services.find((s) => s.id === u.service_id);
        const serviceItem = serviceItems.find(
          (si: ServiceItem) => si.service_id === u.service_id && si.song_id === u.song_id && si.type === 'song'
        );
        const keyUsed = serviceItem?.key || song?.default_key || '';
        return {
          date: u.date,
          serviceTitle: service?.title || 'Unknown',
          serviceId: u.service_id,
          songTitle: song?.title || 'Unknown',
          ccliNumber: song?.ccli_number || '',
          key: keyUsed,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [songUsage, songs, services, serviceItems, dateFrom, dateTo]);

  const handleExportCSV = () => {
    if (rows.length === 0) {
      toast({ title: 'No data to export', status: 'warning', duration: 2000 });
      return;
    }

    const header = 'Date,Service,Song Title,CCLI Number,Key\n';
    const csv = header + rows.map((r) =>
      `"${r.date}","${r.serviceTitle}","${r.songTitle}","${r.ccliNumber}","${r.key}"`
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `song-usage-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: 'CSV exported', status: 'success', duration: 2000 });
  };

  const setPreset = (preset: '6months' | 'year' | 'clear') => {
    if (preset === 'clear') {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    let from: string;
    if (preset === '6months') {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      from = d.toISOString().split('T')[0];
    } else {
      from = `${now.getFullYear()}-01-01`;
    }
    setDateFrom(from);
    setDateTo(to);
  };

  return (
    <Box mt="10" pt="6" borderTop="1px solid" borderColor={borderColor}>
      <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} mb="4" flexWrap="wrap" gap="2">
        <Box>
          <Text fontSize="lg" fontWeight="600" color={textColor}>Song Usage</Text>
          <Text color={subtextColor} fontSize="sm" mt="0.5">Track usage for CCLI reporting</Text>
        </Box>
        <Tooltip label={rows.length === 0 ? 'No data to export' : ''} isDisabled={rows.length > 0}>
          <Button
            onClick={handleExportCSV}
            variant="outline"
            size="sm"
            borderColor="teal.300"
            color="teal.600"
            _hover={{ bg: 'teal.50', borderColor: 'teal.400' }}
            isDisabled={rows.length === 0}
            leftIcon={<Download size={16} />}
            fontWeight="600"
          >
            Export CSV
          </Button>
        </Tooltip>
      </Flex>

      <Divider mb="4" borderColor={borderColor} />

      <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p="4" mb="6" boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
        <VStack spacing="4" align="stretch">
          <HStack spacing="4" flexWrap="wrap">
            <Box flex="1" minW="140px">
              <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase" mb="2">From</Text>
              <HStack>
                <Calendar size={16} color="var(--chakra-colors-gray-400)" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  bg="gray.50"
                  size="sm"
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </HStack>
            </Box>
            <Box flex="1" minW="140px">
              <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase" mb="2">To</Text>
              <HStack>
                <Calendar size={16} color="var(--chakra-colors-gray-400)" />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  bg="gray.50"
                  size="sm"
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </HStack>
            </Box>
          </HStack>

          <HStack spacing="2" flexWrap="wrap">
            <Text fontSize="xs" color="gray.400">Quick filters:</Text>
            <Button size="xs" variant="ghost" onClick={() => setPreset('6months')} color="gray.500" _hover={{ bg: 'gray.100', color: 'gray.700' }} borderRadius="lg">Last 6 months</Button>
            <Button size="xs" variant="ghost" onClick={() => setPreset('year')} color="gray.500" _hover={{ bg: 'gray.100', color: 'gray.700' }} borderRadius="lg">This year</Button>
            {(dateFrom || dateTo) && (
              <Button size="xs" variant="ghost" onClick={() => setPreset('clear')} color="gray.400" _hover={{ bg: 'gray.100', color: 'gray.600' }} borderRadius="lg" leftIcon={<X size={12} />}>Clear</Button>
            )}
          </HStack>
        </VStack>
      </Box>

      {rows.length === 0 ? (
        <EmptyState
          icon="bar-chart"
          title="No usage logged yet"
          description="Mark a service as Completed to automatically log its songs."
          ctaLabel="Go to Services"
          ctaOnClick={() => router.push('/demo/services')}
        />
      ) : (
        <>
          <Box display={{ base: 'none', md: 'block' }} bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden" boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
            <Table variant="simple">
              <Thead bg={headerBg}>
                <Tr>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Date</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Service</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Song Title</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Key</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">CCLI #</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((row, i) => (
                  <Tr key={i} _hover={{ bg: hoverBg }} transition="all 0.15s" borderLeft="3px solid transparent" sx={{ '&:hover': { borderLeftColor: 'teal.500' } }}>
                    <Td fontSize="sm">{formatShortDate(row.date)}</Td>
                    <Td fontSize="sm">
                      <Text fontWeight="500" color="teal.600" cursor="pointer" _hover={{ textDecoration: 'underline' }} onClick={() => router.push(`/demo/services/${row.serviceId}`)}>{row.serviceTitle}</Text>
                    </Td>
                    <Td fontSize="sm" fontWeight="500" color={textColor}>{row.songTitle}</Td>
                    <Td fontSize="sm">
                      {row.key ? (
                        <Badge variant="subtle" colorScheme="teal" fontSize="xs" borderRadius="full" px="2">{row.key}</Badge>
                      ) : <Text color="gray.400">—</Text>}
                    </Td>
                    <Td fontSize="sm" color={subtextColor}>{row.ccliNumber || '—'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          <VStack display={{ base: 'flex', md: 'none' }} spacing="3" align="stretch">
            {rows.map((row, i) => (
              <Box key={i} bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p="4" boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" borderLeft="3px solid" borderLeftColor="teal.500">
                <HStack justify="space-between" mb="2">
                  <HStack spacing="2">
                    <Music size={14} color="var(--chakra-colors-teal-500)" />
                    <Text fontWeight="600" color={textColor}>{row.songTitle}</Text>
                  </HStack>
                  <Text fontSize="sm" color={subtextColor}>{formatShortDate(row.date)}</Text>
                </HStack>
                <HStack spacing="3" flexWrap="wrap">
                  <Text fontSize="sm" color="teal.600" cursor="pointer" _hover={{ textDecoration: 'underline' }} onClick={() => router.push(`/demo/services/${row.serviceId}`)}>{row.serviceTitle}</Text>
                  {row.key && <Badge variant="subtle" colorScheme="teal" fontSize="xs" borderRadius="full" px="2">{row.key}</Badge>}
                  {row.ccliNumber && <Text fontSize="xs" color="gray.400">CCLI: {row.ccliNumber}</Text>}
                </HStack>
              </Box>
            ))}
          </VStack>

          <Text mt="4" fontSize="sm" color={subtextColor} textAlign="center">
            Showing {rows.length} record{rows.length !== 1 ? 's' : ''}
          </Text>
        </>
      )}
    </Box>
  );
}