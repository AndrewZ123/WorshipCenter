'use client';

import React from 'react';
import { Box, Text, Image } from '@chakra-ui/react';

/**
 * Deterministic color generator based on name
 * Cycles through: teal, violet, blue, amber, rose
 */
function getAvatarColor(name: string): string {
  const colors = [
    'teal.500',    // teal-600 equivalent
    'violet.500',
    'blue.500',
    'amber.500',
    'rose.500',
  ];
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Get first initial from name
 */
function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

export interface AvatarProps {
  /** User's name for initial fallback */
  name?: string;
  /** Photo URL if available */
  src?: string | null;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Click handler */
  onClick?: () => void;
  /** Additional className */
  className?: string;
}

const sizeStyles = {
  sm: {
    boxSize: '28px',
    fontSize: 'xs',
  },
  md: {
    boxSize: '36px',
    fontSize: 'sm',
  },
  lg: {
    boxSize: '48px',
    fontSize: 'base',
  },
  xl: {
    boxSize: '64px',
    fontSize: 'lg',
  },
};

/**
 * Global Avatar component
 * - Shows photo if available
 * - Falls back to initial circle with deterministic color
 */
export default function Avatar({
  name,
  src,
  size = 'md',
  onClick,
  className,
}: AvatarProps) {
  const { boxSize, fontSize } = sizeStyles[size];
  const initial = name ? getInitial(name) : '?';
  const bgColor = name ? getAvatarColor(name) : 'gray.400';
  
  // Show image if available
  if (src) {
    return (
      <Box
        boxSize={boxSize}
        borderRadius="full"
        overflow="hidden"
        flexShrink={0}
        onClick={onClick}
        className={className}
      >
        <Image
          src={src}
          alt={name || 'Avatar'}
          w="100%"
          h="100%"
          objectFit="cover"
          fallback={
            <Box
              w="100%"
              h="100%"
              bg={bgColor}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Text color="white" fontSize={fontSize} fontWeight="600">
                {initial}
              </Text>
            </Box>
          }
        />
      </Box>
    );
  }
  
  // Show initial circle
  return (
    <Box
      boxSize={boxSize}
      borderRadius="full"
      bg={bgColor}
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      onClick={onClick}
      className={className}
    >
      <Text color="white" fontSize={fontSize} fontWeight="600">
        {initial}
      </Text>
    </Box>
  );
}