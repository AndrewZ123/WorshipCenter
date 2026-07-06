'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Box, VStack, HStack, Text, Input, Button, IconButton, useColorModeValue,
  Divider, useBreakpointValue,
  Drawer, DrawerOverlay, DrawerContent, DrawerBody,
} from '@chakra-ui/react';
import { Hash, Megaphone, Lock, Plus, Search, Check, ChevronDown } from 'lucide-react';
import type { ChatChannel } from '@/lib/types';

interface ChannelBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  channels: ChatChannel[];
  activeChannelId: string | null;
  onSelect: (channel: ChatChannel) => void;
  canCreate: boolean;
  onCreateClick: () => void;
}

export default function ChannelBottomSheet({
  isOpen, onClose, channels, activeChannelId, onSelect, canCreate, onCreateClick,
}: ChannelBottomSheetProps) {
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const bg = useColorModeValue('white', 'gray.800');

  useEffect(() => {
    if (isOpen) {
      const id = setTimeout(() => searchInputRef.current?.focus(), 300);
      return () => clearTimeout(id);
    }
  }, [isOpen]);
  const textColor = useColorModeValue('gray.700', 'gray.300');
  const activeBg = useColorModeValue('teal.50', 'rgba(13,148,136,0.15)');
  const activeColor = useColorModeValue('teal.700', 'teal.300');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const sectionColor = useColorModeValue('gray.500', 'gray.400');
  const inputBg = useColorModeValue('gray.50', 'gray.700');
  const inputBorder = useColorModeValue('gray.200', 'gray.600');
  const dividerColor = useColorModeValue('gray.100', 'gray.700');

  const safe = useMemo(() => channels.filter(Boolean), [channels]);

  const filtered = useMemo(() => {
    if (!query.trim()) return safe;
    const q = query.toLowerCase();
    return safe.filter((c) => c.name.toLowerCase().includes(q));
  }, [safe, query]);

  const regularChannels = filtered.filter(c => !c.is_announcement && !c.is_private);
  const announcementChannels = filtered.filter(c => c.is_announcement);
  const privateChannels = filtered.filter(c => c.is_private && !c.is_announcement);

  const handleSelect = (ch: ChatChannel) => {
    onSelect(ch);
    setQuery('');
    onClose();
  };

  const renderChannel = (ch: ChatChannel) => {
    const isActive = ch.id === activeChannelId;
    const Icon = ch.is_announcement ? Megaphone : ch.is_private ? Lock : Hash;
    return (
      <HStack
        key={ch.id}
        px="4"
        py="3"
        mx="2"
        borderRadius="lg"
        cursor="pointer"
        bg={isActive ? activeBg : 'transparent'}
        color={isActive ? activeColor : textColor}
        fontWeight={isActive ? '600' : '400'}
        _hover={{ bg: isActive ? activeBg : hoverBg }}
        onClick={() => handleSelect(ch)}
        spacing="3"
        minH="48px"
      >
        <Icon size={18} />
        <Box flex="1" minW="0">
          <Text fontSize="sm" noOfLines={1}>{ch.name}</Text>
          {ch.description && (
            <Text fontSize="xs" color={sectionColor} noOfLines={1}>{ch.description}</Text>
          )}
        </Box>
        {isActive && <Check size={16} color="var(--chakra-colors-teal-500)" />}
      </HStack>
    );
  };

  const isMobile = useBreakpointValue({ base: true, lg: false });

  const content = (
    <>
      <Box p="4" pb="2" flexShrink={0}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb="3">
          <Text fontWeight="700" fontSize="md">Channels</Text>
          <IconButton
            aria-label="Close"
            icon={<ChevronDown size={22} />}
            size="sm"
            variant="ghost"
            borderRadius="full"
            onClick={() => { setQuery(''); onClose(); }}
          />
        </Box>
        <Box position="relative">
          <Input
            ref={searchInputRef}
            placeholder="Search channels..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            size="md"
            h="44px"
            fontSize="sm"
            bg={inputBg}
            border="1px solid"
            borderColor={inputBorder}
            borderRadius="xl"
            pl="10"
            _placeholder={{ color: 'gray.400' }}
            _focus={{ borderColor: 'teal.400', boxShadow: '0 0 0 3px rgba(13, 148, 136, 0.15)' }}
          />
          <Box position="absolute" left="3" top="50%" transform="translateY(-50%)" color="gray.400">
            <Search size={16} />
          </Box>
        </Box>
      </Box>

      <Box flex="1" overflowY="auto" pb="4">
        {regularChannels.length > 0 && (
          <>
            <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="wide" color={sectionColor} px="6" mb="1">
              Channels
            </Text>
            <VStack spacing="0.5" align="stretch">
              {regularChannels.map(renderChannel)}
            </VStack>
          </>
        )}

        {announcementChannels.length > 0 && (
          <>
            <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="wide" color={sectionColor} px="6" mt="3" mb="1">
              Announcements
            </Text>
            <VStack spacing="0.5" align="stretch">
              {announcementChannels.map(renderChannel)}
            </VStack>
          </>
        )}

        {privateChannels.length > 0 && (
          <>
            <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="wide" color={sectionColor} px="6" mt="3" mb="1">
              Private
            </Text>
            <VStack spacing="0.5" align="stretch">
              {privateChannels.map(renderChannel)}
            </VStack>
          </>
        )}

        {filtered.length === 0 && (
          <Text fontSize="sm" color={sectionColor} textAlign="center" py="8">
            No channels found
          </Text>
        )}
      </Box>

      {canCreate && (
        <>
          <Divider borderColor={dividerColor} />
          <Box px="4" py="3" flexShrink={0}>
            <Button
              leftIcon={<Plus size={16} />}
              size="md"
              variant="ghost"
              w="full"
              justifyContent="flex-start"
              color={sectionColor}
              _hover={{ color: 'teal.500', bg: hoverBg }}
              onClick={() => { setQuery(''); onCreateClick(); onClose(); }}
              fontWeight="500"
              h="44px"
              borderRadius="lg"
            >
              Create Channel
            </Button>
          </Box>
        </>
      )}
    </>
  );

  if (isMobile) {
    return (
      <>
        {isOpen && (
          <Box
            position="fixed"
            inset={0}
            bg="blackAlpha.400"
            style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
            zIndex={1100}
            onClick={() => { setQuery(''); onClose(); }}
          />
        )}
        <Box
          position="fixed"
          left={0}
          right={0}
          bottom="var(--keyboard-height, 0px)"
          zIndex={1101}
          bg={bg}
          borderTopRadius="2xl"
          boxShadow="0 -4px 24px rgba(0,0,0,0.15)"
          sx={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          transition="transform 0.3s ease, bottom 0.3s ease"
          transform={isOpen ? 'translateY(0)' : 'translateY(100%)'}
          pointerEvents={isOpen ? 'auto' : 'none'}
          maxH="75vh"
          overflow="hidden"
          display="flex"
          flexDir="column"
        >
          {content}
        </Box>
      </>
    );
  }

  return (
    <Drawer isOpen={isOpen} placement="bottom" onClose={() => { setQuery(''); onClose(); }}>
      <DrawerOverlay bg="blackAlpha.300" backdropFilter="blur(4px)" />
      <DrawerContent
        bg={bg}
        borderTopRadius="2xl"
        sx={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <DrawerBody p="0" display="flex" flexDir="column" maxH="80dvh">
          {content}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
