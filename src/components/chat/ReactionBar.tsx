'use client';

import { useState } from 'react';
import {
  HStack, Box, Text, useColorModeValue,
  Popover, PopoverTrigger, PopoverContent, PopoverBody, SimpleGrid,
} from '@chakra-ui/react';

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
  const emojiHoverBg = useColorModeValue('gray.200', 'gray.600');
  const [pickerOpen, setPickerOpen] = useState(false);

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
        <Popover isOpen={pickerOpen} onClose={() => setPickerOpen(false)} placement="top-start">
          <PopoverTrigger>
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
              onClick={() => setPickerOpen(!pickerOpen)}
              aria-label="Add reaction"
            >
              +
            </Box>
          </PopoverTrigger>
          <PopoverContent w="auto" minW="0" _focus={{ outline: 'none' }}>
            <PopoverBody p="2">
              <SimpleGrid columns={4} spacing="1">
                {QUICK_EMOJIS.map((emoji) => (
                  <Box
                    key={emoji}
                    as="button"
                    type="button"
                    w="36px"
                    h="36px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    borderRadius="md"
                    fontSize="lg"
                    cursor="pointer"
                    _hover={{ bg: emojiHoverBg }}
                    onClick={() => { onReact(emoji); setPickerOpen(false); }}
                    aria-label={emoji}
                  >
                    {emoji}
                  </Box>
                ))}
              </SimpleGrid>
            </PopoverBody>
          </PopoverContent>
        </Popover>
      )}
    </HStack>
  );
}
