'use client';

import { Box, Text, SimpleGrid, useColorModeValue } from '@chakra-ui/react';

const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊',
  '😋', '😎', '😍', '🥰', '😘', '😜', '🤔', '🤗', '😐', '😑',
  '😏', '😒', '😓', '😔', '😕', '🙃', '🫤', '😛', '😤', '😢',
  '😭', '😨', '😰', '😱', '🥵', '🥶', '😳', '🤯', '😵', '😡',
  '👍', '👎', '👏', '🙌', '🤝', '💪', '✌️', '🤞', '🧠', '❤️',
  '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '🔥', '✨',
  '⭐', '🌟', '💡', '🎉', '🎊', '🙏', '🕊️', '☀️', '🌙', '🌈',
  '🎵', '🎶', '🎸', '🎹', '🎤', '📖', '✝️', '🙏', '🛐', '💒',
  '👋', '🤚', '✋', '🖐️', '✊', '👊', '🤛', '🤜', '👐', '🤲',
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const hoverBg = useColorModeValue('gray.100', 'gray.600');

  return (
    <Box
      position="absolute"
      bottom="60px"
      left="0"
      zIndex="100"
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="xl"
      boxShadow="0 4px 16px rgba(0,0,0,0.15)"
      p="2"
      w="280px"
    >
      <SimpleGrid columns={8} spacing="1">
        {EMOJIS.map((emoji) => (
          <Box
            key={emoji}
            as="button"
            type="button"
            fontSize="xl"
            p="1"
            borderRadius="md"
            cursor="pointer"
            textAlign="center"
            _hover={{ bg: hoverBg }}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            aria-label={emoji}
          >
            {emoji}
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
}
