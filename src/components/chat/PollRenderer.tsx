'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, VStack, Text, useColorModeValue, Flex,
} from '@chakra-ui/react';
import { Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ChatPoll, ChatPollVote } from '@/lib/types';

interface PollRendererProps {
  pollId: string;
  userId: string;
  channelId: string;
  onVotePoll: (pollId: string, userId: string, optionIndex: number) => Promise<any>;
}

export default function PollRenderer({ pollId, userId, channelId, onVotePoll }: PollRendererProps) {
  const [poll, setPoll] = useState<ChatPoll | null>(null);
  const [votes, setVotes] = useState<ChatPollVote[]>([]);
  const [userVotes, setUserVotes] = useState<Set<number>>(new Set());
  const [voting, setVoting] = useState<number | null>(null);

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
    if (p) setPoll(p);
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

    // Single-choice: clicking the same option is a no-op
    if (!poll.is_multiple_choice && userVotes.has(optionIndex)) {
      return;
    }
    // Multiple choice: clicking the same option toggles it off
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
        <Text fontSize="sm" fontWeight="600" color={textColor} lineHeight="1.4">
          📊 {poll.question}
        </Text>
      </Box>

      {/* Options */}
      <Box px="4" pb="3" bg={cardBg}>
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
                {/* Bar background */}
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

                {/* Content */}
                <Flex
                  position="relative"
                  align="center"
                  gap="2.5"
                  px="3"
                  py="2.5"
                  minH="40px"
                >
                  {/* Check circle */}
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

                  {/* Option text */}
                  <Text
                    fontSize="sm"
                    fontWeight={isSelected ? '600' : '500'}
                    color={isSelected ? selectedTextColor : textColor}
                    flex="1"
                    lineHeight="1.4"
                  >
                    {option}
                  </Text>

                  {/* Percentage */}
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

        {/* Footer */}
        <Flex justify="space-between" align="center" mt="2.5">
          <Text fontSize="xs" color={subtextColor}>
            {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
            {poll.is_closed ? ' · Closed' : ''}
            {poll.is_multiple_choice ? ' · Multiple choice' : ''}
          </Text>
        </Flex>
      </Box>
    </Box>
  );
}
