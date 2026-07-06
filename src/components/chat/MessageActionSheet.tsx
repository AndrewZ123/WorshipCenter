'use client';

import {
  Box, VStack, HStack, Text, useColorModeValue, Drawer, DrawerOverlay, DrawerContent, DrawerBody, Divider,
} from '@chakra-ui/react';
import { SmilePlus, Pencil, Copy, Trash2 } from 'lucide-react';

interface MessageActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isOwn: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onReact?: (emoji: string) => void;
  onCopy?: () => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function MessageActionSheet({
  isOpen, onClose, isOwn, onEdit, onDelete, onReact, onCopy,
}: MessageActionSheetProps) {
  const bg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.700', 'gray.300');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const dangerColor = 'red.500';
  const emojiBg = useColorModeValue('gray.100', 'gray.700');
  const emojiHoverBg = useColorModeValue('gray.200', 'gray.600');
  const dividerColor = useColorModeValue('gray.100', 'gray.700');

  return (
    <Drawer isOpen={isOpen} placement="bottom" onClose={onClose}>
      <DrawerOverlay bg="blackAlpha.300" backdropFilter="blur(4px)" />
      <DrawerContent
        bg={bg}
        borderTopRadius="2xl"
        sx={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <DrawerBody p="0">
          {onReact && (
            <Box px="4" pt="4" pb="3">
              <Text fontSize="xs" fontWeight="600" color="gray.400" textTransform="uppercase" letterSpacing="wide" mb="2">
                React
              </Text>
              <HStack spacing="2">
                {QUICK_EMOJIS.map((emoji) => (
                  <Box
                    key={emoji}
                    as="button"
                    w="44px"
                    h="44px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    borderRadius="full"
                    bg={emojiBg}
                    _hover={{ bg: emojiHoverBg }}
                    fontSize="xl"
                    cursor="pointer"
                    onClick={() => { onReact(emoji); onClose(); }}
                    transition="all 0.15s"
                  >
                    {emoji}
                  </Box>
                ))}
              </HStack>
            </Box>
          )}

          <Divider borderColor={dividerColor} />

          <VStack spacing="0" align="stretch" py="2">
            {isOwn && onEdit && (
              <HStack
                px="4"
                py="3"
                cursor="pointer"
                borderRadius="lg"
                mx="2"
                _hover={{ bg: hoverBg }}
                onClick={() => { onEdit(); onClose(); }}
                spacing="3"
                minH="48px"
              >
                <Pencil size={18} />
                <Text fontSize="sm" color={textColor}>Edit</Text>
              </HStack>
            )}

            {onCopy && (
              <HStack
                px="4"
                py="3"
                cursor="pointer"
                borderRadius="lg"
                mx="2"
                _hover={{ bg: hoverBg }}
                onClick={() => { onCopy(); onClose(); }}
                spacing="3"
                minH="48px"
              >
                <Copy size={18} />
                <Text fontSize="sm" color={textColor}>Copy</Text>
              </HStack>
            )}

            {isOwn && onDelete && (
              <HStack
                px="4"
                py="3"
                cursor="pointer"
                borderRadius="lg"
                mx="2"
                _hover={{ bg: hoverBg }}
                onClick={() => { onDelete(); onClose(); }}
                spacing="3"
                minH="48px"
                color={dangerColor}
              >
                <Trash2 size={18} />
                <Text fontSize="sm">Delete</Text>
              </HStack>
            )}
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
