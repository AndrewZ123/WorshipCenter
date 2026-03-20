'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Text, HStack, Button, Table, Thead, Tbody, Tr, Th, Td,
  Input, Flex, useToast, useColorModeValue,
  Spinner, Center, VStack, Badge, Icon, Tooltip,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import type { Song, Service, SongUsage, ServiceItem } from '@/lib/types';
import EmptyState from '@/components/ui/EmptyState';
import { formatShortDate } from '@/lib/formatDate';

// Lucide icons
import { 
  Download, Calendar, BarChart2, Music, X, Info
} from 'lucide-react';

export default function UsagePage() {
  const { church } = useAuth();
  const store = useStore();
  const router = useRouter();
  const toast = useToast();
  const [allUsage, setAllUsage] = useState<SongUsage[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [allServiceItems, setAllServiceItems] = useState<ServiceItem[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const headingColor = useColorModeValue('gray.900', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => {
    if (church) loadUsage();
  }, [church]);

  const loadUsage = async () => {
    if (!church) return;
    try {
      setLoading(true);
      setAllUsage(await store.songUsage.getByChurch(church.id));
      setSongs(await store.songs.getByChurch(church.id));
      const svcs = await store.services.getByChurch(church.id);
      setServices(svcs);
      // Load all service items so we can find the key used
      const items: ServiceItem[] = [];
      for (const svc of svcs) {
        const svcItems = await store.serviceItems.getByService(svc.id);
        items.push(...svcItems);
      }
      setAllServiceItems(items);
    } catch (error) {
      console.error('Error loading usage:', error);
      toast({ title: 'Error loading data', status: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  // Build row data
  const rows = useMemo(() => {
    let filtered = allUsage;
    if (dateFrom) filtered = filtered.filter((u) => u.date >= dateFrom);
    if (dateTo) filtered = filtered.filter((u) => u.date <= dateTo);

    return filtered
      .map((u) => {
        const song = songs.find((s) => s.id === u.song_id);
        const service = services.find((s) => s.id === u.service_id);
        // Find the key used in the service item
        const serviceItem = allServiceItems.find(
          (si) => si.service_id === u.service_id && si.song_id === u.song_id && si.type === 'song'
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
  }, [allUsage, songs, services, allServiceItems, dateFrom, dateTo]);

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

  // Quick filter presets
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
          <Text fontSize="2xl" fontWeight="bold" color={headingColor} letterSpacing="tight">Song Usage</Text>
          <Text color={subtextColor} fontSize="sm" mt="1">Track usage for CCLI reporting</Text>
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

      {/* Date Range Filter */}
      <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p="4" mb="6" boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
        <VStack spacing="4" align="stretch">
          <HStack spacing="4" flexWrap="wrap">
            <Box flex="1" minW="140px">
              <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase" mb="2">From</Text>
              <HStack>
                <Calendar size={16} className="text-gray-400" />
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
                <Calendar size={16} className="text-gray-400" />
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
          
          {/* Preset filters */}
          <HStack spacing="2" flexWrap="wrap">
            <Text fontSize="xs" color="gray.400">Quick filters:</Text>
            <Button 
              size="xs" 
              variant="ghost" 
              onClick={() => setPreset('6months')}
              color="gray.500"
              _hover={{ bg: 'gray.100', color: 'gray.700' }}
              borderRadius="lg"
            >
              Last 6 months
            </Button>
            <Button 
              size="xs" 
              variant="ghost" 
              onClick={() => setPreset('year')}
              color="gray.500"
              _hover={{ bg: 'gray.100', color: 'gray.700' }}
              borderRadius="lg"
            >
              This year
            </Button>
            {(dateFrom || dateTo) && (
              <Button 
                size="xs" 
                variant="ghost" 
                onClick={() => setPreset('clear')}
                color="gray.400"
                _hover={{ bg: 'gray.100', color: 'gray.600' }}
                borderRadius="lg"
                leftIcon={<X size={12} />}
              >
                Clear
              </Button>
            )}
          </HStack>
        </VStack>
      </Box>

      {rows.length === 0 ? (
        <EmptyState
          icon="barChart"
          title="No usage logged yet"
          description="Mark a service as Completed to automatically log its songs."
          ctaLabel="Go to Services"
          ctaOnClick={() => router.push('/services')}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <Box display={{ base: 'none', md: 'block' }} bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden" boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
            <Table variant="simple">
              <Thead bg={useColorModeValue('gray.50', 'gray.700')}>
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
                  <Tr 
                    key={i}
                    sx={{ borderLeft: '3px solid transparent' }}
                    _hover={{ 
                      bg: hoverBg,
                      borderLeftColor: 'teal.500',
                    }}
                    transition="all 0.15s"
                  >
                    <Td fontSize="sm">{formatShortDate(row.date)}</Td>
                    <Td fontSize="sm">
                      <Text
                        fontWeight="500"
                        color="teal.600"
                        cursor="pointer"
                        _hover={{ textDecoration: 'underline' }}
                        onClick={() => router.push(`/services/${row.serviceId}`)}
                      >
                        {row.serviceTitle}
                      </Text>
                    </Td>
                    <Td fontSize="sm" fontWeight="500" color={headingColor}>{row.songTitle}</Td>
                    <Td fontSize="sm" color={subtextColor}>
                      {row.key ? (
                        <Badge variant="subtle" colorScheme="teal" fontSize="xs" borderRadius="full" px="2">{row.key}</Badge>
                      ) : '—'}
                    </Td>
                    <Td fontSize="sm" color={subtextColor}>{row.ccliNumber || '—'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          {/* Mobile Cards */}
          <VStack spacing="3" align="stretch" display={{ base: 'flex', md: 'none' }}>
            {rows.map((row, i) => (
              <Box
                key={i}
                bg={cardBg}
                borderRadius="xl"
                border="1px solid"
                borderColor={borderColor}
                p="4"
                boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
                borderLeft="3px solid"
                borderLeftColor="teal.500"
              >
                <HStack justify="space-between" mb="2">
                  <HStack spacing="2">
                    <Music size={14} className="text-teal-500" />
                    <Text fontWeight="600" color={headingColor}>{row.songTitle}</Text>
                  </HStack>
                  <Text fontSize="sm" color={subtextColor}>{formatShortDate(row.date)}</Text>
                </HStack>
                <HStack spacing="3" flexWrap="wrap">
                  <Text 
                    fontSize="sm" 
                    color="teal.600" 
                    cursor="pointer"
                    _hover={{ textDecoration: 'underline' }}
                    onClick={() => router.push(`/services/${row.serviceId}`)}
                  >
                    {row.serviceTitle}
                  </Text>
                  {row.key && (
                    <Badge variant="subtle" colorScheme="teal" fontSize="xs" borderRadius="full" px="2">{row.key}</Badge>
                  )}
                  {row.ccliNumber && (
                    <Text fontSize="xs" color="gray.400">CCLI: {row.ccliNumber}</Text>
                  )}
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