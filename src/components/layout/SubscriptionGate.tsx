'use client';

import { Box, Container, VStack, Text, Button, Icon, Badge, HStack, useColorModeValue } from '@chakra-ui/react';
import { FiLock, FiArrowRight, FiCreditCard } from 'react-icons/fi';
import { useSubscription } from '@/lib/useSubscription';
import { useAuth } from '@/lib/auth';
import NextLink from 'next/link';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { isActive, isTrialing, isPastDue, loading } = useSubscription();
  const hasAccess = isActive || isTrialing;
  const { user } = useAuth();
  
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Show loading state
  if (loading) {
    return (
      <Box w="full" h="100vh" display="flex" alignItems="center" justifyContent="center" bg={bgColor}>
        <Text color="gray.400">Loading...</Text>
      </Box>
    );
  }
  
  // If user has access (trialing or active), show the app
  if (hasAccess) {
    return <>{children}</>;
  }
  
  // User doesn't have access - show subscription required screen
  return (
    <Box w="full" minH="100vh" display="flex" alignItems="center" justifyContent="center" bg={bgColor} p={4}>
      <Container maxW="md">
        <VStack
          bg={cardBg}
          borderRadius="2xl"
          borderWidth="1px"
          borderColor={borderColor}
          p={8}
          spacing={6}
          shadow="xl"
          textAlign="center"
        >
          <Box
            w="16"
            h="16"
            borderRadius="full"
            bg="orange.100"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Icon as={FiLock} boxSize={8} color="orange.500" />
          </Box>
          
          <VStack spacing={2}>
            <Text fontSize="xl" fontWeight="700" color="gray.800">
              {isPastDue ? 'Payment Overdue' : 'Trial Ended'}
            </Text>
            <Text color="gray.500" fontSize="sm">
              {isPastDue
                ? 'Your subscription payment failed. Please update your payment method to regain access.'
                : 'Your 14-day free trial has ended. Subscribe now to continue using WorshipCenter.'}
            </Text>
          </VStack>
          
          <VStack spacing={3} w="full">
            <HStack justify="center" spacing={2}>
              <Badge colorScheme="teal" fontSize="sm" px={3} py={1}>$29/mo</Badge>
              <Text color="gray.400">or</Text>
              <Badge colorScheme="green" fontSize="sm" px={3} py={1}>$290/yr (save 2 months)</Badge>
            </HStack>
            
            <Button
              as={NextLink}
              href="/settings/billing"
              colorScheme="teal"
              size="lg"
              w="full"
              rightIcon={<Icon as={FiArrowRight} />}
              fontWeight="600"
            >
              Subscribe Now
            </Button>
            
            <Button
              as={NextLink}
              href="https://worshipcenter.app/pricing"
              variant="ghost"
              size="sm"
              leftIcon={<Icon as={FiCreditCard} />}
            >
              View Pricing Details
            </Button>
          </VStack>
          
          {user && (
            <Text fontSize="xs" color="gray.400">
              Logged in as {user.email}
            </Text>
          )}
        </VStack>
      </Container>
    </Box>
  );
}