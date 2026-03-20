'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Heading, HStack, Button, VStack, Text, Input, Flex,
  FormControl, FormLabel, Card, CardBody, useToast, IconButton,
  Badge, Tag, TagLabel, Wrap, WrapItem, Table,
  Thead, Tbody, Tr, Th, Td, Link, useDisclosure, useColorModeValue,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
  Spinner, Center,
} from '@chakra-ui/react';
import { useDemo } from '@/lib/demo/context';
import type { Song, SongUsage, Service } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
);
const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8-11 8-11 8-11 8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const YoutubeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z" />
    <polygon fill="white" points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

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
        return <Text key={lineIdx} color="brand.600" fontWeight="600" fontSize="sm" mt="3" mb="1">{directive.split(':').slice(1).join(':').trim()}</Text>;
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
          <Text as="span" position="absolute" top="-1.2em" left="0" fontSize="xs" fontWeight="700" color="brand.600">{match[1]}</Text>
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

// Demo files data (simulated)
const DEMO_FILES = [
  { id: 'file-1', song_id: 'song-1', file_name: 'Amazing Grace.cho', file_url: 'data:text/plain;base64,e3RpdGxlOiBBbWF6aW5nIEdyYWNlfQp7c3VidGl0bGU6IE5ldyBCb3R0b25zfQp7YzogVmVyY2UgMXN0fQpbbSBCXUFtYXppbmcgZ3JhY2UgIVtFQl0gaG93IHN3ZWV0IHRoZSBzb3VuZApbQl1UaGF0IHNhdmVkIGEgd3JldGNoIFtFXWxpa2UgbWUKW0I3XUkgV2FzIG9uY2UgYmxpbmQgYnV0IFtFQl0gbm93IGFtIGZvdW5kCldhcyBibGFuZCBidXQgbm93IEkgW0I3XXNlZQp7YzogQ2hvcnVzfQpUd2FzIGdyYWNlIHRoYXQgdGF1Z2h0IG1lClRoZSBncmFjZSB0aGF0IHRhdWdodCBtZQpJdCdsbCBuZXZlciBsZWFkIG1lIGFzdHJheQpObyBtYXR0ZXIgd2hlcmUgSSBnbyBubyBtYXR0ZXIgd2hlcmUgSSBnbyBKZXN1cyBsb3ZlciBvZiBteSBzb3VsIGhhcyBicm91Z2h0IG1lIGhlcmU=', type: 'chord_chart' as const },
];

export default function DemoSongDetailClient() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { songs, songUsage, services, updateSong, deleteSong } = useDemo();
  const songId = params.id as string;

  const [song, setSong] = useState<Song | null>(null);
  const [editing, setEditing] = useState(false);
  const [viewFile, setViewFile] = useState<typeof DEMO_FILES[0] | null>(null);
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
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => {
    const s = songs.find(s => s.id === songId);
    if (s) {
      setSong(s);
      setTitle(s.title);
      setArtist(s.artist || '');
      setDefaultKey(s.default_key || 'C');
      setCcli(s.ccli_number || '');
      setTagsStr(s.tags.join(', '));
      setYoutubeId(s.youtube_video_id || '');
    }
    setLoading(false);
  }, [songId, songs]);

  const allUsage = songUsage.filter(u => u.song_id === songId);
  const recentServices = useMemo(() => {
    return allUsage
      .map((u) => { const svc = services.find((s) => s.id === u.service_id); return svc ? { date: u.date, service: svc } : null; })
      .filter(Boolean)
      .sort((a, b) => new Date(b!.date).getTime() - new Date(a!.date).getTime())
      .slice(0, 5) as { date: string; service: Service }[];
  }, [allUsage, services]);

  const totalUsageCount = allUsage.length;

  if (loading) {
    return (
      <Center minH="50vh">
        <Spinner size="xl" color="brand.500" />
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
    const extractedId = extractYoutubeId(youtubeId);
    updateSong(songId, {
      title, artist, default_key: defaultKey || 'C', ccli_number: ccli,
      tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean),
      youtube_video_id: extractedId || undefined,
    });
    setEditing(false);
    const s = songs.find(s => s.id === songId);
    if (s) setSong({ ...s, title, artist, default_key: defaultKey || 'C', ccli_number: ccli, tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean), youtube_video_id: extractedId || undefined });
    toast({ title: 'Song updated', status: 'success', duration: 2000 });
  };

  const handleDelete = async () => {
    deleteSong(songId);
    toast({ title: 'Song deleted', status: 'info', duration: 2000 });
    router.push('/demo/songs');
  };

  const handleFileUpload = () => {
    toast({ title: 'Demo Mode', description: 'File upload is available in the full app.', status: 'info', duration: 3000 });
  };

  const handleDeleteFile = () => {
    toast({ title: 'Demo Mode', description: 'File deletion is available in the full app.', status: 'info', duration: 3000 });
  };

  const handleViewFile = (file: typeof DEMO_FILES[0]) => {
    setViewFile(file);
    viewerDisclosure.onOpen();
  };

  const formatDate = (d: string) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
  };

  const decodeTextFile = (dataUrl: string): string => {
    try {
      const base64 = dataUrl.split(',')[1];
      return atob(base64);
    } catch { return ''; }
  };

  const files = DEMO_FILES.filter(f => f.song_id === songId || (songId.startsWith('song-') && f.song_id === 'song-1'));

  return (
    <Box p={{ base: '4', md: '8' }} maxW="800px" mx="auto">
      <Flex mb="6" gap="3" align="flex-start" direction={{ base: 'column', md: 'row' }}>
        <HStack spacing="3" w={{ base: 'full', md: 'auto' }}>
          <IconButton aria-label="Back" icon={<BackIcon />} variant="ghost" onClick={() => router.push('/demo/songs')} />
          <Box flex="1">
            <Heading size="lg" fontWeight="700">{song.title}</Heading>
            <HStack mt="1" spacing="3">
              <Text color="gray.500">{song.artist}</Text>
              {totalUsageCount > 0 && <Badge colorScheme="brand" variant="subtle" fontSize="xs">Used {totalUsageCount} time{totalUsageCount !== 1 ? 's' : ''}</Badge>}
            </HStack>
          </Box>
        </HStack>
        <HStack spacing="2" w={{ base: 'full', md: 'auto' }} justify={{ base: 'flex-end', md: 'flex-start' }}>
          {!editing && <Button variant="outline" onClick={() => setEditing(true)} size={{ base: 'sm', md: 'md' }}>Edit</Button>}
          <Button variant="ghost" colorScheme="red" size={{ base: 'sm', md: 'sm' }} onClick={deleteDisclosure.onOpen}>Delete</Button>
        </HStack>
      </Flex>

      <Card mb="6" bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor}>
        <CardBody>
          {editing ? (
            <VStack spacing="4" align="stretch">
              <FormControl isRequired><FormLabel fontWeight="600">Title</FormLabel><Input value={title} onChange={(e) => setTitle(e.target.value)} /></FormControl>
              <FormControl><FormLabel fontWeight="600">Artist</FormLabel><Input value={artist} onChange={(e) => setArtist(e.target.value)} /></FormControl>
              <Flex gap="4" direction={{ base: 'column', md: 'row' }}>
                <FormControl><FormLabel fontWeight="600">Default Key</FormLabel><Input value={defaultKey} onChange={(e) => setDefaultKey(e.target.value)} /></FormControl>
                <FormControl><FormLabel fontWeight="600">CCLI Number</FormLabel><Input value={ccli} onChange={(e) => setCcli(e.target.value)} /></FormControl>
              </Flex>
              <FormControl><FormLabel fontWeight="600">Tags</FormLabel><Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="Comma-separated" /></FormControl>
              <FormControl>
                <FormLabel fontWeight="600">YouTube Link</FormLabel>
                <Flex gap="2" direction={{ base: 'column', sm: 'row' }}>
                  <Input value={youtubeId} onChange={(e) => setYoutubeId(e.target.value)} placeholder="youtube.com/watch?v=..." flex="1" />
                  <Button as="a" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' ' + artist)}`} target="_blank" variant="outline" leftIcon={<YoutubeIcon />} size="sm">Search</Button>
                </Flex>
              </FormControl>
              <Flex gap="3" justify="flex-end">
                <Button variant="ghost" onClick={() => { 
                  setEditing(false);
                  const s = songs.find(s => s.id === songId); 
                  if (s) { 
                    setTitle(s.title); 
                    setArtist(s.artist || ''); 
                    setDefaultKey(s.default_key || 'C'); 
                    setCcli(s.ccli_number || ''); 
                    setTagsStr(s.tags.join(', ')); 
                    setYoutubeId(s.youtube_video_id || ''); 
                  } 
                }}>Cancel</Button>
                <Button onClick={handleSave}>Save</Button>
              </Flex>
            </VStack>
          ) : (
            <VStack spacing="3" align="stretch">
              <HStack justify="space-between"><Text fontWeight="600" color="gray.600">Key</Text><Badge variant="outline" colorScheme="brand" fontSize="sm">{song.default_key}</Badge></HStack>
              {song.ccli_number && <HStack justify="space-between"><Text fontWeight="600" color="gray.600">CCLI #</Text><Text>{song.ccli_number}</Text></HStack>}
              {song.youtube_video_id && (
                <HStack justify="space-between">
                  <Text fontWeight="600" color="gray.600">YouTube</Text>
                  <Button as="a" href={`https://youtube.com/watch?v=${song.youtube_video_id}`} target="_blank" size="xs" variant="outline" colorScheme="red" leftIcon={<YoutubeIcon />}>Watch Video</Button>
                </HStack>
              )}
              {song.tags.length > 0 && (
                <Box><Text fontWeight="600" color="gray.600" mb="2">Tags</Text>
                  <Wrap spacing="2">{song.tags.map((tag) => <WrapItem key={tag}><Tag variant="subtle" colorScheme="brand" size="md"><TagLabel>{tag}</TagLabel></Tag></WrapItem>)}</Wrap>
                </Box>
              )}
            </VStack>
          )}
        </CardBody>
      </Card>

      {/* Chord Charts with Viewer */}
      <Box mb="6">
        <Flex justify="space-between" align="center" mb="4">
          <Heading size="md" fontWeight="700">Chord Charts</Heading>
          <Button size="sm" variant="outline" onClick={handleFileUpload}>+ Upload File</Button>
        </Flex>
        {files.length === 0 ? (
          <Box textAlign="center" py="8" color="gray.400" bg={cardBg} borderRadius="xl" border="1px dashed" borderColor={borderColor}>
            <Text fontSize="sm">No files uploaded yet. Upload a PDF or ChordPro file.</Text>
          </Box>
        ) : (
          <VStack spacing="2" align="stretch">
            {files.map((f) => (
              <HStack key={f.id} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="lg" px="4" py="3" justify="space-between">
                <HStack spacing="3">
                  <FileIcon />
                  <Link href={f.file_url} download={f.file_name} color="brand.600" fontWeight="500" fontSize="sm">{f.file_name}</Link>
                </HStack>
                <HStack spacing="1">
                  <IconButton aria-label="View file" icon={<EyeIcon />} size="sm" variant="ghost" colorScheme="brand" onClick={() => handleViewFile(f)} />
                  <IconButton aria-label="Delete file" icon={<TrashIcon />} size="sm" variant="ghost" colorScheme="red" onClick={handleDeleteFile} />
                </HStack>
              </HStack>
            ))}
          </VStack>
        )}
      </Box>

      {/* Recent Services */}
      <Box>
        <Heading size="md" fontWeight="700" mb="4">Recent Services</Heading>
        {recentServices.length === 0 ? (
          <Box textAlign="center" py="8" color="gray.400" bg={cardBg} borderRadius="xl" border="1px dashed" borderColor={borderColor}>
            <Text fontSize="sm">Not used in any completed services yet</Text>
          </Box>
        ) : (
          <>
            {/* Desktop Table */}
            <Box display={{ base: 'none', md: 'block' }} bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden">
              <Table variant="simple" size="sm">
                <Thead bg={useColorModeValue('gray.50', 'gray.700')}><Tr><Th>Date</Th><Th>Service</Th></Tr></Thead>
                <Tbody>
                  {recentServices.map((entry, i) => (
                    <Tr key={i} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => router.push(`/demo/services/${entry.service.id}`)}>
                      <Td fontSize="sm">{formatDate(entry.date)}</Td>
                      <Td fontSize="sm"><Text color="brand.600" fontWeight="500" _hover={{ textDecoration: 'underline' }}>{entry.service.title}</Text></Td>
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
                  borderRadius="lg"
                  border="1px solid"
                  borderColor={borderColor}
                  p="4"
                  cursor="pointer"
                  onClick={() => router.push(`/demo/services/${entry.service.id}`)}
                  _hover={{ shadow: 'sm' }}
                >
                  <HStack justify="space-between">
                    <Text color="brand.600" fontWeight="600" noOfLines={1}>{entry.service.title}</Text>
                    <Text fontSize="sm" color="gray.500">{formatDate(entry.date)}</Text>
                  </HStack>
                </Box>
              ))}
            </VStack>
          </>
        )}
      </Box>

      {/* Chord Chart Viewer Modal */}
      <Modal isOpen={viewerDisclosure.isOpen} onClose={viewerDisclosure.onClose} size="xl" isCentered>
        <ModalOverlay />
        <ModalContent borderRadius="xl" maxH="80vh">
          <ModalHeader fontWeight="700">{viewFile?.file_name || 'File Viewer'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto" pb="6">
            {viewFile && (
              <Box p="4" bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                {renderChordPro(decodeTextFile(viewFile.file_url))}
              </Box>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDisclosure.isOpen}
        onClose={deleteDisclosure.onClose}
        onConfirm={handleDelete}
        title="Delete Song"
        message="This will permanently delete this song, its chord charts, and all usage data."
        confirmLabel="Delete Song"
      />
    </Box>
  );
}