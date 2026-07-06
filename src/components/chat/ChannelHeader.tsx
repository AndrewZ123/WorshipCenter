'use client';

import { Box, Flex, HStack, Text, Badge, useColorModeValue } from '@chakra-ui/react';
import { Hash, Megaphone, Users } from 'lucide-react';
import type { ChatChannel } from '@/lib/types';

interface ChannelHeaderProps {
  channel: ChatChannel;
  memberCount: number;
}

export default function ChannelHeader({ channel, memberCount }: ChannelHeaderProps) {
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  if (!channel) return null;

  return (
    <Box
      borderBottom="1px solid"
      borderColor={useColorModeValue('gray.100', 'gray.700')}
      p={{ base: '4', md: '4' }}
    >
      <Flex justify="space-between" alignItems="center">
        <HStack spacing="3">
          <Box p="2" borderRadius="lg" bg="teal.50" color="teal.600">
            {channel.is_announcement ? <Megaphone size={20} /> : <Hash size={20} />}
          </Box>
          <Box>
            <HStack spacing="2">
              <Text fontSize="xl" fontWeight="bold" color={textColor} letterSpacing="tight">
                {channel.name}
              </Text>
              {channel.is_announcement && (
                <Badge colorScheme="orange" variant="subtle" borderRadius="full" px="2" py="0.5" fontSize="xs">
                  Announcement
                </Badge>
              )}
            </HStack>
            <HStack spacing="4">
              {channel.description && (
                <Text fontSize="sm" color={subtextColor}>{channel.description}</Text>
              )}
              <HStack spacing="1" color={subtextColor}>
                <Users size={12} />
                <Text fontSize="xs">{memberCount} {memberCount === 1 ? 'member' : 'members'}</Text>
              </HStack>
            </HStack>
          </Box>
        </HStack>
      </Flex>
    </Box>
  );
}
