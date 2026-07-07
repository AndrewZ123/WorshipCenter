'use client';

import React, { useEffect, useState } from 'react';
import {
  Center, VStack, Text, Box, Spinner, Button, useColorModeValue,
} from '@chakra-ui/react';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : false
  );
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      if (navigator.onLine) {
        window.location.reload();
      }
    }, 2000);
  };

  const bg = useColorModeValue('gray.50', 'gray.900');

  return (
    <Center h="100dvh" bg={bg}>
      <VStack spacing={6} textAlign="center" px={6}>
        <Box
          p={4}
          borderRadius="full"
          bg="orange.100"
          color="orange.500"
          _dark={{ bg: 'orange.900', color: 'orange.200' }}
        >
          <WifiOff size={48} />
        </Box>

        <Text fontSize="2xl" fontWeight="bold">
          No Internet Connection
        </Text>

        <Text color="gray.500" maxW="md">
          You need an internet connection to use WorshipCenter.
          Please check your connection and try again.
        </Text>

        {checking ? (
          <VStack spacing={2}>
            <Spinner size="sm" color="brand.500" />
            <Text fontSize="sm" color="gray.400">Checking connection...</Text>
          </VStack>
        ) : (
          <Button
            leftIcon={<RefreshCw size={18} />}
            colorScheme="brand"
            onClick={handleRetry}
            isDisabled={isOnline}
          >
            {isOnline ? 'Connected! Refreshing...' : 'Try Again'}
          </Button>
        )}

        {isOnline && (
          <Button
            variant="link"
            colorScheme="brand"
            onClick={() => window.location.reload()}
          >
            Refresh now
          </Button>
        )}
      </VStack>
    </Center>
  );
}
