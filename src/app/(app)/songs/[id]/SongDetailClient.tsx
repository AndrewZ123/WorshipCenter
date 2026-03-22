'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Text, HStack, Button, VStack, Input, Flex,
  FormControl, FormLabel, Card, CardBody, useToast, IconButton,
  Badge, Tag, TagLabel, Wrap, WrapItem, Table,
  Thead, Tbody, Tr, Th, Td, Link, useDisclosure, useColorModeValue,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
  Spinner, Center, Menu, MenuButton, MenuList, MenuItem,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import type { Song, SongFile, SongUsage, Service } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';

// Lucide icons
import { 
  ArrowLeft, MoreVertical, Trash2, Edit, FileText, Eye,
  Music, Mic2, Youtube, Upload, Download, Clock, Calendar
} from 'lucide-react';

// ChordPro renderer — parses [G]Amazing [C]Grace format
function renderChordPro(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    if (line.startsWith('{') && line.endsWith('}')) {
      // Directive
      const directive = line.slice(1, -1);
      if (directive.startsWith('title:') || directive.startsWith('t:')) {
        return <Text key={lineIdx} fontWeight="700" fontSize="lg" mb="1">{directive.split(':').slice(1).join(':').trim()}</Text>;
      }
      if (directive.startsWith('subtitle:') || directive.startsWith('st:')) {
        return <Text key={lineIdx} color="gray.500" fontSize="sm" mb="2">{directive.split(':').slice(1).join(':').trim()}</Text>;
      }
      if (directive.startsWith('comment:') || directive.startsWith('c:')) {
        return <Text key={lineIdx} color="teal.600" fontWeight="600" fontSize="sm" mt="3" mb="1">{directive.split(':').slice(1).join(':').trim()}</Text>;
      }
      return null;
    }

    // Parse chord lines: [G]words [C]words
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let partIdx = 0;
    while (remaining) {
      const match = remaining.match(/\[([^\]]+)\]/);
      if (!match) {
        parts.push(<Text as="span" key={partIdx}>{remaining}</Text>);
        break;
      }
      const before = remaining.slice(0, match.index);
      if (before) parts.push(<Text as="span" key={partIdx++}>{before}</Text>);
      parts.push(
        <Text as="span" key={partIdx++} position="relative" display="inline-block">
          <Text as="span" position="absolute" top="-1.2em" left="0" fontSize="xs" fontWeight="700" color="teal.600">{match[1]}</Text>
        </Text>
      );
      remaining = remaining.slice((match.index || 0) + match[0].length);
    }

    return (
      <Box key={lineIdx} lineHeight="2.4" fontFamily="'Courier New', monospace" fontSize="sm" whiteSpace="pre-wrap">
        {parts.length > 0 ? parts : '\u00A0'}
      </Box>
    );
  });
}

// YouTube icon component
const YoutubeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z" />
    <polygon fill="white" points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

// ========== Main Client Component ==========
export default function SongDetailClient() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { user, church } = useAuth();
  const store = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const songId = params.id as string;

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
  const [loading, setLoading] = useState(true);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const headingColor = useColorModeValue('gray.900', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  const loadData = useCallback(async () => {
    if (!church) return;
    try {
      setLoading(true);
      const s = await store.songs.getById(songId, church.id);
      if (s) {
        setSong(s);
        setTitle(s.title);
        setArtist(s.artist);
        setDefaultKey(s.default_key);
        setCcli(s.ccli_number);
        setTagsStr(s.tags.join(', '));
        setYoutubeId(s.youtube_video_id || '');
      }
      setFiles(await store.songFiles.getBySong(songId, church.id));
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

  const recentServices = useMemo(() => {
    return allUsage
      .map((u) => { const svc = services.find((s) => s.id === u.service_id); return svc ? { date: u.date, service: svc } : null; })
      .filter(Boolean)
      .sort((a, b) => new Date(b!.date).getTime() - new Date(a!.date).getTime())
      .slice(0, 5) as { date: string; service: Service }[];
  }, [allUsage, services]);

  const totalUsageCount = allUsage.length;
  const isTeam = user?.role === 'team';

  // Get rotation health
  const getRotationHealth = () => {
    if (totalUsageCount === 0) {
      return { color: 'gray.400', label: 'Not used yet', dot: '⚪' };
    }
    const lastUsedDate = recentServices[0]?.date ? new Date(recentServices[0].date) : null;
    const weeksAgo = lastUsedDate ? Math.floor((Date.now() - lastUsedDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) : null;
    
    if (totalUsageCount >= 6 && weeksAgo !== null && weeksAgo < 8) {
      return { color: 'red.500', label: 'Overplayed — used 6+ times recently', dot: '🔴' };
    } else if (weeksAgo !== null && weeksAgo <= 4) {
      return { color: 'amber.500', label: 'In rotation — used recently', dot: '🟡' };
    } else if (weeksAgo !== null) {
      return { color: 'green.500', label: `Fresh — last used ${weeksAgo} weeks ago`, dot: '🟢' };
    }
    return { color: 'gray.400', label: 'Not used recently', dot: '⚪' };
  };

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
    if (!church) return;
    const extractedId = extractYoutubeId(youtubeId);
    await store.songs.update(songId, church.id, {
      title, artist, default_key: defaultKey || 'C', ccli_number: ccli,
      tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean),
      youtube_video_id: extractedId || undefined,
    });
    setEditing(false);
    await loadData();
    toast({ title: 'Song updated', status: 'success', duration: 2000 });
  };

  const handleDelete = async () => {
    if (!church) return;
    await store.songs.delete(songId, church.id);
    toast({ title: 'Song deleted', status: 'info', duration: 2000 });
    router.push('/songs');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await store.songFiles.create({ song_id: songId, file_url: reader.result as string, file_name: file.name, type: 'chord_chart' });
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
  const isChordPro = (f: SongFile) => /\.(cho|chordpro|chopro)$/i.test(f.file_name);
  const isText = (f: SongFile) => f.file_name.toLowerCase().endsWith('.txt') || isChordPro(f);

  const decodeTextFile = (dataUrl: string): string => {
    try {
      const base64 = dataUrl.split(',')[1];
      return atob(base64);
    } catch { return ''; }
  };

  const health = getRotationHealth();

  return (
    <Box p={{ base: '4', md: '8' }} maxW="800px" mx="auto">
      {/* Header */}
      <Flex mb="6" gap="3" align="flex-start" direction={{ base: 'column', md: 'row' }}>
        <HStack spacing="3" flex="1">
          <IconButton 
            aria-label="Back" 
            icon={<ArrowLeft size={20} />} 
            variant="ghost" 
            onClick={() => router.push('/songs')}
            minW="44px"
            color="gray.500"
            _hover={{ color: 'gray.700', bg: 'gray.100' }}
          />
          <Box>
            <Text fontSize="2xl" fontWeight="bold" color={headingColor} letterSpacing="tight">{song.title}</Text>
            <HStack mt="1" spacing="3">
              <HStack spacing="1">
                <Mic2 size={14} className="text-gray-400" />
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
                  <Input value={ccli} onChange={(e) => setCcli(e.target.value)} borderRadius="lg" />
                </FormControl>
              </Flex>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Tags</FormLabel>
                <Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="Comma-separated" borderRadius="lg" />
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
                  <Music size={14} className="text-gray-400" />
                  <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase">Key:</Text>
                  <Badge variant="subtle" colorScheme="teal" fontSize="sm" borderRadius="md" px="2">{song.default_key}</Badge>
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
        {!isTeam && <input ref={fileInputRef} type="file" accept=".pdf,.cho,.chordpro,.chopro,.txt" style={{ display: 'none' }} onChange={handleFileUpload} />}
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
                  <FileText size={16} className="text-gray-500" />
                </Box>
                <Link href={f.file_url} download={f.file_name} color="teal.600" fontWeight="500" fontSize="sm" _hover={{ textDecoration: 'underline' }}>
                  {f.file_name}
                </Link>
              </HStack>
              <HStack spacing="1">
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
                  <Thead bg={useColorModeValue('gray.50', 'gray.700')}>
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
                        <Td fontSize="sm">{formatDate(entry.date)}</Td>
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
                    <HStack justify="space-between">
                      <HStack spacing="3">
                        <Calendar size={16} className="text-gray-400" />
                        <Text color="teal.600" fontWeight="600" noOfLines={1}>{entry.service.title}</Text>
                      </HStack>
                      <Text fontSize="sm" color={subtextColor}>{formatDate(entry.date)}</Text>
                    </HStack>
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
              <Box as="iframe" src={viewFile.file_url} w="100%" h="600px" borderRadius="lg" border="1px solid" borderColor={borderColor} />
            )}
            {viewFile && isChordPro(viewFile) && (
              <Box p="4" bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                {renderChordPro(decodeTextFile(viewFile.file_url))}
              </Box>
            )}
            {viewFile && viewFile.file_name.toLowerCase().endsWith('.txt') && !isChordPro(viewFile) && (
              <Box p="4" bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="lg" border="1px solid" borderColor={borderColor} fontFamily="monospace" fontSize="sm" whiteSpace="pre-wrap">
                {decodeTextFile(viewFile.file_url)}
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