'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, Input, SimpleGrid, Image, Box, Spinner, Text, VStack,
  useColorModeValue, IconButton, Alert, AlertIcon, AlertDescription,
} from '@chakra-ui/react';
import { Search, ChevronDown } from 'lucide-react';
import { apiUrl } from '@/lib/api-base';

interface GifResult {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
}

interface GifPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void | Promise<void>;
  variant?: 'modal' | 'inline';
}

export default function GifPicker({ isOpen, onClose, onSelect, variant = 'modal' }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [giphyError, setGiphyError] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [isOpen]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    setGiphyError('');
    try {
      const res = await fetch(apiUrl(`/api/chat/giphy?q=${encodeURIComponent(q.trim())}`));
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
          ref={searchInputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search GIPHY..."
          borderRadius="lg"
          size="md"
          pr="10"
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

  if (variant === 'inline') {
    return isOpen ? (
      <Box
        borderBottom="1px solid"
        borderColor={borderColor}
        mb="2"
        maxH="280px"
        overflow="hidden"
        display="flex"
        flexDir="column"
        borderRadius="lg"
      >
        <Box display="flex" alignItems="center" gap="2" p="2" pb="0">
          <Box position="relative" flex="1">
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search GIPHY..."
              size="sm"
              h="36px"
              borderRadius="lg"
              pl="9"
              fontSize="sm"
            />
            <Box position="absolute" left="2.5" top="50%" transform="translateY(-50%)" color="gray.400" pointerEvents="none">
              <Search size={15} />
            </Box>
          </Box>
          <IconButton
            aria-label="Close GIFs"
            icon={<ChevronDown size={18} />}
            size="xs"
            variant="ghost"
            borderRadius="full"
            onClick={() => { setQuery(''); setResults([]); setSearched(false); onClose(); }}
            flexShrink={0}
          />
        </Box>
        <Box flex="1" overflowY="auto" px="2" pb="2" pt="2" sx={{ WebkitOverflowScrolling: 'touch' }}>
          {loading && (
            <Box textAlign="center" py="6">
              <Spinner size="md" color="teal.500" />
            </Box>
          )}
          {!loading && !searched && results.length === 0 && (
            <Text color="gray.400" fontSize="xs" textAlign="center" py="6">
              Search for GIFs
            </Text>
          )}
          {!loading && searched && results.length === 0 && (
            <VStack py="4" spacing="2">
              {giphyError ? (
                <Text color="orange.400" fontSize="xs" textAlign="center" px="2">{giphyError}</Text>
              ) : (
                <Text color="gray.400" fontSize="xs" textAlign="center">No GIFs found</Text>
              )}
            </VStack>
          )}
          {results.length > 0 && (
            <SimpleGrid columns={3} spacing="1.5">
              {results.map((gif) => (
                <Box
                  key={gif.id}
                  borderRadius="md"
                  overflow="hidden"
                  cursor="pointer"
                  onClick={() => {
                    onSelect(gif.url);
                    setQuery('');
                    setResults([]);
                    setSearched(false);
                    onClose();
                  }}
                >
                  <Image
                    src={gif.previewUrl}
                    alt={gif.title || 'GIF'}
                    w="full"
                    aspectRatio={1}
                    objectFit="cover"
                    fallback={<Box w="full" aspectRatio={1} bg="gray.100" />}
                    loading="lazy"
                  />
                </Box>
              ))}
            </SimpleGrid>
          )}
          {results.length > 0 && results.length >= 20 && (
            <Text color="gray.400" fontSize="xs" textAlign="center" py="2">
              Scroll for more
            </Text>
          )}
        </Box>
      </Box>
    ) : null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay backdropBlur="sm" />
      <ModalContent borderRadius="2xl" mx="4">
        <ModalHeader fontWeight="700">Search GIFs</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb="4">
          {content}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
