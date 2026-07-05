'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Box, Text, HStack, VStack, Flex, IconButton, Badge,
  useColorModeValue, useDisclosure,
  Drawer, DrawerOverlay, DrawerContent, DrawerBody,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ServiceChat } from '@/components/services/ServiceChat';
import { createViewerChannel, getActiveSession } from '@/lib/service-live-sync';
import { formatServiceDate } from '@/lib/formatDate';
import type { Service, ServiceItem, User } from '@/lib/types';

import {
  Clock, X, MessageCircle, Music, AlignLeft, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────

interface MobileViewProps {
  service: Service;
  items: ServiceItem[];
  churchId: string;
  currentUser: User | null;
  isOpen: boolean;
  onClose: () => void;
}

interface ReceivedState {
  currentIndex: number;
  currentItemId: string | null;
  elapsedMs: number;
  isPaused: boolean;
  timestamp: number;
}

type ConnectionStatus = 'connecting' | 'live' | 'disconnected' | 'ended' | 'idle';

// ─── Helper ───────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────

export default function ServiceMobileView({
  service, items, churchId, currentUser, isOpen, onClose,
}: MobileViewProps) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [liveState, setLiveState] = useState<ReceivedState | null>(null);
  const [displayMs, setDisplayMs] = useState(0);
  const [showFlow, setShowFlow] = useState(false);

  // Chat state
  const chatDisclosure = useDisclosure();
  const [unreadCount] = useState(0);

  // Color mode values
  const bgColor = useColorModeValue('white', 'gray.900');
  const textColor = useColorModeValue('gray.800', 'whiteAlpha.900');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const cardBg = useColorModeValue('gray.50', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const accentColor = 'teal.500';
  const accentLight = useColorModeValue('teal.50', 'teal.900');
  const activeItemBg = useColorModeValue('teal.100', 'teal.800');
  const headerBg = useColorModeValue('white', 'gray.800');

  const currentIndex = liveState?.currentIndex ?? 0;
  const currentItem = liveState ? items[currentIndex] : null;
  const nextItem = liveState && currentIndex < items.length - 1 ? items[currentIndex + 1] : null;
  const isPaused = liveState?.isPaused ?? true;

  // ─── Timer interpolation ─────────────────────────────────────────

  const baseElapsedRef = useRef(0);

  // Keep ref in sync with liveState
  useEffect(() => {
    if (liveState) {
      baseElapsedRef.current = liveState.elapsedMs;
    }
  }, [liveState?.elapsedMs]);

  useEffect(() => {
    if (!liveState || liveState.isPaused) {
      return;
    }

    let raf: number;
    const tick = () => {
      const elapsed = baseElapsedRef.current + (Date.now() - liveState.timestamp);
      setDisplayMs(Math.max(0, elapsed));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [liveState?.elapsedMs, liveState?.isPaused, liveState?.timestamp]);

  const syncedMs = liveState
    ? (liveState.isPaused ? liveState.elapsedMs : displayMs)
    : 0;

  // ─── Broadcast subscription ──────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    let unsubscribe: (() => void) | null = null;
    let mounted = true;

    const init = async () => {
      // Try to fetch an active session from DB
      const session = await getActiveSession(service.id, churchId);
      if (!mounted) return;

      if (session) {
        setLiveState({
          currentIndex: session.current_index,
          currentItemId: session.current_item_id,
          elapsedMs: session.elapsed_ms,
          isPaused: session.is_paused,
          timestamp: Date.now(),
        });
        setConnectionStatus('connecting');
      } else {
        setConnectionStatus('idle');
      }

      // Subscribe to broadcast channel
      const sub = createViewerChannel(service.id, {
        onState: (state) => {
          if (!mounted) return;
          setLiveState(state);
          setConnectionStatus('live');
        },
        onEnd: () => {
          if (!mounted) return;
          setConnectionStatus('ended');
        },
        onTimeout: () => {
          if (!mounted) return;
          setConnectionStatus('disconnected');
        },
      });

      unsubscribe = sub.unsubscribe;
    };

    init();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen, service.id, churchId]);

  // ─── Not rendered ─────────────────────────────────────────────────

  if (!isOpen) return null;

  // ─── Idle state (no active session) ───────────────────────────────

  if (connectionStatus === 'idle') {
    return (
      <Box h="100dvh" bg={bgColor} display="flex" flexDirection="column">
        <Header onClose={onClose} service={service} headerBg={headerBg} borderColor={borderColor} textColor={textColor} subtextColor={subtextColor} />
        <Flex flex="1" direction="column" align="center" justify="center" px="6">
          <Box
            w="80px" h="80px" borderRadius="full"
            bg={accentLight} display="flex" alignItems="center" justifyContent="center" mb="4"
          >
            <Clock size={40} color="var(--chakra-colors-teal-500)" />
          </Box>
          <Text fontSize="lg" fontWeight="bold" color={textColor} textAlign="center">
            No Live Service
          </Text>
          <Text fontSize="sm" color={subtextColor} textAlign="center" mt="2" maxW="280px">
            Start Service Mode on a desktop or tablet to share the live view with the team.
          </Text>
          <IconButton
            aria-label="Close"
            icon={<X size={20} />}
            variant="ghost"
            color={subtextColor}
            onClick={onClose}
            mt="6"
            size="lg"
            borderRadius="full"
          />
        </Flex>
      </Box>
    );
  }

  // ─── Ended state ──────────────────────────────────────────────────

  if (connectionStatus === 'ended') {
    return (
      <Box h="100dvh" bg={bgColor} display="flex" flexDirection="column">
        <Header onClose={onClose} service={service} headerBg={headerBg} borderColor={borderColor} textColor={textColor} subtextColor={subtextColor} />
        <Flex flex="1" direction="column" align="center" justify="center" px="6">
          <Box
            w="80px" h="80px" borderRadius="full"
            bg="gray.100" display="flex" alignItems="center" justifyContent="center" mb="4"
          >
            <Clock size={40} color="var(--chakra-colors-gray-400)" />
          </Box>
          <Text fontSize="lg" fontWeight="bold" color={textColor}>
            Service Ended
          </Text>
          <Text fontSize="sm" color={subtextColor} textAlign="center" mt="2">
            The live session has ended.
          </Text>
          <IconButton
            aria-label="Close"
            icon={<X size={20} />}
            variant="ghost"
            color={subtextColor}
            onClick={onClose}
            mt="6"
            size="lg"
            borderRadius="full"
          />
        </Flex>
      </Box>
    );
  }

  // ─── Live state ───────────────────────────────────────────────────

  const showDisconnected = connectionStatus === 'disconnected';
  const connecting = connectionStatus === 'connecting';

  return (
    <Box h="100dvh" bg={bgColor} display="flex" flexDirection="column" position="relative">
      {/* Header */}
      <Header
        onClose={onClose}
        service={service}
        headerBg={headerBg}
        borderColor={borderColor}
        textColor={textColor}
        subtextColor={subtextColor}
        isLive={connecting || connectionStatus === 'live'}
        isPaused={isPaused}
        disconnected={showDisconnected}
      />

      {/* Disconnected banner */}
      <AnimatePresence>
        {showDisconnected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Box bg="orange.50" px="4" py="2" borderBottom="1px solid" borderColor="orange.200">
              <HStack spacing="2">
                <Box w="8px" h="8px" borderRadius="full" bg="orange.400" />
                <Text fontSize="xs" color="orange.700" fontWeight="500">
                  Controller disconnected — showing last known state
                </Text>
              </HStack>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main scrollable content */}
      <Box flex="1" overflowY="auto" px="4" pt="4" pb="20">
        {/* Timer section */}
        <VStack spacing="1" mb="6">
          <HStack spacing="2" align="baseline">
            <Clock size={20} color={accentColor} />
            <Text fontSize="5xl" fontWeight="bold" fontFamily="mono" color={accentColor} letterSpacing="tight">
              {formatTime(syncedMs)}
            </Text>
          </HStack>
          {isPaused && (
            <Badge colorScheme="yellow" variant="subtle" fontSize="xs" borderRadius="full" px="2">
              PAUSED
            </Badge>
          )}
        </VStack>

        {/* Current Item */}
        {currentItem ? (
          <Box
            bg={cardBg}
            borderRadius="2xl"
            border="1px solid"
            borderColor={borderColor}
            p="5"
            mb="4"
          >
            <VStack spacing="3" align="stretch">
              <HStack spacing="3">
                <Box
                  w="44px" h="44px" borderRadius="xl"
                  bg={currentItem.type === 'song' ? 'teal.100' : 'gray.200'}
                  display="flex" alignItems="center" justifyContent="center" flexShrink={0}
                >
                  {currentItem.type === 'song' ? (
                    <Music size={22} color="var(--chakra-colors-teal-600)" />
                  ) : (
                    <AlignLeft size={22} color="var(--chakra-colors-gray-500)" />
                  )}
                </Box>
                <Box flex="1" minW="0">
                  <Text fontSize="xs" color={subtextColor} fontWeight="600" textTransform="uppercase" letterSpacing="wide">
                    {currentItem.type === 'song' ? 'Song' : 'Segment'} · {currentIndex + 1} of {items.length}
                  </Text>
                  <Text fontSize="xl" fontWeight="bold" color={textColor} noOfLines={2}>
                    {currentItem.title}
                  </Text>
                </Box>
              </HStack>

              {/* Key + Duration badges */}
              <HStack spacing="2" flexWrap="wrap">
                {currentItem.type === 'song' && currentItem.key && (
                  <Badge colorScheme="teal" variant="subtle" fontSize="xs" px="2" py="0.5" borderRadius="full">
                    Key: {currentItem.key}
                  </Badge>
                )}
                {currentItem.duration_minutes && (
                  <Badge variant="outline" fontSize="xs" px="2" py="0.5" borderRadius="full" color={subtextColor}>
                    {currentItem.duration_minutes} min
                  </Badge>
                )}
                {currentItem.assigned_to && (
                  <Text fontSize="xs" color={subtextColor}>
                    Led by {currentItem.assigned_to}
                  </Text>
                )}
              </HStack>

              {/* Notes */}
              {currentItem.notes && (
                <Box bg={bgColor} borderRadius="lg" p="3" mt="1">
                  <Text fontSize="xs" fontWeight="600" color={subtextColor} mb="1" textTransform="uppercase" letterSpacing="wide">Notes</Text>
                  <Text fontSize="sm" color={textColor} whiteSpace="pre-wrap">
                    {currentItem.notes}
                  </Text>
                </Box>
              )}
            </VStack>
          </Box>
        ) : (
          <Box
            bg={cardBg}
            borderRadius="2xl"
            border="1px solid"
            borderColor={borderColor}
            p="5"
            mb="4"
            textAlign="center"
          >
            <Text fontSize="sm" color={subtextColor}>Waiting for service to start…</Text>
          </Box>
        )}

        {/* Up Next */}
        {nextItem && (
          <Box
            bg={cardBg}
            borderRadius="2xl"
            border="1px solid"
            borderColor={borderColor}
            p="4"
            mb="4"
            opacity={0.85}
          >
            <HStack spacing="2" mb="2">
              <Box
                w="32px" h="32px" borderRadius="lg"
                bg={nextItem.type === 'song' ? 'teal.50' : 'gray.100'}
                display="flex" alignItems="center" justifyContent="center"
              >
                {nextItem.type === 'song' ? (
                  <Music size={16} color="var(--chakra-colors-teal-600)" />
                ) : (
                  <AlignLeft size={16} color="var(--chakra-colors-gray-500)" />
                )}
              </Box>
              <Text fontSize="xs" fontWeight="bold" color={subtextColor} textTransform="uppercase" letterSpacing="wide">
                Up Next
              </Text>
            </HStack>
            <Text fontSize="md" fontWeight="600" color={textColor} ml="40px">
              {nextItem.title}
            </Text>
            {nextItem.type === 'song' && nextItem.key && (
              <Badge colorScheme="teal" variant="subtle" fontSize="xs" ml="40px" mt="1">
                Key: {nextItem.key}
              </Badge>
            )}
          </Box>
        )}

        {/* Service Flow toggle */}
        {items.length > 0 && (
          <Box
            bg={cardBg}
            borderRadius="2xl"
            border="1px solid"
            borderColor={borderColor}
            overflow="hidden"
            mb="4"
          >
            <Flex
              justify="space-between"
              align="center"
              px="4"
              py="3"
              cursor="pointer"
              onClick={() => setShowFlow(!showFlow)}
              _hover={{ bg: connectionStatus === 'live' ? 'blackAlpha.50' : 'transparent' }}
            >
              <Text fontSize="sm" fontWeight="600" color={textColor}>
                Service Order ({items.length})
              </Text>
              <IconButton
                aria-label="Toggle service flow"
                icon={showFlow ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                variant="ghost"
                size="sm"
                color={subtextColor}
              />
            </Flex>

            <AnimatePresence>
              {showFlow && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Box borderTop="1px solid" borderColor={borderColor} px="3" py="2" maxH="300px" overflowY="auto">
                    <VStack spacing="1" align="stretch">
                      {items.map((item, index) => {
                        const isActive = index === currentIndex;
                        const isPast = index < currentIndex;
                        return (
                          <HStack
                            key={item.id}
                            spacing="3"
                            px="3"
                            py="2"
                            borderRadius="lg"
                            bg={isActive ? activeItemBg : 'transparent'}
                            opacity={isPast ? 0.5 : 1}
                          >
                            <Text
                              fontSize="xs"
                              fontWeight="bold"
                              color={isActive ? accentColor : subtextColor}
                              minW="18px"
                            >
                              {index + 1}.
                            </Text>
                            <Box
                              w="24px" h="24px" borderRadius="md"
                              bg={item.type === 'song' ? 'teal.50' : 'gray.100'}
                              display="flex" alignItems="center" justifyContent="center" flexShrink={0}
                            >
                              {item.type === 'song' ? (
                                <Music size={12} color="var(--chakra-colors-teal-600)" />
                              ) : (
                                <AlignLeft size={12} color="var(--chakra-colors-gray-500)" />
                              )}
                            </Box>
                            <Text
                              fontSize="sm"
                              fontWeight={isActive ? '600' : '400'}
                              color={isActive ? textColor : subtextColor}
                              noOfLines={1}
                              flex="1"
                            >
                              {item.title}
                            </Text>
                          </HStack>
                        );
                      })}
                    </VStack>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
        )}
      </Box>

      {/* Sticky bottom bar: Chat button */}
      <Box
        position="fixed"
        bottom="0"
        left="0"
        right="0"
        bg={headerBg}
        borderTop="1px solid"
        borderColor={borderColor}
        px="4"
        py="3"
        sx={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        zIndex="10"
      >
        <Flex justify="center">
          <Flex
            as="button"
            align="center"
            justify="center"
            gap="2"
            bg={accentColor}
            color="white"
            borderRadius="full"
            px="6"
            py="3"
            fontWeight="600"
            fontSize="sm"
            _hover={{ opacity: 0.9 }}
            _active={{ opacity: 0.8 }}
            onClick={chatDisclosure.onOpen}
            position="relative"
            minW="200px"
            boxShadow="0 4px 12px rgba(13, 148, 136, 0.3)"
          >
            <MessageCircle size={18} />
            <Text>Service Chat</Text>
            {unreadCount > 0 && (
              <Box
                position="absolute"
                top="-4px"
                right="-4px"
                w="20px"
                h="20px"
                borderRadius="full"
                bg="red.500"
                color="white"
                fontSize="10px"
                fontWeight="bold"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Box>
            )}
          </Flex>
        </Flex>
      </Box>

      {/* Chat Drawer (slides up from bottom) */}
      <Drawer
        isOpen={chatDisclosure.isOpen}
        onClose={chatDisclosure.onClose}
        placement="bottom"
      >
        <DrawerOverlay bg="blackAlpha.300" backdropFilter="blur(4px)" />
        <DrawerContent
          borderTopRadius="2xl"
          maxH="70dvh"
          minH="50dvh"
          sx={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <DrawerBody p="0" display="flex" flexDirection="column">
            <Flex
              justify="space-between"
              align="center"
              px="4"
              py="3"
              borderBottom="1px solid"
              borderColor={borderColor}
            >
              <HStack spacing="2">
                <MessageCircle size={18} color="var(--chakra-colors-teal-500)" />
                <Text fontSize="sm" fontWeight="600" color={textColor}>Service Chat</Text>
              </HStack>
              <IconButton
                aria-label="Close chat"
                icon={<X size={18} />}
                variant="ghost"
                size="sm"
                borderRadius="full"
                onClick={chatDisclosure.onClose}
              />
            </Flex>
            <Box flex="1" overflow="hidden">
              <ServiceChat
                serviceId={service.id}
                churchId={churchId}
                currentUser={currentUser}
              />
            </Box>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
}

// ─── Header sub-component ─────────────────────────────────────────────

function Header({
  onClose, service, headerBg, borderColor, textColor, subtextColor,
  isLive, isPaused, disconnected,
}: {
  onClose: () => void;
  service: Service;
  headerBg: string;
  borderColor: string;
  textColor: string;
  subtextColor: string;
  isLive?: boolean;
  isPaused?: boolean;
  disconnected?: boolean;
}) {
  return (
    <Flex
      justify="space-between"
      align="center"
      px="4"
      py="3"
      bg={headerBg}
      borderBottom="1px solid"
      borderColor={borderColor}
      sx={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <HStack spacing="3" minW="0">
        {isLive && (
          <Badge colorScheme={disconnected ? 'orange' : 'teal'} fontSize="xs" px="2" py="0.5" borderRadius="full" flexShrink={0}>
            <HStack spacing="1.5">
              <Box
                w="6px" h="6px" borderRadius="full"
                bg={disconnected ? 'orange.400' : isPaused ? 'yellow.300' : 'green.400'}
                className={isPaused || disconnected ? '' : 'animate-pulse'}
              />
              <Text fontWeight="700" fontSize="xs">
                {disconnected ? 'RECONNECTING' : isPaused ? 'PAUSED' : 'LIVE'}
              </Text>
            </HStack>
          </Badge>
        )}
        <VStack spacing="0" align="start" minW="0">
          <Text fontSize="sm" fontWeight="bold" color={textColor} noOfLines={1}>
            {service.title}
          </Text>
          <Text fontSize="xs" color={subtextColor} noOfLines={1}>
            {formatServiceDate(service.date)} {service.time && `· ${service.time}`}
          </Text>
        </VStack>
      </HStack>

      <IconButton
        aria-label="Close"
        icon={<X size={20} />}
        variant="ghost"
        color={subtextColor}
        onClick={onClose}
        size="sm"
        borderRadius="full"
        flexShrink={0}
      />
    </Flex>
  );
}
