'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Center, Flex, HStack, IconButton, Spinner, Text, VStack,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import type { Service, ServiceItem } from '@/lib/types';
import { createViewerChannel, getActiveSession } from '@/lib/service-live-sync';
import { parseChordPro, splitChordProLine } from '@/lib/chordpro';
import { buildChartView, decodeTextFileDataUrl, findChordProFile } from '@/lib/song-chart';
import { formatKey } from '@/lib/formatKey';
import {
  AlignLeft, ArrowLeft, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, Music, Radio,
} from 'lucide-react';

type ConnectionState = 'loading' | 'waiting' | 'live' | 'disconnected' | 'ended';

interface StageChartState {
  status: 'loading' | 'ready' | 'empty' | 'error';
  title?: string;
  artist?: string;
  key?: string;
  originalKey?: string;
  capo?: string;
  ccli?: string;
  chart?: string;
}

const CONNECTION_LABELS: Record<ConnectionState, string> = {
  loading: 'Connecting',
  waiting: 'Waiting for Service Mode',
  live: 'Live',
  disconnected: 'Controller offline',
  ended: 'Service ended',
};

function clampItemIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(Math.trunc(index) || 0, 0), count - 1);
}

function StageChordPro({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <Box
      fontFamily="'Courier New', monospace"
      fontSize="clamp(20px, 5vw, 44px)"
      lineHeight="1.2"
      color="#f8fafc"
    >
      {lines.map((line, lineIndex) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const inner = trimmed.slice(1, -1);
          const colon = inner.indexOf(':');
          const directive = colon === -1 ? inner : inner.slice(0, colon);
          const value = colon === -1 ? '' : inner.slice(colon + 1).trim();
          if (directive.trim().toLowerCase() === 'comment' || directive.trim().toLowerCase() === 'c') {
            return (
              <Text
                key={lineIndex}
                mt="4"
                mb="1"
                color="#5eead4"
                fontWeight="800"
                fontSize="0.72em"
                letterSpacing="0.08em"
                textTransform="uppercase"
              >
                {value}
              </Text>
            );
          }
          return null;
        }

        const segments = splitChordProLine(line);

        if (segments.length === 0) {
          return <Box key={lineIndex} h="0.7em" />;
        }

        return (
          <Flex key={lineIndex} wrap="wrap" align="flex-start" mb="0.35em">
            {segments.map((segment, segmentIndex) => {
              const chordLabel = segment.chord
                ? segment.lyric
                  ? segment.chord
                  : `${segment.chord} `
                : '';

              return (
                <Box
                  as="span"
                  key={segmentIndex}
                  display="inline-flex"
                  flexDirection="column"
                  alignItems="flex-start"
                  maxW="100%"
                  pr="0.08em"
                >
                  <Text
                    as="span"
                    fontSize="0.74em"
                    fontWeight="800"
                    lineHeight="1.15"
                    minH="1.15em"
                    color="#fbbf24"
                    whiteSpace="pre-wrap"
                    overflowWrap="break-word"
                  >
                    {chordLabel || '\u00A0'}
                  </Text>
                  <Text
                    as="span"
                    lineHeight="1.25"
                    minH="1.25em"
                    whiteSpace="pre-wrap"
                    overflowWrap="break-word"
                  >
                    {segment.lyric || '\u00A0'}
                  </Text>
                </Box>
              );
            })}
          </Flex>
        );
      })}
    </Box>
  );
}

export default function StageDisplayClient() {
  const params = useParams();
  const router = useRouter();
  const { church, loading: authLoading } = useAuth();
  const store = useStore();
  const serviceId = params.id as string;

  const [service, setService] = useState<Service | null>(null);
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [connection, setConnection] = useState<ConnectionState>('loading');
  const [controllerActive, setControllerActive] = useState(false);
  const [chart, setChart] = useState<StageChartState>({ status: 'loading' });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const itemsRef = useRef<ServiceItem[]>([]);
  const everLiveRef = useRef(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Load the service and plan, always scoped to the signed-in church.
  useEffect(() => {
    if (!church) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [serviceData, itemData] = await Promise.all([
          store.services.getById(serviceId, church.id),
          store.serviceItems.getByService(serviceId),
        ]);
        if (cancelled) return;

        if (!serviceData) {
          setService(null);
          setItems([]);
          setLoadError('Service not found');
          return;
        }

        setService(serviceData);
        setItems(itemData.slice().sort((a, b) => a.position - b.position));
      } catch (error) {
        if (!cancelled) {
          console.error('[StageDisplay] Failed to load service:', error);
          setLoadError('Could not load this service');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [church, serviceId, store]);

  // Follow the existing Service Mode live session. No new protocol: this is
  // the same viewer channel the phone companion view uses.
  useEffect(() => {
    if (!service || !church) return;
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      const session = await getActiveSession(service.id, church.id);
      if (!mounted) return;

      if (session) {
        everLiveRef.current = true;
        setControllerActive(true);
        setConnection('live');
        setCurrentIndex(clampItemIndex(session.current_index, itemsRef.current.length));
      } else {
        setConnection('waiting');
      }

      const viewer = createViewerChannel(service.id, {
        onState: (state) => {
          if (!mounted) return;
          everLiveRef.current = true;
          setControllerActive(true);
          setConnection('live');
          setCurrentIndex(clampItemIndex(state.currentIndex, itemsRef.current.length));
        },
        onEnd: () => {
          if (!mounted) return;
          setControllerActive(false);
          setConnection('ended');
        },
        onTimeout: () => {
          if (!mounted) return;
          setControllerActive(false);
          setConnection(everLiveRef.current ? 'disconnected' : 'waiting');
        },
      });

      unsubscribe = viewer.unsubscribe;
    };

    init();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [service, church]);

  const currentItem = items[clampItemIndex(currentIndex, items.length)];
  const manualAllowed = !controllerActive && items.length > 0;
  const canGoPrev = manualAllowed && currentIndex > 0;
  const canGoNext = manualAllowed && currentIndex < items.length - 1;

  const goPrev = useCallback(() => {
    setCurrentIndex((index) => clampItemIndex(index - 1, items.length));
  }, [items.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((index) => clampItemIndex(index + 1, items.length));
  }, [items.length]);

  // Load and transpose the current song's ChordPro chart.
  useEffect(() => {
    if (!church || !currentItem) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the previous item's chart.
      setChart({ status: 'empty' });
      return;
    }

    if (currentItem.type !== 'song' || !currentItem.song_id) {
      setChart({ status: 'empty', title: currentItem.title });
      return;
    }

    const item = currentItem;
    const songId = item.song_id;
    if (!songId) {
      setChart({ status: 'empty', title: item.title });
      return;
    }
    let cancelled = false;

    const loadChart = async () => {
      setChart({ status: 'loading' });
      try {
        const song = await store.songs.getById(songId, church.id);
        if (cancelled) return;

        if (!song) {
          setChart({ status: 'empty', title: item.title });
          return;
        }

        const files = await store.songFiles.getBySong(songId, church.id);
        if (cancelled) return;

        const chartFile = findChordProFile(files);
        const raw = chartFile ? decodeTextFileDataUrl(chartFile.file_url) : '';

        if (!raw.trim()) {
          setChart({
            status: 'empty',
            title: song.title,
            artist: song.artist,
            key: item.key || song.default_key,
          });
          return;
        }

        const meta = parseChordPro(raw).meta;
        // Stage and PDFs share one key rule: service item key if set, else the
        // chart's own key. No browser-local transpose is involved.
        const view = buildChartView({
          chartText: raw,
          defaultKey: song.default_key,
          serviceKey: item.key,
        });

        setChart({
          status: 'ready',
          title: song.title || meta.title,
          artist: song.artist || meta.artist,
          key: view.displayKey || view.sourceKey,
          originalKey: view.sourceKey,
          ccli: song.ccli_number || meta.ccli,
          capo: view.capoLabel,
          chart: view.chart,
        });
      } catch (error) {
        if (!cancelled) {
          console.error('[StageDisplay] Failed to load chord chart:', error);
          setChart({ status: 'error', title: item.title });
        }
      }
    };

    loadChart();
    return () => { cancelled = true; };
  }, [church, currentItem, store]);

  // Leader-only keyboard navigation while no controller is broadcasting.
  useEffect(() => {
    if (!manualAllowed) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [manualAllowed, goNext, goPrev]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen is a convenience; some mobile browsers block it.
    }
  };

  if (authLoading || (church && loading)) {
    return (
      <Center h="100dvh" bg="#0b0f14">
        <Spinner size="xl" color="#2dd4bf" thickness="3px" />
      </Center>
    );
  }

  if (!church || loadError || !service) {
    return (
      <Center h="100dvh" bg="#0b0f14" color="#f8fafc" px="6">
        <VStack spacing="3" textAlign="center">
          <Text fontSize="xl" fontWeight="700">{loadError || 'Sign in to view this stage display'}</Text>
          <Text fontSize="sm" color="#94a3b8">
            Stage display is only available to your church team.
          </Text>
          <IconButton
            aria-label="Back to service"
            icon={<ArrowLeft size={20} />}
            variant="outline"
            color="#f8fafc"
            borderColor="#334155"
            onClick={() => router.push(`/services/${serviceId}`)}
          />
        </VStack>
      </Center>
    );
  }

  const isLive = connection === 'live';
  const isSong = currentItem?.type === 'song';

  return (
    <Flex h="100dvh" bg="#0b0f14" color="#f8fafc" direction="column" overflow="hidden">
      {/* Minimal top strip: status, song, key. */}
      <Flex
        align="center"
        justify="space-between"
        gap="3"
        px={{ base: '3', md: '6' }}
        py={{ base: '2', md: '3' }}
        borderBottom="1px solid"
        borderColor="#1e293b"
        flexShrink={0}
        sx={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
      >
        <HStack spacing="3" minW="0">
          <IconButton
            aria-label="Back to service"
            icon={<ArrowLeft size={18} />}
            size="sm"
            variant="ghost"
            color="#94a3b8"
            _hover={{ color: '#f8fafc', bg: '#1e293b' }}
            onClick={() => router.push(`/services/${serviceId}`)}
            flexShrink={0}
          />
          <HStack spacing="2" flexShrink={0}>
            <Box
              w="9px"
              h="9px"
              borderRadius="full"
              bg={isLive ? '#2dd4bf' : connection === 'disconnected' ? '#fbbf24' : '#64748b'}
              sx={isLive ? { animation: 'pulse 2s infinite' } : undefined}
            />
            <Text fontSize="xs" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color={isLive ? '#5eead4' : '#94a3b8'}>
              {CONNECTION_LABELS[connection]}
            </Text>
          </HStack>
          <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="700" noOfLines={1} color="#e2e8f0">
            {service.title}
          </Text>
        </HStack>

        <HStack spacing="2" flexShrink={0}>
          {currentItem && (
            <Text fontSize="xs" color="#94a3b8" whiteSpace="nowrap">
              {clampItemIndex(currentIndex, items.length) + 1}/{items.length}
            </Text>
          )}
          {chart.key && (
            <Text fontSize="sm" fontWeight="800" color="#5eead4" whiteSpace="nowrap">
              {formatKey(chart.key)}
            </Text>
          )}
          <IconButton
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            icon={isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            size="sm"
            variant="ghost"
            color="#94a3b8"
            _hover={{ color: '#f8fafc', bg: '#1e293b' }}
            onClick={toggleFullscreen}
          />
        </HStack>
      </Flex>

      {/* Chart / current item */}
      <Box
        flex="1"
        minH="0"
        overflowY="auto"
        px={{ base: '4', md: '10' }}
        py={{ base: '4', md: '7' }}
        sx={{ WebkitOverflowScrolling: 'touch' }}
      >
        <Box maxW="1100px" mx="auto">
          {currentItem ? (
            <>
              <Flex align="flex-start" justify="space-between" gap="4" mb={{ base: '4', md: '6' }}>
                <Box minW="0">
                  <HStack spacing="2" mb="1">
                    {isSong ? <Music size={16} color="#fbbf24" /> : <AlignLeft size={16} color="#94a3b8" />}
                    <Text fontSize="xs" fontWeight="700" color="#94a3b8" textTransform="uppercase" letterSpacing="0.08em">
                      {isSong ? 'Song' : 'Segment'}
                    </Text>
                  </HStack>
                  <Text
                    fontSize={{ base: '2xl', md: '4xl' }}
                    fontWeight="800"
                    lineHeight="1.1"
                    color="#f8fafc"
                  >
                    {currentItem.title}
                  </Text>
                  {chart.artist && (
                    <Text mt="1" fontSize={{ base: 'sm', md: 'md' }} color="#94a3b8">
                      {chart.artist}
                    </Text>
                  )}
                  {(chart.capo || chart.ccli) && (
                    <HStack mt="2" spacing="3" flexWrap="wrap">
                      {chart.capo && (
                        <Text fontSize="xs" color="#c4b5fd" fontWeight="700">
                          {chart.capo}
                        </Text>
                      )}
                      {chart.ccli && (
                        <Text fontSize="xs" color="#64748b">
                          CCLI {chart.ccli}
                        </Text>
                      )}
                    </HStack>
                  )}
                </Box>
              </Flex>

              {isSong ? (
                chart.status === 'ready' ? (
                  <StageChordPro text={chart.chart || ''} />
                ) : chart.status === 'loading' ? (
                  <Center py="20">
                    <Spinner color="#2dd4bf" thickness="3px" />
                  </Center>
                ) : chart.status === 'error' ? (
                  <Box border="1px solid" borderColor="#7f1d1d" bg="#450a0a" borderRadius="xl" p="5">
                    <Text fontWeight="700" color="#fecaca">Could not load this chord chart</Text>
                    <Text mt="1" fontSize="sm" color="#fca5a5">
                      Check the connection and try again.
                    </Text>
                  </Box>
                ) : (
                  <Box border="1px solid" borderColor="#334155" bg="#0f172a" borderRadius="xl" p="5">
                    <Text fontWeight="700" color="#e2e8f0">No chord chart uploaded</Text>
                    <Text mt="1" fontSize="sm" color="#94a3b8">
                      Add a ChordPro chart on the song page to show lyrics and chords here.
                    </Text>
                  </Box>
                )
              ) : (
                currentItem.notes ? (
                  <Text fontSize={{ base: '2xl', md: '4xl' }} lineHeight="1.35" whiteSpace="pre-wrap">
                    {currentItem.notes}
                  </Text>
                ) : (
                  <Text fontSize={{ base: 'xl', md: '2xl' }} color="#94a3b8">
                    No notes for this segment.
                  </Text>
                )
              )}
            </>
          ) : (
            <Center py="20" h="60vh">
              <VStack spacing="3">
                <Radio size={32} color="#475569" />
                <Text fontSize="xl" color="#94a3b8">No items in this service yet.</Text>
              </VStack>
            </Center>
          )}
        </Box>
      </Box>

      {/* Manual controls only when no controller is broadcasting. */}
      {manualAllowed && currentItem && (
        <Flex
          align="center"
          justify="center"
          gap="4"
          px="4"
          py="3"
          borderTop="1px solid"
          borderColor="#1e293b"
          flexShrink={0}
          sx={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <IconButton
            aria-label="Previous item"
            icon={<ChevronLeft size={28} />}
            size="lg"
            borderRadius="full"
            variant="outline"
            color="#f8fafc"
            borderColor="#334155"
            _hover={{ bg: '#1e293b' }}
            isDisabled={!canGoPrev}
            onClick={goPrev}
            minW="56px"
            minH="56px"
          />
          <Text fontSize="xs" color="#94a3b8" fontWeight="600" textAlign="center">
            {connection === 'ended'
              ? 'Service ended - manual view'
              : connection === 'disconnected'
                ? 'Controller offline - manual view'
                : 'No live controller - manual view'}
          </Text>
          <IconButton
            aria-label="Next item"
            icon={<ChevronRight size={28} />}
            size="lg"
            borderRadius="full"
            variant="outline"
            color="#f8fafc"
            borderColor="#334155"
            _hover={{ bg: '#1e293b' }}
            isDisabled={!canGoNext}
            onClick={goNext}
            minW="56px"
            minH="56px"
          />
        </Flex>
      )}
    </Flex>
  );
}
