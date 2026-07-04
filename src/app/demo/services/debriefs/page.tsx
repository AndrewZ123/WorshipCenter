'use client';

import { useState, useMemo } from 'react';
import { useDemo } from '@/lib/demo/context';
import {
  Box, VStack, HStack, Text, Button, Select, SimpleGrid,
  Stat, StatLabel, StatNumber, StatHelpText,
  Table, Thead, Tbody, Tr, Th, Td, Badge, Spinner, Center,
  useColorModeValue, Card, CardBody, Collapse, Divider, Flex,
} from '@chakra-ui/react';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import { Star, Calendar, TrendingUp, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

type DateRange = '1m' | '3m' | '6m' | '1y' | 'all';

export default function DemoDebriefsPage() {
  const { services, debriefs, teamMembers, user } = useDemo();
  const [range, setRange] = useState<DateRange>('6m');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const headingColor = useColorModeValue('gray.900', 'white');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  const getMonths = (r: DateRange): number | undefined => {
    switch (r) {
      case '1m': return 1;
      case '3m': return 3;
      case '6m': return 6;
      case '1y': return 12;
      default: return undefined;
    }
  };

  const filtered = useMemo(() => {
    const months = getMonths(range);
    const cutoff = months ? new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000) : null;
    return debriefs
      .filter(d => !cutoff || new Date(d.created_at) >= cutoff)
      .map(d => {
        const svc = services.find(s => s.id === d.service_id);
        const member = teamMembers.find(tm => tm.user_id === d.user_id);
        return {
          ...d,
          service: svc ? { title: svc.title, date: svc.date } : undefined,
          user: { name: member?.name || 'Demo User', avatar_url: member?.avatar_url },
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [debriefs, services, teamMembers, range]);

  const trends = useMemo(() => {
    if (filtered.length === 0) return null;
    const avg = (vals: number[]) => Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    return {
      avg_engagement: avg(filtered.map(d => d.rating_engagement)),
      avg_flow: avg(filtered.map(d => d.rating_flow)),
      avg_tech: avg(filtered.map(d => d.rating_tech)),
      total: filtered.length,
    };
  }, [filtered]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={14}
        fill={i < rating ? 'var(--chakra-colors-yellow-400)' : 'none'}
        color={i < rating ? 'var(--chakra-colors-yellow-400)' : 'var(--chakra-colors-gray-300)'}
      />
    ));
  };

  return (
    <Box px={{ base: '4', md: '8' }} pb={{ base: '4', md: '8' }} maxW="1100px" mx="auto">
      <Flex justify="space-between" align={{ base: 'start', md: 'center' }} mb="6" direction={{ base: 'column', md: 'row' }} gap="4">
        <Box>
          <Text fontSize="2xl" fontWeight="bold" color={headingColor}>Service Debriefs</Text>
          <Text color={subtextColor} fontSize="sm">Review feedback and trends from completed services</Text>
        </Box>
        <Select
          value={range}
          onChange={(e) => setRange(e.target.value as DateRange)}
          w={{ base: 'full', md: '200px' }}
          borderRadius="lg"
        >
          <option value="1m">Last 30 days</option>
          <option value="3m">Last 3 months</option>
          <option value="6m">Last 6 months</option>
          <option value="1y">Last year</option>
          <option value="all">All time</option>
        </Select>
      </Flex>

      {filtered.length === 0 ? (
        <EmptyState
          icon="star"
          title="No debriefs yet"
          description="Debriefs appear after services are completed and team members submit feedback."
        />
      ) : (
        <>
          {/* Trends */}
          {trends && (
            <SimpleGrid columns={{ base: 2, md: 4 }} spacing="4" mb="6">
              <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl">
                <CardBody>
                  <Stat>
                    <StatLabel color={subtextColor}>Engagement</StatLabel>
                    <StatNumber color={headingColor}>{trends.avg_engagement}</StatNumber>
                    <StatHelpText color={subtextColor}>
                      <HStack spacing="1">{renderStars(Math.round(trends.avg_engagement))}</HStack>
                    </StatHelpText>
                  </Stat>
                </CardBody>
              </Card>
              <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl">
                <CardBody>
                  <Stat>
                    <StatLabel color={subtextColor}>Flow</StatLabel>
                    <StatNumber color={headingColor}>{trends.avg_flow}</StatNumber>
                    <StatHelpText color={subtextColor}>
                      <HStack spacing="1">{renderStars(Math.round(trends.avg_flow))}</HStack>
                    </StatHelpText>
                  </Stat>
                </CardBody>
              </Card>
              <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl">
                <CardBody>
                  <Stat>
                    <StatLabel color={subtextColor}>Technical</StatLabel>
                    <StatNumber color={headingColor}>{trends.avg_tech}</StatNumber>
                    <StatHelpText color={subtextColor}>
                      <HStack spacing="1">{renderStars(Math.round(trends.avg_tech))}</HStack>
                    </StatHelpText>
                  </Stat>
                </CardBody>
              </Card>
              <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl">
                <CardBody>
                  <Stat>
                    <StatLabel color={subtextColor}>Total Debriefs</StatLabel>
                    <StatNumber color={headingColor}>{trends.total}</StatNumber>
                    <StatHelpText color={subtextColor}>In selected period</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>
            </SimpleGrid>
          )}

          {/* Debrief List */}
          <VStack spacing="2" align="stretch">
            {filtered.map((entry) => (
              <Box key={entry.id}>
                <Card
                  bg={cardBg}
                  border="1px solid"
                  borderColor={borderColor}
                  borderRadius="xl"
                  cursor="pointer"
                  _hover={{ borderColor: 'teal.200', boxShadow: 'md' }}
                  transition="all 0.15s"
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  <CardBody py="4" px="5">
                    <HStack spacing="4" align="center">
                      <Avatar name={entry.user?.name || 'Unknown'} src={entry.user?.avatar_url} size="sm" />
                      <Box flex="1" minW="0">
                        <HStack spacing="2">
                          <Text fontWeight="600" fontSize="sm" color={headingColor} noOfLines={1}>
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
                      {entry.what_broke && (
                        <AlertTriangle size={14} color="var(--chakra-colors-orange-400)" />
                      )}
                      {expandedId === entry.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </HStack>

                    <Collapse in={expandedId === entry.id} animateOpacity>
                      <VStack spacing="4" align="stretch" mt="4" pt="4" borderTop="1px solid" borderColor={borderColor}>
                        {entry.what_went_well && (
                          <Box>
                            <HStack spacing="2" mb="1">
                              <Star size={14} color="var(--chakra-colors-green-500)" />
                              <Text fontSize="sm" fontWeight="600" color="green.600">What went well</Text>
                            </HStack>
                            <Text fontSize="sm" color={textColor} ml="6">{entry.what_went_well}</Text>
                          </Box>
                        )}
                        {entry.what_broke && (
                          <Box>
                            <HStack spacing="2" mb="1">
                              <AlertTriangle size={14} color="var(--chakra-colors-orange-400)" />
                              <Text fontSize="sm" fontWeight="600" color="orange.600">What broke</Text>
                            </HStack>
                            <Text fontSize="sm" color={textColor} ml="6">{entry.what_broke}</Text>
                          </Box>
                        )}
                        {entry.what_to_change && (
                          <Box>
                            <HStack spacing="2" mb="1">
                              <TrendingUp size={14} color="var(--chakra-colors-blue-500)" />
                              <Text fontSize="sm" fontWeight="600" color="blue.600">What to change</Text>
                            </HStack>
                            <Text fontSize="sm" color={textColor} ml="6">{entry.what_to_change}</Text>
                          </Box>
                        )}
                      </VStack>
                    </Collapse>
                  </CardBody>
                </Card>
              </Box>
            ))}
          </VStack>
        </>
      )}
    </Box>
  );
}
