'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Text, HStack, Button, Table, Thead, Tbody, Tr, Th, Td,
  Input, Flex, useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalCloseButton, ModalFooter, FormControl,
  FormLabel, VStack, useToast, Tag, TagLabel, Wrap, WrapItem, Badge,
  Card, CardBody, IconButton, Menu, MenuButton, MenuList, MenuItem,
  useColorModeValue, Spinner, Center,
} from '@chakra-ui/react';
import { useDemo } from '@/lib/demo/context';
import type { Song, SongUsage } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { formatRelativeDate } from '@/lib/formatDate';

// Lucide icons
import { 
  Plus, MoreVertical, Search, Music, Trash2, SlidersHorizontal
} from 'lucide-react';

export default function DemoSongsPage() {
  const { church, songs, songUsage, createSong, deleteSong } = useDemo();
  const router = useRouter();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [search, setSearch] = useState('');
  const [filterRecent, setFilterRecent] = useState(false);
  const [loading, setLoading] = useState(true);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteDisclosure = useDisclosure();

  // Form
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [defaultKey, setDefaultKey] = useState('');
  const [ccli, setCcli] = useState('');
  const [tagsStr, setTagsStr] = useState('');

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.900', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const emptyColor = useColorModeValue('gray.400', 'gray.500');
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  const tabBg = useColorModeValue('gray.100', 'gray.700');
  const tabActiveBg = useColorModeValue('white', 'gray.600');

  useEffect(() => {
    setLoading(false);
  }, [songs]);

  // Sort songs alphabetically
  const sortedSongs = useMemo(() => {
    return [...songs].sort((a, b) => a.title.localeCompare(b.title));
  }, [songs]);

  const usageMap = useMemo(() => {
    const map: Record<string, { count: number; lastUsed: string | null }> = {};
    songUsage.forEach((u: SongUsage) => {
      if (!map[u.song_id]) map[u.song_id] = { count: 0, lastUsed: null };
      map[u.song_id].count++;
      if (!map[u.song_id].lastUsed || u.date > map[u.song_id].lastUsed!) map[u.song_id].lastUsed = u.date;
    });
    return map;
  }, [songUsage]);

  const threeMonthsAgo = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 90);
    return d.toISOString().split('T')[0];
  }, []);

  // Get rotation health indicator
  const getRotationHealth = (songId: string) => {
    const usage = usageMap[songId];
    if (!usage || usage.count === 0) {
      return { color: 'green', label: 'Fresh' };
    }
    // Check usage in last 8 weeks
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    const recentUsage = songUsage.filter((u: SongUsage) => 
      u.song_id === songId && new Date(u.date) >= eightWeeksAgo
    );
    if (recentUsage.length >= 6) {
      return { color: 'red', label: 'Overplayed' };
    } else if (recentUsage.length >= 3) {
      return { color: 'yellow', label: 'In rotation' };
    }
    return { color: 'green', label: 'Fresh' };
  };

  const handleCreate = async () => {
    if (!church || !title) return;
    createSong({
      church_id: church.id,
      title,
      artist,
      default_key: defaultKey || 'C',
      ccli_number: ccli,
      tags: tagsStr.split(',').map((t) => t.trim()).filter(Boolean),
    });
    toast({ title: 'Song added', status: 'success', duration: 2000 });
    setTitle(''); setArtist(''); setDefaultKey(''); setCcli(''); setTagsStr('');
    onClose();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    deleteSong(deleteId);
    toast({ title: 'Song deleted', status: 'info', duration: 2000 });
    setDeleteId(null);
    deleteDisclosure.onClose();
  };

  const filtered = sortedSongs.filter((s) => {
    const matchesSearch = s.title.toLowerCase().includes(search.toLowerCase()) || s.artist.toLowerCase().includes(search.toLowerCase()) || s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    if (!matchesSearch) return false;
    if (filterRecent) {
      const usage = usageMap[s.id];
      if (!usage?.lastUsed || usage.lastUsed < threeMonthsAgo) return false;
    }
    return true;
  });

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return formatRelativeDate(d);
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
          <Text fontSize="2xl" fontWeight="bold" color={textColor} letterSpacing="tight">Song Library</Text>
          <Text color={subtextColor} fontSize="sm" mt="1">Manage your worship songs and chord charts</Text>
        </Box>
        <Button 
          onClick={onOpen} 
          size="sm" 
          colorScheme="teal" 
          px="4" 
          py="2"
          fontWeight="600"
          leftIcon={<Plus size={16} />}
          w={{ base: 'full', md: 'auto' }}
        >
          Add Song
        </Button>
      </Flex>

      {/* Search and Filter */}
      <Flex mb="5" gap="3" flexWrap="wrap" align="stretch" direction={{ base: 'column', md: 'row' }}>
        <Box position="relative" flex="1" minW="200px">
          <Box position="absolute" left="3" top="50%" transform="translateY(-50%)" color="gray.400">
            <Search size={16} />
          </Box>
          <Input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Search by title, artist, or tag..." 
            bg={cardBg} 
            size="md" 
            pl="10"
            borderRadius="lg"
            border="1px solid"
            borderColor="gray.200"
            _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
          />
        </Box>
        <Box 
          bg={tabBg} 
          rounded="full" 
          p="1" 
          display="flex"
          w={{ base: 'full', md: 'auto' }}
        >
          <Button
            onClick={() => setFilterRecent(false)}
            bg={!filterRecent ? tabActiveBg : 'transparent'}
            color={!filterRecent ? 'teal.700' : 'gray.500'}
            fontWeight={!filterRecent ? '600' : '400'}
            size="sm"
            rounded="full"
            boxShadow={!filterRecent ? 'sm' : 'none'}
            _hover={{ bg: !filterRecent ? tabActiveBg : 'gray.200' }}
            flex="1"
          >
            All Songs
          </Button>
          <Button
            onClick={() => setFilterRecent(true)}
            bg={filterRecent ? tabActiveBg : 'transparent'}
            color={filterRecent ? 'teal.700' : 'gray.500'}
            fontWeight={filterRecent ? '600' : '400'}
            size="sm"
            rounded="full"
            boxShadow={filterRecent ? 'sm' : 'none'}
            _hover={{ bg: filterRecent ? tabActiveBg : 'gray.200' }}
            flex="1"
          >
            Used Last 3 Months
          </Button>
        </Box>
      </Flex>

      {filtered.length === 0 ? (
        songs.length === 0 ? (
          <EmptyState
            icon="music"
            title="Your library is empty"
            description="Add your first song to start building your worship library."
            ctaLabel="Add Song"
            ctaOnClick={onOpen}
          />
        ) : (
          <EmptyState
            icon="music"
            title="No songs match your search"
            description="Try a different search term or filter."
          />
        )
      ) : (
        <>
          {/* Desktop table */}
          <Box display={{ base: 'none', md: 'block' }} bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden" boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
            <Table variant="simple">
              <Thead bg={headerBg}>
                <Tr>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Title</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Artist</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Key</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Last Used</Th>
                  <Th isNumeric fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Used</Th>
                  <Th w="50px"></Th>
                </Tr>
              </Thead>
              <Tbody>
                {filtered.map((song) => {
                  const usage = usageMap[song.id];
                  const timesUsed = usage?.count || 0;
                  const health = getRotationHealth(song.id);
                  return (
                    <Tr 
                      key={song.id} 
                      cursor="pointer" 
                      _hover={{ bg: hoverBg }} 
                      transition="all 0.15s"
                      onClick={() => router.push(`/demo/songs/${song.id}`)}
                      borderLeft="3px solid transparent"
                      sx={{ '&:hover': { borderLeftColor: 'teal.500' } }}
                    >
                      <Td>
                        <HStack spacing="3">
                          <Box 
                            p="2" 
                            borderRadius="lg" 
                            bg="teal.50"
                            color="teal.600"
                          >
                            <Music size={16} />
                          </Box>
                          <Box>
                            <Text fontWeight="600" color={textColor}>{song.title}</Text>
                            {song.tags.length > 0 && (
                              <Wrap mt="1" spacing="1">
                                {song.tags.slice(0, 3).map((tag) => (
                                  <WrapItem key={tag}>
                                    <Tag size="sm" variant="subtle" colorScheme="gray" borderRadius="md">
                                      <TagLabel fontSize="xs">{tag}</TagLabel>
                                    </Tag>
                                  </WrapItem>
                                ))}
                              </Wrap>
                            )}
                          </Box>
                        </HStack>
                      </Td>
                      <Td color={subtextColor}>{song.artist || '—'}</Td>
                      <Td>
                        <HStack spacing="2">
                          <Badge 
                            bg="teal.100" 
                            color="teal.700" 
                            borderRadius="full" 
                            px="2"
                            fontWeight="600"
                            fontSize="xs"
                          >
                            {song.default_key}
                          </Badge>
                          <Box 
                            w="2" 
                            h="2" 
                            borderRadius="full" 
                            bg={health.color === 'green' ? 'green.400' : health.color === 'yellow' ? 'yellow.400' : 'red.400'}
                            title={health.label}
                          />
                        </HStack>
                      </Td>
                      <Td color={subtextColor} fontSize="sm">{formatDate(usage?.lastUsed || null)}</Td>
                      <Td isNumeric>
                        {timesUsed > 0 ? (
                          <Badge 
                            bg="teal.50" 
                            color="teal.700" 
                            fontSize="xs" 
                            px="2" 
                            py="0.5" 
                            borderRadius="full"
                            fontWeight="600"
                          >
                            {timesUsed}
                          </Badge>
                        ) : (
                          <Text color={emptyColor} fontSize="sm">0</Text>
                        )}
                      </Td>
                      <Td onClick={(e) => e.stopPropagation()}>
                        <Menu>
                          <MenuButton 
                            as={IconButton} 
                            icon={<MoreVertical size={16} />} 
                            variant="ghost" 
                            size="sm" 
                            aria-label="Actions"
                            color="gray.400"
                            _hover={{ color: 'gray.600', bg: 'gray.100' }}
                            minW="32px"
                          />
                          <MenuList borderRadius="xl">
                            <MenuItem 
                              icon={<Trash2 size={16} />} 
                              color="red.500" 
                              onClick={() => { setDeleteId(song.id); deleteDisclosure.onOpen(); }}
                              borderRadius="lg"
                              _hover={{ bg: 'red.50' }}
                            >
                              Delete
                            </MenuItem>
                          </MenuList>
                        </Menu>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>

          {/* Mobile cards */}
          <VStack display={{ base: 'flex', md: 'none' }} spacing="3" align="stretch">
            {filtered.map((song) => {
              const usage = usageMap[song.id];
              const timesUsed = usage?.count || 0;
              const health = getRotationHealth(song.id);
              return (
                <Card 
                  key={song.id} 
                  bg={cardBg} 
                  border="1px solid" 
                  borderColor={borderColor} 
                  borderRadius="xl" 
                  cursor="pointer" 
                  boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
                  _hover={{ 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
                    transform: 'translateY(-1px)'
                  }}
                  transition="all 0.15s"
                  onClick={() => router.push(`/demo/songs/${song.id}`)}
                  borderLeft="3px solid"
                  borderLeftColor="teal.500"
                >
                  <CardBody py="3" px="4">
                    <Flex justify="space-between" align="start">
                      <HStack spacing="3" flex="1" minW="0">
                        <Box 
                          p="2" 
                          borderRadius="lg" 
                          bg="teal.50"
                          color="teal.600"
                          flexShrink={0}
                        >
                          <Music size={16} />
                        </Box>
                        <Box minW="0">
                          <Text fontWeight="600" color={textColor} noOfLines={1}>{song.title}</Text>
                          <HStack spacing="2" mt="0.5">
                            <Text fontSize="sm" color={subtextColor} noOfLines={1}>{song.artist || '—'}</Text>
                            <Text color="gray.300">·</Text>
                            <Badge 
                              bg="teal.100" 
                              color="teal.700" 
                              borderRadius="full" 
                              fontSize="xs"
                              fontWeight="600"
                            >
                              {song.default_key}
                            </Badge>
                            <Box 
                              w="2" 
                              h="2" 
                              borderRadius="full" 
                              bg={health.color === 'green' ? 'green.400' : health.color === 'yellow' ? 'yellow.400' : 'red.400'}
                            />
                          </HStack>
                          {timesUsed > 0 && (
                            <Text fontSize="xs" color={emptyColor} mt="0.5">
                              Used {timesUsed} time{timesUsed !== 1 ? 's' : ''} · {formatDate(usage?.lastUsed || null)}
                            </Text>
                          )}
                        </Box>
                      </HStack>
                      <Box onClick={(e) => e.stopPropagation()} flexShrink={0}>
                        <Menu>
                          <MenuButton 
                            as={IconButton} 
                            icon={<MoreVertical size={16} />} 
                            variant="ghost" 
                            size="sm" 
                            aria-label="Actions"
                            color="gray.400"
                            minW="32px"
                          />
                          <MenuList borderRadius="xl">
                            <MenuItem 
                              icon={<Trash2 size={16} />}
                              color="red.500" 
                              onClick={() => { setDeleteId(song.id); deleteDisclosure.onOpen(); }}
                              borderRadius="lg"
                              _hover={{ bg: 'red.50' }}
                            >
                              Delete
                            </MenuItem>
                          </MenuList>
                        </Menu>
                      </Box>
                    </Flex>
                  </CardBody>
                </Card>
              );
            })}
          </VStack>
        </>
      )}

      {/* Add Song Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
        <ModalOverlay />
        <ModalContent borderRadius="xl">
          <ModalHeader fontWeight="700">Add Song</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Title</FormLabel>
                <Input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="Song title"
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Artist</FormLabel>
                <Input 
                  value={artist} 
                  onChange={(e) => setArtist(e.target.value)} 
                  placeholder="e.g., Hillsong Worship"
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </FormControl>
              <HStack w="full" spacing="4">
                <FormControl>
                  <FormLabel fontWeight="600" fontSize="sm">Default Key</FormLabel>
                  <Input 
                    value={defaultKey} 
                    onChange={(e) => setDefaultKey(e.target.value)} 
                    placeholder="e.g., G"
                    borderRadius="lg"
                    border="1px solid"
                    borderColor="gray.200"
                    _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontWeight="600" fontSize="sm">CCLI Number</FormLabel>
                  <Input 
                    value={ccli} 
                    onChange={(e) => setCcli(e.target.value)} 
                    placeholder="Optional"
                    borderRadius="lg"
                    border="1px solid"
                    borderColor="gray.200"
                    _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                  />
                </FormControl>
              </HStack>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Tags</FormLabel>
                <Input 
                  value={tagsStr} 
                  onChange={(e) => setTagsStr(e.target.value)} 
                  placeholder="Comma-separated (e.g., worship, upbeat, advent)"
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                  _focus={{ borderColor: 'teal.400', ring: '2px', ringColor: 'teal.100' }}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr="3" onClick={onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleCreate} isDisabled={!title} fontWeight="600">Add Song</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDisclosure.isOpen}
        onClose={deleteDisclosure.onClose}
        onConfirm={handleDelete}
        title="Remove Song?"
        message="This will permanently delete this song and all its chord charts and usage data. This cannot be undone."
        confirmLabel="Delete Song"
      />
    </Box>
  );
}