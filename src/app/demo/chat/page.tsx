'use client';

import { useState, useEffect } from 'react';
import { useDemo } from '@/lib/demo/context';
import { useStore } from '@/lib/StoreContext';
import {
  Box, Text, HStack, VStack, Spinner, Center, useColorModeValue,
  useDisclosure, IconButton, Badge,
} from '@chakra-ui/react';
import { Hash, Menu, Users } from 'lucide-react';
import ClientOnly from '@/components/ui/ClientOnly';
import ChannelHeader from '@/components/chat/ChannelHeader';
import ChannelPillBar from '@/components/chat/ChannelPillBar';
import ChannelBottomSheet from '@/components/chat/ChannelBottomSheet';
import ChannelList from '@/components/chat/ChannelList';
import MessageList from '@/components/chat/MessageList';
import ChatInput from '@/components/chat/ChatInput';
import type { ChatChannel } from '@/lib/types';

export default function DemoChatPage() {
  const { user, church, chatChannels, chatMessages } = useDemo();
  const db = useStore();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const { isOpen: sheetOpen, onOpen: onSheetOpen, onClose: onSheetClose } = useDisclosure();

  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const bgColor = useColorModeValue('gray.50', 'gray.800');

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      const demoChannels = (chatChannels || []) as ChatChannel[];
      setChannels(demoChannels);
      if (demoChannels.length > 0) {
        setActiveChannel((prev) => {
          if (prev && demoChannels.find((c) => c.id === prev.id)) return prev;
          return demoChannels[0];
        });
      }
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [chatChannels]);

  useEffect(() => {
    if (!activeChannel) return;
    setIsLoadingMessages(true);
    const timer = setTimeout(() => {
      const channelMsgs = (chatMessages || []).filter(
        (m: any) => m.channel_id === activeChannel.id || !m.channel_id
      );
      setMessages(channelMsgs);
      setIsLoadingMessages(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [activeChannel, chatMessages]);

  const handleSend = async (content: string) => {
    if (!activeChannel || !user?.id) return;
    const newMsg = await db.channels.sendMessage(activeChannel.id, user.id, content);
    setMessages((prev) => [...prev, newMsg]);
  };

  const handleEdit = async (messageId: string, content: string) => {
    const updated = await db.channels.updateMessage(messageId, content);
    if (updated) {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: updated.content, updated_at: updated.updated_at } : m)));
    }
  };

  const handleDelete = async (messageId: string) => {
    const ok = await db.channels.deleteMessage(messageId);
    if (ok) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  };

  const handleReact = async (_messageId: string, _emoji: string) => {
    // Demo: no-op since reactions aren't persisted
  };

  if (isLoading) {
    return (
      <Center minH="80dvh">
        <VStack spacing="3">
          <Spinner size="xl" color="teal.500" />
          <Text fontSize="sm" color={subtextColor}>Loading channels...</Text>
        </VStack>
      </Center>
    );
  }

  return (
    <ClientOnly fallback={<Center minH="80dvh"><Spinner size="xl" color="teal.500" /></Center>}>
    <Box
      display="flex"
      flexDir="column"
      h={{ base: '100%', md: 'auto' }}
      maxW="900px"
      mx="auto"
      w="full"
      px={{ base: '0', md: '4' }}
      pt={{ base: '0', md: '8' }}
      pb={{ base: '0', md: '4' }}
    >
      <Box
        bg={cardBg}
        borderRadius={{ base: '0', md: 'xl' }}
        border={{ base: 'none', md: '1px solid' }}
        borderColor={borderColor}
        boxShadow={{ base: 'none', md: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
        overflow="hidden"
        display="flex"
        flexDir="column"
        flex="1"
        minH={{ base: 'auto', md: 'calc(100dvh - 280px)' }}
        maxH={{ base: 'none', md: 'calc(100dvh - 280px)' }}
      >
        {/* Mobile: channel bottom sheet */}
        <ChannelBottomSheet
          isOpen={sheetOpen}
          onClose={onSheetClose}
          channels={channels}
          activeChannelId={activeChannel?.id || null}
          onSelect={(ch) => setActiveChannel(ch)}
          canCreate={false}
          onCreateClick={() => {}}
        />

        {/* Mobile: channel navigation (hidden when keyboard is open) */}
        <Box className="chat-nav-area" display={{ base: 'block', lg: 'none' }}>
          {/* Mobile header with channel name + bottom sheet trigger */}
          <Box
            display="flex"
            borderBottom="1px solid"
            borderColor={borderColor}
            p="3"
            alignItems="center"
            onClick={onSheetOpen}
            cursor="pointer"
            _active={{ bg: useColorModeValue('gray.50', 'gray.700') }}
          >
            <IconButton
              aria-label="Open channels"
              icon={<Menu size={20} />}
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onSheetOpen(); }}
            />
            <HStack spacing="2" ml="2" flex="1">
              <Hash size={16} color="gray.400" />
              <Text fontWeight="600" fontSize="sm" color={textColor}>
                {activeChannel?.name || 'Select a channel'}
              </Text>
            </HStack>
            <Badge colorScheme="teal" variant="subtle" borderRadius="full" px="2" py="1" fontSize="xs">
              <HStack spacing="1">
                <Users size={12} />
                <Text>{channels.length}</Text>
              </HStack>
            </Badge>
          </Box>

          {/* Mobile: channel pill bar */}
          <ChannelPillBar
            channels={channels}
            activeChannelId={activeChannel?.id || null}
            onSelect={(ch) => setActiveChannel(ch)}
          />
        </Box>

        {/* Desktop: channel list sidebar */}
        <Box display={{ base: 'none', lg: 'flex' }} flex="1" overflow="hidden">
          <ChannelList
            channels={channels}
            activeChannelId={activeChannel?.id || null}
            onSelect={setActiveChannel}
            canCreate={false}
            onCreateClick={() => {}}
          />

          <Box display="flex" flexDir="column" flex="1" minW="0">
            {/* Desktop channel header */}
            {activeChannel && (
              <ChannelHeader channel={activeChannel} memberCount={messages.length > 0 ? [...new Set(messages.map((m) => m.user?.id))].length : 0} />
            )}

            {!activeChannel ? (
              <Center h="full" flex="1">
                <VStack spacing="4">
                  <Text fontSize="lg" fontWeight="600" color="gray.500">Select a channel</Text>
                </VStack>
              </Center>
            ) : (
              <>
                <MessageList
                  messages={messages}
                  reactions={{}}
                  currentUserId={user?.id || ''}
                  isLoading={isLoadingMessages}
                  onReact={handleReact}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
                <ChatInput
                  channelId={activeChannel.id}
                  userId={user?.id || ''}
                  onSend={handleSend}
                  onCreatePoll={async () => {}}
                />
              </>
            )}
          </Box>
        </Box>

        {/* Mobile: message area + input (shown outside the desktop flex) */}
        <Box display={{ base: 'flex', lg: 'none' }} flexDir="column" flex="1" minH="0">
          {!activeChannel ? (
            <Center h="full" flex="1">
              <VStack spacing="4">
                <Text fontSize="lg" fontWeight="600" color="gray.500">Select a channel</Text>
              </VStack>
            </Center>
          ) : (
            <>
              <MessageList
                messages={messages}
                reactions={{}}
                currentUserId={user?.id || ''}
                isLoading={isLoadingMessages}
                onReact={handleReact}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
              <ChatInput
                channelId={activeChannel.id}
                userId={user?.id || ''}
                onSend={handleSend}
                onCreatePoll={async () => {}}
              />
            </>
          )}
        </Box>
      </Box>
    </Box>
    </ClientOnly>
  );
}
