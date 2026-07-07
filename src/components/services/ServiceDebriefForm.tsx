'use client';

import React, { useState, useEffect } from 'react';
import {
  Box, Text, HStack, VStack, Button, Textarea, Flex,
  useColorModeValue, useToast, Icon, Heading, Divider,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalCloseButton, ModalFooter, Tag, TagLabel, Badge,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import type { Service, ServiceItem, ServiceDebrief, TimingComparisonItem } from '@/lib/types';

// Lucide icons
import { Star, Clock, CheckCircle, AlertTriangle, RefreshCw, Heart } from 'lucide-react';

interface ServiceDebriefFormProps {
  service: Service;
  items: ServiceItem[];
  existingEntry?: ServiceDebrief | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const starColors = ['red.400', 'orange.400', 'yellow.400', 'lime.400', 'green.400'];
  const starLabels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  return (
    <Box>
      <Text fontSize="sm" fontWeight="600" mb="1">{label}</Text>
      <HStack spacing="1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Box
            key={star}
            as="button"
            type="button"
            onClick={() => onChange(star)}
            cursor="pointer"
            transition="all 0.1s"
            _hover={{ transform: 'scale(1.2)' }}
            color={star <= value ? starColors[value - 1] : 'gray.300'}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            <Star size={28} fill={star <= value ? starColors[value - 1] : 'none'} />
          </Box>
        ))}
        {value > 0 && (
          <Text fontSize="xs" color="gray.500" ml="2" fontStyle="italic">
            {starLabels[value - 1]}
          </Text>
        )}
      </HStack>
    </Box>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function ServiceDebriefForm({
  service, items, existingEntry, isOpen, onClose, onSubmitted,
}: ServiceDebriefFormProps) {
  const { user, church } = useAuth();
  const store = useStore();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [ratingEngagement, setRatingEngagement] = useState(existingEntry?.rating_engagement || 0);
  const [ratingFlow, setRatingFlow] = useState(existingEntry?.rating_flow || 0);
  const [ratingTech, setRatingTech] = useState(existingEntry?.rating_tech || 0);
  const [whatWentWell, setWhatWentWell] = useState(existingEntry?.what_went_well || '');
  const [whatBroke, setWhatBroke] = useState(existingEntry?.what_broke || '');
  const [whatToChange, setWhatToChange] = useState(existingEntry?.what_to_change || '');
  const [sawGodWorking, setSawGodWorking] = useState(existingEntry?.saw_god_working || '');

  // Build timing comparison data from service_items
  const [timingData, setTimingData] = useState<TimingComparisonItem[]>(() => {
    if (existingEntry?.timing_data && existingEntry.timing_data.length > 0) {
      return existingEntry.timing_data as TimingComparisonItem[];
    }
    return items.map((item) => ({
      item_id: item.id,
      title: item.title,
      type: item.type as 'song' | 'segment',
      planned_seconds: item.duration_minutes ? item.duration_minutes * 60 : null,
      actual_seconds: item.actual_duration_seconds ?? null,
    }));
  });

  const updateActual = (itemId: string, seconds: number | null) => {
    setTimingData((prev) =>
      prev.map((t) => (t.item_id === itemId ? { ...t, actual_seconds: seconds } : t))
    );
  };

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const cardBg = useColorModeValue('gray.50', 'gray.700');

  const allRatingsFilled = ratingEngagement > 0 && ratingFlow > 0 && ratingTech > 0;
  const allFieldsFilled = whatWentWell.trim().length > 0 && whatBroke.trim().length > 0
    && whatToChange.trim().length > 0 && sawGodWorking.trim().length > 0;

  const hasTiming = timingData.some((t) => t.actual_seconds != null);

  const handleSubmit = async () => {
    if (!church || !user) return;
    if (!allRatingsFilled) {
      toast({ title: 'Please complete all ratings', status: 'warning', duration: 2000 });
      return;
    }
    if (!allFieldsFilled) {
      toast({ title: 'Please fill in all reflection fields', status: 'warning', duration: 2000 });
      return;
    }

    setSubmitting(true);
    try {
      await store.debriefs.upsert({
        service_id: service.id,
        user_id: user.id,
        church_id: church.id,
        rating_engagement: ratingEngagement,
        rating_flow: ratingFlow,
        rating_tech: ratingTech,
        what_went_well: whatWentWell,
        what_broke: whatBroke,
        what_to_change: whatToChange,
        saw_god_working: sawGodWorking,
        timing_data: timingData,
      });
      toast({ title: existingEntry ? 'Debrief updated!' : 'Debrief submitted!', status: 'success', duration: 2000 });
      onSubmitted?.();
      onClose();
    } catch (error) {
      console.error('[DebriefForm] Submit failed:', error);
      toast({ title: 'Error submitting debrief', status: 'error', duration: 3000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={{ base: 'full', md: 'xl' }} scrollBehavior="inside" closeOnOverlayClick={false}>
      <ModalOverlay backdropBlur="sm" />
      <ModalContent bg={bgColor} borderRadius={{ base: '0', md: '2xl' }} mx={{ base: '0', md: '4' }}>
        <ModalHeader fontWeight="700">
          <HStack spacing="3">
            <Clock size={20} />
            <Box>
              <Text>Service Debrief</Text>
              <Text fontSize="sm" fontWeight="normal" color={subtextColor}>
                {service.title} — {service.date}
              </Text>
            </Box>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing="6" align="stretch">
            {/* Ratings */}
            <Box bg={cardBg} borderRadius="lg" p="4">
              <Text fontSize="sm" fontWeight="700" mb="3" textTransform="uppercase" letterSpacing="wide" color={subtextColor}>
                Rate This Service
              </Text>
              <VStack spacing="4" align="stretch">
                <StarRating value={ratingEngagement} onChange={setRatingEngagement} label="Engagement" />
                <StarRating value={ratingFlow} onChange={setRatingFlow} label="Flow &amp; Pace" />
                <StarRating value={ratingTech} onChange={setRatingTech} label="Technical (Sound/Media)" />
              </VStack>
            </Box>

            {/* Timing Comparison */}
            {hasTiming && (
              <Box bg={cardBg} borderRadius="lg" p="4">
                <HStack mb="3" spacing="2">
                  <Clock size={16} />
                  <Text fontSize="sm" fontWeight="700" textTransform="uppercase" letterSpacing="wide" color={subtextColor}>
                    Timing vs Planned
                  </Text>
                  <Tag size="sm" colorScheme="blue" borderRadius="full" fontSize="xs">
                    from Service Mode
                  </Tag>
                </HStack>
                <VStack spacing="2" align="stretch">
                  {timingData.map((t) => {
                    const variance = t.actual_seconds != null && t.planned_seconds != null
                      ? t.actual_seconds - t.planned_seconds
                      : null;
                    const isOver = variance != null && variance > 30; // more than 30s over
                    const varianceLabel = variance != null
                      ? `${variance > 0 ? '+' : ''}${formatDuration(Math.abs(variance))}`
                      : null;

                    return (
                      <HStack key={t.item_id} spacing="3" justify="space-between" py="1">
                        <Box flex="1" minW="0">
                          <Text fontSize="sm" fontWeight="500" color={textColor} noOfLines={1}>
                            {t.title}
                          </Text>
                        </Box>
                        <HStack spacing="3" fontSize="xs" color={subtextColor}>
                          <Text>Plan: {formatDuration(t.planned_seconds)}</Text>
                          <Text>Actual:
                            {t.actual_seconds != null ? (
                              <Box as="span" fontWeight="600" color={isOver ? 'red.400' : 'green.400'} ml="1">
                                {formatDuration(t.actual_seconds)}
                              </Box>
                            ) : (
                              <Box as="span" color={subtextColor} ml="1">—</Box>
                            )}
                          </Text>
                          {varianceLabel && (
                            <Badge colorScheme={isOver ? 'red' : 'green'} fontSize="xs" variant="subtle">
                              {varianceLabel}
                            </Badge>
                          )}
                        </HStack>
                      </HStack>
                    );
                  })}
                </VStack>
                <Text fontSize="xs" color={subtextColor} mt="2" fontStyle="italic">
                  Actual times captured during Service Mode. Adjustments made here are saved with your debrief.
                </Text>
              </Box>
            )}

            {/* Reflection Fields */}
            <Box>
              <Text fontSize="sm" fontWeight="700" mb="3" textTransform="uppercase" letterSpacing="wide" color={subtextColor}>
                Your Reflections
              </Text>
              <VStack spacing="4">
                <Box>
                  <HStack spacing="2" mb="1">
                    <CheckCircle size={16} color="var(--chakra-colors-green-500)" />
                    <Text fontSize="sm" fontWeight="600">What went well?</Text>
                  </HStack>
                  <Textarea
                    value={whatWentWell}
                    onChange={(e) => setWhatWentWell(e.target.value)}
                    placeholder="What worked great? Any highlights?"
                    rows={2}
                    borderRadius="lg"
                    borderColor={borderColor}
                    _focus={{ borderColor: 'teal.400' }}
                  />
                </Box>

                <Box>
                  <HStack spacing="2" mb="1">
                    <AlertTriangle size={16} color="var(--chakra-colors-orange-500)" />
                    <Text fontSize="sm" fontWeight="600">What broke or struggled?</Text>
                  </HStack>
                  <Textarea
                    value={whatBroke}
                    onChange={(e) => setWhatBroke(e.target.value)}
                    placeholder="Any technical issues, miscommunications, or rough moments?"
                    rows={2}
                    borderRadius="lg"
                    borderColor={borderColor}
                    _focus={{ borderColor: 'teal.400' }}
                  />
                </Box>

                <Box>
                  <HStack spacing="2" mb="1">
                    <RefreshCw size={16} color="var(--chakra-colors-blue-500)" />
                    <Text fontSize="sm" fontWeight="600">What would you change?</Text>
                  </HStack>
                  <Textarea
                    value={whatToChange}
                    onChange={(e) => setWhatToChange(e.target.value)}
                    placeholder="What would you do differently next time?"
                    rows={2}
                    borderRadius="lg"
                    borderColor={borderColor}
                    _focus={{ borderColor: 'teal.400' }}
                  />
                </Box>

                <Box>
                  <HStack spacing="2" mb="1">
                    <Heart size={16} color="var(--chakra-colors-purple-500)" />
                    <Text fontSize="sm" fontWeight="600">How did you see God working?</Text>
                  </HStack>
                  <Textarea
                    value={sawGodWorking}
                    onChange={(e) => setSawGodWorking(e.target.value)}
                    placeholder="Moments where you sensed God's presence, answered prayers, spiritual impact..."
                    rows={2}
                    borderRadius="lg"
                    borderColor={borderColor}
                    _focus={{ borderColor: 'teal.400' }}
                  />
                </Box>
              </VStack>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter gap="3" borderTop="1px solid" borderColor={borderColor} mt="4">
          <Button variant="ghost" onClick={onClose} isDisabled={submitting}>
            Cancel
          </Button>
          <Button
            colorScheme="teal"
            onClick={handleSubmit}
            isLoading={submitting}
            loadingText="Saving..."
            fontWeight="600"
          >
            {existingEntry ? 'Update Debrief' : 'Submit Debrief'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
