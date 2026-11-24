'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Text, HStack, Button, VStack, Input, Flex,
  FormControl, FormLabel, Card, CardBody, useToast, IconButton,
  Badge, Tag, TagLabel, Wrap, WrapItem, Table,
  Thead, Tbody, Tr, Th, Td, Link, useDisclosure, useColorModeValue,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
  Spinner, Center, Menu, MenuButton, MenuList, MenuItem, Textarea,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/lib/PermissionsContext';
import { useStore } from '@/lib/StoreContext';
import type { Song, SongFile, SongUsage, Service } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import ChordProPreview from '@/components/songs/ChordProPreview';
import { summarizeSongUsageDates } from '@/lib/song-usage';
import { isFutureCalendarDate } from '@/lib/formatDate';
import { parseChordPro } from '@/lib/chordpro';
import { capoSuggestions, transposeChordPro, transposeKey } from '@/lib/transpose';
import { formatKey } from '@/lib/formatKey';
import { normalizeCcliNumber, CCLI_NUMBER_MAX_LENGTH } from '@/lib/ccli';
import {
  CHORD_PRO_MAX_LENGTH,
  buildChordProFileInput,
  decodeTextFileDataUrl,
  findChordProFile,
  isChordProFileName,
  isChordProWithinLimit,
} from '@/lib/song-chart';

// Lucide icons
import { 
  ArrowLeft, MoreVertical, Trash2, Edit, FileText, Eye,
  Music, Mic2, Upload, Download, Calendar, Minus, Plus, RotateCcw
} from 'lucide-react';

// YouTube icon component
const YoutubeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z" />
    <polygon fill="white" points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

const TRANSPOSE_STORAGE_PREFIX = 'wc:song-transpose:';
const TRANSPOSE_LIMIT = 11;

function clampTranspose(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-TRANSPOSE_LIMIT, Math.min(TRANSPOSE_LIMIT, Math.trunc(value)));
}

// ========== Main Client Component ==========
export default function SongDetailClient({ songId: propSongId, onBack }: { songId?: string; onBack?: () => void } = {}) {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { user, church, loading: authLoading } = useAuth();
  const permissions = usePermissions();
  const store = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const songId = propSongId || (params.id as string);

  const [song, setSong] = useState<Song | null>(null);
  const [files, setFiles] = useState<SongFile[]>([]);
  const [allUsage, setAllUsage] = useState<SongUsage[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [editing, setEditing] = useState(false);
  const [viewFile, setViewFile] = useState<SongFile | null>(null);
  const viewerDisclosure = useDisclosure();
  const deleteDisclosure = useDisclosure();

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [defaultKey, setDefaultKey] = useState('');
  const [ccli, setCcli] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [youtubeId, setYoutubeId] = useState('');
  const [chordProText, setChordProText] = useState('');
  const [initialChordProText, setInitialChordProText] = useState('');
  const [showChartPreview, setShowChartPreview] = useState(false);
  const [loading, setLoading] = useState(true);

  // Display-only transpose. Persisted per song in this browser, never saved
  // back to the song record unless the user explicitly uses Save Changes.
  const [transposeOffset, setTransposeOffset] = useState(0);
  const [transposeHydrated, setTransposeHydrated] = useState(false);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const headingColor = useColorModeValue('gray.900', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const theadBg = useColorModeValue('gray.50', 'gray.700');
  const codeBg = useColorModeValue('gray.50', 'gray.700');

  const loadData = useCallback(async () => {
    if (!church) return;
    try {
      setLoading(true);
      const s = await store.songs.getById(songId, church.id);
      if (!s) {
        // Stale link or a song that belongs to another church: stop here and
        // render "Song not found" instead of querying related tables for an
        // inaccessible id.
        setSong(null);
        return;
      }
      setSong(s);
      setTitle(s.title);
      setArtist(s.artist);
      setDefaultKey(s.default_key);
      setCcli(s.ccli_number);
      setTagsStr(s.tags.join(', '));
      setYoutubeId(s.youtube_video_id || '');
      const songFiles = await store.songFiles.getBySong(songId, church.id);
      setFiles(songFiles);
      const editableChart = findChordProFile(songFiles);
      const chartText = editableChart ? decodeTextFileDataUrl(editableChart.file_url) : '';
      setChordProText(chartText);
      setInitialChordProText(chartText);
      setAllUsage(await store.songUsage.getBySong(songId, church.id));
      setServices(await store.services.getByChurch(church.id));
    } catch (error) {
      console.error('Error loading song:', error);
      toast({ title: 'Error loading data', description: 'Please refresh the page.', status: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  }, [church, songId, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!songId) return;
    try {
      const stored = window.localStorage.getItem(`${TRANSPOSE_STORAGE_PREFIX}${songId}`);
      setTransposeOffset(stored === null ? 0 : clampTranspose(Number.parseInt(stored, 10)));
    } catch {
      setTransposeOffset(0);
    }
    setTransposeHydrated(true);
  }, [songId]);

  useEffect(() => {
    if (!songId || !transposeHydrated) return;
    try {
      window.localStorage.setItem(
        `${TRANSPOSE_STORAGE_PREFIX}${songId}`,
        String(transposeOffset)
      );
    } catch {
      // Storage can be unavailable (private mode / quota); transpose still works.
    }
  }, [songId, transposeOffset, transposeHydrated]);

  const recentServices = useMemo(() => {
    return allUsage
      .map((u) => { const svc = services.find((s) => s.id === u.service_id); return svc ? { date: u.date, service: svc } : null; })
      .filter(Boolean)
      .sort((a, b) => new Date(b!.date).getTime() - new Date(a!.date).getTime())
      .slice(0, 5) as { date: string; service: Service }[];
  }, [allUsage, services]);

  const totalUsageCount = allUsage.length;
  const isTeam = permissions.isVolunteer;

  // Get rotation health
  const getRotationHealth = () => {
    if (totalUsageCount === 0) {
      return { color: 'gray.400', label: 'Not used yet', dot: '⚪' };
    }
    const { lastUsed, nextScheduled } = summarizeSongUsageDates(
      allUsage.map((u) => u.date)
    );
    if (nextScheduled) {
      return {
        color: 'teal.500',
        label: `Scheduled — next used ${formatDate(nextScheduled)}`,
        dot: '🟢',
      };
    }
    const lastUsedDate = lastUsed ? new Date(lastUsed + 'T00:00:00') : null;
    const weeksAgo = lastUsedDate
      ? Math.max(0, Math.floor((Date.now() - lastUsedDate.getTime()) / (7 * 24 * 60 * 60 * 1000)))
      : null;
    
    if (totalUsageCount >= 6 && weeksAgo !== null && weeksAgo < 8) {
      return { color: 'red.500', label: 'Overplayed — used 6+ times recently', dot: '🔴' };
    } else if (weeksAgo !== null && weeksAgo <= 4) {
      return { color: 'amber.500', label: 'In rotation — used recently', dot: '🟡' };
    } else if (weeksAgo !== null) {
      return { color: 'green.500', label: `Fresh — last used ${weeksAgo} weeks ago`, dot: '🟢' };
    }
    return { color: 'gray.400', label: 'Not used recently', dot: '⚪' };
  };

  if (authLoading) {
    return (
      <Center minH="50vh">
        <Spinner size="xl" color="teal.500" />
      </Center>
    );
  }

  // Auth finished but church data never arrived — explain instead of spinning forever.
  if (!church) {
    return (
      <Center minH="50vh">
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

  if (loading) {
    return (
      <Center minH="50vh">
        <Spinner size="xl" color="teal.500" />
      </Center>
    );
  }

  if (!song) {
    return <Box p="8" textAlign="center" color="gray.400"><Text>Song not found</Text></Box>;
  }

  const extractYoutubeId = (url: string) => {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url.trim();
  };

  const handleSave = async () => {
    if (!church || !song) return;
    if (!isChordProWithinLimit(chordProText)) {
      toast({
        title: 'Chord chart is too long',
        description: `Keep it under ${CHORD_PRO_MAX_LENGTH.toLocaleString()} characters.`,
        status: 'error',
        duration: 3000,
      });
      return;
    }

    const extractedId = extractYoutubeId(youtubeId);
    await store.songs.update(songId, church.id, {
      title, artist, default_key: defaultKey || 'C', ccli_number: normalizeCcliNumber(ccli),
      tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean),
      youtube_video_id: extractedId || undefined,
    });

    const chartChanged = chordProText !== initialChordProText;
    if (chartChanged && chordProText.trim()) {
      const existingChart = findChordProFile(files);
      if (existingChart) {
        await store.songFiles.update(existingChart.id, church.id, {
          file_url: buildChordProFileInput({
            songId,
            title: title || song.title,
            chart: chordProText,
            uploadedBy: user?.id || null,
          }).file_url,
          file_size: new TextEncoder().encode(chordProText).length,
        });
      } else {
        await store.songFiles.create(
          buildChordProFileInput({
            songId,
            title: title || song.title,
            chart: chordProText,
            uploadedBy: user?.id || null,
          }),
        );
      }
    }

    setEditing(false);
    setShowChartPreview(false);
    await loadData();
    toast({ title: 'Song updated', status: 'success', duration: 2000 });
  };

  const handleDelete = async () => {
    if (!church) return;
    await store.songs.delete(songId, church.id);
    toast({ title: 'Song deleted', status: 'info', duration: 2000 });
    if (onBack) onBack(); else router.push('/songs');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await store.songFiles.create({
        song_id: songId,
        file_url: reader.result as string,
        file_name: file.name,
        type: 'chord_chart',
        file_size: file.size,
        mime_type: file.type,
        arrangement_id: null,
        version_id: null,
        is_primary: false,
        uploaded_by: user?.id || null,
      });
      await loadData();
      toast({ title: 'File uploaded', status: 'success', duration: 2000 });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteFile = async (fileId: string) => { 
    if (!church) return;
    await store.songFiles.delete(fileId, church.id); 
    await loadData(); 
    toast({ title: 'File removed', status: 'info', duration: 2000 }); 
  };

  const handleViewFile = (file: SongFile) => {
    setViewFile(file);
    viewerDisclosure.onOpen();
  };

  const formatDate = (d: string) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
  };

  const isPdf = (f: SongFile) => f.file_name.toLowerCase().endsWith('.pdf');
  const isChordPro = (f: SongFile) => isChordProFileName(f.file_name);
  const isText = (f: SongFile) => f.file_name.toLowerCase().endsWith('.txt') || isChordPro(f);

  const health = getRotationHealth();

  // Chart view transposition is derived on every render from the original
  // file text; nothing here is written back to the database.
  const chartRaw = viewFile && isChordPro(viewFile) ? decodeTextFileDataUrl(viewFile.file_url) : '';
  const chartOriginalKey = chartRaw
    ? (parseChordPro(chartRaw).meta.key.trim() || song.default_key || '')
    : '';
  const chartDisplayKey = chartOriginalKey
    ? transposeKey(chartOriginalKey, transposeOffset)
    : '';
  const chartText = chartRaw
    ? transposeChordPro(
        chartRaw,
        transposeOffset,
        transposeOffset === 0 ? undefined : (chartDisplayKey || undefined)
      )
    : '';
  const chartCapoSuggestions = chartDisplayKey ? capoSuggestions(chartDisplayKey) : [];

  return (
    <Box px={{ base: '4', md: '8' }} pt={{ base: '2', md: '8' }} pb={{ base: '4', md: '8' }} maxW="800px" mx="auto">
      {/* Header */}
      <Flex mb="6" gap="3" align="flex-start" direction="row">
        <HStack spacing="3" flex="1" minW="0">
          <IconButton 
            aria-label="Back" 
            icon={<ArrowLeft size={20} />} 
            variant="ghost" 
            onClick={() => onBack ? onBack() : router.push('/songs')}
            minW="44px"
            color="gray.500"
            _hover={{ color: 'gray.700', bg: 'gray.100' }}
          />
          <Box minW="0" flex="1">
            <Text fontSize="2xl" fontWeight="bold" color={headingColor} letterSpacing="tight" noOfLines={2}>{song.title}</Text>
            <HStack mt="1" spacing="3">
              <HStack spacing="1">
                <Mic2 size={14} color="var(--chakra-colors-gray-400)" />
                <Text color={subtextColor} fontSize="sm">{song.artist || 'Unknown artist'}</Text>
              </HStack>
              {!isTeam && totalUsageCount > 0 && (
                <Badge colorScheme="teal" variant="subtle" fontSize="xs" borderRadius="full" px="2">
                  Used {totalUsageCount} time{totalUsageCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </HStack>
          </Box>
        </HStack>
        
        {!isTeam && !editing && (
          <Menu>
            <MenuButton 
              as={IconButton} 
              icon={<MoreVertical size={20} />} 
              variant="ghost"
              aria-label="Actions"
              color="gray.400"
              _hover={{ color: 'gray.600', bg: 'gray.100' }}
              flexShrink={0}
            />
            <MenuList borderRadius="xl" zIndex={50}>
              <MenuItem onClick={() => setEditing(true)}><HStack><Edit size={16} /><Text>Edit Song</Text></HStack></MenuItem>
              <MenuItem color="red.500" onClick={deleteDisclosure.onOpen}><HStack><Trash2 size={16} /><Text>Delete</Text></HStack></MenuItem>
            </MenuList>
          </Menu>
        )}
      </Flex>

      {/* Metadata Card */}
      <Card mb="6" bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
        <CardBody>
          {editing ? (
            <VStack spacing="4" align="stretch">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Title</FormLabel>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} borderRadius="lg" />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Artist</FormLabel>
                <Input value={artist} onChange={(e) => setArtist(e.target.value)} borderRadius="lg" />
              </FormControl>
              <Flex gap="4" direction={{ base: 'column', md: 'row' }}>
                <FormControl>
                  <FormLabel fontWeight="600" fontSize="sm">Default Key</FormLabel>
                  <Input value={defaultKey} onChange={(e) => setDefaultKey(e.target.value)} borderRadius="lg" />
                </FormControl>
                <FormControl>
                  <FormLabel fontWeight="600" fontSize="sm">CCLI Number</FormLabel>
                  <Input
                    value={ccli}
                    onChange={(e) => setCcli(normalizeCcliNumber(e.target.value))}
                    placeholder="Optional"
                    inputMode="numeric"
                    maxLength={CCLI_NUMBER_MAX_LENGTH}
                    borderRadius="lg"
                  />
                </FormControl>
              </Flex>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Tags</FormLabel>
                <Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="Comma-separated" borderRadius="lg" />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Chord chart (ChordPro)</FormLabel>
                <Text fontSize="xs" color={subtextColor} mb="2">
                  Paste or type a ChordPro chart using [G]inline chords. It saves with this song and supports transpose and capo.
                </Text>
                <Textarea
                  value={chordProText}
                  onChange={(event) => setChordProText(event.target.value)}
                  maxLength={CHORD_PRO_MAX_LENGTH}
                  rows={8}
                  fontFamily="'Courier New', monospace"
                  fontSize="sm"
                  placeholder={'{title: Amazing Grace}\n{key: G}\n\n[G]Amazing [C]grace'}
                  borderRadius="lg"
                />
                <HStack justify="space-between" mt="2">
                  <Text fontSize="xs" color={subtextColor}>
                    {chordProText.length.toLocaleString()}/{CHORD_PRO_MAX_LENGTH.toLocaleString()} characters
                  </Text>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setShowChartPreview((current) => !current)}
                  >
                    {showChartPreview ? 'Hide preview' : 'Preview'}
                  </Button>
                </HStack>
                {showChartPreview && (
                  <Box mt="2" p="4" bg={codeBg} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                    <ChordProPreview text={chordProText} />
                  </Box>
                )}
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">YouTube Link</FormLabel>
                <Flex gap="2" direction={{ base: 'column', sm: 'row' }}>
                  <Input value={youtubeId} onChange={(e) => setYoutubeId(e.target.value)} placeholder="youtube.com/watch?v=..." flex="1" borderRadius="lg" />
                  <Button as="a" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' ' + artist)}`} target="_blank" variant="outline" leftIcon={<YoutubeIcon />} size="sm" borderRadius="lg">Search</Button>
                </Flex>
              </FormControl>
              <Flex gap="3" justify="flex-end">
                <Button variant="ghost" onClick={() => { setEditing(false); loadData(); }}>Cancel</Button>
                <Button colorScheme="teal" onClick={handleSave} fontWeight="600">Save Changes</Button>
              </Flex>
            </VStack>
          ) : (
            <VStack spacing="4" align="stretch">
              {/* Metadata strip */}
              <Flex gap="4" wrap="wrap" align="center">
                <HStack spacing="2">
                  <Music size={14} color="var(--chakra-colors-gray-400)" />
                  <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase">Key:</Text>
                  <Badge variant="subtle" colorScheme="teal" fontSize="sm" borderRadius="md" px="2" textTransform="none">{formatKey(song.default_key)}</Badge>
                </HStack>
                {song.ccli_number && (
                  <HStack spacing="2">
                    <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase">CCLI:</Text>
                    <Text fontSize="sm" color={subtextColor}>{song.ccli_number}</Text>
                  </HStack>
                )}
              </Flex>

              {/* Rotation Health */}
              {!isTeam && (
                <HStack spacing="2">
                  <Text fontSize="sm">{health.dot}</Text>
                  <Text fontSize="sm" color={health.color} fontWeight="500">{health.label}</Text>
                </HStack>
              )}

              {/* YouTube */}
              {song.youtube_video_id && (
                <HStack spacing="3">
                  <Button 
                    as="a" 
                    href={`https://youtube.com/watch?v=${song.youtube_video_id}`} 
                    target="_blank" 
                    size="sm" 
                    variant="outline" 
                    colorScheme="red"
                    leftIcon={<YoutubeIcon />}
                    borderRadius="lg"
                  >
                    Watch on YouTube
                  </Button>
                </HStack>
              )}

              {/* Tags */}
              {song.tags.length > 0 && (
                <Box>
                  <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase" mb="2">Tags</Text>
                  <Wrap spacing="2">
                    {song.tags.map((tag) => (
                      <WrapItem key={tag}>
                        <Tag variant="subtle" colorScheme="teal" size="md" borderRadius="full">
                          <TagLabel>{tag}</TagLabel>
                        </Tag>
                      </WrapItem>
                    ))}
                  </Wrap>
                </Box>
              )}
            </VStack>
          )}
        </CardBody>
      </Card>

      {/* Chord Charts Section */}
      <HStack justify="space-between" align="center" mb="4">
        <Text fontSize="lg" fontWeight="semibold" color={headingColor}>Chord Charts</Text>
        {!isTeam && (
          <Button size="sm" variant="outline" colorScheme="teal" onClick={() => fileInputRef.current?.click()} leftIcon={<Upload size={14} />}>
            Upload File
          </Button>
        )}
        {!isTeam && <input ref={fileInputRef} type="file" accept=".pdf,.cho,.chordpro,.chopro,.crd,.pro,.txt" style={{ display: 'none' }} onChange={handleFileUpload} />}
      </HStack>

      {files.length === 0 ? (
        <EmptyState
          icon="file-text"
          title="No chord charts yet"
          description="Upload a PDF or ChordPro file to share with your team."
          ctaLabel={!isTeam ? "Upload File" : undefined}
          ctaOnClick={!isTeam ? () => fileInputRef.current?.click() : undefined}
        />
      ) : (
        <VStack spacing="2" align="stretch">
          {files.map((f) => (
            <HStack 
              key={f.id} 
              bg={cardBg} 
              border="1px solid" 
              borderColor={borderColor} 
              borderRadius="lg" 
              px="4" 
              py="3" 
              justify="space-between"
              boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
              _hover={{ 
                boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
                transform: 'translateY(-1px)'
              }}
              transition="all 0.15s"
            >
              <HStack spacing="3">
                <Box 
                  minW="32px" 
                  h="32px" 
                  borderRadius="lg" 
                  bg="gray.100"
                  display="flex" 
                  alignItems="center" 
                  justifyContent="center"
                >
                  <FileText size={16} color="var(--chakra-colors-gray-500)" />
                </Box>
                <Link
                  href={f.file_url}
                  download={f.file_name}
                  onClick={(event) => {
                    if (!isChordPro(f)) return;
                    event.preventDefault();
                    handleViewFile(f);
                  }}
                  color="teal.600"
                  fontWeight="500"
                  fontSize="sm"
                  _hover={{ textDecoration: 'underline' }}
                >
                  {f.file_name}
                </Link>
              </HStack>
              <HStack spacing="2">
                <IconButton 
                  aria-label="View file" 
                  icon={<Eye size={16} />} 
                  size="sm" 
                  variant="ghost" 
                  color="gray.400"
                  _hover={{ color: 'gray.600', bg: 'gray.100' }}
                  onClick={() => handleViewFile(f)} 
                />
                <IconButton 
                  aria-label="Download file" 
                  icon={<Download size={16} />} 
                  size="sm" 
                  variant="ghost" 
                  color="gray.400"
                  _hover={{ color: 'gray.600', bg: 'gray.100' }}
                  as="a"
                  href={f.file_url}
                  download={f.file_name}
                />
                {!isTeam && (
                  <IconButton 
                    aria-label="Delete file" 
                    icon={<Trash2 size={16} />} 
                    size="sm" 
                    variant="ghost" 
                    color="gray.400"
                    _hover={{ color: 'red.500', bg: 'red.50' }}
                    onClick={() => handleDeleteFile(f.id)} 
                  />
                )}
              </HStack>
            </HStack>
          ))}
        </VStack>
      )}

      {/* Recent Services Section */}
      {!isTeam && (
        <Box mt="8">
          <Text fontSize="lg" fontWeight="semibold" color={headingColor} mb="4">Recent Services</Text>
          
          {recentServices.length === 0 ? (
            <EmptyState
              icon="clock"
              title="Not used yet"
              description="This song hasn't been used in any completed services."
              ctaLabel="Go to Services"
              ctaOnClick={() => router.push('/services')}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <Box display={{ base: 'none', md: 'block' }} bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden" boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)">
                <Table variant="simple" size="sm">
                  <Thead bg={theadBg}>
                    <Tr>
                      <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Date</Th>
                      <Th fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wide" color="gray.500">Service</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {recentServices.map((entry, i) => (
                      <Tr 
                        key={i} 
                        cursor="pointer" 
                        _hover={{ bg: hoverBg }} 
                        onClick={() => router.push(`/services/${entry.service.id}`)}
                        transition="all 0.15s"
                      >
                        <Td fontSize="sm">
                          <HStack spacing="2">
                            <Text>{formatDate(entry.date)}</Text>
                            {isFutureCalendarDate(entry.date) && (
                              <Badge colorScheme="teal" variant="subtle" fontSize="xs" borderRadius="full">Upcoming</Badge>
                            )}
                          </HStack>
                        </Td>
                        <Td fontSize="sm">
                          <Text color="teal.600" fontWeight="500" _hover={{ textDecoration: 'underline' }}>{entry.service.title}</Text>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
              
              {/* Mobile Cards */}
              <VStack spacing="3" align="stretch" display={{ base: 'flex', md: 'none' }}>
                {recentServices.map((entry, i) => (
                  <Box
                    key={i}
                    bg={cardBg}
                    borderRadius="xl"
                    border="1px solid"
                    borderColor={borderColor}
                    p="4"
                    cursor="pointer"
                    onClick={() => router.push(`/services/${entry.service.id}`)}
                    boxShadow="0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
                    _hover={{ 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
                      transform: 'translateY(-1px)'
                    }}
                    transition="all 0.15s"
                  >
                    <Flex
                      direction={{ base: 'column', md: 'row' }}
                      align={{ base: 'stretch', md: 'center' }}
                      justify={{ base: 'flex-start', md: 'space-between' }}
                      gap="1"
                    >
                      <HStack spacing="3" minW="0" flex="1" align="flex-start">
                        <Box flexShrink={0} pt="2px">
                          <Calendar size={16} color="var(--chakra-colors-gray-400)" />
                        </Box>
                        <Text color="teal.600" fontWeight="600" noOfLines={2} minW="0">
                          {entry.service.title}
                        </Text>
                      </HStack>
                      <Text fontSize="sm" color={subtextColor} flexShrink={0} pl={{ base: '7', md: '0' }}>
                        {formatDate(entry.date)}
                        {isFutureCalendarDate(entry.date) ? ' · Upcoming' : ''}
                      </Text>
                    </Flex>
                  </Box>
                ))}
              </VStack>
            </>
          )}
        </Box>
      )}

      {/* Chord Chart Viewer Modal */}
      <Modal isOpen={viewerDisclosure.isOpen} onClose={viewerDisclosure.onClose} size="xl" isCentered>
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl" maxH="80vh" mx="4">
          <ModalHeader fontWeight="700">{viewFile?.file_name || 'File Viewer'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto" pb="6">
            {viewFile && isPdf(viewFile) && (
              <Box as="iframe" src={viewFile.file_url} w="100%" h={{ base: '70vh', md: '600px' }} borderRadius="lg" border="1px solid" borderColor={borderColor} />
            )}
            {viewFile && isChordPro(viewFile) && (
              <Box>
                <Flex justify="space-between" align="center" gap="2" mb="3" flexWrap="wrap">
                  <HStack spacing="3" flexWrap="wrap">
                    <Text fontSize="xs" color={subtextColor}>
                      Original key:{' '}
                      <Text as="span" fontWeight="700" color={headingColor}>{formatKey(chartOriginalKey) || '—'}</Text>
                    </Text>
                    <Text fontSize="xs" color={subtextColor}>
                      Displaying:{' '}
                      <Badge variant="subtle" colorScheme="teal" fontSize="xs" borderRadius="md" px="2" textTransform="none">
                        {formatKey(chartDisplayKey) || '—'}
                      </Badge>
                    </Text>
                  </HStack>
                  <HStack spacing="1">
                    <IconButton
                      aria-label="Transpose down one semitone"
                      icon={<Minus size={14} />}
                      size="sm"
                      variant="outline"
                      borderColor={borderColor}
                      onClick={() => setTransposeOffset((current) => clampTranspose(current - 1))}
                    />
                    <IconButton
                      aria-label="Transpose up one semitone"
                      icon={<Plus size={14} />}
                      size="sm"
                      variant="outline"
                      borderColor={borderColor}
                      onClick={() => setTransposeOffset((current) => clampTranspose(current + 1))}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<RotateCcw size={14} />}
                      onClick={() => setTransposeOffset(0)}
                      isDisabled={transposeOffset === 0}
                    >
                      Reset
                    </Button>
                  </HStack>
                </Flex>

                {chartDisplayKey && chartCapoSuggestions.length > 0 && (
                  <HStack spacing="2" mb="3" flexWrap="wrap">
                    <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase">
                      Capo suggestions:
                    </Text>
                    {chartCapoSuggestions.map((suggestion) => (
                      <Badge
                        key={`${suggestion.capo}-${suggestion.shapeKey}`}
                        variant="subtle"
                        colorScheme="purple"
                        fontSize="xs"
                        borderRadius="full"
                        px="2"
                        textTransform="none"
                      >
                        {suggestion.capo === 0
                          ? `No capo — ${formatKey(suggestion.shapeKey)} shapes`
                          : `Capo ${suggestion.capo}, play in ${formatKey(suggestion.shapeKey)} shapes`}
                      </Badge>
                    ))}
                  </HStack>
                )}

                <Box p="4" bg={codeBg} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                  <ChordProPreview text={chartText} />
                </Box>
              </Box>
            )}
            {viewFile && viewFile.file_name.toLowerCase().endsWith('.txt') && !isChordPro(viewFile) && (
              <Box p="4" bg={codeBg} borderRadius="lg" border="1px solid" borderColor={borderColor} fontFamily="monospace" fontSize="sm" whiteSpace="pre-wrap">
                {decodeTextFileDataUrl(viewFile.file_url)}
              </Box>
            )}
            {viewFile && !isPdf(viewFile) && !isText(viewFile) && (
              <Text color="gray.400" textAlign="center">Preview not available for this file type. Download it instead.</Text>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog 
        isOpen={deleteDisclosure.isOpen} 
        onClose={deleteDisclosure.onClose} 
        onConfirm={handleDelete} 
        title="Remove Song?" 
        message="This will permanently delete this song, its chord charts, and all usage data. This cannot be undone." 
        confirmLabel="Delete Song"
        variant="destructive"
      />
    </Box>
  );
}