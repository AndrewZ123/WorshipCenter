'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/store';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import { formatRelativeDate, formatServiceDate } from '@/lib/formatDate';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box, Text, HStack, VStack, Flex, Spinner, Center, IconButton,
  Badge, SlideFade, useColorModeValue, Input, InputGroup, InputRightElement
} from '@chakra-ui/react';
import { 
  Send, MessageCircle, Smile, Hash, Users, MoreVertical,
  Check, CheckCheck
} from 'lucide-react';
import type { ChatMessagePopulated } from '@/lib/types';

// Helper to group messages by date
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

// Helper to format date header
function formatDateHeader(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return formatServiceDate(dateString);
  }
}

// Helper to check if messages should be grouped (same user within 2 minutes)
function shouldGroupWithPrevious(current: ChatMessagePopulated, previous: ChatMessagePopulated | null) {
  if (!previous) return false;
  if (current.user?.id !== previous.user?.id) return false;
  
  const currentTime = new Date(current.created_at).getTime();
  const previousTime = new Date(previous.created_at).getTime();
  
  return (currentTime - previousTime) < 2 * 60 * 1000; // 2 minutes
}

// Typing indicator dots animation component
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

// Date separator component
function DateSeparator({ date }: { date: string }) {
  const bgColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.500', 'gray.400');
  
  return (
    <Flex align="center" my="4">
      <Box flex="1" h="1px" bg={bgColor} />
      <Text
        fontSize="xs"
        fontWeight="600"
        color={textColor}
        textTransform="uppercase"
        letterSpacing="wide"
        px="3"
      >
        {formatDateHeader(date)}
      </Text>
      <Box flex="1" h="1px" bg={bgColor} />
    </Flex>
  );
}

// Message bubble component
function MessageBubble({ 
  message, 
  isOwn, 
  showAvatar, 
  showName,
  isGrouped 
}: { 
  message: ChatMessagePopulated; 
  isOwn: boolean;
  showAvatar: boolean;
  showName: boolean;
  isGrouped: boolean;
}) {
  const ownBubbleBg = useColorModeValue('teal.500', 'teal.400');
  const otherBubbleBg = useColorModeValue('white', 'gray.700');
  const otherBubbleBorder = useColorModeValue('gray.200', 'gray.600');
  const ownTextColor = 'white';
  const otherTextColor = useColorModeValue('gray.800', 'white');
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
        {/* Avatar space - show or keep space for alignment */}
        <Box w="28px" h="28px" flexShrink={0}>
          {showAvatar && (
            <Avatar
              name={message.user?.name || 'Unknown'}
              src={message.user?.avatar_url}
              size="sm"
            />
          )}
        </Box>
        
        <VStack 
          align={isOwn ? 'flex-end' : 'flex-start'} 
          spacing="1"
          maxW={{ base: '75%', md: '65%' }}
          flex="1"
        >
          {/* Name and time - only show if not grouped */}
          {showName && (
            <HStack spacing="2" px="1">
              <Text 
                fontSize="xs" 
                fontWeight="600"
                color={isOwn ? 'teal.600' : 'gray.600'}
              >
                {message.user?.name || 'Unknown'}
              </Text>
              <Text fontSize="10px" color={timeColor}>
                {formatRelativeDate(message.created_at)}
              </Text>
            </HStack>
          )}
          
          {/* Message bubble */}
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
            position="relative"
            _hover={{
              '& .timestamp': {
                opacity: 1,
              }
            }}
          >
            <Text fontSize="sm" lineHeight="1.5" whiteSpace="pre-wrap" wordBreak="break-word">
              {message.content}
            </Text>
            
            {/* Hover timestamp */}
            <Box
              className="timestamp"
              position="absolute"
              {...(isOwn ? { left: '-50px' } : { right: '-50px' })}
              bottom="50%"
              transform="translateY(50%)"
              opacity="0"
              transition="opacity 0.15s"
            >
              <Text fontSize="10px" color={timeColor} whiteSpace="nowrap">
                {new Date(message.created_at).toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </Text>
            </Box>
          </Box>
        </VStack>
      </Flex>
    </motion.div>
  );
}

export default function ChatPage() {
  const { user, church } = useAuth();
  const [messages, setMessages] = useState<ChatMessagePopulated[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Color mode values
  const bgColor = useColorModeValue('gray.50', 'gray.800');
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const inputBg = useColorModeValue('gray.50', 'gray.700');
  const inputBorder = useColorModeValue('gray.200', 'gray.600');
  const headerBg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  // Load initial messages
  useEffect(() => {
    async function loadMessages() {
      if (!church?.id) return;
      setIsLoading(true);
      try {
        const chatMessages = await db.chat.getByChurch(church.id);
        setMessages(chatMessages);
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadMessages();
  }, [church?.id]);

  // Subscribe to new messages
  useEffect(() => {
    if (!church?.id) return;
    
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    setConnectionError(false);
    
    const unsubscribe = db.chat.subscribe(
      church.id, 
      (newMessage) => {
        // Only add message if it doesn't already exist (prevents duplicates when sender)
        setMessages((prev) => {
          const exists = prev.some(m => m.id === newMessage.id);
          if (exists) return prev;
          return [...prev, newMessage];
        });
        // Show typing indicator briefly when receiving a message from someone else
        if (newMessage.user?.id !== user?.id) {
          setIsTyping(true);
          setTimeout(() => setIsTyping(false), 1000);
        }
      },
      (error) => {
        console.warn('[Chat] WebSocket failed, falling back to polling:', error);
        setConnectionError(true);
        
        // Start polling for new messages every 30 seconds
        pollingIntervalRef.current = setInterval(async () => {
          try {
            const chatMessages = await db.chat.getByChurch(church.id);
            // Only update if we have new messages
            if (chatMessages.length > messages.length) {
              setMessages(chatMessages);
            }
          } catch (pollError) {
            console.error('[Chat] Polling error:', pollError);
          }
        }, 30000);
      }
    );

    return () => {
      unsubscribe();
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [church?.id, user?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user?.id || !church?.id || isSending) return;

    const messageContent = input.trim();
    setIsSending(true);
    
    try {
      const newMessage = await db.chat.create({
        church_id: church.id,
        user_id: user.id,
        content: messageContent,
      });
      
      // Immediately add message to state so the sender sees it right away
      setMessages((prev) => [...prev, newMessage]);
      setInput('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Enter key to send
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }, [input, isSending]);

  // Group messages by date
  const messageGroups = groupMessagesByDate(messages);

  return (
    <Box 
      p={{ base: '0', md: '4' }} 
      maxW="900px" 
      mx="auto" 
      h={{ base: 'calc(100vh - 56px)', md: 'auto' }}
      display="flex"
      flexDirection="column"
    >
      {/* Header */}
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
            <Box
              p="2"
              borderRadius="lg"
              bg="teal.50"
              color="teal.600"
            >
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
                    ? `${messages.filter((m, i, arr) => arr.findIndex(x => x.user?.id === m.user?.id) === i).length} members`
                    : 'Coordinate with your worship team'
                  }
                </Text>
              </HStack>
            </Box>
          </HStack>
          
          {/* Header actions */}
          <HStack spacing="2">
            {connectionError && (
              <Badge 
                colorScheme="orange" 
                variant="subtle" 
                borderRadius="full"
                px="3"
                py="1"
                fontSize="xs"
                fontWeight="600"
              >
                <HStack spacing="1">
                  <Text>Syncing every 30s</Text>
                </HStack>
              </Badge>
            )}
            {!connectionError && (
              <Badge 
                colorScheme="teal" 
                variant="subtle" 
                borderRadius="full"
                px="3"
                py="1"
                fontSize="xs"
                fontWeight="600"
              >
                <HStack spacing="1">
                  <Users size={12} />
                  <Text>Live</Text>
                </HStack>
              </Badge>
            )}
          </HStack>
        </Flex>
      </Box>

      {/* Chat Container */}
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
        minH={{ base: 'auto', md: 'calc(100vh - 280px)' }}
        maxH={{ base: 'calc(100vh - 180px)', md: 'calc(100vh - 280px)' }}
      >
        {/* Messages Area */}
        <Box 
          ref={messagesContainerRef}
          flex="1" 
          overflowY="auto" 
          p={{ base: '4', md: '6' }}
          pb="4"
          bg={bgColor}
          css={{
            '::-webkit-scrollbar': {
              width: '6px',
            },
            '::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '::-webkit-scrollbar-thumb': {
              background: '#d1d5db',
              borderRadius: '3px',
            },
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
                <Box
                  p="4"
                  borderRadius="full"
                  bg="teal.50"
                  color="teal.400"
                >
                  <MessageCircle size={48} />
                </Box>
                <VStack spacing="1">
                  <Text fontSize="lg" fontWeight="600" color={textColor}>
                    Start the conversation
                  </Text>
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
                    const isOwn = message.user?.id === user?.id;
                    
                    return (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isOwn={isOwn}
                        showAvatar={showAvatar}
                        showName={showName}
                        isGrouped={isGrouped}
                      />
                    );
                  })}
                </Box>
              ))}
              
              {/* Typing indicator */}
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

        {/* Input Area */}
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
                _focus={{
                  borderColor: 'teal.400',
                  boxShadow: '0 0 0 3px rgba(13, 148, 136, 0.15)',
                }}
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
              _disabled={{
                opacity: 0.5,
                cursor: 'not-allowed',
              }}
              isLoading={isSending}
            />
          </HStack>
          
          <Text fontSize="xs" color="gray.400" mt="2" textAlign="center">
            Press Enter to send
          </Text>
        </Box>
      </Box>
    </Box>
  );
}