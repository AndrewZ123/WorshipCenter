'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Text, HStack, VStack, Flex, Spinner, Center, IconButton,
  useColorModeValue, Textarea,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle, ArrowDown } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { db } from '@/lib/store';
import type { User } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  chat_id: string;
  content: string;
  created_at: string;
  sender_user_id: string;
  read_at: string | null;
  sender: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

interface ServiceChatProps {
  serviceId: string;
  churchId: string;
  currentUser: User | null;
  isDemo?: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const GROUP_WINDOW_MS = 2 * 60 * 1000; // 2 min
const MAX_MESSAGE_LENGTH = 2000;
const SCROLL_THRESHOLD = 120; // px from bottom

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== today.getFullYear() && { year: 'numeric' }),
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isNewDay(prevDate: string, currDate: string): boolean {
  return new Date(prevDate).toDateString() !== new Date(currDate).toDateString();
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  const lineColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.400', 'gray.500');

  return (
    <Flex align="center" my="4">
      <Box flex="1" h="1px" bg={lineColor} />
      <Text
        fontSize="xs"
        fontWeight="600"
        color={textColor}
        textTransform="uppercase"
        letterSpacing="wide"
        px="3"
      >
        {label}
      </Text>
      <Box flex="1" h="1px" bg={lineColor} />
    </Flex>
  );
}

function MessageRow({
  message,
  isOwn,
  isFirstInGroup,
  isLastInGroup,
}: {
  message: Message;
  isOwn: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}) {
  const ownBubbleBg = useColorModeValue('teal.500', 'teal.400');
  const otherBubbleBg = useColorModeValue('white', 'gray.700');
  const otherBubbleBorder = useColorModeValue('gray.200', 'gray.600');
  const ownTextColor = 'white';
  const otherTextColor = useColorModeValue('gray.800', 'white');
  const timeColor = useColorModeValue('gray.400', 'gray.500');
  const nameColor = useColorModeValue('gray.600', 'gray.300');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Flex
        align="end"
        gap="2"
        flexDir={isOwn ? 'row-reverse' : 'row'}
        mt={isFirstInGroup ? '3' : '0.5'}
      >
        {/* Avatar — show on last message of a group */}
        {!isOwn && (
          <Box w="32px" h="32px" flexShrink={0}>
            {isLastInGroup && (
              <Avatar
                name={message.sender.name}
                src={message.sender.avatar_url}
                size="sm"
              />
            )}
          </Box>
        )}

        <VStack
          align={isOwn ? 'flex-end' : 'flex-start'}
          spacing="0.5"
          maxW={{ base: '75%', md: '65%' }}
        >
          {/* Sender name (first in group, others only) */}
          {!isOwn && isFirstInGroup && (
            <Text fontSize="xs" fontWeight="600" color={nameColor} px="1" mb="0.5">
              {message.sender.name}
            </Text>
          )}

          {/* Bubble */}
          <Box
            px="3.5"
            py="2"
            borderRadius="2xl"
            bg={isOwn ? ownBubbleBg : otherBubbleBg}
            color={isOwn ? ownTextColor : otherTextColor}
            borderBottomRightRadius={isOwn ? 'sm' : '2xl'}
            borderBottomLeftRadius={isOwn ? '2xl' : 'sm'}
            boxShadow={isOwn
              ? '0 2px 8px rgba(13, 148, 136, 0.2)'
              : '0 1px 2px rgba(0,0,0,0.06)'}
            border={isOwn ? 'none' : '1px solid'}
            borderColor={isOwn ? 'transparent' : otherBubbleBorder}
          >
            <Text fontSize="sm" lineHeight="1.5" whiteSpace="pre-wrap" wordBreak="break-word">
              {message.content}
            </Text>
          </Box>

          {/* Timestamp + read receipt (last in group only) */}
          {isLastInGroup && (
            <HStack
              spacing="1"
              mt="0.5"
              px="1"
              flexDir={isOwn ? 'row-reverse' : 'row'}
            >
              <Text fontSize="10px" color={timeColor}>
                {formatTime(message.created_at)}
              </Text>
              {isOwn && message.read_at && (
                <Text fontSize="10px" color="teal.500" fontWeight="500">
                  Read
                </Text>
              )}
            </HStack>
          )}
        </VStack>
      </Flex>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ServiceChat({ serviceId, churchId, currentUser, isDemo = false }: ServiceChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  const messageIdSetRef = useRef<Set<string>>(new Set());
  const hasMarkedReadRef = useRef(false);

  // Color mode values
  const bgColor = useColorModeValue('gray.50', 'gray.800');
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const inputBg = useColorModeValue('gray.50', 'gray.700');
  const inputBorder = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  // ─── Textarea helpers ──────────────────────────────────────────────────────

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  const resetTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) textarea.style.height = 'auto';
  }, []);

  // ─── Scroll management ──────────────────────────────────────────────────────

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    isNearBottomRef.current = true;
    setShowScrollButton(false);
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distFromBottom = scrollHeight - scrollTop - clientHeight;
    isNearBottomRef.current = distFromBottom < SCROLL_THRESHOLD;
    setShowScrollButton(distFromBottom > 250);
  }, []);

  // ─── Load messages ──────────────────────────────────────────────────────────

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      hasMarkedReadRef.current = false;
      isInitialLoadRef.current = true;
      const msgs = await db.serviceChat.getMessages(serviceId, churchId);
      messageIdSetRef.current = new Set(msgs.map((m) => m.id));
      setMessages(msgs);
    } catch (err) {
      console.error('[ServiceChat] Failed to load messages:', err);
      setError('Failed to load messages.');
    } finally {
      setLoading(false);
    }
  }, [serviceId, churchId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // ─── Realtime subscription ──────────────────────────────────────────────────

  useEffect(() => {
    if (isDemo) return;

    const unsubscribe = db.serviceChat.subscribe(
      serviceId,
      churchId,
      (message: Message) => {
        if (messageIdSetRef.current.has(message.id)) return;
        messageIdSetRef.current.add(message.id);
        setMessages((prev) => [...prev, message]);
      },
      (err: unknown) => {
        console.error('[ServiceChat] Subscription error:', err);
      },
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [serviceId, churchId, isDemo]);

  // ─── Auto-scroll on new messages ────────────────────────────────────────────

  useEffect(() => {
    if (messages.length === 0) return;
    if (isNearBottomRef.current) {
      const behavior = isInitialLoadRef.current ? 'auto' : 'smooth';
      isInitialLoadRef.current = false;
      requestAnimationFrame(() => scrollToBottom(behavior));
    }
  }, [messages, scrollToBottom]);

  // ─── Mark messages as read ──────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser || messages.length === 0 || isDemo || hasMarkedReadRef.current) return;

    const hasUnreadFromOthers = messages.some(
      (m) => m.sender_user_id !== currentUser.id && m.read_at === null,
    );
    if (!hasUnreadFromOthers) return;

    hasMarkedReadRef.current = true;
    db.serviceChat
      .markAsRead(serviceId, churchId, currentUser.id)
      .catch((err: unknown) => {
        console.error('[ServiceChat] Error marking as read:', err);
        hasMarkedReadRef.current = false;
      });
  }, [messages, currentUser, serviceId, churchId, isDemo]);

  // ─── Send message (optimistic) ──────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || !currentUser || sending) return;

    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMsg: Message = {
      id: tempId,
      chat_id: serviceId,
      content,
      created_at: new Date().toISOString(),
      sender_user_id: currentUser.id,
      read_at: null,
      sender: {
        id: currentUser.id,
        name: currentUser.name || 'You',
        avatar_url: currentUser.avatar_url,
      },
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputValue('');
    resetTextareaHeight();
    setSending(true);
    setError(null);
    isNearBottomRef.current = true;

    try {
      const message = await db.serviceChat.createMessage(serviceId, churchId, currentUser.id, content);

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        if (message && !messageIdSetRef.current.has(message.id)) {
          messageIdSetRef.current.add(message.id);
          return [...withoutTemp, message];
        }
        return withoutTemp;
      });
    } catch (err) {
      console.error('[ServiceChat] Failed to send message:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputValue(content);
      setError('Failed to send message. Please try again.');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [inputValue, currentUser, sending, serviceId, churchId, resetTextareaHeight]);

  // ─── Input handlers ──────────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    adjustTextareaHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Compute render items (date separators + grouped messages) ──────────────

  const renderItems = useMemo(() => {
    type RenderItem =
      | { type: 'date'; key: string; label: string }
      | { type: 'message'; key: string; message: Message; isOwn: boolean; isFirstInGroup: boolean; isLastInGroup: boolean };

    const items: RenderItem[] = [];
    const currentUserId = currentUser?.id;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const prev = i > 0 ? messages[i - 1] : null;
      const next = i < messages.length - 1 ? messages[i + 1] : null;

      if (!prev || isNewDay(prev.created_at, msg.created_at)) {
        items.push({ type: 'date', key: `date-${msg.id}`, label: getDateSeparator(msg.created_at) });
      }

      const isFirstInGroup =
        !prev ||
        prev.sender_user_id !== msg.sender_user_id ||
        isNewDay(prev.created_at, msg.created_at) ||
        new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() >= GROUP_WINDOW_MS;

      const isLastInGroup =
        !next ||
        next.sender_user_id !== msg.sender_user_id ||
        isNewDay(msg.created_at, next.created_at) ||
        new Date(next.created_at).getTime() - new Date(msg.created_at).getTime() >= GROUP_WINDOW_MS;

      items.push({
        type: 'message',
        key: msg.id,
        message: msg,
        isOwn: msg.sender_user_id === currentUserId,
        isFirstInGroup,
        isLastInGroup,
      });
    }

    return items;
  }, [messages, currentUser?.id]);

  // ─── Not signed in ───────────────────────────────────────────────────────────

  if (!currentUser) {
    return (
      <Center h="300px">
        <VStack spacing="3">
          <Box p="3" borderRadius="full" bg="gray.100" color="gray.400">
            <MessageCircle size={32} />
          </Box>
          <Text fontSize="sm" color={subtextColor}>Sign in to participate in the chat.</Text>
        </VStack>
      </Center>
    );
  }

  // ─── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Center h="400px">
        <VStack spacing="3">
          <Spinner size="xl" color="teal.500" />
          <Text fontSize="sm" color={subtextColor}>Loading messages…</Text>
        </VStack>
      </Center>
    );
  }

  // ─── Error state (no messages loaded) ────────────────────────────────────────

  if (error && messages.length === 0) {
    return (
      <Center h="300px">
        <VStack spacing="4">
          <Box p="3" borderRadius="full" bg="red.50" color="red.400">
            <MessageCircle size={32} />
          </Box>
          <Text fontSize="sm" color={subtextColor}>{error}</Text>
          <IconButton
            aria-label="Try again"
            icon={<span>↻</span>}
            onClick={loadMessages}
            colorScheme="teal"
            variant="outline"
            size="sm"
          />
        </VStack>
      </Center>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <Box
      display="flex"
      flexDirection="column"
      h={{ base: 'calc(100vh - 220px)', md: '600px' }}
      minH="400px"
      bg={cardBg}
      overflow="hidden"
    >
      {/* Inline error banner */}
      {error && messages.length > 0 && (
        <Box
          px="4"
          py="2"
          bg="red.50"
          borderBottom="1px solid"
          borderColor="red.100"
        >
          <HStack justify="space-between">
            <Text fontSize="xs" color="red.600" noOfLines={1}>{error}</Text>
            <IconButton
              aria-label="Dismiss error"
              icon={<span>✕</span>}
              size="xs"
              variant="ghost"
              color="red.400"
              onClick={() => setError(null)}
            />
          </HStack>
        </Box>
      )}

      {/* Messages scroll area */}
      <Box position="relative" flex="1" minH="0">
        <Box
          ref={scrollContainerRef}
          onScroll={handleScroll}
          h="full"
          overflowY="auto"
          px={{ base: '3', md: '4' }}
          py="4"
          bg={bgColor}
          css={{
            '::-webkit-scrollbar': { width: '6px' },
            '::-webkit-scrollbar-track': { background: 'transparent' },
            '::-webkit-scrollbar-thumb': { background: '#d1d5db', borderRadius: '3px' },
          }}
        >
          {messages.length === 0 ? (
            <Center h="full" minH="250px">
              <VStack spacing="4">
                <Box p="4" borderRadius="full" bg="teal.50" color="teal.400">
                  <MessageCircle size={40} />
                </Box>
                <VStack spacing="1">
                  <Text fontSize="md" fontWeight="600" color={textColor}>
                    No messages yet
                  </Text>
                  <Text fontSize="sm" color={subtextColor} textAlign="center">
                    Start the conversation for this service.
                  </Text>
                </VStack>
              </VStack>
            </Center>
          ) : (
            <AnimatePresence initial={false}>
              {renderItems.map((item) => {
                if (item.type === 'date') {
                  return <DateSeparator key={item.key} label={item.label} />;
                }
                return (
                  <MessageRow
                    key={item.key}
                    message={item.message}
                    isOwn={item.isOwn}
                    isFirstInGroup={item.isFirstInGroup}
                    isLastInGroup={item.isLastInGroup}
                  />
                );
              })}
            </AnimatePresence>
          )}
        </Box>

        {/* Scroll-to-bottom button */}
        {showScrollButton && (
          <IconButton
            aria-label="Scroll to latest"
            icon={<ArrowDown size={16} />}
            onClick={() => scrollToBottom('smooth')}
            position="absolute"
            bottom="4"
            left="50%"
            transform="translateX(-50%)"
            zIndex={10}
            size="sm"
            borderRadius="full"
            bg={cardBg}
            boxShadow="md"
            border="1px solid"
            borderColor={borderColor}
            color="gray.600"
            _hover={{ bg: 'gray.50' }}
          />
        )}
      </Box>

      {/* Input area */}
      <Box
        borderTop="1px solid"
        borderColor={borderColor}
        p={{ base: '3', md: '4' }}
        bg={cardBg}
      >
        <HStack spacing="2" align="end">
          <Box flex="1" position="relative">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              rows={1}
              maxLength={MAX_MESSAGE_LENGTH}
              isDisabled={sending}
              resize="none"
              bg={inputBg}
              border="1px solid"
              borderColor={inputBorder}
              borderRadius="xl"
              fontSize="sm"
              px="3.5"
              py="2.5"
              maxH="120px"
              _placeholder={{ color: 'gray.400' }}
              _focus={{
                borderColor: 'teal.400',
                boxShadow: '0 0 0 3px rgba(13, 148, 136, 0.15)',
              }}
            />
          </Box>
          <IconButton
            aria-label="Send message"
            icon={<Send size={18} />}
            onClick={handleSend}
            isDisabled={sending || !inputValue.trim()}
            isLoading={sending}
            w="44px"
            h="44px"
            borderRadius="xl"
            colorScheme="teal"
            flexShrink={0}
          />
        </HStack>
        {inputValue.length > MAX_MESSAGE_LENGTH * 0.8 && (
          <Text fontSize="xs" color="gray.400" mt="1" textAlign="right">
            {inputValue.length} / {MAX_MESSAGE_LENGTH}
          </Text>
        )}
      </Box>
    </Box>
  );
}