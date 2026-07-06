'use client';

import { Box, Flex, Text, useColorModeValue } from '@chakra-ui/react';
import { Hash, Megaphone, Lock } from 'lucide-react';
import type { ChatChannel } from '@/lib/types';

interface ChannelPillBarProps {
  channels: ChatChannel[];
  activeChannelId: string | null;
  onSelect: (channel: ChatChannel) => void;
}

export default function ChannelPillBar({ channels, activeChannelId, onSelect }: ChannelPillBarProps) {
  const activeBg = useColorModeValue('teal.500', 'teal.400');
  const activeText = 'white';
  const inactiveBg = useColorModeValue('gray.100', 'gray.700');
  const inactiveText = useColorModeValue('gray.600', 'gray.300');
  const inactiveBorder = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box
      borderBottom="1px solid"
      borderColor={useColorModeValue('gray.100', 'gray.700')}
      bg={useColorModeValue('white', 'gray.800')}
      py="2"
      px="3"
    >
      <Flex
        gap="2"
        overflowX="auto"
        sx={{
          scrollSnapType: 'x proximity',
          '::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}
      >
        {channels.map((ch) => {
          const isActive = ch.id === activeChannelId;
          const Icon = ch.is_announcement ? Megaphone : ch.is_private ? Lock : Hash;
          return (
            <Flex
              key={ch.id}
              as="button"
              align="center"
              gap="1.5"
              px="3"
              py="1.5"
              borderRadius="full"
              bg={isActive ? activeBg : inactiveBg}
              color={isActive ? activeText : inactiveText}
              border={isActive ? 'none' : '1px solid'}
              borderColor={isActive ? 'transparent' : inactiveBorder}
              fontSize="sm"
              fontWeight={isActive ? '600' : '500'}
              whiteSpace="nowrap"
              cursor="pointer"
              minH="36px"
              flexShrink={0}
              onClick={() => onSelect(ch)}
              transition="all 0.15s"
              _hover={!isActive ? { bg: useColorModeValue('gray.200', 'gray.600') } : undefined}
            >
              <Icon size={14} />
              <Text>{ch.name}</Text>
            </Flex>
          );
        })}
      </Flex>
    </Box>
  );
}
