'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDemo } from '@/lib/demo/context';
import Avatar from '@/components/ui/Avatar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { formatRelativeDate, formatServiceDate } from '@/lib/formatDate';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box, Text, HStack, VStack, Flex, Spinner, Center, IconButton,
  Badge, useColorModeValue, Input, Textarea, Button,
  Menu, MenuButton, MenuList, MenuItem,
} from '@chakra-ui/react';
import {
  Send, MessageCircle, Smile, Hash, Users, MoreVertical, Pencil, Trash2, X, Check,
} from 'lucide-react';
import type { ChatMessagePopulated } from '@/lib/types';

function groupMessagesByDate(messages: ChatMessagePopulated[]) {
  const groups: { date: string; messages: ChatMessagePopulated[] }[] = [];
  messages.forEach((message) => {
    const messageDate = new Date(message.created_at).toDateString();
    const existingGroup = groups.find(g => g.date === messageDate);
    if (existingGroup) {
      existingGroup.messages.push(message);
    } else {
      groups.push({ date: messageDate, messages: [message] });
    }
  });
  return groups;
}

function formatDateHeader(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  else if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  else return formatServiceDate(dateString);
}

function shouldGroupWithPrevious(current: ChatMessagePopulated, previous: ChatMessagePopulated | null) {
  if (!previous) return false;
  if (current.user.id !== previous.user.id) return false;
  const currentTime = new Date(current.created_at).getTime();
  const previousTime = new Date(previous.created_at).getTime();
  return (currentTime - previousTime) < 2 * 60 * 1000;
}

function TypingIndicator() {
  return (
    <HStack spacing="1" px="2">
      <motion.span
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1, repeat: Infinity, delay: 0 }}
        style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0d9488', display: 'inline-block' }}
      />
      <motion.span
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
        style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0d9488', display: 'inline-block' }}
      />
      <motion.span
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
        style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0d9488', display: 'inline-block' }}
      />
    </HStack>
  );
}

function DateSeparator({ date }: { date: string }) {
  const bgColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.500', 'gray.400');
  return (
    <Flex align="center" my="4">
      <Box flex="1" h="1px" bg={bgColor} />
      <Text fontSize="xs" fontWeight="600" color={textColor} textTransform="uppercase" letterSpacing="wide" px="3">
        {formatDateHeader(date)}
      </Text>
      <Box flex="1" h="1px" bg={bgColor} />
    </Flex>
  );
}

function MessageBubble({
  message, isOwn, showAvatar, showName, isGrouped,
  onEdit, onDelete,
}: {
  message: ChatMessagePopulated;
  isOwn: boolean;
  showAvatar: boolean;
  showName: boolean;
  isGrouped: boolean;
  onEdit?: (id: string, content: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const ownBubbleBg = useColorModeValue('teal.500', 'teal.400');
  const otherBubbleBg = useColorModeValue('white', 'gray.700');
  const otherBubbleBorder = useColorModeValue('gray.200', 'gray.600');
  const ownTextColor = 'white';
  const otherTextColor = useColorModeValue('gray.800', 'white');
  const timeColor = useColorModeValue('gray.400', 'gray.500');
  const editBg = useColorModeValue('white', 'gray.700');
  const editBorder = useColorModeValue('gray.300', 'gray.500');

  // Client-only hover effect — avoids CSS class mismatch during hydration
  useEffect(() => {
    const btn = menuRef.current;
    const row = rowRef.current;
    if (!btn || !row) return;
    const show = () => { btn.style.opacity = '1'; };
    const hide = () => { btn.style.opacity = '0'; };
    if (isOwn) {
      row.addEventListener('mouseenter', show);
      row.addEventListener('mouseleave', hide);
    }
    return () => {
      row.removeEventListener('mouseenter', show);
      row.removeEventListener('mouseleave', hide);
    };
  }, [isOwn]);

  const handleSaveEdit = async () => {
    if (!editContent.trim() || !onEdit) return;
    setIsSaving(true);
    try {
      await onEdit(message.id, editContent.trim());
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(message.content || '');
    setIsEditing(false);
  };

  const hasBeenEdited = !!(message as any).updated_at;

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
            <Avatar name={message.user.name || 'Unknown'} size="sm" />
          )}
        </Box>

        <Flex ref={rowRef} align="end" gap="1" flex="1" minW="0" justify={isOwn ? 'flex-end' : 'flex-start'}>
          <VStack
            align={isOwn ? 'flex-end' : 'flex-start'}
            spacing="1"
            flex="1"
            minW="0"
          >
            {showName && (
              <HStack spacing="2" px="1">
                <Text fontSize="xs" fontWeight="600" color={isOwn ? 'teal.600' : 'gray.600'}>
                  {message.user.name || 'Unknown'}
                </Text>
                <Text fontSize="10px" color={timeColor}>
                  {formatRelativeDate(message.created_at)}
                </Text>
                {hasBeenEdited && (
                  <Text fontSize="10px" color={timeColor} fontStyle="italic">edited</Text>
                )}
              </HStack>
            )}

            {isEditing ? (
              <Box
                w="full"
                bg={editBg}
                borderRadius="2xl"
                border="1px solid"
                borderColor={editBorder}
                overflow="hidden"
                boxShadow="0 2px 12px rgba(0,0,0,0.08)"
              >
                <Flex
                  px="3"
                  py="1.5"
                  borderBottom="1px solid"
                  borderColor={editBorder}
                  align="center"
                  justify="space-between"
                >
                  <Text fontSize="xs" fontWeight="600" color={timeColor}>Editing</Text>
                  <HStack spacing="1">
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="red"
                      leftIcon={<X size={13} />}
                      onClick={handleCancelEdit}
                      px="2"
                      h="7"
                      fontSize="xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="xs"
                      colorScheme="teal"
                      leftIcon={<Check size={13} />}
                      onClick={handleSaveEdit}
                      isLoading={isSaving}
                      isDisabled={!editContent.trim()}
                      px="3"
                      h="7"
                      fontSize="xs"
                      fontWeight="600"
                    >
                      Save
                    </Button>
                  </HStack>
                </Flex>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  variant="unstyled"
                  px="4"
                  py="3"
                  fontSize="sm"
                  lineHeight="1.6"
                  minH="100px"
                  resize="none"
                  autoFocus
                  _placeholder={{ color: 'gray.400' }}
                />
              </Box>
            ) : (
              <Box
                px="4"
                py="2.5"
                borderRadius="2xl"
                bg={isOwn ? ownBubbleBg : otherBubbleBg}
                color={isOwn ? ownTextColor : otherTextColor}
                borderBottomRightRadius={isOwn ? 'sm' : '2xl'}
                borderBottomLeftRadius={isOwn ? '2xl' : 'sm'}
                boxShadow={isOwn
                  ? '0 2px 8px rgba(13, 148, 136, 0.25)'
                  : '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)'
                }
                border={isOwn ? 'none' : '1px solid'}
                borderColor={isOwn ? 'transparent' : otherBubbleBorder}
              >
                <Text fontSize="sm" lineHeight="1.5" whiteSpace="pre-wrap" wordBreak="break-word">
                  {message.content}
                </Text>

                {hasBeenEdited && !showName && (
                  <Text
                    fontSize="10px"
                    color={isOwn ? 'whiteAlpha.600' : timeColor}
                    fontStyle="italic"
                    textAlign={isOwn ? 'right' : 'left'}
                    mt="1"
                  >
                    edited
                  </Text>
                )}
              </Box>
            )}
          </VStack>

          {/* 3-dot menu — visible on hover for own messages via JS event listeners */}
          {(onEdit || onDelete) && (
            <Box ref={menuRef} opacity="0" transition="opacity 0.15s" flexShrink={0}>
              <Menu isLazy placement="bottom-end">
                <MenuButton
                  as={IconButton}
                  aria-label="Message options"
                  icon={<MoreVertical size={16} />}
                  size="xs"
                  variant="ghost"
                  colorScheme="gray"
                  borderRadius="full"
                />
                <MenuList minW="120px">
                  {onEdit && (
                    <MenuItem
                      icon={<Pencil size={15} />}
                      onClick={() => { setEditContent(message.content || ''); setIsEditing(true); }}
                    >
                      Edit
                    </MenuItem>
                  )}
                  {onDelete && (
                    <MenuItem
                      icon={<Trash2 size={15} />}
                      color="red.500"
                      onClick={() => setDeleteOpen(true)}
                    >
                      Delete
                    </MenuItem>
                  )}
                </MenuList>
              </Menu>
            </Box>
          )}
        </Flex>
      </Flex>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          if (!onDelete) return;
          await onDelete(message.id);
          setDeleteOpen(false);
        }}
        title="Delete Message"
        message="Are you sure you want to delete this message? This cannot be undone."
        confirmLabel="Delete"
      />
    </motion.div>
  );
}

export default function DemoChatPage() {
  const { user, church, chatMessages, createChatMessage, updateChatMessage, deleteChatMessage } = useDemo();
  const [messages, setMessages] = useState<ChatMessagePopulated[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const bgColor = useColorModeValue('gray.50', 'gray.800');
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const inputBg = useColorModeValue('gray.50', 'gray.700');
  const inputBorder = useColorModeValue('gray.200', 'gray.600');
  const headerBg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setMessages(chatMessages as ChatMessagePopulated[]);
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [chatMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user?.id || !church?.id || isSending) return;
    setIsSending(true);
    setIsTyping(true);
    try {
      createChatMessage({
        church_id: church.id,
        user_id: user.id,
        content: input.trim(),
      });
      setInput('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
      setTimeout(() => setIsTyping(false), 1500);
    }
  };

  const handleEdit = async (id: string, content: string) => {
    updateChatMessage(id, { content } as any);
    setMessages((prev) => prev.map((m) =>
      m.id === id ? { ...m, content, updated_at: new Date().toISOString() } as ChatMessagePopulated : m
    ));
  };

  const handleDelete = async (id: string) => {
    deleteChatMessage(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }, [input, isSending]);

  const messageGroups = groupMessagesByDate(messages);

  return (
    <Box
      px={{ base: '0', md: '4' }}
      pt={{ base: '2', md: '8' }}
      pb={{ base: '0', md: '4' }}
      maxW="900px"
      mx="auto"
      h={{ base: 'calc(100dvh - 48px - env(safe-area-inset-top) - 48px - env(safe-area-inset-bottom))', md: 'auto' }}
      display="flex"
      flexDirection="column"
    >
      <Box
        bg={headerBg}
        borderBottom="1px solid"
        borderColor={borderColor}
        p={{ base: '4', md: '0' }}
        pb={{ base: '4', md: '6' }}
        position={{ base: 'sticky', md: 'relative' }}
        top={{ base: '0', md: 'auto' }}
        zIndex="10"
      >
        <Flex justify="space-between" align="center">
          <HStack spacing="3">
            <Box p="2" borderRadius="lg" bg="teal.50" color="teal.600">
              <Hash size={20} />
            </Box>
            <Box>
              <Text fontSize="xl" fontWeight="bold" color={textColor} letterSpacing="tight">
                Team Chat
              </Text>
              <HStack spacing="2">
                <Box w="2" h="2" borderRadius="full" bg="green.400" />
                <Text fontSize="sm" color={subtextColor}>
                  {messages.length > 0
                    ? `${messages.filter((m, i, arr) => arr.findIndex(x => x.user.id === m.user.id) === i).length} members`
                    : 'Coordinate with your worship team'
                  }
                </Text>
              </HStack>
            </Box>
          </HStack>
          <HStack spacing="2">
            <Badge colorScheme="teal" variant="subtle" borderRadius="full" px="3" py="1" fontSize="xs" fontWeight="600">
              <HStack spacing="1">
                <Users size={12} />
                <Text>Demo</Text>
              </HStack>
            </Badge>
          </HStack>
        </Flex>
      </Box>

      <Box
        bg={cardBg}
        borderRadius={{ base: '0', md: 'xl' }}
        border={{ base: 'none', md: '1px solid' }}
        borderColor={borderColor}
        boxShadow={{ base: 'none', md: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
        overflow="hidden"
        display="flex"
        flexDirection="column"
        flex="1"
        minH={{ base: 'auto', md: 'calc(100dvh - 280px)' }}
        maxH={{ base: 'none', md: 'calc(100dvh - 280px)' }}
      >
        <Box
          ref={messagesContainerRef}
          flex="1"
          overflowY="auto"
          p={{ base: '4', md: '6' }}
          pb="4"
          bg={bgColor}
          css={{
            '::-webkit-scrollbar': { width: '6px' },
            '::-webkit-scrollbar-track': { background: 'transparent' },
            '::-webkit-scrollbar-thumb': { background: '#d1d5db', borderRadius: '3px' },
          }}
        >
          {isLoading ? (
            <Center h="full">
              <VStack spacing="3">
                <Spinner size="xl" color="teal.500" />
                <Text fontSize="sm" color={subtextColor}>Loading messages...</Text>
              </VStack>
            </Center>
          ) : messages.length === 0 ? (
            <Center h="full" minH="300px">
              <VStack spacing="4">
                <Box p="4" borderRadius="full" bg="teal.50" color="teal.400">
                  <MessageCircle size={48} />
                </Box>
                <VStack spacing="1">
                  <Text fontSize="lg" fontWeight="600" color={textColor}>Start the conversation</Text>
                  <Text fontSize="sm" color={subtextColor} textAlign="center" maxW="280px">
                    Send a message to coordinate with your worship team in real-time
                  </Text>
                </VStack>
              </VStack>
            </Center>
          ) : (
            <AnimatePresence initial={false}>
              {messageGroups.map((group, groupIndex) => (
                <Box key={group.date}>
                  <DateSeparator date={group.date} />
                  {group.messages.map((message, messageIndex) => {
                    const prevMessage = messageIndex > 0
                      ? group.messages[messageIndex - 1]
                      : (groupIndex > 0
                        ? messageGroups[groupIndex - 1].messages[messageGroups[groupIndex - 1].messages.length - 1]
                        : null);
                    const isGrouped = shouldGroupWithPrevious(message, prevMessage);
                    const showAvatar = !isGrouped;
                    const showName = !isGrouped;
                    const isOwn = message.user.id === user?.id;
                    return (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isOwn={isOwn}
                        showAvatar={showAvatar}
                        showName={showName}
                        isGrouped={isGrouped}
                        onEdit={isOwn ? handleEdit : undefined}
                        onDelete={isOwn ? handleDelete : undefined}
                      />
                    );
                  })}
                </Box>
              ))}
              {isTyping && (
                <Flex align="end" gap="2" mt="2">
                  <Box w="28px" h="28px" flexShrink={0}>
                    <Avatar name="Someone" size="sm" />
                  </Box>
                  <Box
                    px="4"
                    py="3"
                    borderRadius="2xl"
                    borderBottomLeftRadius="sm"
                    bg={cardBg}
                    border="1px solid"
                    borderColor={borderColor}
                    boxShadow="0 1px 3px rgba(0,0,0,0.08)"
                  >
                    <TypingIndicator />
                  </Box>
                </Flex>
              )}
              <div ref={messagesEndRef} />
            </AnimatePresence>
          )}
        </Box>

        <Box
          as="form"
          onSubmit={handleSend}
          borderTop="1px solid"
          borderColor={borderColor}
          p={{ base: '3', md: '4' }}
          bg={cardBg}
        >
          <HStack spacing="3">
            <Box position="relative" flex="1">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                size="md"
                h="48px"
                fontSize="md"
                bg={inputBg}
                border="1px solid"
                borderColor={inputBorder}
                borderRadius="xl"
                pr="12"
                _placeholder={{ color: 'gray.400' }}
                _focus={{ borderColor: 'teal.400', boxShadow: '0 0 0 3px rgba(13, 148, 136, 0.15)' }}
                disabled={isSending}
              />
              <IconButton
                aria-label="Add emoji"
                icon={<Smile size={20} />}
                variant="ghost"
                size="sm"
                position="absolute"
                right="2"
                top="50%"
                transform="translateY(-50%)"
                color="gray.400"
                _hover={{ color: 'teal.500', bg: 'teal.50' }}
              />
            </Box>
            <IconButton
              aria-label="Send message"
              type="submit"
              icon={<Send size={20} />}
              size="lg"
              w="48px"
              h="48px"
              borderRadius="xl"
              colorScheme="teal"
              disabled={!input.trim() || isSending}
              _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
              isLoading={isSending}
            />
          </HStack>
          <Text fontSize="xs" color="gray.400" mt="2" textAlign="center">Press Enter to send</Text>
        </Box>
      </Box>
    </Box>
  );
}
