'use client';

import { Box, Flex, VStack, HStack, Text, useColorModeValue } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import Avatar from '@/components/ui/Avatar';
import { formatRelativeDate } from '@/lib/formatDate';
import MarkdownRenderer from './MarkdownRenderer';
import ReactionBar from './ReactionBar';
import type { ChatReaction } from '@/lib/types';

import PollRenderer from './PollRenderer';

interface MessageBubbleProps {
  message: any;
  isOwn: boolean;
  showAvatar: boolean;
  showName: boolean;
  isGrouped: boolean;
  reactions: ChatReaction[];
  currentUserId: string;
  onReact: (messageId: string, emoji: string) => Promise<void>;
  onVotePoll?: (pollId: string, userId: string, optionIndex: number) => Promise<any>;
}

function getReactionSummary(reactions: ChatReaction[], currentUserId: string) {
  const emojiMap = new Map<string, { count: number; hasReacted: boolean }>();
  for (const r of reactions) {
    const existing = emojiMap.get(r.emoji) || { count: 0, hasReacted: false };
    existing.count++;
    if (r.user_id === currentUserId) existing.hasReacted = true;
    emojiMap.set(r.emoji, existing);
  }
  return Array.from(emojiMap.entries()).map(([emoji, data]) => ({ emoji, ...data }));
}

export default function MessageBubble({
  message, isOwn, showAvatar, showName, isGrouped, reactions, currentUserId, onReact, onVotePoll,
}: MessageBubbleProps) {
  const ownBubbleBg = useColorModeValue('teal.500', 'teal.400');
  const otherBubbleBg = useColorModeValue('white', 'gray.700');
  const otherBubbleBorder = useColorModeValue('gray.200', 'gray.600');
  const timeColor = useColorModeValue('gray.400', 'gray.500');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Flex
        align="end"
        gap="2"
        flexDir={isOwn ? 'row-reverse' : 'row'}
        mt={isGrouped ? '1' : '3'}
      >
        <Box w="28px" h="28px" flexShrink={0}>
          {showAvatar && (
            <Avatar name={message.user?.name || 'Unknown'} src={message.user?.avatar_url} size="sm" />
          )}
        </Box>
        <VStack align={isOwn ? 'flex-end' : 'flex-start'} spacing="1" maxW={{ base: '75%', md: '65%' }} flex="1">
          {showName && (
            <HStack spacing="2" px="1">
              <Text fontSize="xs" fontWeight="600" color={isOwn ? 'teal.600' : 'gray.600'}>
                {message.user?.name || 'Unknown'}
              </Text>
              <Text fontSize="10px" color={timeColor}>
                {formatRelativeDate(message.created_at)}
              </Text>
            </HStack>
          )}
          <Box
            px="4"
            py="2.5"
            borderRadius="2xl"
            bg={isOwn ? ownBubbleBg : otherBubbleBg}
            color={isOwn ? 'white' : undefined}
            borderBottomRightRadius={isOwn ? 'sm' : '2xl'}
            borderBottomLeftRadius={isOwn ? '2xl' : 'sm'}
            boxShadow={isOwn ? '0 2px 8px rgba(13, 148, 136, 0.25)' : '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)'}
            border={isOwn ? 'none' : '1px solid'}
            borderColor={isOwn ? 'transparent' : otherBubbleBorder}
            position="relative"
          >
            <MarkdownRenderer content={message.content} color={isOwn ? 'white' : undefined} />
          </Box>
          {message.poll_id && onVotePoll && (
            <Box w="full">
              <PollRenderer
                pollId={message.poll_id}
                userId={currentUserId}
                channelId={message.channel_id}
                onVotePoll={onVotePoll}
              />
            </Box>
          )}
          {reactions.length > 0 && (
            <Box px="1">
              <ReactionBar
                reactions={getReactionSummary(reactions, currentUserId)}
                onReact={(emoji) => onReact(message.id, emoji)}
              />
            </Box>
          )}
        </VStack>
      </Flex>
    </motion.div>
  );
}
