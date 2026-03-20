'use client';

import React from 'react';
import { Box, HStack, VStack, useColorModeValue } from '@chakra-ui/react';

interface SkeletonProps {
  height?: string | number;
  width?: string | number;
  borderRadius?: string | number;
}

export function Skeleton({ height = '20px', width = '100%', borderRadius = 'md' }: SkeletonProps) {
  const bgColor = useColorModeValue('gray.100', 'gray.700');
  
  return (
    <Box
      bg={bgColor}
      h={height}
      w={width}
      borderRadius={borderRadius}
      className="animate-pulse"
    />
  );
}

// Service card skeleton
export function ServiceCardSkeleton() {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  
  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="xl"
      p="5"
    >
      <HStack justify="space-between" align="start">
        <VStack align="start" spacing="2" flex="1">
          <HStack spacing="3">
            <Skeleton height="24px" width="180px" />
            <Skeleton height="20px" width="60px" borderRadius="full" />
          </HStack>
          <Skeleton height="16px" width="200px" />
        </VStack>
        <HStack spacing="4">
          <Skeleton height="16px" width="60px" />
          <Skeleton height="16px" width="40px" />
          <Skeleton height="16px" width="70px" />
        </HStack>
      </HStack>
    </Box>
  );
}

// Song row skeleton
export function SongRowSkeleton() {
  return (
    <HStack spacing="3" py="3" px="2">
      <Box
        minW="32px"
        h="32px"
        borderRadius="lg"
        bg="gray.100"
        className="animate-pulse"
      />
      <VStack align="start" spacing="1" flex="1">
        <Skeleton height="18px" width="150px" />
        <Skeleton height="14px" width="100px" />
      </VStack>
      <Skeleton height="20px" width="30px" borderRadius="md" />
      <Skeleton height="16px" width="80px" />
      <Skeleton height="20px" width="30px" borderRadius="full" />
    </HStack>
  );
}

// Team member row skeleton
export function TeamMemberRowSkeleton() {
  return (
    <HStack spacing="3" py="3" px="2">
      <Box
        w="28px"
        h="28px"
        borderRadius="full"
        bg="gray.100"
        className="animate-pulse"
      />
      <VStack align="start" spacing="1" flex="1">
        <Skeleton height="18px" width="120px" />
        <HStack spacing="1">
          <Skeleton height="18px" width="60px" borderRadius="full" />
          <Skeleton height="18px" width="50px" borderRadius="full" />
        </HStack>
      </VStack>
      <Skeleton height="16px" width="100px" />
    </HStack>
  );
}

// Stat card skeleton
export function StatCardSkeleton() {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  
  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="xl"
      p={{ base: '4', md: '5' }}
    >
      <VStack align="start" spacing="2">
        <Box
          p="2"
          borderRadius="lg"
          bg="gray.100"
          className="animate-pulse"
          w="40px"
          h="40px"
        />
        <Skeleton height="28px" width="40px" />
        <Skeleton height="14px" width="80px" />
      </VStack>
    </Box>
  );
}

// List of service card skeletons
export function ServiceListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <VStack spacing="3" align="stretch">
      {Array.from({ length: count }).map((_, i) => (
        <ServiceCardSkeleton key={i} />
      ))}
    </VStack>
  );
}

// List of song row skeletons
export function SongListSkeleton({ count = 4 }: { count?: number }) {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  
  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="xl"
      overflow="hidden"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Box key={i} px="4" py="2" borderBottom={i < count - 1 ? '1px solid' : 'none'} borderColor={borderColor}>
          <SongRowSkeleton />
        </Box>
      ))}
    </Box>
  );
}

// List of team member row skeletons
export function TeamListSkeleton({ count = 3 }: { count?: number }) {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  
  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="xl"
      overflow="hidden"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Box key={i} px="4" py="2" borderBottom={i < count - 1 ? '1px solid' : 'none'} borderColor={borderColor}>
          <TeamMemberRowSkeleton />
        </Box>
      ))}
    </Box>
  );
}

export default Skeleton;