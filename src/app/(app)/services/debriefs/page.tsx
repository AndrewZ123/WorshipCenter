'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import {
  Box, VStack, HStack, Text, Button, Select, SimpleGrid,
  Stat, StatLabel, StatNumber, StatHelpText,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer, Badge, Spinner, Center,
  useColorModeValue, Card, CardBody, useDisclosure, Collapse,
  Divider, Tag, TagLabel, Flex,
} from '@chakra-ui/react';
import type { ServiceDebriefPopulated, DebriefTrends } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';

// Lucide icons
import {
  Star, Calendar, Clock, TrendingUp, Users, MessageSquare,
  ChevronDown, ChevronRight, Heart, CheckCircle, AlertTriangle,
  RefreshCw,
} from 'lucide-react';

type DateRange = '1m' | '3m' | '6m' | '1y' | 'all';

export default function ServiceLogPage() {
  const { church } = useAuth();
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [debriefs, setDebriefs] = useState<(ServiceDebriefPopulated & { service?: { title: string; date: string } })[]>([]);
  const [trends, setTrends] = useState<DebriefTrends[]>([]);
  const [range, setRange] = useState<DateRange>('6m');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const headingColor = useColorModeValue('gray.900', 'white');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  const getMonths = useCallback((r: DateRange): number | undefined => {
    switch (r) {
      case '1m': return 1;
      case '3m': return 3;
      case '6m': return 6;
      case '1y': return 12;
      default: return undefined;
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!church) return;
    setLoading(true);
    try {
      const months = getMonths(range);
      const limit = range === 'all' ? 500 : 200;
      const [entries, trendsData] = await Promise.all([
        store.debriefs.getByChurch(church.id, { limit, months }),
        store.debriefs.getTrends(church.id, months || 12),
      ]);
      setDebriefs(entries);
      setTrends(trendsData);
    } catch (error) {
      console.error('[ServiceLog] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [church, range, getMonths, store]);

  useEffect(() => { loadData(); }, [loadData]);

  const latestTrend = trends.length > 0 ? trends[trends.length - 1] : null;
  const overallAvg = debriefs.length > 0 ? {
    engagement: Math.round((debriefs.reduce((s, d) => s + d.rating_engagement, 0) / debriefs.length) * 10) / 10,
    flow: Math.round((debriefs.reduce((s, d) => s + d.rating_flow, 0) / debriefs.length) * 10) / 10,
    tech: Math.round((debriefs.reduce((s, d) => s + d.rating_tech, 0) / debriefs.length) * 10) / 10,
  } : null;

  if (loading) {
    return (
      <Center minH="50vh">
        <Spinner size="xl" color="teal.500" />
      </Center>
    );
  }

  return (
    <Box p={{ base: '4', md: '8' }} maxW="1100px" mx="auto">
      {/* Header */}
      <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} mb="6" flexWrap="wrap" gap="4" direction={{ base: 'column', md: 'row' }}>
        <Box>
          <HStack spacing="3">
            <Star size={24} />
            <Box>
              <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">Service Log</Text>
              <Text mt="1" fontSize="sm" color={subtextColor}>
                Debriefs and trends across all services
              </Text>
            </Box>
          </HStack>
        </Box>
        <Select
          value={range}
          onChange={(e) => setRange(e.target.value as DateRange)}
          w={{ base: 'full', md: '200px' }}
          borderRadius="lg"
          size="sm"
        >
          <option value="1m">Last 30 days</option>
          <option value="3m">Last 3 months</option>
          <option value="6m">Last 6 months</option>
          <option value="1y">Last year</option>
          <option value="all">All time</option>
        </Select>
      </Flex>

      {debriefs.length === 0 ? (
        <EmptyState
          icon="star"
          title="No debriefs yet"
          description="Debriefs appear here once team members submit them after services are marked as completed."
        />
      ) : (
        <>
          {/* Trend Cards */}
          <SimpleGrid columns={{ base: 1, md: 4 }} spacing="4" mb="6">
            <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" boxShadow="none">
              <CardBody py="4" px="5">
                <Stat>
                  <StatLabel fontSize="xs" fontWeight="600" textTransform="uppercase" color={subtextColor}>
                    <HStack spacing="1">
                      <MessageSquare size={12} />
                      <span>Total Debriefs</span>
                    </HStack>
                  </StatLabel>
                  <StatNumber fontSize="2xl" fontWeight="bold" color={headingColor} mt="1">
                    {debriefs.length}
                  </StatNumber>
                  <StatHelpText fontSize="xs" color={subtextColor}>
                    {new Set(debriefs.map(d => d.service_id)).size} services
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" boxShadow="none">
              <CardBody py="4" px="5">
                <Stat>
                  <StatLabel fontSize="xs" fontWeight="600" textTransform="uppercase" color={subtextColor}>
                    <HStack spacing="1">
                      <Users size={12} />
                      <span>Team Members</span>
                    </HStack>
                  </StatLabel>
                  <StatNumber fontSize="2xl" fontWeight="bold" color={headingColor} mt="1">
                    {new Set(debriefs.map(d => d.user_id)).size}
                  </StatNumber>
                  <StatHelpText fontSize="xs" color={subtextColor}>
                    contributed debriefs
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" boxShadow="none">
              <CardBody py="4" px="5">
                <Stat>
                  <StatLabel fontSize="xs" fontWeight="600" textTransform="uppercase" color={subtextColor}>
                    <HStack spacing="1">
                      <TrendingUp size={12} />
                      <span>Avg Engagement</span>
                    </HStack>
                  </StatLabel>
                  <StatNumber fontSize="2xl" fontWeight="bold" color={headingColor} mt="1">
                    {overallAvg?.engagement || '—'}
                  </StatNumber>
                  <StatHelpText fontSize="xs" color={subtextColor}>
                    {latestTrend ? `Last period: ${latestTrend.avg_engagement}` : ''}
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" boxShadow="none">
              <CardBody py="4" px="5">
                <Stat>
                  <StatLabel fontSize="xs" fontWeight="600" textTransform="uppercase" color={subtextColor}>
                    <HStack spacing="1">
                      <TrendingUp size={12} />
                      <span>Avg Flow / Tech</span>
                    </HStack>
                  </StatLabel>
                  <StatNumber fontSize="2xl" fontWeight="bold" color={headingColor} mt="1">
                    {overallAvg ? `${overallAvg.flow} / ${overallAvg.tech}` : '—'}
                  </StatNumber>
                  <StatHelpText fontSize="xs" color={subtextColor}>
                    Flow · Tech
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </SimpleGrid>

          {/* Trends Timeline */}
          {trends.length > 1 && (
            <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" mb="6" boxShadow="none">
              <CardBody py="4" px="5">
                <Text fontSize="sm" fontWeight="600" color={headingColor} mb="3">
                  <HStack spacing="2">
                    <TrendingUp size={16} />
                    <span>Monthly Trends</span>
                  </HStack>
                </Text>
                <TableContainer overflowX="auto">
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr>
                        <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide">Period</Th>
                        <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide">Debriefs</Th>
                        <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide">Engagement</Th>
                        <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide">Flow</Th>
                        <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide">Tech</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {trends.map((t) => {
                        const avg = (t.avg_engagement + t.avg_flow + t.avg_tech) / 3;
                        return (
                          <Tr key={t.period} _hover={{ bg: hoverBg }}>
                            <Td fontWeight="600" fontSize="sm">{t.period}</Td>
                            <Td fontSize="sm">{t.total_debriefs}</Td>
                            <Td fontSize="sm">
                              <Badge
                                colorScheme={t.avg_engagement >= 4 ? 'green' : t.avg_engagement >= 3 ? 'yellow' : 'red'}
                                variant="subtle"
                                borderRadius="full"
                              >
                                {t.avg_engagement}
                              </Badge>
                            </Td>
                            <Td fontSize="sm">
                              <Badge
                                colorScheme={t.avg_flow >= 4 ? 'green' : t.avg_flow >= 3 ? 'yellow' : 'red'}
                                variant="subtle"
                                borderRadius="full"
                              >
                                {t.avg_flow}
                              </Badge>
                            </Td>
                            <Td fontSize="sm">
                              <Badge
                                colorScheme={t.avg_tech >= 4 ? 'green' : t.avg_tech >= 3 ? 'yellow' : 'red'}
                                variant="subtle"
                                borderRadius="full"
                              >
                                {t.avg_tech}
                              </Badge>
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </TableContainer>
              </CardBody>
            </Card>
          )}

          {/* Debrief Entries */}
          <Text fontSize="sm" fontWeight="600" color={headingColor} mb="3">
            <HStack spacing="2">
              <MessageSquare size={16} />
              <span>All Debrief Entries</span>
              <Tag size="sm" colorScheme="teal" borderRadius="full" fontSize="xs">
                {debriefs.length}
              </Tag>
            </HStack>
          </Text>

          <VStack spacing="3" align="stretch">
            {debriefs.map((entry) => (
              <Card
                key={entry.id}
                bg={cardBg}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="lg"
                boxShadow="none"
                cursor="pointer"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                _hover={{ borderColor: 'teal.200' }}
                transition="border-color 0.15s ease"
              >
                <CardBody py="3" px="4">
                  {/* Summary row */}
                  <HStack spacing="3">
                    <Avatar name={entry.user?.name || 'Unknown'} src={entry.user?.avatar_url} size="sm" />
                    <Box flex="1" minW="0">
                      <HStack spacing="2">
                        <Text fontSize="sm" fontWeight="600" color={headingColor} noOfLines={1}>
                          {entry.service?.title || 'Service'}
                        </Text>
                        {entry.service?.date && (
                          <Text fontSize="xs" color={subtextColor}>{entry.service.date}</Text>
                        )}
                      </HStack>
                      <Text fontSize="xs" color={subtextColor}>
                        {entry.user?.name || 'Unknown'}
                      </Text>
                    </Box>
                    <HStack spacing="3">
                      {[
                        { label: 'E', value: entry.rating_engagement },
                        { label: 'F', value: entry.rating_flow },
                        { label: 'T', value: entry.rating_tech },
                      ].map(r => (
                        <Box key={r.label} textAlign="center">
                          <Text fontSize="xs" fontWeight="bold" color={subtextColor}>{r.label}</Text>
                          <Text fontSize="sm" fontWeight="700" color={headingColor}>{r.value}</Text>
                        </Box>
                      ))}
                    </HStack>
                    <Box color={subtextColor}>
                      {expandedId === entry.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </Box>
                  </HStack>

                  {/* Expanded detail */}
                  <Collapse in={expandedId === entry.id} animateOpacity>
                    <VStack spacing="3" align="stretch" mt="4" pt="3" borderTop="1px solid" borderColor={borderColor}>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing="3">
                        {entry.what_went_well && (
                          <Box bg="green.50" _dark={{ bg: 'green.900' }} p="3" borderRadius="md">
                            <HStack spacing="1" mb="1">
                              <CheckCircle size={14} color="var(--chakra-colors-green-500)" />
                              <Text fontSize="xs" fontWeight="700" textTransform="uppercase" color="green.600" _dark={{ color: 'green.200' }}>
                                What went well
                              </Text>
                            </HStack>
                            <Text fontSize="sm" whiteSpace="pre-wrap">{entry.what_went_well}</Text>
                          </Box>
                        )}
                        {entry.what_broke && (
                          <Box bg="orange.50" _dark={{ bg: 'orange.900' }} p="3" borderRadius="md">
                            <HStack spacing="1" mb="1">
                              <AlertTriangle size={14} color="var(--chakra-colors-orange-500)" />
                              <Text fontSize="xs" fontWeight="700" textTransform="uppercase" color="orange.600" _dark={{ color: 'orange.200' }}>
                                What broke
                              </Text>
                            </HStack>
                            <Text fontSize="sm" whiteSpace="pre-wrap">{entry.what_broke}</Text>
                          </Box>
                        )}
                      </SimpleGrid>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing="3">
                        {entry.what_to_change && (
                          <Box bg="blue.50" _dark={{ bg: 'blue.900' }} p="3" borderRadius="md">
                            <HStack spacing="1" mb="1">
                              <RefreshCw size={14} color="var(--chakra-colors-blue-500)" />
                              <Text fontSize="xs" fontWeight="700" textTransform="uppercase" color="blue.600" _dark={{ color: 'blue.200' }}>
                                What to change
                              </Text>
                            </HStack>
                            <Text fontSize="sm" whiteSpace="pre-wrap">{entry.what_to_change}</Text>
                          </Box>
                        )}
                        {entry.saw_god_working && (
                          <Box bg="purple.50" _dark={{ bg: 'purple.900' }} p="3" borderRadius="md">
                            <HStack spacing="1" mb="1">
                              <Heart size={14} color="var(--chakra-colors-purple-500)" />
                              <Text fontSize="xs" fontWeight="700" textTransform="uppercase" color="purple.600" _dark={{ color: 'purple.200' }}>
                                Saw God working
                              </Text>
                            </HStack>
                            <Text fontSize="sm" whiteSpace="pre-wrap">{entry.saw_god_working}</Text>
                          </Box>
                        )}
                      </SimpleGrid>
                      {entry.timing_data && entry.timing_data.length > 0 && (
                        <Box mt="1">
                          <Text fontSize="xs" fontWeight="700" textTransform="uppercase" color={subtextColor} mb="1">
                            <HStack spacing="1">
                              <Clock size={12} />
                              <span>Timing Comparison</span>
                            </HStack>
                          </Text>
                          <Box overflowX="auto">
                          <Table variant="simple" size="xs">
                            <Thead>
                              <Tr>
                                <Th fontSize="xs">Item</Th>
                                <Th fontSize="xs">Planned</Th>
                                <Th fontSize="xs">Actual</Th>
                                <Th fontSize="xs">Δ</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {(entry.timing_data as any[]).map((t: any, i: number) => {
                                const diff = t.actual_seconds != null && t.planned_seconds != null
                                  ? t.actual_seconds - t.planned_seconds : null;
                                return (
                                  <Tr key={i}>
                                    <Td fontSize="xs">{t.title}</Td>
                                    <Td fontSize="xs">{t.planned_seconds != null ? `${Math.round(t.planned_seconds / 60)}m` : '—'}</Td>
                                    <Td fontSize="xs">{t.actual_seconds != null ? `${Math.round(t.actual_seconds / 60)}m` : '—'}</Td>
                                    <Td fontSize="xs">
                                      {diff != null && (
                                        <Badge colorScheme={diff > 30 ? 'red' : diff < -30 ? 'green' : 'gray'} variant="subtle" fontSize="xs">
                                          {diff > 0 ? '+' : ''}{Math.round(diff / 60)}m
                                        </Badge>
                                      )}
                                    </Td>
                                  </Tr>
                                );
                              })}
                            </Tbody>
                          </Table>
                          </Box>
                        </Box>
                      )}
                      <Text fontSize="xs" color={subtextColor}>
                        Submitted {new Date(entry.created_at).toLocaleString()}
                      </Text>
                    </VStack>
                  </Collapse>
                </CardBody>
              </Card>
            ))}
          </VStack>
        </>
      )}
    </Box>
  );
}
