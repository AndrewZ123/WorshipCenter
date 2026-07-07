'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/lib/PermissionsContext';
import { db } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import {
  Box, Text, HStack, VStack, Flex, Spinner, Center, useColorModeValue,
  useDisclosure, useToast, Drawer, DrawerOverlay, DrawerContent, DrawerCloseButton, DrawerBody,
  Badge, IconButton, Button,
} from '@chakra-ui/react';
import { Menu, MessageCircle, Hash, Plus } from 'lucide-react';
import type { ChatChannel, ChatReaction, ChatChannelWithMeta, ChatChannelMessagePopulated } from '@/lib/types';
import ChannelList from '@/components/chat/ChannelList';
import ChannelHeader from '@/components/chat/ChannelHeader';
import ChannelInfo from '@/components/chat/ChannelInfo';
import ChannelPillBar from '@/components/chat/ChannelPillBar';
import ChannelBottomSheet from '@/components/chat/ChannelBottomSheet';
import MessageList from '@/components/chat/MessageList';
import ChatInput from '@/components/chat/ChatInput';
import ChannelCreateModal from '@/components/chat/ChannelCreateModal';

export default function ChatPage() {
  const { user, church } = useAuth();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reactions, setReactions] = useState<Record<string, ChatReaction[]>>({});
  const [channelMembers, setChannelMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [channelError, setChannelError] = useState(false);
  const { isOpen: drawerOpen, onOpen: onDrawerOpen, onClose: onDrawerClose } = useDisclosure();
  const { isOpen: sheetOpen, onOpen: onSheetOpen, onClose: onSheetClose } = useDisclosure();
  const { isOpen: createOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const bgColor = useColorModeValue('gray.50', 'gray.800');
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const toast = useToast();
  const permissions = usePermissions();

  const isAdmin = permissions.can('manage_chat');

  // Load channels — ref-based to avoid stale closures
  const activeChannelRef = useRef(activeChannel);
  activeChannelRef.current = activeChannel;

  const loadChannels = useCallback(async () => {
    if (!church?.id) return;
    try {
      const chs = await db.channels.getByChurch(church.id);
      if (chs.length === 0) {
        const general = await db.channels.getOrCreateGeneral(church.id);
        if (!general) {
          console.error('[Chat] Failed to create General channel');
          setChannelError(true);
          return;
        }
        setChannels([general]);
        setActiveChannel(general);
      } else {
        setChannels(chs);
        const current = activeChannelRef.current;
        if (!current || !chs.find(c => c.id === current.id)) {
          setActiveChannel(chs[0]);
        }
      }
    } catch (error) {
      console.error('[Chat] Failed to load channels:', error);
      setChannelError(true);
    } finally {
      setIsLoading(false);
    }
  }, [church?.id]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // Load messages and reactions for active channel
  const loadMessages = useCallback(async (channelId: string) => {
    if (!channelId) return;
    setIsLoadingMessages(true);
    try {
      const msgs = await db.channels.getMessages(channelId);
      setMessages(msgs);

      // Batch-load reactions for all messages
      if (msgs.length > 0) {
        const ids = msgs.map((m: any) => m.id);
        const { data: reactionData } = await supabase
          .from('chat_reactions')
          .select('*')
          .in('message_id', ids);
        const grouped: Record<string, ChatReaction[]> = {};
        for (const r of (reactionData || []) as ChatReaction[]) {
          if (!grouped[r.message_id]) grouped[r.message_id] = [];
          grouped[r.message_id].push(r);
        }
        setReactions(grouped);
      }
    } catch (error) {
      console.error('[Chat] Failed to load messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (activeChannel?.id) {
      loadMessages(activeChannel.id);
    }
  }, [activeChannel?.id]);

  // Load channel members
  const loadMembers = useCallback(async (channelId: string) => {
    if (!channelId || !church) return;
    try {
      const members = await db.channels.getMembers(channelId);
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email, avatar_url, role')
        .in('id', members.map(m => m.user_id));
      setChannelMembers(users || []);
    } catch {}
  }, [church]);

  useEffect(() => {
    if (activeChannel?.id) {
      loadMembers(activeChannel.id);
    }
  }, [activeChannel?.id]);

  // Subscribe to new messages
  useEffect(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (!activeChannel?.id) return;

    let timeoutId: NodeJS.Timeout | null = null;
    const unsub = db.channels.subscribe(
      activeChannel.id,
      (payload, event) => {
        if (payload.channel_id !== activeChannelRef.current?.id) return;
        if (event === 'INSERT') {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === payload.id);
            if (exists) return prev;
            return [...prev, payload];
          });
        } else if (event === 'UPDATE') {
          setMessages((prev) => prev.map((m) => m.id === payload.id ? { ...m, content: payload.content, updated_at: payload.updated_at } : m));
        } else if (event === 'DELETE') {
          setMessages((prev) => prev.filter((m) => m.id !== payload.id));
        }
      },
      () => {
        setChannelError(true);
        // Fallback polling
        const id = activeChannel.id;
        timeoutId = setInterval(async () => {
          const msgs = await db.channels.getMessages(id);
          setMessages(msgs);
        }, 30000);
      }
    );
    unsubscribeRef.current = () => {
      unsub();
      if (timeoutId) clearInterval(timeoutId);
    };

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [activeChannel?.id]);

  const handleSend = async (content: string) => {
    if (!activeChannel || !user?.id) return;
    const newMsg = await db.channels.sendMessage(activeChannel.id, user.id, content);
    setMessages((prev) => [...prev, newMsg]);
  };

  const handleEdit = async (messageId: string, content: string) => {
    try {
      const updated = await db.channels.updateMessage(messageId, content);
      if (updated) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: updated.content, updated_at: updated.updated_at } : m)));
      }
    } catch {
      toast({ title: 'Failed to edit message', status: 'error', duration: 3000 });
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      const ok = await db.channels.deleteMessage(messageId);
      if (ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } catch {
      toast({ title: 'Failed to delete message', status: 'error', duration: 3000 });
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!user?.id) return;
    // Toggle: if already reacted with this emoji, remove it
    const existing = (reactions[messageId] || []).find(
      (r) => r.user_id === user.id && r.emoji === emoji
    );
    if (existing) {
      await db.channels.removeReaction(messageId, user.id, emoji);
      setReactions((prev) => ({
        ...prev,
        [messageId]: (prev[messageId] || []).filter(
          (r) => !(r.user_id === user.id && r.emoji === emoji)
        ),
      }));
    } else {
      const newReaction = await db.channels.addReaction(messageId, user.id, emoji);
      setReactions((prev) => ({
        ...prev,
        [messageId]: [...(prev[messageId] || []), newReaction],
      }));
    }
  };

  const handleCreatePoll = async (question: string, options: string[], isMultipleChoice: boolean) => {
    if (!activeChannel || !user?.id) return;
    await db.channels.createPoll(activeChannel.id, user.id, question, options, isMultipleChoice);
  };

  const handleVotePoll = async (pollId: string, userId: string, optionIndex: number) => {
    return db.channels.votePoll(pollId, userId, optionIndex);
  };

  const handleClosePoll = async (pollId: string) => {
    await db.channels.closePoll(pollId);
  };

  const handleUpdatePoll = async (pollId: string, updates: { question?: string; options?: string[]; is_closed?: boolean }) => {
    return db.channels.updatePoll(pollId, updates);
  };

  const handleChannelCreated = async () => {
    await loadChannels();
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

  if (channelError && channels.length === 0) {
    return (
      <Center minH="80dvh">
        <VStack spacing="4">
          <MessageCircle size={48} color="gray.300" />
          <Text fontSize="lg" fontWeight="600" color="gray.500">Chat isn't set up yet</Text>
          <Text fontSize="sm" color={subtextColor} textAlign="center" maxW="300px">
            No channels found. An admin needs to create the first channel to get started.
          </Text>
          {isAdmin && (
            <Button colorScheme="teal" size="sm" leftIcon={<Plus size={16} />} onClick={onCreateOpen}>
              Create Channel
            </Button>
          )}
        </VStack>
      </Center>
    );
  }

  return (
    <Box display="flex" flexDir="column" h="100%">
      {/* Mobile channel drawer (desktop-style, kept for fallback) */}
      <Drawer isOpen={drawerOpen} placement="left" onClose={onDrawerClose} size="xs">
        <DrawerOverlay bg="blackAlpha.300" backdropFilter="blur(4px)" />
        <DrawerContent maxW="240px">
          <DrawerCloseButton />
          <DrawerBody p="0">
            <ChannelList
              channels={channels}
              activeChannelId={activeChannel?.id || null}
              onSelect={(ch) => { setActiveChannel(ch); onDrawerClose(); }}
              canCreate={isAdmin}
              onCreateClick={() => { onCreateOpen(); onDrawerClose(); }}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Mobile channel bottom sheet */}
      <ChannelBottomSheet
        isOpen={sheetOpen}
        onClose={onSheetClose}
        channels={channels}
        activeChannelId={activeChannel?.id || null}
        onSelect={(ch) => setActiveChannel(ch)}
        canCreate={isAdmin}
        onCreateClick={onCreateOpen}
      />

      <Box display="flex" flex="1" overflow="hidden" bg={cardBg} borderRadius={{ base: '0', md: 'xl' }} border={{ base: 'none', md: '1px solid' }} borderColor={borderColor} m={{ base: '0', md: '4' }}>
        {/* Desktop Channel List */}
        <Box display={{ base: 'none', lg: 'block' }}>
          <ChannelList
            channels={channels}
            activeChannelId={activeChannel?.id || null}
            onSelect={setActiveChannel}
            canCreate={isAdmin}
            onCreateClick={onCreateOpen}
          />
        </Box>

        {/* Main Chat Area */}
        <Box display="flex" flexDir="column" flex="1" minW="0">
          {/* Mobile: channel navigation (hidden when keyboard is open) */}
          <Box className="chat-nav-area" display={{ base: 'block', lg: 'none' }}>
            <Box display="flex" borderBottom="1px solid" borderColor={borderColor} p="3" alignItems="center" onClick={onSheetOpen} cursor="pointer" _active={{ bg: useColorModeValue('gray.50', 'gray.700') }}>
              <IconButton
                aria-label="Open channels"
                icon={<Menu size={20} />}
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onSheetOpen(); }}
              />
              <HStack spacing="2" ml="2" flex="1">
                {activeChannel?.is_announcement ? (
                  <Badge colorScheme="orange" variant="subtle" borderRadius="full" px="2" fontSize="xs">
                    Announcement
                  </Badge>
                ) : (
                  <Hash size={16} color="gray.400" />
                )}
                <Text fontWeight="600" fontSize="sm">{activeChannel?.name || 'Select a channel'}</Text>
              </HStack>
            </Box>

            <ChannelPillBar
              channels={channels}
              activeChannelId={activeChannel?.id || null}
              onSelect={(ch) => setActiveChannel(ch)}
            />
          </Box>

          {/* Content area */}
          <Box flex="1" display="flex" flexDir="column" minH="0" position="relative">
              {!activeChannel ? (
                <Center h="full" flex="1">
                  <VStack spacing="4">
                    <MessageCircle size={48} color="gray.300" />
                    <Text fontSize="lg" fontWeight="600" color="gray.500">Select a channel</Text>
                  </VStack>
                </Center>
              ) : (
                <>
                  <Box display={{ base: 'none', lg: 'block' }}>
                    <ChannelHeader channel={activeChannel} memberCount={channelMembers.length} />
                  </Box>
                  <MessageList
                messages={messages}
                reactions={reactions}
                currentUserId={user?.id || ''}
                isLoading={isLoadingMessages}
                onReact={handleReact}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onVotePoll={handleVotePoll}
                onClosePoll={handleClosePoll}
                onUpdatePoll={handleUpdatePoll}
              />
              <ChatInput
                channelId={activeChannel.id}
                userId={user?.id || ''}
                onSend={handleSend}
                onCreatePoll={handleCreatePoll}
                isAnnouncement={activeChannel.is_announcement}
                canPost={isAdmin}
              />
            </>
          )}
        </Box>
        </Box>

        {/* Desktop Channel Info */}
        {activeChannel && (
          <ChannelInfo
            channel={activeChannel}
            members={channelMembers}
            isAdmin={isAdmin}
            churchId={church?.id}
            onUpdateChannel={(id, updates) => {
              if (!church?.id) return;
              db.channels.update(id, church.id, updates).then((updated) => {
                if (updated) {
                  setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
                  setActiveChannel((prev) => (prev?.id === id ? { ...prev, ...updated } : prev));
                }
              });
            }}
            onDeleteChannel={(id) => {
              if (!church?.id) return;
              db.channels.delete(id, church.id).then((ok) => {
                if (ok) {
                  setChannels((prev) => {
                    const idx = prev.findIndex((c) => c.id === id);
                    const filtered = prev.filter((c) => c.id !== id);
                    setActiveChannel((current) => {
                      if (current?.id !== id) return current;
                      if (filtered.length === 0) return null;
                      if (idx > 0) return filtered[Math.min(idx - 1, filtered.length - 1)];
                      return filtered[0];
                    });
                    return filtered;
                  });
                }
              });
            }}
            onMembersChanged={(channelId) => loadMembers(channelId)}
          />
        )}
      </Box>

      <ChannelCreateModal
        isOpen={createOpen}
        onClose={onCreateClose}
        churchId={church?.id || ''}
        userId={user?.id || ''}
        onCreated={handleChannelCreated}
      />
    </Box>
  );
}
