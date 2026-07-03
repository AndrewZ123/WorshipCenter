'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Box, Flex, Text, HStack, VStack, Button, IconButton,
  useColorModeValue, useBreakpointValue,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTour } from '@/lib/tour/TourContext';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SPOTLIGHT_PADDING = 6;

function measureTarget(selector: string): TargetRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };
}

function IconBox({ icon: Icon }: { icon: React.ComponentType<{ size?: number }> }) {
  const bg = useColorModeValue('teal.50', 'rgba(13,148,136,0.15)');
  const color = useColorModeValue('teal.600', 'teal.300');
  return (
    <Box p="2" borderRadius="lg" bg={bg} color={color} flexShrink={0}>
      <Icon size={18} />
    </Box>
  );
}

export default function TourOverlay() {
  const { isActive, currentStep, steps, next, prev, end } = useTour();
  const step = steps[currentStep];
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const isMobile = useBreakpointValue({ base: true, lg: false });

  const overlayBg = useColorModeValue('rgba(0,0,0,0.55)', 'rgba(0,0,0,0.7)');
  const cardBg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isActive || !step?.targetSelector) {
      setTargetRect(null);
      return;
    }

    const measure = () => setTargetRect(measureTarget(step.targetSelector!));
    measure();

    const timeout = setTimeout(measure, 400);

    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [isActive, step]);

  useEffect(() => {
    if (isActive && step?.targetSelector) {
      const el = document.querySelector(step.targetSelector);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isActive, step]);

  useEffect(() => {
    if (!isActive) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { end(); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); return; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isActive, next, prev, end]);

  if (!mounted || !isActive || !step || steps.length === 0) return null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const noTarget = !step.targetSelector;

  let cardStyle: React.CSSProperties;

  if (isMobile) {
    cardStyle = {
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
    };
  } else if (noTarget) {
    cardStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  } else if (targetRect) {
    cardStyle = {
      left: `${Math.min(targetRect.left + targetRect.width + 16, window.innerWidth - 380)}px`,
      top: `${targetRect.top + targetRect.height / 2}px`,
      transform: 'translateY(-50%)',
    };
  } else {
    cardStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  return createPortal(
    <Box position="fixed" inset="0" zIndex={9999}>
      <Box
        position="absolute"
        inset="0"
        bg={overlayBg}
        onClick={end}
      />

      {targetRect && (
        <Box
          position="absolute"
          left={`${targetRect.left}px`}
          top={`${targetRect.top}px`}
          w={`${targetRect.width}px`}
          h={`${targetRect.height}px`}
          borderRadius="lg"
          boxShadow={`0 0 0 9999px ${overlayBg}`}
          pointerEvents="none"
          zIndex={1}
          transition="all 0.35s cubic-bezier(0.4, 0, 0.2, 1)"
        />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            zIndex: 2,
            pointerEvents: 'auto',
            ...cardStyle,
          }}
        >
          <Box
            bg={cardBg}
            borderRadius="xl"
            boxShadow="0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.1)"
            maxW={noTarget ? '420px' : '360px'}
            w={isMobile ? 'calc(100vw - 32px)' : 'auto'}
            p="5"
            onClick={(e) => e.stopPropagation()}
          >
            <VStack spacing="4" align="stretch">
              <Flex justify="space-between" align="flex-start">
                <HStack spacing="3">
                  <IconBox icon={step.icon} />
                  <Text fontWeight="700" fontSize="md" color={textColor}>
                    {step.title}
                  </Text>
                </HStack>
                <IconButton
                  icon={<X size={16} />}
                  variant="ghost"
                  size="xs"
                  aria-label="Close tour"
                  onClick={end}
                  borderRadius="full"
                  minW="32px"
                  h="32px"
                />
              </Flex>

              <Text fontSize="sm" color={subtextColor} lineHeight="tall">
                {step.description}
              </Text>

              <Flex justify="space-between" align="center">
                <HStack spacing="1.5">
                  {steps.map((_, i) => (
                    <Box
                      key={i}
                      w="2"
                      h="2"
                      borderRadius="full"
                      bg={i === currentStep ? 'teal.500' : 'gray.200'}
                      transition="background 0.2s"
                    />
                  ))}
                </HStack>

                <HStack spacing="2">
                  {!isFirst && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={prev}
                      leftIcon={<ChevronLeft size={14} />}
                      borderRadius="lg"
                      minH="36px"
                    >
                      Back
                    </Button>
                  )}
                  {isLast ? (
                    <Button
                      size="sm"
                      colorScheme="teal"
                      onClick={end}
                      borderRadius="lg"
                      fontWeight="600"
                      minH="36px"
                    >
                      Done
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      colorScheme="teal"
                      onClick={next}
                      rightIcon={<ChevronRight size={14} />}
                      borderRadius="lg"
                      fontWeight="600"
                      minH="36px"
                    >
                      {isFirst ? 'Start' : 'Next'}
                    </Button>
                  )}
                </HStack>
              </Flex>
            </VStack>
          </Box>
        </motion.div>
      </AnimatePresence>
    </Box>,
    document.body
  );
}
