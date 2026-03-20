'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Text, Button, Table, Thead, Tbody, Tr, Th, Td,
  Input, Flex, useToast, Spinner, Center, useColorModeValue,
  HStack, VStack, Badge, IconButton, Menu, MenuButton, MenuList, MenuItem,
} from '@chakra-ui/react';
import { useDemo } from '@/lib/demo/context';
import type { SongUsage, ServiceItem } from '@/lib/types';
import EmptyState from '@/components/ui/EmptyState';
import { formatShortDate } from '@/lib/formatDate';

// Lucide icons
import { 
  Download, Calendar, X, BarChart2, FileText
} from 'lucide-react';

export default function DemoUsagePage() {
  const { songs, services, songUsage, serviceItems } = useDemo();
  const router = useRouter();
  const toast = useToast();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.900', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => {
    setLoading(false);
  }, [songUsage]);

  // Build row data
  const rows = useMemo(() => {
    let filtered = songUsage;
    if (dateFrom) filtered = filtered.filter((u: SongUsage) => u.date >= dateFrom);
    if (dateTo) filtered = filtered.filter((u: SongUsage) => u.date <= dateTo);

    return filtered
      .map((u: SongUsage) => {
        const song = songs.find((s) => s.id === u.song_id);
        const service = services.find((s) => s.id === u.service_id);
        // Find the key used in the service item
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

  // Quick filter presets
  const setPreset = (preset: string) => {
    const today = new Date();
    const toDate = today.toISOString().split('T')[0];
    let fromDate = '';
    
    if (preset === '6months') {
      const from = new Date(today);
      from.setMonth(from.getMonth() - 6);
      fromDate = from.toISOString().split('T')[0];
    } else if (preset === 'year') {
      const from = new Date(today.getFullYear(), 0, 1);
      fromDate = from.toISOString().split('T')[0];
    }
    
    setDateFrom(fromDate);
    setDateTo(toDate);
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
          <Text fontSize="2xl" fontWeight="bold" color={textColor} letterSpacing="tight">Song Usage</Text>
          <Text color={subtextColor} fontSize="sm" mt="1">Track usage for CCLI reporting</Text>
        </Box>
        <Button 
          onClick={handleExportCSV} 
          variant="outline" 
          size="sm"
          borderColor="teal.500"
          color="teal.600"
          _hover={{ bg: 'teal.50' }}
          leftIcon={<Download size={16} />}
          isDisabled={rows.length === 0}
          fontWeight="600"
          w={{ base: 'full', md: 'auto' }}
        >
          Export CSV
        </Button>
      </Flex>

      {/* Date Range Filters */}
      <Box 
        bg={cardBg} 
        borderRadius="xl" 
        border="1px solid" 
        borderColor={borderColor} 
        p="4" 
        mb="6"
        boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
      >
        <VStack spacing="4" align="stretch">
          <Flex gap="4" flexWrap="wrap" align="flex-end">
            <Box flex="1" minW="140px">
              <Text fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500" mb="2">From</Text>
              <HStack>
                <Calendar size={16} className="text-gray-400" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  size="sm"
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </HStack>
            </Box>
            <Box flex="1" minW="140px">
              <Text fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500" mb="2">To</Text>
              <HStack>
                <Calendar size={16} className="text-gray-400" />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  size="sm"
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </HStack>
            </Box>
            {(dateFrom || dateTo) && (
              <IconButton
                aria-label="Clear filters"
                icon={<X size={16} />}
                size="sm"
                variant="ghost"
                onClick={() => { setDateFrom(''); setDateTo(''); }}
              />
            )}
          </Flex>
          
          {/* Quick filter chips */}
          <HStack spacing="2" flexWrap="wrap">
            <Text fontSize="xs" color="gray.400">Quick filters:</Text>
            <Button 
              size="xs" 
              variant="ghost" 
              onClick={() => setPreset('6months')}
              borderRadius="full"
              px="3"
              _hover={{ bg: 'teal.50', color: 'teal.600' }}
            >
              Last 6 months
            </Button>
            <Button 
              size="xs" 
              variant="ghost" 
              onClick={() => setPreset('year')}
              borderRadius="full"
              px="3"
              _hover={{ bg: 'teal.50', color: 'teal.600' }}
            >
              This year
            </Button>
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
          {/* Desktop table */}
          <Box 
            display={{ base: 'none', md: 'block' }}
            bg={cardBg} 
            borderRadius="xl" 
            border="1px solid" 
            borderColor={borderColor} 
            overflow="hidden"
            boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
          >
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
                  <Tr 
                    key={i}
                    _hover={{ bg: hoverBg }}
                    transition="all 0.15s"
                    borderLeft="3px solid transparent"
                    sx={{ '&:hover': { borderLeftColor: 'teal.500' } }}
                  >
                    <Td fontSize="sm" color={subtextColor}>{formatShortDate(row.date)}</Td>
                    <Td fontSize="sm">
                      <Text
                        fontWeight="600"
                        color="teal.600"
                        cursor="pointer"
                        _hover={{ textDecoration: 'underline' }}
                        onClick={() => router.push(`/demo/services/${row.serviceId}`)}
                      >
                        {row.serviceTitle}
                      </Text>
                    </Td>
                    <Td fontSize="sm" fontWeight="600" color={textColor}>{row.songTitle}</Td>
                    <Td fontSize="sm">
                      {row.key ? (
                        <Badge bg="teal.100" color="teal.700" fontSize="xs" borderRadius="full" px="2" fontWeight="600">
                          {row.key}
                        </Badge>
                      ) : (
                        <Text color="gray.400">—</Text>
                      )}
                    </Td>
                    <Td fontSize="sm" color={subtextColor}>{row.ccliNumber || '—'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          {/* Mobile cards */}
          <VStack display={{ base: 'flex', md: 'none' }} spacing="3" align="stretch">
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
                <Flex justify="space-between" align="start">
                  <Box>
                    <Text fontWeight="600" color={textColor}>{row.songTitle}</Text>
                    <Text
                      fontSize="sm"
                      color="teal.600"
                      cursor="pointer"
                      _hover={{ textDecoration: 'underline' }}
                      onClick={() => router.push(`/demo/services/${row.serviceId}`)}
                    >
                      {row.serviceTitle}
                    </Text>
                    <HStack mt="2" spacing="3">
                      <Text fontSize="xs" color="gray.400">{formatShortDate(row.date)}</Text>
                      {row.key && (
                        <Badge bg="teal.100" color="teal.700" fontSize="xs" borderRadius="full" px="2" fontWeight="600">
                          {row.key}
                        </Badge>
                      )}
                    </HStack>
                  </Box>
                  {row.ccliNumber && (
                    <Text fontSize="xs" color="gray.400">CCLI #{row.ccliNumber}</Text>
                  )}
                </Flex>
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