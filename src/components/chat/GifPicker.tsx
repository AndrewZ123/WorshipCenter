'use client';

import { useState, useCallback } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, Input, SimpleGrid, Image, Box, Spinner, Text, VStack,
  useColorModeValue, IconButton, Alert, AlertIcon, AlertDescription, useBreakpointValue,
  Drawer, DrawerOverlay, DrawerContent, DrawerBody,
} from '@chakra-ui/react';
import { Search, X } from 'lucide-react';

interface GifResult {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
}

interface GifPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export default function GifPicker({ isOpen, onClose, onSelect }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [giphyError, setGiphyError] = useState('');
  const isMobile = useBreakpointValue({ base: true, lg: false });
  const hoverBg = useColorModeValue('gray.100', 'gray.600');

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    setGiphyError('');
    try {
      const res = await fetch(`/api/chat/giphy?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      if (data.error === 'GIPHY API key not configured') {
        setGiphyError('GIPHY API key not configured. Add GIPHY_API_KEY to your environment variables.');
        setResults([]);
      } else {
        setResults(data.results || []);
      }
    } catch (error) {
      console.error('GIF search failed:', error);
      setResults([]);
      setGiphyError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      search(query);
    }
  };

  const content = (
    <>
      <Box position="relative" mb="4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search GIPHY..."
          borderRadius="lg"
          size="md"
          pr="10"
          autoFocus
        />
        <IconButton
          aria-label="Search"
          icon={<Search size={18} />}
          position="absolute"
          right="1"
          top="50%"
          transform="translateY(-50%)"
          variant="ghost"
          size="sm"
          onClick={() => search(query)}
        />
      </Box>

      {loading && (
        <Box textAlign="center" py="8">
          <Spinner size="lg" color="teal.500" />
        </Box>
      )}

      {!loading && searched && results.length === 0 && (
        <VStack py="8" spacing="2">
          {giphyError ? (
            <Alert status="warning" borderRadius="lg" fontSize="sm">
              <AlertIcon />
              <AlertDescription>{giphyError}</AlertDescription>
            </Alert>
          ) : (
            <Text color="gray.400" fontSize="sm">No GIFs found</Text>
          )}
        </VStack>
      )}

      {results.length > 0 && (
        <SimpleGrid columns={2} spacing="2" maxH="400px" overflowY="auto">
          {results.map((gif) => (
            <Box
              key={gif.id}
              borderRadius="md"
              overflow="hidden"
              cursor="pointer"
              border="2px solid transparent"
              _hover={{ borderColor: 'teal.400' }}
              onClick={() => {
                onSelect(gif.url);
                onClose();
              }}
            >
              <Image
                src={gif.previewUrl}
                alt={gif.title || 'GIF'}
                w="full"
                h="150px"
                objectFit="cover"
                fallback={<Box w="full" h="150px" bg="gray.100" />}
              />
            </Box>
          ))}
        </SimpleGrid>
      )}
    </>
  );

  const header = query ? 'Search GIFs' : 'Search GIFs';

  if (isMobile) {
    return (
      <Drawer isOpen={isOpen} placement="bottom" onClose={onClose}>
        <DrawerOverlay bg="blackAlpha.300" backdropFilter="blur(4px)" />
        <DrawerContent borderTopRadius="2xl" maxH="80dvh" sx={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <DrawerBody pt="4" pb="4">
            {content}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay backdropBlur="sm" />
      <ModalContent borderRadius="2xl" mx="4">
        <ModalHeader fontWeight="700">{header}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb="4">
          {content}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
