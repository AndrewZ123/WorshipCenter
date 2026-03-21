'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, VStack, Text, HStack, IconButton, Collapse, Flex, Badge, Link,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/store';
import { ChevronDown, ChevronUp, Check, Calendar, Music, Users, Plus } from 'lucide-react';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  actionText: string;
  actionPath: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export default function OnboardingChecklist() {
  const { user, church } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(3);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function loadOnboardingData() {
      if (!church) return;

      setLoading(true);
      
      // Check if organization has any services, songs, or team members
      const [services, songs, team] = await Promise.all([
        db.services.getByChurch(church.id),
        db.songs.getByChurch(church.id),
        db.teamMembers.getByChurch(church.id),
      ]);

      const checklist: ChecklistItem[] = [
        {
          id: 'services',
          title: 'Create your first service',
          description: 'Plan your worship service with songs and segments',
          completed: services.length > 0,
          actionText: services.length > 0 ? 'View services' : 'Create service',
          actionPath: '/services',
          icon: Calendar,
        },
        {
          id: 'songs',
          title: 'Add songs to your library',
          description: 'Import or add worship songs with chord charts',
          completed: songs.length > 0,
          actionText: songs.length > 0 ? 'View songs' : 'Add song',
          actionPath: '/songs',
          icon: Music,
        },
        {
          id: 'team',
          title: 'Add team members',
          description: 'Invite musicians, vocalists, and tech team',
          completed: team.length > 0,
          actionText: team.length > 0 ? 'View team' : 'Add member',
          actionPath: '/team',
          icon: Users,
        },
      ];

      setItems(checklist);
      setCompletedCount(checklist.filter((item) => item.completed).length);
      setTotalCount(checklist.length);
      setLoading(false);
    }

    loadOnboardingData();
  }, [church]);

  // Check if user has dismissed the checklist
  useEffect(() => {
    const dismissedKey = `onboarding_dismissed_${church?.id}`;
    const isDismissed = localStorage.getItem(dismissedKey) === 'true';
    setDismissed(isDismissed);
  }, [church]);

  // Auto-dismiss when all tasks are complete
  useEffect(() => {
    if (completedCount === totalCount && totalCount > 0 && church) {
      const dismissedKey = `onboarding_dismissed_${church.id}`;
      localStorage.setItem(dismissedKey, 'true');
      setDismissed(true);
    }
  }, [completedCount, totalCount, church]);

  const handleDismiss = () => {
    if (church) {
      const dismissedKey = `onboarding_dismissed_${church.id}`;
      localStorage.setItem(dismissedKey, 'true');
      setDismissed(true);
    }
  };

  const handleAction = (path: string) => {
    router.push(path);
  };

  // Don't show if dismissed, loading, or admin role (admins don't need onboarding)
  if (dismissed || loading || user?.role !== 'admin') {
    return null;
  }

  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allComplete = completedCount === totalCount;

  return (
    <Box
      bg="white"
      borderRadius="xl"
      boxShadow="sm"
      border="1px solid"
      borderColor="gray.200"
      mb="6"
      overflow="hidden"
    >
      {/* Header */}
      <Flex
        p="4"
        align="center"
        justify="space-between"
        cursor="pointer"
        onClick={() => setIsOpen(!isOpen)}
        _hover={{ bg: 'gray.50' }}
        transition="background 0.2s ease"
      >
        <HStack spacing="3">
          <Box
            p="2"
            borderRadius="lg"
            bg={allComplete ? 'teal.50' : 'blue.50'}
          >
            {allComplete ? (
              <Check size={20} className="text-teal-600" />
            ) : (
              <Plus size={20} className="text-blue-600" />
            )}
          </Box>
          <Box>
            <HStack spacing="2">
              <Text fontWeight="700" color="gray.900">
                {allComplete ? "You're all set!" : 'Getting started'}
              </Text>
              {progress > 0 && !allComplete && (
                <Badge colorScheme="blue" size="sm">
                  {progress}%
                </Badge>
              )}
            </HStack>
            <Text fontSize="sm" color="gray.500">
              {allComplete
                ? 'Complete! Start planning your services'
                : `${completedCount} of ${totalCount} steps complete`}
            </Text>
          </Box>
        </HStack>
        <IconButton
          icon={isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          variant="ghost"
          size="sm"
          aria-label="Toggle checklist"
        />
      </Flex>

      {/* Checklist items */}
      <Collapse in={isOpen}>
        <Box px="4" pb="4">
          <VStack spacing="0" align="stretch">
            {items.map((item, index) => (
              <Flex
                key={item.id}
                p="3"
                align="center"
                justify="space-between"
                borderRadius="lg"
                bg={item.completed ? 'teal.50' : 'transparent'}
                _hover={{ bg: item.completed ? 'teal.50' : 'gray.50' }}
                cursor="pointer"
                onClick={() => handleAction(item.actionPath)}
                transition="all 0.2s ease"
              >
                <HStack spacing="3" flex="1">
                  <Box
                    p="2"
                    borderRadius="lg"
                    bg={item.completed ? 'teal.100' : 'gray.100'}
                    flexShrink={0}
                  >
                    <item.icon
                      size={16}
                      className={item.completed ? 'text-teal-600' : 'text-gray-500'}
                    />
                  </Box>
                  <Box>
                    <Text
                      fontWeight={item.completed ? '600' : '500'}
                      color={item.completed ? 'teal.900' : 'gray.700'}
                    >
                      {item.title}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {item.description}
                    </Text>
                  </Box>
                </HStack>
                <Flex align="center" gap="2">
                  <Link
                    color="teal.600"
                    fontSize="sm"
                    fontWeight="600"
                    _hover={{ textDecoration: 'underline' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction(item.actionPath);
                    }}
                  >
                    {item.actionText}
                  </Link>
                  {item.completed && (
                    <Check size={16} className="text-teal-600" />
                  )}
                </Flex>
              </Flex>
            ))}
          </VStack>

          {/* Progress bar */}
          {!allComplete && (
            <Box mt="4">
              <Flex justify="space-between" mb="2">
                <Text fontSize="xs" color="gray.500" fontWeight="600">
                  Progress
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {progress}%
                </Text>
              </Flex>
              <Box
                h="2"
                bg="gray.100"
                borderRadius="full"
                overflow="hidden"
              >
                <Box
                  h="full"
                  bg="teal.500"
                  width={`${progress}%`}
                  transition="width 0.3s ease"
                />
              </Box>
            </Box>
          )}

          {/* Dismiss button */}
          {!allComplete && (
            <Flex justify="flex-end" mt="4">
              <Link
                color="gray.400"
                fontSize="xs"
                fontWeight="600"
                _hover={{ color: 'gray.600', textDecoration: 'underline' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss();
                }}
              >
                Dismiss
              </Link>
            </Flex>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}