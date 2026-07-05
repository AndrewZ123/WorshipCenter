'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Text, HStack, VStack, Button, Flex,
  IconButton, useColorModeValue, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter,
  useDisclosure, Badge, Progress, Spacer,
} from '@chakra-ui/react';
import type { Service, ServiceItem } from '@/lib/types';
import { formatServiceDate } from '@/lib/formatDate';
import { db } from '@/lib/store';
import { createControllerChannel, publishState, publishEndSession, startLiveSession } from '@/lib/service-live-sync';

import {
  Play, Pause, SkipForward, SkipBack, X, Clock,
  Music, AlignLeft, Maximize2, Minimize2,
  Eye, EyeOff, Zap,
} from 'lucide-react';

interface TimingSnapshot {
  itemId: string;
  actualSeconds: number;
}

interface ServiceModeProps {
  service: Service;
  items: ServiceItem[];
  isOpen: boolean;
  churchId: string;
  currentUserId: string;
  onClose: (timingData?: TimingSnapshot[]) => void;
}

interface RunningItemState {
  itemId: string;
  startedAt: number;
  pausedElapsed: number;
  isPaused: boolean;
}

export default function ServiceMode({ service, items, isOpen, onClose, churchId, currentUserId }: ServiceModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [runningState, setRunningState] = useState<RunningItemState | null>(null);
  const [showPresenterNotes, setShowPresenterNotes] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timingSnapshotRef = useRef<Record<string, number>>({});
  const sessionIdRef = useRef<string | null>(null);
  const liveChannelRef = useRef<ReturnType<typeof createControllerChannel> | null>(null);
  const broadcastIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dbWriteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastBroadcastRef = useRef<string>('');

  const bgColor = useColorModeValue('gray.900', 'gray.900');
  const cardBg = useColorModeValue('whiteAlpha.100', 'whiteAlpha.100');
  const textColor = 'whiteAlpha.900';
  const subtextColor = 'whiteAlpha.600';
  const accentColor = 'teal.400';
  const itemBg = useColorModeValue('whiteAlpha.50', 'whiteAlpha.50');
  const activeItemBg = useColorModeValue('teal.500', 'teal.500');

  const currentItem = items[currentIndex];
  const nextItem = items[currentIndex + 1];
  const prevItem = items[currentIndex - 1];

  const totalEstimated = items.reduce((sum, item) => sum + (item.duration_minutes || 0), 0);
  const estimatedMs = (currentItem?.duration_minutes || 0) * 60 * 1000;

  // ─── Broadcast & DB sync ──────────────────────────────────────

  const broadcastCurrentState = useCallback(() => {
    if (!liveChannelRef.current || !sessionIdRef.current) return;
    publishState(liveChannelRef.current, sessionIdRef.current, {
      currentIndex,
      currentItemId: currentItem?.id || null,
      elapsedMs: elapsed,
      isPaused,
    });
  }, [currentIndex, currentItem, elapsed, isPaused]);

  const debouncedDbWrite = useCallback(() => {
    if (dbWriteTimerRef.current) clearTimeout(dbWriteTimerRef.current);
    dbWriteTimerRef.current = setTimeout(() => {
      if (sessionIdRef.current) {
        db.serviceLive.updateSession(sessionIdRef.current, {
          current_item_id: currentItem?.id || null,
          current_index: currentIndex,
          elapsed_ms: elapsed,
          is_paused: isPaused,
          is_live: true,
        }).catch(() => {});
      }
    }, 2000);
  }, [currentIndex, currentItem, elapsed, isPaused]);

  // Publish state whenever relevant state changes
  useEffect(() => {
    if (!isOpen) return;
    broadcastCurrentState();
    debouncedDbWrite();
  }, [broadcastCurrentState, debouncedDbWrite, isOpen]);

  // Periodic broadcast (heartbeat + timer sync)
  useEffect(() => {
    if (!isOpen) return;
    broadcastIntervalRef.current = setInterval(() => {
      broadcastCurrentState();
    }, 1000);
    return () => {
      if (broadcastIntervalRef.current) clearInterval(broadcastIntervalRef.current);
    };
  }, [isOpen, broadcastCurrentState]);

  // Start live session on mount
  useEffect(() => {
    if (!isOpen) return;

    const init = async () => {
      const session = await startLiveSession(service.id, churchId, currentUserId, items[0]?.id, 0);
      if (session) {
        sessionIdRef.current = session.id;
      }
      const channel = createControllerChannel(service.id);
      liveChannelRef.current = channel;
    };

    init();

    return () => {
      // Cleanup on unmount
      if (sessionIdRef.current) {
        db.serviceLive.endSession(sessionIdRef.current).catch(() => {});
        sessionIdRef.current = null;
      }
      if (liveChannelRef.current) {
        publishEndSession(liveChannelRef.current, sessionIdRef.current || '');
        liveChannelRef.current.unsubscribe();
        liveChannelRef.current = null;
      }
    };
  }, [isOpen, service.id, churchId, currentUserId, items]);

  // Timer effect
  useEffect(() => {
    if (!isPaused && runningState) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const totalElapsed = runningState.pausedElapsed + (now - runningState.startedAt);
        setElapsed(totalElapsed);

        if (autoAdvance && estimatedMs > 0 && totalElapsed >= estimatedMs && currentIndex < items.length - 1) {
          handleNext();
        }
      }, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, runningState, autoAdvance, estimatedMs, currentIndex, items.length]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          togglePause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          setIsFullscreen(!isFullscreen);
          break;
        case 'Escape':
          if (isFullscreen) setIsFullscreen(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isFullscreen, currentIndex, isPaused]);

  // Fullscreen API
  useEffect(() => {
    if (!isOpen) return;

    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [isOpen]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      setIsFullscreen(!isFullscreen);
    }
  }, [isFullscreen]);

  const togglePause = useCallback(() => {
    if (isPaused) {
      setRunningState(prev => prev ? {
        ...prev,
        startedAt: Date.now(),
        isPaused: false,
      } : {
        itemId: currentItem?.id || '',
        startedAt: Date.now(),
        pausedElapsed: 0,
        isPaused: false,
      });
    } else {
      if (runningState) {
        const now = Date.now();
        const totalElapsed = runningState.pausedElapsed + (now - runningState.startedAt);
        setRunningState({
          ...runningState,
          pausedElapsed: totalElapsed,
          isPaused: true,
        });
      }
    }
    setIsPaused(!isPaused);
  }, [isPaused, runningState, currentItem]);

  const saveCurrentTiming = useCallback(() => {
    const currentItem = items[currentIndex];
    if (currentItem && elapsed > 0) {
      timingSnapshotRef.current[currentItem.id] = Math.round(elapsed / 1000);
    }
  }, [currentIndex, items, elapsed]);

  const handleNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      saveCurrentTiming();
      setCurrentIndex(currentIndex + 1);
      setElapsed(0);
      setRunningState({
        itemId: items[currentIndex + 1]?.id || '',
        startedAt: Date.now(),
        pausedElapsed: 0,
        isPaused: false,
      });
    }
  }, [currentIndex, items.length, saveCurrentTiming]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      saveCurrentTiming();
      setCurrentIndex(currentIndex - 1);
      setElapsed(0);
      setRunningState({
        itemId: items[currentIndex - 1]?.id || '',
        startedAt: Date.now(),
        pausedElapsed: 0,
        isPaused: false,
      });
    }
  }, [currentIndex, saveCurrentTiming]);

  const handleItemClick = (index: number) => {
    saveCurrentTiming();
    setCurrentIndex(index);
    setElapsed(0);
    setRunningState({
      itemId: items[index]?.id || '',
      startedAt: Date.now(),
      pausedElapsed: 0,
      isPaused: false,
    });
  };

  const handleClose = useCallback(() => {
    saveCurrentTiming();
    if (sessionIdRef.current) {
      db.serviceLive.endSession(sessionIdRef.current).catch(() => {});
      sessionIdRef.current = null;
    }
    if (liveChannelRef.current) {
      publishEndSession(liveChannelRef.current, sessionIdRef.current || '');
      liveChannelRef.current = null;
    }
    const timingArray = Object.entries(timingSnapshotRef.current)
      .filter(([, seconds]) => seconds > 0)
      .map(([itemId, actualSeconds]) => ({ itemId, actualSeconds }));
    onClose(timingArray.length > 0 ? timingArray : undefined);
  }, [saveCurrentTiming, onClose]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = estimatedMs > 0 ? Math.min((elapsed / estimatedMs) * 100, 100) : 0;

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="full" isCentered>
      <ModalOverlay backdropBlur="none" bg="gray.900" />
      <ModalContent
        bg={bgColor}
        color={textColor}
        borderRadius="0"
        m="0"
        h="100dvh"
        maxW="100vw"
        overflow="hidden"
      >
        {/* Top Bar */}
        <Flex
          justify="space-between"
          align="center"
          px={{ base: '4', md: '6', lg: '8' }}
          py={{ base: '3', md: '4' }}
          borderBottom="1px solid"
          borderColor="whiteAlpha.200"
        >
          <HStack spacing={{ base: '3', md: '4' }}>
            <Badge colorScheme="teal" fontSize="sm" px="3" py="1" borderRadius="full">
              <HStack spacing="2">
                <Box w="8px" h="8px" borderRadius="full" bg="teal.300" className={isPaused ? '' : 'animate-pulse'} />
                <Text fontWeight="700" fontSize={{ base: 'xs', md: 'sm' }}>LIVE</Text>
              </HStack>
            </Badge>
            <VStack spacing="0" align="start">
              <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight="bold" noOfLines={1}>{service.title}</Text>
              <Text fontSize="xs" color={subtextColor}>
                {formatServiceDate(service.date)} {service.time && `· ${service.time}`}
              </Text>
            </VStack>
          </HStack>

          <HStack spacing={{ base: '1', md: '2' }}>
            <Button
              size={{ base: 'xs', md: 'sm' }}
              leftIcon={<Zap size={14} />}
              variant={autoAdvance ? 'solid' : 'ghost'}
              colorScheme={autoAdvance ? 'teal' : undefined}
              color={autoAdvance ? 'white' : 'whiteAlpha.700'}
              _hover={{ color: 'white', bg: autoAdvance ? 'teal.600' : 'whiteAlpha.200' }}
              onClick={() => setAutoAdvance(!autoAdvance)}
              display={{ base: 'none', md: 'inline-flex' }}
            >
              Auto
            </Button>
            <Button
              size={{ base: 'xs', md: 'sm' }}
              leftIcon={showPresenterNotes ? <EyeOff size={14} /> : <Eye size={14} />}
              variant={showPresenterNotes ? 'solid' : 'ghost'}
              colorScheme={showPresenterNotes ? 'purple' : undefined}
              color={showPresenterNotes ? 'white' : 'whiteAlpha.700'}
              _hover={{ color: 'white', bg: showPresenterNotes ? 'purple.600' : 'whiteAlpha.200' }}
              onClick={() => setShowPresenterNotes(!showPresenterNotes)}
              display={{ base: 'none', md: 'inline-flex' }}
            >
              Notes
            </Button>
            <IconButton
              aria-label="Toggle fullscreen"
              icon={isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              variant="ghost"
              color="whiteAlpha.700"
              _hover={{ color: 'white', bg: 'whiteAlpha.200' }}
              onClick={toggleFullscreen}
              size={{ base: 'sm', md: 'md' }}
            />
            <IconButton
              aria-label="Exit service mode"
              icon={<X size={18} />}
              variant="ghost"
              color="whiteAlpha.700"
              _hover={{ color: 'red.400', bg: 'whiteAlpha.200' }}
              onClick={handleClose}
              size={{ base: 'sm', md: 'md' }}
            />
          </HStack>
        </Flex>

        {/* Main Content */}
        <Flex
          h={{ base: 'calc(100dvh - 52px)', md: 'calc(100dvh - 60px)', lg: 'calc(100vh - 73px)' }}
          direction={{ base: 'column', md: 'row' }}
        >
          {/* Presenter Notes Panel */}
          {showPresenterNotes && (
            <Box
              w={{ base: 'full', md: '280px', lg: '320px' }}
              bg="blackAlpha.400"
              borderRight={{ base: 'none', md: '1px solid' }}
              borderBottom={{ base: '1px solid', md: 'none' }}
              borderColor="purple.500"
              overflowY="auto"
              flexShrink={0}
              maxH={{ base: '200px', md: 'none' }}
              p={{ base: '3', md: '4' }}
            >
              <HStack mb="3" justify="space-between">
                <HStack spacing="2">
                  <Eye size={14} color="#D6BCFA" />
                  <Text fontSize="xs" fontWeight="bold" color="purple.200" letterSpacing="wide" textTransform="uppercase">
                    Notes
                  </Text>
                </HStack>
                <Badge colorScheme="purple" fontSize="xs">
                  {currentIndex + 1}/{items.length}
                </Badge>
              </HStack>

              {currentItem ? (
                <VStack spacing="3" align="stretch">
                  {currentItem.notes ? (
                    <Box bg="whiteAlpha.50" borderRadius="md" p="3">
                      <Text fontSize="xs" color="purple.300" mb="1" fontWeight="bold">ITEM NOTES</Text>
                      <Text fontSize="sm" color="whiteAlpha.900" whiteSpace="pre-wrap">
                        {currentItem.notes}
                      </Text>
                    </Box>
                  ) : (
                    <Text fontSize="sm" color="whiteAlpha.500" fontStyle="italic">
                      No notes for this item.
                    </Text>
                  )}

                  {currentItem.type === 'song' && (
                    <Box bg="whiteAlpha.50" borderRadius="md" p="3">
                      <Text fontSize="xs" color="purple.300" mb="2" fontWeight="bold">SONG DETAILS</Text>
                      <VStack spacing="1" align="stretch" fontSize="sm">
                        {currentItem.key && (
                          <HStack justify="space-between">
                            <Text color="whiteAlpha.600">Key:</Text>
                            <Text color="whiteAlpha.900" fontWeight="medium">{currentItem.key}</Text>
                          </HStack>
                        )}
                        {currentItem.duration_minutes && (
                          <HStack justify="space-between">
                            <Text color="whiteAlpha.600">Duration:</Text>
                            <Text color="whiteAlpha.900" fontWeight="medium">{currentItem.duration_minutes} min</Text>
                          </HStack>
                        )}
                        {currentItem.assigned_to && (
                          <HStack justify="space-between">
                            <Text color="whiteAlpha.600">Leader:</Text>
                            <Text color="whiteAlpha.900" fontWeight="medium">{currentItem.assigned_to}</Text>
                          </HStack>
                        )}
                      </VStack>
                    </Box>
                  )}

                  <Box bg="whiteAlpha.50" borderRadius="md" p="3">
                    <Text fontSize="xs" color="purple.300" mb="2" fontWeight="bold">TIMING</Text>
                    <VStack spacing="1" align="stretch" fontSize="sm">
                      <HStack justify="space-between">
                        <Text color="whiteAlpha.600">Elapsed:</Text>
                        <Text color={progress > 100 ? 'red.300' : 'teal.300'} fontFamily="mono" fontWeight="bold">
                          {formatTime(elapsed)}
                        </Text>
                      </HStack>
                      {estimatedMs > 0 && (
                        <HStack justify="space-between">
                          <Text color="whiteAlpha.600">Estimated:</Text>
                          <Text color="whiteAlpha.900" fontFamily="mono">{formatTime(estimatedMs)}</Text>
                        </HStack>
                      )}
                      {estimatedMs > 0 && (
                        <HStack justify="space-between">
                          <Text color="whiteAlpha.600">Remaining:</Text>
                          <Text color={elapsed > estimatedMs ? 'red.300' : 'whiteAlpha.900'} fontFamily="mono" fontWeight="bold">
                            {formatTime(Math.max(0, estimatedMs - elapsed))}
                          </Text>
                        </HStack>
                      )}
                      {estimatedMs > 0 && (
                        <Progress
                          value={progress}
                          colorScheme={progress > 100 ? 'red' : 'teal'}
                          size="xs"
                          w="full"
                          borderRadius="full"
                          mt="2"
                        />
                      )}
                    </VStack>
                  </Box>

                  {nextItem && (
                    <Box bg="purple.500Alpha.200" borderRadius="md" p="3" borderColor="purple.500" borderWidth="1px">
                      <Text fontSize="xs" color="purple.300" mb="1" fontWeight="bold">UP NEXT</Text>
                      <Text fontSize="sm" color="whiteAlpha.900" fontWeight="semibold">
                        {nextItem.title}
                      </Text>
                      {nextItem.type === 'song' && nextItem.key && (
                        <Badge colorScheme="teal" fontSize="xs" mt="1">Key: {nextItem.key}</Badge>
                      )}
                    </Box>
                  )}
                </VStack>
              ) : (
                <Text fontSize="sm" color="whiteAlpha.500">No item selected.</Text>
              )}
            </Box>
          )}

          {/* Current Item Display */}
          <Flex
            flex="1"
            direction="column"
            align="center"
            justify="center"
            p={{ base: '4', md: '8', lg: '12' }}
            position="relative"
          >
            {currentItem ? (
              <VStack spacing={{ base: '4', md: '6' }} align="center" maxW="800px" w="full">
                <Text fontSize="xs" color={subtextColor} letterSpacing="wider" textTransform="uppercase">
                  Item {currentIndex + 1} of {items.length}
                </Text>

                <Box
                  w={{ base: '60px', md: '80px' }}
                  h={{ base: '60px', md: '80px' }}
                  borderRadius="2xl"
                  bg={currentItem.type === 'song' ? 'teal.500' : 'whiteAlpha.200'}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  {currentItem.type === 'song' ? (
                    <Music size={32} color="white" />
                  ) : (
                    <AlignLeft size={32} color="white" />
                  )}
                </Box>

                <Text
                  fontSize={{ base: '2xl', md: '4xl', lg: '5xl' }}
                  fontWeight="bold"
                  textAlign="center"
                  lineHeight="1.2"
                >
                  {currentItem.title}
                </Text>

                <HStack spacing="4" flexWrap="wrap" justify="center">
                  {currentItem.type === 'song' && currentItem.key && (
                    <Badge colorScheme="teal" fontSize={{ base: 'sm', md: 'md' }} px="4" py="2" borderRadius="lg">
                      Key: {currentItem.key}
                    </Badge>
                  )}
                  {currentItem.duration_minutes && (
                    <Badge variant="outline" colorScheme="whiteAlpha" fontSize={{ base: 'sm', md: 'md' }} px="4" py="2" borderRadius="lg">
                      Est: {currentItem.duration_minutes} min
                    </Badge>
                  )}
                  {currentItem.assigned_to && (
                    <Text fontSize={{ base: 'sm', md: 'md' }} color={subtextColor}>
                      Led by: {currentItem.assigned_to}
                    </Text>
                  )}
                </HStack>

                {currentItem.notes && (
                  <Box
                    bg={cardBg}
                    borderRadius="xl"
                    px={{ base: '4', md: '6' }}
                    py={{ base: '3', md: '4' }}
                    maxW="600px"
                    textAlign="center"
                  >
                    <Text fontSize="sm" color={subtextColor} whiteSpace="pre-wrap">
                      {currentItem.notes}
                    </Text>
                  </Box>
                )}

                <VStack spacing="2" mt={{ base: '2', md: '4' }}>
                  <HStack spacing="3" align="baseline">
                    <Clock size={22} color={accentColor} />
                    <Text fontSize={{ base: '3xl', md: '4xl' }} fontWeight="bold" fontFamily="mono" color={elapsed > estimatedMs && estimatedMs > 0 ? 'red.400' : accentColor}>
                      {formatTime(elapsed)}
                    </Text>
                    {estimatedMs > 0 && (
                      <Text fontSize={{ base: 'lg', md: 'xl' }} color={subtextColor} fontFamily="mono">
                        / {formatTime(estimatedMs)}
                      </Text>
                    )}
                  </HStack>
                  {estimatedMs > 0 && (
                    <Progress
                      value={progress}
                      colorScheme={progress > 100 ? 'red' : 'teal'}
                      size="xs"
                      w={{ base: '200px', md: '300px' }}
                      borderRadius="full"
                    />
                  )}
                </VStack>

                {/* Playback Controls */}
                <HStack spacing={{ base: '4', md: '6' }} mt={{ base: '4', md: '8' }}>
                  <IconButton
                    aria-label="Previous item"
                    icon={<SkipBack size={24} />}
                    variant="ghost"
                    color="whiteAlpha.700"
                    _hover={{ color: 'white', bg: 'whiteAlpha.200' }}
                    isDisabled={currentIndex === 0}
                    onClick={handlePrev}
                    size={{ base: 'md', md: 'lg' }}
                    borderRadius="full"
                    minW={{ base: '44px', md: 'auto' }}
                    minH={{ base: '44px', md: 'auto' }}
                  />
                  <IconButton
                    aria-label={isPaused ? 'Play timer' : 'Pause timer'}
                    icon={isPaused ? <Play size={32} /> : <Pause size={32} />}
                    variant="solid"
                    colorScheme="teal"
                    onClick={togglePause}
                    size={{ base: 'lg', md: 'lg' }}
                    borderRadius="full"
                    w={{ base: '64px', md: '80px' }}
                    h={{ base: '64px', md: '80px' }}
                    minW={{ base: '64px', md: '80px' }}
                    minH={{ base: '64px', md: '80px' }}
                  />
                  <IconButton
                    aria-label="Next item"
                    icon={<SkipForward size={24} />}
                    variant="ghost"
                    color="whiteAlpha.700"
                    _hover={{ color: 'white', bg: 'whiteAlpha.200' }}
                    isDisabled={currentIndex === items.length - 1}
                    onClick={handleNext}
                    size={{ base: 'md', md: 'lg' }}
                    borderRadius="full"
                    minW={{ base: '44px', md: 'auto' }}
                    minH={{ base: '44px', md: 'auto' }}
                  />
                </HStack>
              </VStack>
            ) : (
              <VStack spacing="4">
                <Text fontSize="2xl" color={subtextColor}>No items in service</Text>
                <Text fontSize="md" color={subtextColor}>Add items to the service plan first.</Text>
              </VStack>
            )}
          </Flex>

          {/* Sidebar - Service Flow */}
          {!isFullscreen && items.length > 0 && (
            <Box
              w={{ base: 'full', md: '260px', lg: '350px' }}
              bg="blackAlpha.300"
              borderLeft={{ base: 'none', md: '1px solid' }}
              borderTop={{ base: '1px solid', md: 'none' }}
              borderColor="whiteAlpha.200"
              overflowY="auto"
              flexShrink={0}
              maxH={{ base: '240px', md: 'none' }}
            >
              <VStack spacing="2" align="stretch" p="4">
                <Text fontSize="xs" fontWeight="bold" color={subtextColor} letterSpacing="wide" textTransform="uppercase" mb="2">
                  Service Flow
                </Text>
                {items.map((item, index) => {
                  const isActive = index === currentIndex;
                  const isPast = index < currentIndex;
                  return (
                    <Box
                      key={item.id}
                      bg={isActive ? activeItemBg : itemBg}
                      borderRadius="lg"
                      px="3"
                      py="2"
                      cursor="pointer"
                      onClick={() => handleItemClick(index)}
                      opacity={isPast ? 0.5 : 1}
                      transition="all 0.15s ease"
                      borderLeft="3px solid"
                      borderLeftColor={
                        isActive ? 'teal.300' :
                        item.type === 'song' ? 'teal.500' : 'transparent'
                      }
                      _hover={{ opacity: 0.85 }}
                    >
                      <HStack spacing="3">
                        <Text
                          fontSize="xs"
                          fontWeight="bold"
                          color={isActive ? 'white' : subtextColor}
                          minW="20px"
                        >
                          {index + 1}.
                        </Text>
                        <Box flex="1">
                          <HStack spacing="2">
                            {item.type === 'song' ? (
                              <Music size={12} color={isActive ? 'white' : accentColor} />
                            ) : (
                              <AlignLeft size={12} color={isActive ? 'white' : subtextColor} />
                            )}
                            <Text
                              fontSize="xs"
                              fontWeight={isActive ? 'bold' : 'medium'}
                              color={isActive ? 'white' : textColor}
                              noOfLines={1}
                            >
                              {item.title}
                            </Text>
                          </HStack>
                        </Box>
                      </HStack>
                    </Box>
                  );
                })}

                {nextItem && (
                  <Box mt="4" p="3" bg="whiteAlpha.100" borderRadius="lg">
                    <Text fontSize="xs" color={subtextColor} letterSpacing="wide" textTransform="uppercase" mb="1">
                      Up Next
                    </Text>
                    <Text fontSize="sm" fontWeight="semibold">
                      {nextItem.title}
                    </Text>
                  </Box>
                )}
              </VStack>
            </Box>
          )}
        </Flex>

        {/* Keyboard hints (only when not fullscreen) */}
        {!isFullscreen && (
          <Box
            position="absolute"
            bottom="4"
            left="50%"
            transform="translateX(-50%)"
            bg="blackAlpha.500"
            borderRadius="full"
            px="4"
            py="2"
          >
            <HStack spacing="4" fontSize="xs" color="whiteAlpha.600">
              <Text><kbd>Space</kbd> Play/Pause</Text>
              <Text><kbd>←</kbd> Prev</Text>
              <Text><kbd>→</kbd> Next</Text>
              <Text><kbd>F</kbd> Fullscreen</Text>
            </HStack>
          </Box>
        )}
      </ModalContent>
    </Modal>
  );
}
