'use client';

import { useState } from 'react';
import {
  Box, Flex, VStack, HStack, Text, useColorModeValue, IconButton, Textarea, Button,
  Menu, MenuButton, MenuList, MenuItem,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { MoreVertical, Pencil, Trash2, X, Check } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
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
  onEdit?: (messageId: string, content: string) => Promise<void>;
  onDelete?: (messageId: string) => Promise<void>;
  onVotePoll?: (pollId: string, userId: string, optionIndex: number) => Promise<any>;
  onClosePoll?: (pollId: string) => Promise<void>;
  onUpdatePoll?: (pollId: string, updates: { question?: string; options?: string[]; is_closed?: boolean }) => Promise<any>;
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
  message, isOwn, showAvatar, showName, isGrouped, reactions, currentUserId,
  onReact, onEdit, onDelete, onVotePoll, onClosePoll, onUpdatePoll,
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const ownBubbleBg = useColorModeValue('teal.500', 'teal.400');
  const otherBubbleBg = useColorModeValue('white', 'gray.700');
  const otherBubbleBorder = useColorModeValue('gray.200', 'gray.600');
  const timeColor = useColorModeValue('gray.400', 'gray.500');
  const editBg = useColorModeValue('white', 'gray.700');
  const editBorder = useColorModeValue('gray.300', 'gray.500');

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

  const handleDelete = async () => {
    if (!onDelete) return;
    await onDelete(message.id);
    setDeleteOpen(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    }
  };

  const hasBeenEdited = !!message.updated_at;

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

        <Flex role="group" align="end" gap="1" flex="1" minW="0" justify={isOwn ? 'flex-end' : 'flex-start'}>
          <VStack align={isOwn ? 'flex-end' : 'flex-start'} spacing="1" flex="1" minW="0">
            {showName && (
              <HStack spacing="2" px="1">
                <Text fontSize="xs" fontWeight="600" color={isOwn ? 'teal.600' : 'gray.600'}>
                  {message.user?.name || 'Unknown'}
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
                  onKeyDown={handleEditKeyDown}
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
                color={isOwn ? 'white' : undefined}
                borderBottomRightRadius={isOwn ? 'sm' : '2xl'}
                borderBottomLeftRadius={isOwn ? '2xl' : 'sm'}
                boxShadow={isOwn ? '0 2px 8px rgba(13, 148, 136, 0.25)' : '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)'}
                border={isOwn ? 'none' : '1px solid'}
                borderColor={isOwn ? 'transparent' : otherBubbleBorder}
              >
                <MarkdownRenderer content={message.content} color={isOwn ? 'white' : undefined} />
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

            {message.poll_id && onVotePoll && (
              <Box w="full">
                <PollRenderer
                  pollId={message.poll_id}
                  userId={currentUserId}
                  channelId={message.channel_id}
                  onVotePoll={onVotePoll}
                  onClosePoll={onClosePoll}
                  onUpdatePoll={onUpdatePoll}
                />
              </Box>
            )}

            {reactions.length > 0 && !isEditing && (
              <Box px="1">
                <ReactionBar
                  reactions={getReactionSummary(reactions, currentUserId)}
                  onReact={(emoji) => onReact(message.id, emoji)}
                />
              </Box>
            )}
          </VStack>

          {(onEdit || onDelete) && (
            <Box opacity="0" _groupHover={{ opacity: 1 }} transition="opacity 0.15s" flexShrink={0}>
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
        onConfirm={handleDelete}
        title="Delete Message"
        message="Are you sure you want to delete this message? This cannot be undone."
        confirmLabel="Delete"
      />
    </motion.div>
  );
}
