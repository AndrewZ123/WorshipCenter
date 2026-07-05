'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Text, HStack, Button, Table, Thead, Tbody, Tr, Th, Td,
  Input, Flex, useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalCloseButton, ModalFooter, FormControl,
  FormLabel, VStack, useToast, Badge, Card, CardBody, IconButton,
  Menu, MenuButton, MenuList, MenuItem, useColorModeValue, Spinner, Center,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import type { Song, SongUsage } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import SongDetailClient from './[id]/SongDetailClient';
import { parseChordPro } from '@/lib/chordpro';
import type { ChordProParsed } from '@/lib/chordpro';

// Lucide icons
import { 
  Plus, Search, Music, MoreVertical, Trash2, Edit, 
  SlidersHorizontal, Mic2, Upload, AlertCircle
} from 'lucide-react';

export default function SongsPage() {
  const { church, user } = useAuth();
  const store = useStore();
  const router = useRouter();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [songs, setSongs] = useState<Song[]>([]);
  const [allUsage, setAllUsage] = useState<SongUsage[]>([]);
  const [search, setSearch] = useState('');
  const [filterRecent, setFilterRecent] = useState(false);
  const [loading, setLoading] = useState(true);

  // ChordPro import
  const importDisclosure = useDisclosure();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importParsed, setImportParsed] = useState<ChordProParsed | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);

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
  const headingColor = useColorModeValue('gray.900', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const tabInactiveBg = useColorModeValue('gray.100', 'gray.700');
  const theadBg = useColorModeValue('gray.50', 'gray.700');
  const iconBoxBg = useColorModeValue('teal.100', 'rgba(13,148,136,0.2)');
  const iconColor = useColorModeValue('gray.400', 'gray.500');
  const actionHoverBg = useColorModeValue('gray.100', 'gray.600');
  const actionColor = useColorModeValue('gray.400', 'gray.500');
  const actionHoverColor = useColorModeValue('gray.600', 'gray.300');
  const importMetaBg = useColorModeValue('teal.50', 'gray.700');
  const importMetaColor = useColorModeValue('teal.700', 'teal.300');
  const importLabelColor = useColorModeValue('gray.500', 'gray.400');
  const theadTextColor = useColorModeValue('gray.500', 'gray.300');
  const mutedText = useColorModeValue('gray.400', 'gray.500');
  const iconTeal = useColorModeValue('#0D9488', '#5EEAD4');
  
  // Team members have read-only access
  const isReadOnly = user?.role === 'team';

  useEffect(() => {
    if (church) loadSongs();
  }, [church]);

  const loadSongs = async () => {
    if (!church) return;
    try {
      setLoading(true);
      const allSongs = await store.songs.getByChurch(church.id);
      allSongs.sort((a: Song, b: Song) => a.title.localeCompare(b.title));
      setSongs(allSongs);
      setAllUsage(await store.songUsage.getByChurch(church.id));
    } catch (error) {
      console.error('Error loading songs:', error);
      toast({ title: 'Error loading data', status: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const usageMap = useMemo(() => {
    const map: Record<string, { count: number; lastUsed: string | null }> = {};
    allUsage.forEach((u) => {
      if (!map[u.song_id]) map[u.song_id] = { count: 0, lastUsed: null };
      map[u.song_id].count++;
      if (!map[u.song_id].lastUsed || u.date > map[u.song_id].lastUsed!) map[u.song_id].lastUsed = u.date;
    });
    return map;
  }, [allUsage]);

  const threeMonthsAgo = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 90);
    return d.toISOString().split('T')[0];
  }, []);

  const handleCreate = async () => {
    if (!church || !title) return;
    await store.songs.create({ church_id: church.id, title, artist, default_key: defaultKey || 'C', ccli_number: ccli, tags: tagsStr.split(',').map((t) => t.trim()).filter(Boolean) });
    toast({ title: 'Song added', status: 'success', duration: 2000 });
    setTitle(''); setArtist(''); setDefaultKey(''); setCcli(''); setTagsStr('');
    onClose(); await loadSongs();
  };

  const handleDelete = async () => {
    if (!deleteId || !church) return;
    await store.songs.delete(deleteId, church.id);
    toast({ title: 'Song deleted', status: 'info', duration: 2000 });
    setDeleteId(null); await loadSongs();
  };

  const isIncomplete = (song: Song) => !song.artist && !song.ccli_number;

  const filtered = songs.filter((s) => {
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
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
  };

  // Get rotation health indicator
  const getRotationHealth = (songId: string) => {
    const usage = usageMap[songId];
    if (!usage || usage.count === 0) {
      return { color: 'gray.400', label: 'Not used' };
    }
    const lastUsedDate = usage.lastUsed ? new Date(usage.lastUsed) : null;
    const weeksAgo = lastUsedDate ? Math.floor((Date.now() - lastUsedDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) : null;
    
    if (usage.count >= 6 && weeksAgo !== null && weeksAgo < 8) {
      return { color: 'red.500', label: 'Overplayed' };
    } else if (weeksAgo !== null && weeksAgo <= 4) {
      return { color: 'amber.500', label: 'In rotation' };
    } else {
      return { color: 'green.500', label: 'Fresh' };
    }
  };

  if (loading) {
    return (
      <Center minH="50vh">
        <Spinner size="xl" color="teal.500" />
      </Center>
    );
  }

  if (selectedSongId) {
    return <SongDetailClient songId={selectedSongId} onBack={() => setSelectedSongId(null)} />;
  }

  return (
    <Box px={{ base: '4', md: '8' }} pt={{ base: '2', md: '8' }} pb={{ base: '4', md: '8' }} maxW="1100px" mx="auto">
      {/* Header */}
      <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} mb="6" flexWrap="wrap" gap="4" direction={{ base: 'column', md: 'row' }}>
        <Box>
          <Text fontSize="2xl" fontWeight="bold" color={headingColor} letterSpacing="tight">Song Library</Text>
          <Text color={subtextColor} fontSize="sm" mt="1">Manage your worship songs and chord charts</Text>
        </Box>
        {!isReadOnly && (
          <HStack spacing="2">
            <Button 
              onClick={importDisclosure.onOpen} 
              size="sm" 
              variant="outline"
              colorScheme="teal" 
              fontWeight="600"
              leftIcon={<Upload size={14} />}
              px="4"
              py="2"
            >
              Import ChordPro
            </Button>
            <Button 
              onClick={onOpen} 
              size="sm" 
              colorScheme="teal" 
              fontWeight="600"
              leftIcon={<Plus size={16} />}
              px="4"
              py="2"
            >
              Add Song
            </Button>
          </HStack>
        )}
      </Flex>

      {/* Search and Filter */}
      <Flex mb="5" gap="3" flexWrap="wrap" align="stretch" direction={{ base: 'column', md: 'row' }}>
        <Box position="relative" flex="1" minW="200px">
          <Box position="absolute" left="3" top="50%" transform="translateY(-50%)" color={iconColor}>
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
            borderColor={borderColor}
            aria-label="Search songs"
            _focus={{ borderColor: 'teal.400', boxShadow: '0 0 0 2px rgba(56, 178, 172, 0.2)' }}
          />
        </Box>
        <Box 
          display="flex" 
          bg={tabInactiveBg} 
          borderRadius="full" 
          p="1"
          gap="1"
        >
          <Button 
            onClick={() => setFilterRecent(false)} 
            size="sm" 
            borderRadius="full"
            bg={filterRecent ? 'transparent' : cardBg}
            color={filterRecent ? 'gray.500' : 'teal.700'}
            fontWeight={filterRecent ? '400' : '600'}
            boxShadow={filterRecent ? 'none' : 'sm'}
            _hover={{ bg: filterRecent ? 'gray.200' : cardBg }}
            transition="all 0.15s"
          >
            All Songs
          </Button>
          <Button 
            onClick={() => setFilterRecent(true)} 
            size="sm" 
            borderRadius="full"
            bg={filterRecent ? cardBg : 'transparent'}
            color={filterRecent ? 'teal.700' : 'gray.500'}
            fontWeight={filterRecent ? '600' : '400'}
            boxShadow={filterRecent ? 'sm' : 'none'}
            _hover={{ bg: filterRecent ? cardBg : 'gray.200' }}
            transition="all 0.15s"
          >
            Used Recently
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
            icon="search"
            title="No songs match your search"
            description="Try a different search term or filter."
          />
        )
      ) : (
        <>
          {/* Desktop table */}
          <Box display={{ base: 'none', md: 'block' }} bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden" boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
            <Table variant="simple">
              <Thead bg={theadBg}>
                <Tr>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color={theadTextColor}>Title</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color={theadTextColor}>Artist</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color={theadTextColor}>Key</Th>
                  <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color={theadTextColor}>Last Used</Th>
                  <Th isNumeric fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color={theadTextColor}>Used</Th>
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
                      transition="all 0.15s" 
                      onClick={() => setSelectedSongId(song.id)}
                      sx={{ 
                        borderLeft: '3px solid transparent',
                      }}
                      _hover={{ 
                        bg: hoverBg,
                        borderLeftColor: 'teal.500',
                      }}
                    >
                      <Td>
                        <HStack spacing="3">
                          <Box 
                            minW="32px" 
                            h="32px" 
                            borderRadius="lg" 
                            bg={iconBoxBg}
                            display="flex" 
                            alignItems="center" 
                            justifyContent="center"
                          >
                            <Music size={16} color={iconTeal} />
                          </Box>
                          <Box>
                            <HStack spacing="1.5">
                              <Text fontWeight="600" color={headingColor}>{song.title}</Text>
                              {isIncomplete(song) && (
                                <AlertCircle size={14} color="var(--chakra-colors-orange-400)" aria-label="Incomplete song info" />
                              )}
                            </HStack>
                            {song.tags.length > 0 && (
                              <HStack spacing="1" mt="1">
                                {song.tags.slice(0, 3).map((tag) => (
                                  <Badge key={tag} variant="subtle" colorScheme="gray" fontSize="xs" borderRadius="full" px="2">{tag}</Badge>
                                ))}
                              </HStack>
                            )}
                          </Box>
                        </HStack>
                      </Td>
                      <Td color={subtextColor} fontSize="sm">{song.artist || '—'}</Td>
                      <Td>
                        <Badge variant="subtle" colorScheme="teal" fontSize="xs" borderRadius="md" px="2" py="0.5">{song.default_key}</Badge>
                      </Td>
                      <Td>
                        <HStack spacing="2">
                          <Box w="2" h="2" borderRadius="full" bg={health.color} />
                          <Text color={subtextColor} fontSize="sm">{formatDate(usage?.lastUsed || null)}</Text>
                        </HStack>
                      </Td>
                      <Td isNumeric>
                        {timesUsed > 0 ? (
                          <Badge colorScheme="teal" variant="subtle" fontSize="xs" px="2.5" py="0.5" borderRadius="full">{timesUsed}</Badge>
                        ) : (
                          <Text color={mutedText} fontSize="sm">0</Text>
                        )}
                      </Td>
                      <Td onClick={(e) => e.stopPropagation()}>
                        {!isReadOnly ? (
                          <Menu>
                            <MenuButton 
                              as={IconButton} 
                              icon={<MoreVertical size={16} />} 
                              variant="ghost" 
                              size="sm" 
                              aria-label="Actions"
                              color={actionColor}
                              _hover={{ color: actionHoverColor, bg: actionHoverBg }}
                            />
                            <MenuList borderRadius="xl" zIndex={50}>
                              <MenuItem onClick={() => setSelectedSongId(song.id)}>View Details</MenuItem>
                              <MenuItem color="red.500" onClick={() => { setDeleteId(song.id); deleteDisclosure.onOpen(); }}>Delete</MenuItem>
                            </MenuList>
                          </Menu>
                        ) : (
                          <IconButton
                            as="a"
                            href={`/songs/${song.id}`}
                            icon={<MoreVertical size={16} />}
                            variant="ghost"
                            size="sm"
                            aria-label="View details"
                            color={actionColor}
                            _hover={{ color: actionHoverColor, bg: actionHoverBg }}
                          />
                        )}
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
                  onClick={() => setSelectedSongId(song.id)}
                  borderLeft="3px solid"
                  borderLeftColor="teal.500"
                >
                  <CardBody py="3" px="4">
                    <Flex justify="space-between" align="start">
                      <HStack spacing="3" flex="1">
                        <Box 
                          minW="36px" 
                          h="36px" 
                          borderRadius="lg" 
                          bg={iconBoxBg}
                          display="flex" 
                          alignItems="center" 
                          justifyContent="center"
                        >
                          <Music size={18} color={iconTeal} />
                        </Box>
                        <Box>
                          <HStack spacing="1.5">
                            <Text fontWeight="600" color={headingColor}>{song.title}</Text>
                            {isIncomplete(song) && (
                              <AlertCircle size={14} color="var(--chakra-colors-orange-400)" aria-label="Incomplete song info" />
                            )}
                          </HStack>
                          <HStack spacing="2" mt="1">
                            <Mic2 size={12} color="var(--chakra-colors-gray-400)" />
                            <Text fontSize="sm" color={subtextColor}>{song.artist || 'Unknown'}</Text>
                            <Text color={mutedText}>·</Text>
                            <Badge variant="subtle" colorScheme="teal" fontSize="xs" borderRadius="md">{song.default_key}</Badge>
                          </HStack>
                          <HStack spacing="2" mt="1">
                            <Box w="2" h="2" borderRadius="full" bg={health.color} />
                            <Text fontSize="xs" color={mutedText}>{timesUsed > 0 ? `Used ${timesUsed} time${timesUsed !== 1 ? 's' : ''}` : 'Not used'}</Text>
                          </HStack>
                        </Box>
                      </HStack>
                      <Box onClick={(e) => e.stopPropagation()}>
                        {!isReadOnly ? (
                          <Menu>
                            <MenuButton 
                              as={IconButton} 
                              icon={<MoreVertical size={16} />} 
                              variant="ghost" 
                              size="sm" 
                              aria-label="Actions"
                              color={actionColor}
                              _hover={{ color: actionHoverColor, bg: actionHoverBg }}
                            />
                            <MenuList borderRadius="xl" zIndex={50}>
                              <MenuItem onClick={() => setSelectedSongId(song.id)}>View Details</MenuItem>
                              <MenuItem color="red.500" onClick={() => { setDeleteId(song.id); deleteDisclosure.onOpen(); }}>Delete</MenuItem>
                            </MenuList>
                          </Menu>
                        ) : (
                          <IconButton
                            as="a"
                            href={`/songs/${song.id}`}
                            icon={<MoreVertical size={16} />}
                            variant="ghost"
                            size="sm"
                            aria-label="View details"
                            color={actionColor}
                            _hover={{ color: actionHoverColor, bg: actionHoverBg }}
                          />
                        )}
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
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl" mx="4">
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
                />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Artist</FormLabel>
                <Input 
                  value={artist} 
                  onChange={(e) => setArtist(e.target.value)} 
                  placeholder="e.g., Hillsong Worship"
                  borderRadius="lg"
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
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontWeight="600" fontSize="sm">CCLI Number</FormLabel>
                  <Input 
                    value={ccli} 
                    onChange={(e) => setCcli(e.target.value)} 
                    placeholder="Optional"
                    borderRadius="lg"
                  />
                </FormControl>
              </HStack>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Tags</FormLabel>
                <Input 
                  value={tagsStr} 
                  onChange={(e) => setTagsStr(e.target.value)} 
                  placeholder="Comma-separated (e.g., worship, uptempo, easter)"
                  borderRadius="lg"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleCreate} isDisabled={!title} fontWeight="600">Add Song</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Import ChordPro Modal */}
      <Modal isOpen={importDisclosure.isOpen} onClose={() => { importDisclosure.onClose(); setImportFile(null); setImportParsed(null); }} isCentered size="lg">
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl" mx="4">
          <ModalHeader fontWeight="700">Import ChordPro File</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb="6">
            <VStack spacing="4">
              <Text fontSize="sm" color={subtextColor}>
                Upload a <strong>.pro</strong>, <strong>.chordpro</strong>, or <strong>.txt</strong> file exported from SongSelect. The song's metadata (title, artist, key, CCLI) will be parsed automatically.
              </Text>
              <FormControl>
                <Button 
                  as="label" 
                  htmlFor="chordpro-upload"
                  variant="outline" 
                  w="full" 
                  h="120px" 
                  border="2px dashed" 
                  borderColor={importParsed ? 'teal.300' : borderColor}
                  borderRadius="xl"
                  cursor="pointer"
                  display="flex"
                  flexDirection="column"
                  gap="2"
                  _hover={{ borderColor: 'teal.400', bg: hoverBg }}
                >
                  <Upload size={24} className={importParsed ? 'text-teal-500' : 'text-gray-400'} />
                  <Text fontSize="sm" color={importParsed ? 'teal.600' : subtextColor}>
                    {importFile ? importFile.name : 'Click to select a ChordPro file'}
                  </Text>
                  <input
                    id="chordpro-upload"
                    type="file"
                    accept=".pro,.chordpro,.chopro,.txt"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setImportFile(file);
                      const reader = new FileReader();
                      reader.onload = () => {
                        const result = parseChordPro(reader.result as string);
                        setImportParsed(result);
                      };
                      reader.readAsText(file);
                    }}
                  />
                </Button>
              </FormControl>

              {importParsed && (
                <Box w="full" p="4" bg={importMetaBg} borderRadius="lg">
                  <Text fontWeight="600" fontSize="sm" mb="3" color={importMetaColor}>Parsed Metadata</Text>
                  <VStack spacing="2" align="stretch" fontSize="sm">
                    {importParsed.meta.title && (
                      <HStack><Text fontWeight="500" color={importLabelColor} minW="60px">Title:</Text><Text>{importParsed.meta.title}</Text></HStack>
                    )}
                    {importParsed.meta.artist && (
                      <HStack><Text fontWeight="500" color={importLabelColor} minW="60px">Artist:</Text><Text>{importParsed.meta.artist}</Text></HStack>
                    )}
                    {importParsed.meta.key && (
                      <HStack><Text fontWeight="500" color={importLabelColor} minW="60px">Key:</Text><Text>{importParsed.meta.key}</Text></HStack>
                    )}
                    {importParsed.meta.ccli && (
                      <HStack><Text fontWeight="500" color={importLabelColor} minW="60px">CCLI:</Text><Text>{importParsed.meta.ccli}</Text></HStack>
                    )}
                    {importParsed.meta.tags.length > 0 && (
                      <HStack><Text fontWeight="500" color={importLabelColor} minW="60px">Tags:</Text><Text>{importParsed.meta.tags.join(', ')}</Text></HStack>
                    )}
                    <Text fontSize="xs" color={mutedText} mt="1">{importParsed.lines.length} lyric lines parsed</Text>
                  </VStack>
                </Box>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={() => { importDisclosure.onClose(); setImportFile(null); setImportParsed(null); }}>Cancel</Button>
              <Button 
                colorScheme="teal" 
                isDisabled={!importParsed} 
                isLoading={importing}
                fontWeight="600"
                onClick={async () => {
                  if (!importParsed || !importFile || !church) return;
                  setImporting(true);
                  try {
                    const { meta } = importParsed;
                    await store.songs.create({
                      church_id: church.id,
                      title: meta.title || importFile.name.replace(/\.(pro|chordpro|chopro|txt)$/i, ''),
                      artist: meta.artist || '',
                      default_key: meta.key || 'C',
                      ccli_number: meta.ccli || '',
                      tags: meta.tags,
                    });
                    toast({ title: 'Song imported', description: `${meta.title || importFile.name} has been added. You can now upload the file on the song detail page.`, status: 'success', duration: 3000 });
                    importDisclosure.onClose();
                    setImportFile(null);
                    setImportParsed(null);
                    await loadSongs();
                  } catch (err) {
                    console.error('Import failed:', err);
                    toast({ title: 'Import failed', description: 'Could not import the file. Try again.', status: 'error', duration: 3000 });
                  } finally {
                    setImporting(false);
                  }
                }}
              >
                Import Song
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog 
        isOpen={deleteDisclosure.isOpen} 
        onClose={deleteDisclosure.onClose} 
        onConfirm={handleDelete} 
        title="Remove Song?" 
        message="This will permanently delete this song and all its chord charts and usage data. This cannot be undone." 
        confirmLabel="Delete Song"
        variant="destructive"
      />
    </Box>
  );
}