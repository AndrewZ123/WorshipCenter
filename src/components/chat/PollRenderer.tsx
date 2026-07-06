'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, VStack, Text, useColorModeValue, Flex, IconButton, HStack,
  Button, Textarea,
} from '@chakra-ui/react';
import { Check, Lock, Pencil, X, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ChatPoll, ChatPollVote } from '@/lib/types';

interface PollRendererProps {
  pollId: string;
  userId: string;
  channelId: string;
  onVotePoll: (pollId: string, userId: string, optionIndex: number) => Promise<any>;
  onClosePoll?: (pollId: string) => Promise<void>;
  onUpdatePoll?: (pollId: string, updates: { question?: string; options?: string[]; is_closed?: boolean }) => Promise<any>;
}

export default function PollRenderer({
  pollId, userId, channelId, onVotePoll, onClosePoll, onUpdatePoll,
}: PollRendererProps) {
  const [poll, setPoll] = useState<ChatPoll | null>(null);
  const [votes, setVotes] = useState<ChatPollVote[]>([]);
  const [userVotes, setUserVotes] = useState<Set<number>>(new Set());
  const [voting, setVoting] = useState<number | null>(null);
  const [isEditingPoll, setIsEditingPoll] = useState(false);
  const [editQuestion, setEditQuestion] = useState('');
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [savingPoll, setSavingPoll] = useState(false);

  const cardBg = useColorModeValue('gray.50', 'gray.700');
  const optionBg = useColorModeValue('white', 'gray.600');
  const optionHover = useColorModeValue('gray.100', 'gray.500');
  const selectedBorder = useColorModeValue('teal.400', 'teal.300');
  const barFill = useColorModeValue('teal.100', 'teal.700');
  const barTrack = useColorModeValue('gray.100', 'gray.600');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const selectedTextColor = useColorModeValue('teal.800', 'teal.200');
  const editBg = useColorModeValue('white', 'gray.700');
  const editBorder = useColorModeValue('gray.300', 'gray.600');

  const isCreator = poll?.user_id === userId;

  const loadData = useCallback(async () => {
    const { data: p } = await supabase
      .from('chat_polls')
      .select('*')
      .eq('id', pollId)
      .single();
    const { data: v } = await supabase
      .from('chat_poll_votes')
      .select('*')
      .eq('poll_id', pollId);
    if (p) {
      setPoll(p);
      setEditQuestion(p.question);
      setEditOptions([...p.options]);
    }
    if (v) {
      setVotes(v);
      const uv = new Set<number>();
      v.forEach((vote: ChatPollVote) => {
        if (vote.user_id === userId) uv.add(vote.option_index);
      });
      setUserVotes(uv);
    }
  }, [pollId, userId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Live vote updates
  useEffect(() => {
    const channel = supabase
      .channel(`poll-votes:${pollId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_poll_votes', filter: `poll_id=eq.${pollId}` },
        () => { loadData(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pollId, loadData]);

  if (!poll) return null;

  const totalVotes = votes.length;

  const getPercentage = (index: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes.filter(v => v.option_index === index).length / totalVotes) * 100);
  };

  const handleVote = async (optionIndex: number) => {
    if (!poll || poll.is_closed || voting !== null) return;

    if (!poll.is_multiple_choice && userVotes.has(optionIndex)) {
      return;
    }
    if (poll.is_multiple_choice && userVotes.has(optionIndex)) {
      setVoting(optionIndex);
      try {
        await supabase
          .from('chat_poll_votes')
          .delete()
          .eq('poll_id', pollId)
          .eq('user_id', userId)
          .eq('option_index', optionIndex);
        await loadData();
      } catch (e) {
        console.error('[Poll] Unvote error:', e);
      } finally {
        setVoting(null);
      }
      return;
    }

    setVoting(optionIndex);
    try {
      if (!poll.is_multiple_choice) {
        await supabase
          .from('chat_poll_votes')
          .delete()
          .eq('poll_id', pollId)
          .eq('user_id', userId);
      }
      await onVotePoll(pollId, userId, optionIndex);
      await loadData();
    } catch (e) {
      console.error('[Poll] Vote error:', e);
    } finally {
      setVoting(null);
    }
  };

  const handleClosePoll = async () => {
    if (!onClosePoll) return;
    await onClosePoll(pollId);
    await loadData();
  };

  const handleSaveEdit = async () => {
    if (!editQuestion.trim() || editOptions.length < 2 || !onUpdatePoll) return;
    setSavingPoll(true);
    try {
      await onUpdatePoll(pollId, {
        question: editQuestion.trim(),
        options: editOptions,
      });
      setIsEditingPoll(false);
      await loadData();
    } finally {
      setSavingPoll(false);
    }
  };

  const updateOption = (index: number, value: string) => {
    setEditOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  return (
    <Box
      mt="3"
      borderRadius="lg"
      border="1px solid"
      borderColor={borderColor}
      overflow="hidden"
    >
      {/* Header */}
      <Box px="4" pt="3" pb="2" bg={cardBg}>
        <Flex justify="space-between" align="flex-start">
          <Text fontSize="sm" fontWeight="600" color={textColor} lineHeight="1.4" flex="1">
            📊 {poll.question}
          </Text>
          {isCreator && !poll.is_closed && onClosePoll && !isEditingPoll && (
            <IconButton
              aria-label="Close poll"
              icon={<Lock size={14} />}
              size="xs"
              variant="ghost"
              colorScheme="orange"
              ml="2"
              onClick={handleClosePoll}
            />
          )}
          {isCreator && onUpdatePoll && !isEditingPoll && totalVotes === 0 && (
            <IconButton
              aria-label="Edit poll"
              icon={<Pencil size={14} />}
              size="xs"
              variant="ghost"
              colorScheme="gray"
              onClick={() => setIsEditingPoll(true)}
            />
          )}
        </Flex>
      </Box>

      {/* Options or Edit Mode */}
      <Box px="4" pb="3" bg={cardBg}>
        {isEditingPoll ? (
          <VStack spacing="3" align="stretch">
            <Box>
              <Text fontSize="xs" fontWeight="600" color={subtextColor} mb="1">Question</Text>
              <Textarea
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
                bg={editBg}
                border="1px solid"
                borderColor={editBorder}
                borderRadius="md"
                fontSize="sm"
                rows={2}
              />
            </Box>
            <Box>
              <Text fontSize="xs" fontWeight="600" color={subtextColor} mb="1">Options</Text>
              {totalVotes > 0 && (
                <Text fontSize="xs" color="orange.500" mb="2" fontStyle="italic">
                  Options can't be edited after votes are cast
                </Text>
              )}
              <VStack spacing="2">
                {editOptions.map((opt, i) => (
                  <HStack key={i} w="full" spacing="2">
                    <Box flex="1">
                      <Textarea
                        value={opt}
                        onChange={(e) => updateOption(i, e.target.value)}
                        bg={editBg}
                        border="1px solid"
                        borderColor={editBorder}
                        borderRadius="md"
                        fontSize="sm"
                        rows={1}
                        minH="36px"
                        py="2"
                        isDisabled={totalVotes > 0}
                      />
                    </Box>
                    {editOptions.length > 2 && !(totalVotes > 0) && (
                      <IconButton
                        aria-label="Remove option"
                        icon={<X size={14} />}
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => setEditOptions((prev) => prev.filter((_, idx) => idx !== i))}
                      />
                    )}
                  </HStack>
                ))}
              </VStack>
            </Box>
            <HStack spacing="2" justify="flex-end">
              <Button size="xs" variant="ghost" onClick={() => { setIsEditingPoll(false); setEditQuestion(poll.question); setEditOptions([...poll.options]); }}>
                Cancel
              </Button>
              <Button
                size="xs"
                colorScheme="teal"
                leftIcon={<Save size={14} />}
                onClick={handleSaveEdit}
                isLoading={savingPoll}
                isDisabled={!editQuestion.trim() || editOptions.length < 2}
              >
                Save
              </Button>
            </HStack>
          </VStack>
        ) : (
          <VStack spacing="2" align="stretch">
            {poll.options.map((option, i) => {
              const pct = getPercentage(i);
              const count = votes.filter(v => v.option_index === i).length;
              const isSelected = userVotes.has(i);

              return (
                <Box
                  key={i}
                  position="relative"
                  borderRadius="md"
                  overflow="hidden"
                  border="2px solid"
                  borderColor={isSelected ? selectedBorder : 'transparent'}
                  bg={optionBg}
                  cursor={poll.is_closed ? 'default' : 'pointer'}
                  opacity={voting === i ? 0.5 : 1}
                  transition="all 0.15s"
                  _hover={!poll.is_closed ? { bg: optionHover } : undefined}
                  onClick={() => handleVote(i)}
                >
                  <Box
                    position="absolute"
                    top="0"
                    left="0"
                    h="full"
                    w={`${pct}%`}
                    bg={barFill}
                    transition="width 0.4s ease"
                    borderRadius="md"
                    pointerEvents="none"
                  />
                  <Flex
                    position="relative"
                    align="center"
                    gap="2.5"
                    px="3"
                    py="2.5"
                    minH="40px"
                  >
                    <Flex
                      w="5"
                      h="5"
                      borderRadius="full"
                      border="2px solid"
                      borderColor={isSelected ? 'teal.400' : 'gray.300'}
                      align="center"
                      justify="center"
                      flexShrink={0}
                      bg={isSelected ? 'teal.400' : 'transparent'}
                      transition="all 0.15s"
                    >
                      {isSelected && <Check size={12} color="white" strokeWidth={3} />}
                    </Flex>
                    <Text
                      fontSize="sm"
                      fontWeight={isSelected ? '600' : '500'}
                      color={isSelected ? selectedTextColor : textColor}
                      flex="1"
                      lineHeight="1.4"
                    >
                      {option}
                    </Text>
                    <Text
                      fontSize="xs"
                      fontWeight="600"
                      color={isSelected ? 'teal.600' : subtextColor}
                      flexShrink={0}
                      sx={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {pct}%
                    </Text>
                  </Flex>
                </Box>
              );
            })}
          </VStack>
        )}

        {/* Footer */}
        {!isEditingPoll && (
          <Flex justify="space-between" align="center" mt="2.5">
            <Text fontSize="xs" color={subtextColor}>
              {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
              {poll.is_closed ? ' · Closed' : ''}
              {poll.is_multiple_choice ? ' · Multiple choice' : ''}
            </Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
}
