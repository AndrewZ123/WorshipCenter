'use client';

import { useState, useEffect } from 'react';
import { Box, Button, HStack, Text, Icon, Container, Badge, useColorModeValue, VStack, Flex } from '@chakra-ui/react';
import { FiClock, FiArrowRight, FiCheck } from 'react-icons/fi';
import { useSubscription } from '@/lib/useSubscription';
import NextLink from 'next/link';

export function TrialBanner() {
  const { billingState, hasAccess, loading } = useSubscription();
  
  const bgColor = useColorModeValue('teal.50', 'teal.900');
  const borderColor = useColorModeValue('teal.200', 'teal.700');
  
  // Don't show banner while loading, if active subscription, not trialing, or more than 3 days remaining
  if (loading || billingState.isActive || !billingState.isTrialing || billingState.daysRemaining > 3) {
    return null;
  }
  
  const daysText = billingState.daysRemaining === 1 ? '1 day' : `${billingState.daysRemaining} days`;
  
  return (
    <Box
      bg={bgColor}
      borderBottom="1px"
      borderColor={borderColor}
      py={3}
    >
      <Container maxW="container.xl">
        <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
          <HStack spacing={3}>
            <Icon as={FiClock} color="teal.600" boxSize={5} />
            <VStack align="start" spacing={0}>
              <Text fontSize="sm" color="teal.800" fontWeight="600">
                {daysText} remaining in your free trial
              </Text>
              <HStack spacing={1} display={{ base: 'none', md: 'flex' }}>
                <Text fontSize="xs" color="teal.600">
                  Subscribe now:
                </Text>
                <Badge colorScheme="teal" variant="subtle" fontSize="xs">$29/mo</Badge>
                <Text fontSize="xs" color="teal.600">or</Text>
                <Badge colorScheme="green" variant="subtle" fontSize="xs">$290/yr (save 2 months)</Badge>
              </HStack>
            </VStack>
          </HStack>
          <Button
            as={NextLink}
            href="/settings/billing"
            size="sm"
            colorScheme="teal"
            rightIcon={<Icon as={FiArrowRight} />}
            fontWeight="600"
          >
            Subscribe Now
          </Button>
        </Flex>
      </Container>
    </Box>
  );
}

export function TrialExpiredBanner() {
  const { billingState, loading } = useSubscription();
  
  const bgColor = useColorModeValue('orange.50', 'orange.900');
  const borderColor = useColorModeValue('orange.200', 'orange.700');
  
  // Only show if not loading, trial expired and not active
  if (loading || billingState.isActive || billingState.isTrialing) {
    return null;
  }
  
  return (
    <Box
      bg={bgColor}
      borderBottom="1px"
      borderColor={borderColor}
      py={3}
    >
      <Container maxW="container.xl">
        <HStack justify="space-between" wrap="wrap" spacing={4}>
          <Text fontSize="sm" color="orange.800">
            <strong>Your trial has ended.</strong> Subscribe now to regain access to WorshipCenter.
          </Text>
          <Button
            as={NextLink}
            href="/settings/billing"
            size="sm"
            colorScheme="orange"
            rightIcon={<Icon as={FiArrowRight} />}
          >
            Subscribe Now
          </Button>
        </HStack>
      </Container>
    </Box>
  );
}

// Floating CTA for trial users - shows on bottom right
export function FloatingSubscribeCTA() {
  const { billingState } = useSubscription();
  const [isVisible, setIsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  
  const bgColor = useColorModeValue('teal.500', 'teal.400');
  const hoverBg = useColorModeValue('teal.600', 'teal.500');
  
  useEffect(() => {
    // Show after 30 seconds on page
    const timer = setTimeout(() => {
      if (billingState.isTrialing && !billingState.isActive && !dismissed && billingState.daysRemaining <= 3) {
        setIsVisible(true);
      }
    }, 30000);
    
    return () => clearTimeout(timer);
  }, [billingState.isTrialing, billingState.isActive, dismissed, billingState.daysRemaining]);
  
  // Don't show if not trialing, already active, dismissed, or more than 3 days remaining
  if (!billingState.isTrialing || billingState.isActive || dismissed || billingState.daysRemaining > 3) {
    return null;
  }
  
  if (!isVisible) return null;
  
  return (
    <Box
      position="fixed"
      bottom="24px"
      right="24px"
      zIndex="1000"
      bg={bgColor}
      color="white"
      borderRadius="xl"
      p={4}
      shadow="2xl"
      maxW="280px"
      _hover={{ bg: hoverBg }}
      transition="all 0.2s"
    >
      <Flex justify="space-between" align="start" mb={2}>
        <Text fontWeight="700" fontSize="sm">
          💜 Ready to subscribe?
        </Text>
        <Box
          as="button"
          onClick={() => setDismissed(true)}
          color="whiteAlpha.700"
          _hover={{ color: 'white' }}
          fontSize="sm"
          cursor="pointer"
          ml={2}
        >
          ✕
        </Box>
      </Flex>
      <Text fontSize="xs" mb={3} opacity={0.9}>
        {billingState.daysRemaining} days left in your trial. Keep your worship planning smooth with WorshipCenter.
      </Text>
      <HStack spacing={2} mb={3}>
        <Badge colorScheme="whiteAlpha" fontSize="xs">$29/mo</Badge>
        <Badge colorScheme="green" fontSize="xs">Save 2 months yearly</Badge>
      </HStack>
      <Button
        as={NextLink}
        href="/settings/billing"
        size="sm"
        bg="white"
        color="teal.600"
        _hover={{ bg: 'gray.100' }}
        w="full"
        fontWeight="600"
        rightIcon={<Icon as={FiArrowRight} />}
      >
        Subscribe Now
      </Button>
    </Box>
  );
}
