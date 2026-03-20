'use client';

import React from 'react';
import { Box, Text, VStack, Button, HStack } from '@chakra-ui/react';
import { 
  Calendar, Music, Users, UserCheck, BarChart2, Clock,
  FileText, FolderOpen, Inbox, AlertCircle
} from 'lucide-react';

/**
 * Icon map for common empty states
 */
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  calendar: Calendar,
  music: Music,
  users: Users,
  userCheck: UserCheck,
  barChart: BarChart2,
  clock: Clock,
  fileText: FileText,
  folder: FolderOpen,
  inbox: Inbox,
  alertCircle: AlertCircle,
};

export interface EmptyStateProps {
  /** Icon name from the map, or pass a custom icon component */
  icon?: string;
  /** Custom icon component (overrides icon name) */
  iconComponent?: React.ComponentType<{ size?: number; className?: string }>;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** CTA button label */
  ctaLabel?: string;
  /** CTA button href or onClick */
  ctaHref?: string;
  /** CTA button click handler */
  ctaOnClick?: () => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Global EmptyState component
 * Provides consistent empty state UI across the app
 */
export default function EmptyState({
  icon,
  iconComponent: CustomIcon,
  title,
  description,
  ctaLabel,
  ctaHref,
  ctaOnClick,
  size = 'md',
}: EmptyStateProps) {
  const IconComponent = CustomIcon || (icon ? ICON_MAP[icon] : null);
  
  const iconSize = size === 'sm' ? 32 : size === 'lg' ? 64 : 48;
  const titleSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'base';
  const descSize = size === 'sm' ? 'xs' : 'sm';
  const py = size === 'sm' ? '6' : size === 'lg' ? '12' : '8';
  
  return (
    <Box
      bg="gray.50"
      borderRadius="xl"
      border="1px dashed"
      borderColor="gray.200"
      py={{ base: size === 'sm' ? '8' : '10', md: py }}
      px={{ base: '6', md: '4' }}
    >
      <VStack spacing={{ base: '4', md: '3' }} textAlign="center">
        {IconComponent && (
          <Box color="teal.200">
            <IconComponent size={iconSize} />
          </Box>
        )}
        
        <Text
          fontSize={titleSize}
          fontWeight="600"
          color="gray.700"
        >
          {title}
        </Text>
        
        {description && (
          <Text
            fontSize={descSize}
            color="gray.400"
            maxW="xs"
          >
            {description}
          </Text>
        )}
        
        {ctaLabel && (ctaHref || ctaOnClick) && (
          <Button
            size="sm"
            colorScheme="teal"
            onClick={ctaOnClick}
            as={ctaHref ? 'a' : undefined}
            href={ctaHref}
          >
            {ctaLabel}
          </Button>
        )}
      </VStack>
    </Box>
  );
}

/**
 * Preset empty states for common scenarios
 */
export function NoServicesEmpty({ onCta }: { onCta?: () => void }) {
  return (
    <EmptyState
      icon="calendar"
      title="No services yet"
      description="Create your first service to get started planning Sunday."
      ctaLabel="Create Service"
      ctaOnClick={onCta}
    />
  );
}

export function NoSongsEmpty({ onCta }: { onCta?: () => void }) {
  return (
    <EmptyState
      icon="music"
      title="Your library is empty"
      description="Add your first song to start building your worship library."
      ctaLabel="Add Song"
      ctaOnClick={onCta}
    />
  );
}

export function NoTeamMembersEmpty({ onCta }: { onCta?: () => void }) {
  return (
    <EmptyState
      icon="users"
      title="No team members yet"
      description="Add your worship team so you can schedule and notify them."
      ctaLabel="Add Team Member"
      ctaOnClick={onCta}
    />
  );
}

export function NoAssignmentsEmpty() {
  return (
    <EmptyState
      icon="userCheck"
      title="No one assigned yet"
      description="Assign team members to this service to send invitations."
      size="sm"
    />
  );
}

export function NoSongUsageEmpty({ onCta }: { onCta?: () => void }) {
  return (
    <EmptyState
      icon="barChart"
      title="No usage logged yet"
      description="Mark a service as Completed to automatically log its songs."
      ctaLabel="Go to Services"
      ctaOnClick={onCta}
    />
  );
}

export function NoRecentServicesEmpty() {
  return (
    <EmptyState
      icon="clock"
      title="Not used yet"
      description="This song hasn't been used in any completed services."
      size="sm"
    />
  );
}

export function NeverScheduledEmpty({ onCta }: { onCta?: () => void }) {
  return (
    <EmptyState
      icon="calendar"
      title="Never scheduled"
      description="This team member hasn't been assigned to any services yet."
      ctaLabel="Assign to a Service"
      ctaOnClick={onCta}
      size="sm"
    />
  );
}

export function NoItemsEmpty() {
  return (
    <EmptyState
      icon="folder"
      title="No items yet"
      description="Add songs and segments to build your service order."
      size="sm"
    />
  );
}