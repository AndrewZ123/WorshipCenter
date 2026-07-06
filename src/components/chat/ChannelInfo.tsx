'use client';

import { Box, VStack, HStack, Text, useColorModeValue, Divider, Badge } from '@chakra-ui/react';
import Avatar from '@/components/ui/Avatar';
import type { ChatChannel } from '@/lib/types';

interface MemberInfo {
  user_id: string;
  name: string;
  email?: string;
  avatar_url?: string;
  role: string;
}

interface ChannelInfoProps {
  channel: ChatChannel;
  members: MemberInfo[];
  isAdmin: boolean;
}

export default function ChannelInfo({ channel, members, isAdmin }: ChannelInfoProps) {
  const bgColor = useColorModeValue('gray.50', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  return (
    <Box
      w="260px"
      borderLeft="1px solid"
      borderColor={useColorModeValue('gray.100', 'gray.700')}
      bg={useColorModeValue('white', 'gray.800')}
      display={{ base: 'none', lg: 'block' }}
      overflowY="auto"
    >
      <Box p="4">
        <Text fontWeight="700" fontSize="sm" color={textColor} mb="1">About</Text>
        <Text fontSize="sm" color={subtextColor}>
          {channel.description || 'No description'}
        </Text>
        <HStack spacing="1" mt="2" color={subtextColor}>
          <Badge variant="subtle" colorScheme={channel.is_announcement ? 'orange' : 'teal'} fontSize="xs">
            {channel.is_announcement ? 'Announcements' : channel.type === 'group' ? 'Private Group' : 'Channel'}
          </Badge>
        </HStack>
      </Box>
      <Divider />
      <Box p="4">
        <Text fontWeight="700" fontSize="sm" color={textColor} mb="3">
          Members ({members.length})
        </Text>
        <VStack spacing="2" align="stretch">
          {members.map((member) => (
            <HStack key={member.user_id} spacing="2">
              <Avatar name={member.name} src={member.avatar_url} size="sm" />
              <Box flex="1">
                <Text fontSize="sm" fontWeight="500" color={textColor} noOfLines={1}>
                  {member.name}
                </Text>
                <Text fontSize="xs" color={subtextColor}>{member.role}</Text>
              </Box>
            </HStack>
          ))}
        </VStack>
      </Box>
    </Box>
  );
}
