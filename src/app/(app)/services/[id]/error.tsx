'use client';

import { Button, Center, Text, VStack } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';

export default function ServiceDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <Center minH="300px" p="8">
      <VStack spacing="4" textAlign="center">
        <Text fontSize="lg" fontWeight="600">Failed to load service</Text>
        <Text fontSize="sm" color="gray.500">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </Text>
        <Button size="sm" colorScheme="teal" onClick={reset}>
          Try again
        </Button>
        <Button size="sm" variant="ghost" onClick={() => router.push('/services')}>
          Back to services
        </Button>
      </VStack>
    </Center>
  );
}
