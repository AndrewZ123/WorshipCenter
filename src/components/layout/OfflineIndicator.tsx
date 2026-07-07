'use client';

import React from 'react';
import {
  Box, Text, HStack, Spinner, useColorModeValue, Collapse, IconButton,
} from '@chakra-ui/react';
import { useOffline } from '@/lib/offline/OfflineContext';
import { WifiOff, RefreshCw, X } from 'lucide-react';

export function OfflineIndicator() {
  const { isOnline, wasOffline, queueSize, cacheSize, isSyncing, triggerSync } = useOffline();
  const [dismissed, setDismissed] = React.useState(false);
  const offlineBg = useColorModeValue('orange.500', 'orange.600');
  const syncingBg = useColorModeValue('blue.500', 'blue.600');
  const textColor = 'white';

  const show = !isOnline || (isSyncing && wasOffline) || (isSyncing);

  if (!show && dismissed) {
    return null;
  }

  return (
    <Collapse in={show || (!isOnline)} animateOpacity>
      {!isOnline ? (
        <Box bg={offlineBg} px={4} py={2} color={textColor}>
          <HStack justify="space-between">
            <HStack spacing={2}>
              <WifiOff size={18} />
              <Text fontSize="sm" fontWeight="600">
                You are offline
              </Text>
              {cacheSize > 0 && (
                <Text fontSize="xs" opacity={0.9}>
                  &middot; {cacheSize} items cached
                </Text>
              )}
            </HStack>
            <HStack spacing={2}>
              <IconButton
                aria-label="Dismiss"
                icon={<X size={16} />}
                size="xs"
                variant="ghost"
                color="whiteAlpha.800"
                _hover={{ bg: 'whiteAlpha.200' }}
                onClick={() => setDismissed(true)}
              />
            </HStack>
          </HStack>
        </Box>
      ) : isSyncing ? (
        <Box bg={syncingBg} px={4} py={2} color={textColor}>
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Spinner size="xs" thickness="2px" />
              <Text fontSize="sm" fontWeight="600">Syncing changes...</Text>
              {queueSize > 0 && (
                <Text fontSize="xs" opacity={0.9}>
                  &middot; {queueSize} pending
                </Text>
              )}
            </HStack>
            {queueSize > 0 && (
              <IconButton
                aria-label="Refresh"
                icon={<RefreshCw size={16} />}
                size="xs"
                variant="ghost"
                color="whiteAlpha.800"
                _hover={{ bg: 'whiteAlpha.200' }}
                onClick={triggerSync}
              />
            )}
          </HStack>
        </Box>
      ) : null}
    </Collapse>
  );
}
