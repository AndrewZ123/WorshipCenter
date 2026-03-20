'use client';

import React from 'react';
import { Badge } from '@chakra-ui/react';

export type StatusType = 'draft' | 'published' | 'upcoming' | 'completed' | 'confirmed' | 'declined' | 'pending' | 'finalized';

interface StatusConfig {
  label: string;
  bg: string;
  color: string;
  borderColor: string;
  icon?: string;
}

const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  draft: {
    label: 'Draft',
    bg: 'amber.100',
    color: 'amber.700',
    borderColor: 'amber.200',
  },
  published: {
    label: 'Published',
    bg: 'green.100',
    color: 'green.700',
    borderColor: 'green.200',
  },
  upcoming: {
    label: 'Upcoming',
    bg: 'blue.100',
    color: 'blue.700',
    borderColor: 'blue.200',
  },
  completed: {
    label: 'Completed',
    bg: 'gray.100',
    color: 'gray.600',
    borderColor: 'gray.200',
  },
  confirmed: {
    label: '✓ Confirmed',
    bg: 'green.100',
    color: 'green.700',
    borderColor: 'green.200',
  },
  declined: {
    label: '✗ Declined',
    bg: 'red.100',
    color: 'red.600',
    borderColor: 'red.200',
  },
  pending: {
    label: 'Pending',
    bg: 'amber.100',
    color: 'amber.700',
    borderColor: 'amber.200',
  },
  finalized: {
    label: 'Finalized',
    bg: 'blue.100',
    color: 'blue.700',
    borderColor: 'blue.200',
  },
};

export interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md';
}

/**
 * Global StatusBadge component
 * Provides consistent styling for all status indicators
 */
export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  
  const fontSize = size === 'sm' ? '2xs' : 'xs';
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

/**
 * Helper to convert service status to StatusType
 */
export function mapServiceStatus(status: string): StatusType {
  const mapping: Record<string, StatusType> = {
    draft: 'draft',
    published: 'published',
    finalized: 'finalized',
    completed: 'completed',
  };
  return mapping[status] || 'draft';
}

/**
 * Helper to convert assignment status to StatusType
 */
export function mapAssignmentStatus(status: string): StatusType {
  const mapping: Record<string, StatusType> = {
    pending: 'pending',
    confirmed: 'confirmed',
    declined: 'declined',
  };
  return mapping[status] || 'pending';
}