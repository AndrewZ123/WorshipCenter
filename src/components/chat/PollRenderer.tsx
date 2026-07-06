'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, VStack, Text, useColorModeValue, Progress, Flex,
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
  const selectedBg = useColorModeValue('teal.50', 'teal.900');
  const selectedBorder = useColorModeValue('teal.400', 'teal.300');
  const barTrack = useColorModeValue('gray.200', 'gray.600');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

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
      // Single-choice: remove any existing vote first, then add the new one
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
      mt="2"
      p="4"
      bg={cardBg}
      borderRadius="xl"
      border="1px solid"
      borderColor={borderColor}
      maxW={{ base: '100%', md: '420px' }}
    >
      <VStack spacing="3" align="stretch">
        <Text fontWeight="600" fontSize="sm">
          {poll.question}
        </Text>

        <VStack spacing="2" align="stretch">
          {poll.options.map((option, i) => {
            const pct = getPercentage(i);
            const isSelected = userVotes.has(i);
            const count = votes.filter(v => v.option_index === i).length;

            return (
              <Box
                key={i}
                position="relative"
                overflow="hidden"
                borderRadius="lg"
                border="2px solid"
                borderColor={isSelected ? selectedBorder : 'transparent'}
                bg={isSelected ? selectedBg : optionBg}
                cursor={poll.is_closed ? 'default' : 'pointer'}
                opacity={voting === i ? 0.6 : 1}
                transition="all 0.15s"
                _hover={!poll.is_closed && !isSelected ? { bg: optionHover } : undefined}
                onClick={() => handleVote(i)}
              >
                <Progress
                  value={pct}
                  size="lg"
                  colorScheme="teal"
                  bg={barTrack}
                  position="absolute"
                  top="0"
                  left="0"
                  h="full"
                  w="full"
                  borderRadius="lg"
                  sx={{ '& > div': { transition: 'width 0.4s ease', borderRadius: 'lg' } }}
                />
                <Flex
                  position="relative"
                  align="center"
                  justify="space-between"
                  px="3"
                  py="2.5"
                  minH="42px"
                >
                  <Flex align="center" gap="2" flex="1">
                    {isSelected && <Check size={14} style={{ flexShrink: 0 }} color="#319795" />}
                    <Text
                      fontSize="sm"
                      fontWeight={isSelected ? '600' : '400'}
                      color={isSelected ? 'teal.700' : undefined}
                    >
                      {option}
                    </Text>
                  </Flex>
                  <Text
                    fontSize="xs"
                    fontWeight="600"
                    color="gray.500"
                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                    flexShrink={0}
                  >
                    {count} ({pct}%)
                  </Text>
                </Flex>
              </Box>
            );
          })}
        </VStack>

        <Flex justify="space-between" align="center">
          <Text fontSize="xs" color="gray.400">
            {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
            {poll.is_closed ? ' · Closed' : ''}
            {poll.is_multiple_choice ? ' · Multiple choice' : ''}
          </Text>
        </Flex>
      </VStack>
    </Box>
  );
}
