'use client';

import React from 'react';
import { Badge, useColorModeValue } from '@chakra-ui/react';

export type StatusType = 'draft' | 'published' | 'upcoming' | 'completed' | 'confirmed' | 'declined' | 'pending' | 'finalized';

interface StatusConfig {
  label: string;
  bg: string;
  color: string;
  borderColor: string;
}

const LIGHT_CONFIG: Record<StatusType, StatusConfig> = {
  draft: { label: 'Draft', bg: 'amber.100', color: 'amber.700', borderColor: 'amber.200' },
  published: { label: 'Published', bg: 'green.100', color: 'green.700', borderColor: 'green.200' },
  upcoming: { label: 'Upcoming', bg: 'blue.100', color: 'blue.700', borderColor: 'blue.200' },
  completed: { label: 'Completed', bg: 'gray.100', color: 'gray.600', borderColor: 'gray.200' },
  confirmed: { label: '✓ Confirmed', bg: 'green.100', color: 'green.700', borderColor: 'green.200' },
  declined: { label: '✗ Declined', bg: 'red.100', color: 'red.600', borderColor: 'red.200' },
  pending: { label: 'Pending', bg: 'amber.100', color: 'amber.700', borderColor: 'amber.200' },
  finalized: { label: 'Finalized', bg: 'blue.100', color: 'blue.700', borderColor: 'blue.200' },
};

const DARK_CONFIG: Record<StatusType, StatusConfig> = {
  draft: { label: 'Draft', bg: 'rgba(217,119,6,0.2)', color: '#FBBF24', borderColor: 'rgba(217,119,6,0.3)' },
  published: { label: 'Published', bg: 'rgba(22,163,74,0.2)', color: '#4ADE80', borderColor: 'rgba(22,163,74,0.3)' },
  upcoming: { label: 'Upcoming', bg: 'rgba(37,99,235,0.2)', color: '#60A5FA', borderColor: 'rgba(37,99,235,0.3)' },
  completed: { label: 'Completed', bg: 'rgba(107,114,128,0.2)', color: '#9CA3AF', borderColor: 'rgba(107,114,128,0.3)' },
  confirmed: { label: '✓ Confirmed', bg: 'rgba(22,163,74,0.2)', color: '#4ADE80', borderColor: 'rgba(22,163,74,0.3)' },
  declined: { label: '✗ Declined', bg: 'rgba(220,38,38,0.2)', color: '#F87171', borderColor: 'rgba(220,38,38,0.3)' },
  pending: { label: 'Pending', bg: 'rgba(217,119,6,0.2)', color: '#FBBF24', borderColor: 'rgba(217,119,6,0.3)' },
  finalized: { label: 'Finalized', bg: 'rgba(37,99,235,0.2)', color: '#60A5FA', borderColor: 'rgba(37,99,235,0.3)' },
};

export interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = useColorModeValue(LIGHT_CONFIG[status], DARK_CONFIG[status]) || LIGHT_CONFIG.draft;
  
  const fontSize = size === 'sm' ? { base: 'xs', md: '2xs' } : 'xs';
  const px = size === 'sm' ? '2' : '3';
  const py = size === 'sm' ? '0.5' : '1';
  
  return (
    <Badge
      bg={config.bg}
      color={config.color}
      borderColor={config.borderColor}
      borderWidth="1px"
      borderRadius="full"
      px={px}
      py={py}
      fontSize={fontSize}
      fontWeight="600"
      textTransform="none"
      letterSpacing="normal"
    >
      {config.label}
    </Badge>
  );
}

export function mapServiceStatus(status: string): StatusType {
  const mapping: Record<string, StatusType> = {
    draft: 'draft',
    published: 'published',
    finalized: 'finalized',
    completed: 'completed',
  };
  return mapping[status] || 'draft';
}

export function mapAssignmentStatus(status: string): StatusType {
  const mapping: Record<string, StatusType> = {
    pending: 'pending',
    confirmed: 'confirmed',
    declined: 'declined',
  };
  return mapping[status] || 'pending';
}