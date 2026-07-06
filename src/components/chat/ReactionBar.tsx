'use client';

import { HStack, Box, Text, useColorModeValue } from '@chakra-ui/react';

const QUICK_EMOJIS = ['👍', '❤️', '😄', '🎉', '🙏', '🔥', '😢', '😮'];

interface ReactionSummary {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface ReactionBarProps {
  reactions: ReactionSummary[];
  onReact: (emoji: string) => void;
  showPicker?: boolean;
}

export default function ReactionBar({ reactions, onReact, showPicker }: ReactionBarProps) {
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const activeBg = useColorModeValue('teal.50', 'teal.900');
  const activeColor = useColorModeValue('teal.600', 'teal.300');

  return (
    <HStack spacing="1" mt="1" flexWrap="wrap">
      {reactions.filter(r => r.count > 0).map((r) => (
        <Box
          key={r.emoji}
          as="button"
          type="button"
          px="2"
          py="0.5"
          borderRadius="full"
          fontSize="xs"
          bg={r.hasReacted ? activeBg : bgColor}
          border="1px solid"
          borderColor={r.hasReacted ? 'teal.200' : 'transparent'}
          cursor="pointer"
          _hover={{ bg: activeBg }}
          onClick={() => onReact(r.emoji)}
        >
          <HStack spacing="1">
            <Text>{r.emoji}</Text>
            {r.count > 1 && (
              <Text fontSize="10px" fontWeight="600" color={r.hasReacted ? activeColor : 'gray.500'}>
                {r.count}
              </Text>
            )}
          </HStack>
        </Box>
      ))}
      {showPicker && (
        <Box
          as="button"
          type="button"
          px="2"
          py="0.5"
          borderRadius="full"
          fontSize="xs"
          bg={bgColor}
          cursor="pointer"
          _hover={{ bg: 'gray.200' }}
          onClick={() => {}}
          aria-label="Add reaction"
        >
          +
        </Box>
      )}
    </HStack>
  );
}
