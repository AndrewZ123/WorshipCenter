'use client';

import { Box, VStack, HStack, Text, useColorModeValue, Button, Divider } from '@chakra-ui/react';
import { Hash, Megaphone, Lock, Plus } from 'lucide-react';
import type { ChatChannel } from '@/lib/types';

interface ChannelListProps {
  channels: ChatChannel[];
  activeChannelId: string | null;
  onSelect: (channel: ChatChannel) => void;
  canCreate: boolean;
  onCreateClick: () => void;
}

export default function ChannelList({ channels, activeChannelId, onSelect, canCreate, onCreateClick }: ChannelListProps) {
  const textColor = useColorModeValue('gray.700', 'gray.300');
  const activeBg = useColorModeValue('teal.50', 'rgba(13,148,136,0.15)');
  const activeColor = useColorModeValue('teal.700', 'teal.300');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const subtextColor = useColorModeValue('gray.400', 'gray.500');
  const sectionColor = useColorModeValue('gray.500', 'gray.400');

  const regularChannels = channels.filter(c => !c.is_announcement && !c.is_private);
  const announcementChannels = channels.filter(c => c.is_announcement);
  const privateChannels = channels.filter(c => c.is_private && !c.is_announcement);

  const renderChannel = (ch: ChatChannel) => {
    const isActive = ch.id === activeChannelId;
    const Icon = ch.is_announcement ? Megaphone : ch.is_private ? Lock : Hash;
    return (
      <HStack
        key={ch.id}
        px="3"
        py="2"
        mx="2"
        borderRadius="md"
        cursor="pointer"
        bg={isActive ? activeBg : 'transparent'}
        color={isActive ? activeColor : textColor}
        fontWeight={isActive ? '600' : '400'}
        _hover={{ bg: isActive ? activeBg : hoverBg }}
        transition="all 0.1s"
        onClick={() => onSelect(ch)}
        spacing="2"
      >
        <Icon size={16} />
        <Text fontSize="sm" noOfLines={1}>{ch.name}</Text>
      </HStack>
    );
  };

  return (
    <Box
      w={{ base: 'full', lg: '240px' }}
      borderRight="1px solid"
      borderColor={useColorModeValue('gray.100', 'gray.700')}
      bg={useColorModeValue('white', 'gray.800')}
      display="flex"
      flexDir="column"
      overflow="hidden"
    >
      <Box p="4" pb="2">
        <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="wide" color={sectionColor} mb="2">
          Channels
        </Text>
        <VStack spacing="0.5" align="stretch">
          {regularChannels.map(renderChannel)}
        </VStack>

        {announcementChannels.length > 0 && (
          <>
            <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="wide" color={sectionColor} mt="4" mb="2">
              Announcements
            </Text>
            <VStack spacing="0.5" align="stretch">
              {announcementChannels.map(renderChannel)}
            </VStack>
          </>
        )}

        {privateChannels.length > 0 && (
          <>
            <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="wide" color={sectionColor} mt="4" mb="2">
              Private
            </Text>
            <VStack spacing="0.5" align="stretch">
              {privateChannels.map(renderChannel)}
            </VStack>
          </>
        )}
      </Box>

      {canCreate && (
        <Box px="4" py="3" borderTop="1px solid" borderColor={useColorModeValue('gray.100', 'gray.700')} mt="auto">
          <Button
            leftIcon={<Plus size={16} />}
            size="sm"
            variant="ghost"
            w="full"
            justifyContent="flex-start"
            color={subtextColor}
            _hover={{ color: 'teal.500', bg: hoverBg }}
            onClick={onCreateClick}
            fontWeight="500"
          >
            Create Channel
          </Button>
        </Box>
      )}
    </Box>
  );
}
