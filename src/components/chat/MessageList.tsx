'use client';

import { useRef, useEffect } from 'react';
import { Box, Center, Spinner, Text, VStack, Flex, useColorModeValue } from '@chakra-ui/react';
import { MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MessageBubble from './MessageBubble';
import type { ChatReaction } from '@/lib/types';

interface MessageListProps {
  messages: any[];
  reactions: Record<string, ChatReaction[]>;
  currentUserId: string;
  isLoading: boolean;
  onReact: (messageId: string, emoji: string) => Promise<void>;
  onEdit?: (messageId: string, content: string) => Promise<void>;
  onDelete?: (messageId: string) => Promise<void>;
  onVotePoll?: (pollId: string, userId: string, optionIndex: number) => Promise<any>;
  onClosePoll?: (pollId: string) => Promise<void>;
  onUpdatePoll?: (pollId: string, updates: { question?: string; options?: string[]; is_closed?: boolean }) => Promise<any>;
}

function groupMessagesByDate(messages: any[]) {
  const groups: { date: string; messages: any[] }[] = [];
  for (const msg of messages) {
    const msgDate = new Date(msg.created_at).toDateString();
    const existing = groups.find(g => g.date === msgDate);
    if (existing) existing.messages.push(msg);
    else groups.push({ date: msgDate, messages: [msg] });
  }
  return groups;
}

function formatDateHeader(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function shouldGroupWithPrevious(current: any, previous: any | null) {
  if (!previous) return false;
  if (current.user?.id !== previous.user?.id) return false;
  return new Date(current.created_at).getTime() - new Date(previous.created_at).getTime() < 2 * 60 * 1000;
}

function DateSeparator({ date }: { date: string }) {
  const bgColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.500', 'gray.400');
  return (
    <Flex alignItems="center" my="4">
      <Box flex="1" h="1px" bg={bgColor} />
      <Text fontSize="xs" fontWeight="600" color={textColor} textTransform="uppercase" letterSpacing="wide" px="3">
        {formatDateHeader(date)}
      </Text>
      <Box flex="1" h="1px" bg={bgColor} />
    </Flex>
  );
}

export default function MessageList({
  messages, reactions, currentUserId, isLoading, onReact, onEdit, onDelete, onVotePoll, onClosePoll, onUpdatePoll,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const bgColor = useColorModeValue('gray.50', 'gray.800');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  useEffect(() => {
    if (messages.length === 0 || isLoading) return;
    const scrollToBottom = () => {
      if (!containerRef.current) return;
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    };
    requestAnimationFrame(() => requestAnimationFrame(scrollToBottom));
  }, [messages, isLoading]);

  if (isLoading) {
    return (
      <Center h="full" minH="300px">
        <VStack spacing="3">
          <Spinner size="xl" color="teal.500" />
          <Text fontSize="sm" color={subtextColor}>Loading messages...</Text>
        </VStack>
      </Center>
    );
  }

  if (messages.length === 0) {
    return (
      <Center h="full" minH="300px">
        <VStack spacing="4">
          <Box p="4" borderRadius="full" bg="teal.50" color="teal.400"><MessageCircle size={48} /></Box>
          <VStack spacing="1">
            <Text fontSize="lg" fontWeight="600" color="gray.700">No messages yet</Text>
            <Text fontSize="sm" color={subtextColor} textAlign="center" maxW="280px">Start the conversation</Text>
          </VStack>
        </VStack>
      </Center>
    );
  }

  const groups = groupMessagesByDate(messages);

  return (
    <Box ref={containerRef} flex="1" overflowY="auto" p={{ base: '4', md: '6' }} bg={bgColor}>
      <AnimatePresence initial={false}>
        {groups.map((group, gi) => (
          <Box key={group.date}>
            <DateSeparator date={group.date} />
            {group.messages.map((msg, mi) => {
              const prev = mi > 0 ? group.messages[mi - 1] : (gi > 0 ? groups[gi - 1].messages[groups[gi - 1].messages.length - 1] : null);
              const grouped = shouldGroupWithPrevious(msg, prev);
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.user?.id === currentUserId}
                  showAvatar={!grouped}
                  showName={!grouped}
                  isGrouped={grouped}
                  reactions={reactions[msg.id] || []}
                  currentUserId={currentUserId}
                  onReact={onReact}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onVotePoll={onVotePoll}
                  onClosePoll={onClosePoll}
                  onUpdatePoll={onUpdatePoll}
                />
              );
            })}
          </Box>
        ))}
      </AnimatePresence>
      <div ref={endRef} />
    </Box>
  );
}
