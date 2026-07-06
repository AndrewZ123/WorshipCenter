'use client';

import { useState, useRef, useCallback } from 'react';
import {
  HStack, Input, IconButton, Box, useColorModeValue, Text,
  useDisclosure, Tooltip, useBreakpointValue,
  Drawer, DrawerOverlay, DrawerContent, DrawerBody,
} from '@chakra-ui/react';
import { Send, Smile, ImagePlus, Film, BarChart3, Bold, Italic, Strikethrough, AtSign } from 'lucide-react';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import PollModal from './PollModal';

interface ChatInputProps {
  channelId: string;
  userId: string;
  onSend: (content: string) => Promise<void>;
  onCreatePoll: (question: string, options: string[], isMultipleChoice: boolean) => Promise<void>;
  isAnnouncement?: boolean;
  canPost?: boolean;
}

export default function ChatInput({ channelId, userId, onSend, onCreatePoll, isAnnouncement, canPost }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const { isOpen: gifOpen, onOpen: onGifOpen, onClose: onGifClose } = useDisclosure();
  const { isOpen: pollOpen, onOpen: onPollOpen, onClose: onPollClose } = useDisclosure();
  const isMobile = useBreakpointValue({ base: true, lg: false });
  const inputRef = useRef<HTMLInputElement>(null);

  const inputBg = useColorModeValue('gray.50', 'gray.700');
  const inputBorder = useColorModeValue('gray.200', 'gray.600');

  const wrapSelection = useCallback((before: string, after: string) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const selected = input.substring(start, end);
    const newText = input.substring(0, start) + before + selected + after + input.substring(end);
    setInput(newText);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    setIsSending(true);
    try {
      await onSend(input.trim());
      setInput('');
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isAnnouncement && !canPost) {
    return (
      <Box
        borderTop="1px solid"
        borderColor={inputBorder}
        p="4"
        textAlign="center"
      >
        <Text fontSize="sm" color="gray.400">
          📢 Only admins and leaders can post in announcement channels
        </Text>
      </Box>
    );
  }

  const handleImageUpload = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      // Client-side compression
      try {
        const compressed = await compressImage(file);
        const url = URL.createObjectURL(compressed);
        setInput((prev) => prev + ` ![image](${url})`);
      } catch {
        // If compression fails, just insert as placeholder
        setInput((prev) => prev + ` ![image](uploading...)`);
      }
    };
    fileInput.click();
  };

  return (
    <>
      <Box borderTop="1px solid" borderColor={inputBorder} p={{ base: '2', md: '4' }}>
        {/* Formatting toolbar - hidden on mobile */}
        <HStack spacing="1" mb="2" display={{ base: 'none', md: 'flex' }}>
          <Tooltip label="Bold">
            <IconButton
              aria-label="Bold"
              icon={<Bold size={16} />}
              size="xs"
              variant="ghost"
              color="gray.400"
              _hover={{ color: 'teal.500' }}
              onClick={() => wrapSelection('**', '**')}
            />
          </Tooltip>
          <Tooltip label="Italic">
            <IconButton
              aria-label="Italic"
              icon={<Italic size={16} />}
              size="xs"
              variant="ghost"
              color="gray.400"
              _hover={{ color: 'teal.500' }}
              onClick={() => wrapSelection('*', '*')}
            />
          </Tooltip>
          <Tooltip label="Strikethrough">
            <IconButton
              aria-label="Strikethrough"
              icon={<Strikethrough size={16} />}
              size="xs"
              variant="ghost"
              color="gray.400"
              _hover={{ color: 'teal.500' }}
              onClick={() => wrapSelection('~~', '~~')}
            />
          </Tooltip>
          <Box w="1px" h="4" bg="gray.200" mx="1" />
          <Tooltip label="Upload Image">
            <IconButton
              aria-label="Upload image"
              icon={<ImagePlus size={16} />}
              size="xs"
              variant="ghost"
              color="gray.400"
              _hover={{ color: 'teal.500' }}
              onClick={handleImageUpload}
            />
          </Tooltip>
          <Tooltip label="Add GIF">
            <IconButton
              aria-label="Add GIF"
              icon={<Film size={16} />}
              size="xs"
              variant="ghost"
              color="gray.400"
              _hover={{ color: 'teal.500' }}
              onClick={onGifOpen}
            />
          </Tooltip>
          <Tooltip label="Create Poll">
            <IconButton
              aria-label="Create poll"
              icon={<BarChart3 size={16} />}
              size="xs"
              variant="ghost"
              color="gray.400"
              _hover={{ color: 'teal.500' }}
              onClick={onPollOpen}
            />
          </Tooltip>
        </HStack>

        {/* Mobile compact toolbar - above input row */}
        {isMobile && (
          <HStack spacing="1" mb="1.5">
            <IconButton
              aria-label="Mention"
              icon={<AtSign size={16} />}
              size="xs"
              variant="ghost"
              color="gray.400"
              _hover={{ color: 'teal.500' }}
              onClick={() => setInput((prev) => prev + '@')}
              minW="44px"
              h="36px"
            />
            <IconButton
              aria-label="Upload Image"
              icon={<ImagePlus size={16} />}
              size="xs"
              variant="ghost"
              color="gray.400"
              _hover={{ color: 'teal.500' }}
              onClick={handleImageUpload}
              minW="44px"
              h="36px"
            />
            <IconButton
              aria-label="Add GIF"
              icon={<Film size={16} />}
              size="xs"
              variant="ghost"
              color="gray.400"
              _hover={{ color: 'teal.500' }}
              onClick={onGifOpen}
              minW="44px"
              h="36px"
            />
            <IconButton
              aria-label="Create Poll"
              icon={<BarChart3 size={16} />}
              size="xs"
              variant="ghost"
              color="gray.400"
              _hover={{ color: 'teal.500' }}
              onClick={onPollOpen}
              minW="44px"
              h="36px"
            />
          </HStack>
        )}

        <HStack spacing="2" position="relative" align="end">
          <Box position="relative" flex="1">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              size="md"
              h={isMobile ? '44px' : '48px'}
              fontSize={isMobile ? '16px' : 'md'}
              bg={inputBg}
              border="1px solid"
              borderColor={inputBorder}
              borderRadius="xl"
              pr="12"
              _placeholder={{ color: 'gray.400' }}
              _focus={{ borderColor: 'teal.400', boxShadow: '0 0 0 3px rgba(13, 148, 136, 0.15)' }}
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
              onClick={() => setShowEmoji(!showEmoji)}
            />
            {showEmoji && isMobile && (
              <Drawer isOpen={showEmoji} placement="bottom" onClose={() => setShowEmoji(false)}>
                <DrawerOverlay bg="blackAlpha.300" backdropFilter="blur(4px)" />
                <DrawerContent borderTopRadius="2xl" sx={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                  <DrawerBody p="3">
                    <EmojiPicker
                      onSelect={(emoji) => {
                        setInput((prev) => prev + emoji);
                        inputRef.current?.focus();
                      }}
                      onClose={() => setShowEmoji(false)}
                    />
                  </DrawerBody>
                </DrawerContent>
              </Drawer>
            )}
            {showEmoji && !isMobile && (
              <EmojiPicker
                onSelect={(emoji) => {
                  setInput((prev) => prev + emoji);
                  inputRef.current?.focus();
                }}
                onClose={() => setShowEmoji(false)}
              />
            )}
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
            _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
            isLoading={isSending}
            onClick={handleSend}
          />
        </HStack>

      </Box>

      <GifPicker
        isOpen={gifOpen}
        onClose={onGifClose}
        onSelect={(url) => {
          setInput((prev) => prev + ` ![gif](${url})`);
        }}
      />
      <PollModal
        isOpen={pollOpen}
        onClose={onPollClose}
        onCreate={onCreatePoll}
      />
    </>
  );
}

// Client-side image compression
async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = (h * maxWidth) / w;
        w = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Could not get canvas context')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}
