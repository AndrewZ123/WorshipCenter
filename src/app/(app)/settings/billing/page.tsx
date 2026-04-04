'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  Card,
  CardBody,
  Badge,
  Icon,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  SimpleGrid,
  List,
  ListItem,
  ListIcon,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { FiCheck, FiCreditCard, FiCalendar, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from '@/lib/auth';
import { useSubscription } from '@/lib/useSubscription';
import { supabase } from '@/lib/supabase';
import SyncSubscriptionButton from '@/components/billing/SyncSubscriptionButton';
import { PRICING } from '@/lib/stripe';

export default function BillingPage() {
  const { user } = useAuth();
  const { subscription, billingState, loading, refetch } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState<'monthly' | 'yearly' | null>(null);
  const [success, setSuccess] = useState(false);
  const toast = useToast();

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    // Check for success param from Stripe redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setSuccess(true);
      // Clear the URL param so it doesn't persist on re-renders
      window.history.replaceState({}, '', '/settings/billing');
      refetch();
    }
  }, [refetch]);

  const handleSubscribe = useCallback(async (priceType: 'monthly' | 'yearly') => {
    setCheckoutLoading(priceType);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Please log in to subscribe', status: 'error' });
        return;
      }

      const response = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ priceType }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        toast({ title: data.error || 'Failed to start checkout', status: 'error' });
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: 'Failed to get checkout URL', status: 'error' });
      }
    } catch (err) {
      console.error('[Billing] Checkout error:', err);
      toast({ title: 'Failed to start checkout. Please try again.', status: 'error' });
    } finally {
      setCheckoutLoading(null);
    }
  }, [toast]);

  if (loading) {
    return (
      <Container maxW="container.xl" py={8} centerContent>
        <Spinner size="xl" color="teal.500" />
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>Billing & Subscription</Heading>
          <Text color="gray.600">Manage your WorshipCenter subscription</Text>
        </Box>

        {success && (
          <Alert status="success" borderRadius="lg">
            <AlertIcon />
            <AlertTitle>Payment successful!</AlertTitle>
            <AlertDescription>
              Your subscription is now active. Thank you for supporting WorshipCenter!
            </AlertDescription>
          </Alert>
        )}

        {/* Current Status Card */}
        <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
          <CardBody>
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between">
                <HStack>
                  <Icon as={FiCreditCard} boxSize={5} color="teal.500" />
                  <Heading size="md">Subscription Status</Heading>
                </HStack>
                <Badge
                  colorScheme={
                    billingState.isActive ? 'green' :
                    billingState.isTrialing ? 'blue' :
                    billingState.isPastDue ? 'red' : 'gray'
                  }
                  fontSize="sm"
                  px={3}
                  py={1}
                  borderRadius="full"
                >
                  {billingState.isActive ? 'Active' :
                   billingState.isTrialing ? 'Free Trial' :
                   billingState.isPastDue ? 'Past Due' : 'Inactive'}
                </Badge>
              </HStack>

              {billingState.isTrialing && (
                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Trial Period</AlertTitle>
                    <AlertDescription>
                      You have <strong>{billingState.daysRemaining} days</strong> remaining in your free trial.
                      Subscribe now to continue using WorshipCenter after your trial ends.
                    </AlertDescription>
                  </Box>
                </Alert>
              )}

              {billingState.isActive && subscription && (
                <HStack color="gray.600">
                  <Icon as={FiCalendar} />
                  <Text>
                    {subscription.current_period_end && (
                      <>Next billing date: {new Date(subscription.current_period_end).toLocaleDateString()}</>
                    )}
                  </Text>
                </HStack>
              )}

              {!billingState.isTrialing && !billingState.isActive && (
                <Alert status="warning" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Subscription Required</AlertTitle>
                    <AlertDescription>
                      Your trial has ended. Subscribe now to regain access to WorshipCenter.
                    </AlertDescription>
                  </Box>
                </Alert>
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* Pricing Cards - Only show if not already subscribed */}
        {!billingState.isActive && (
          <Box>
            <Heading size="md" mb={4}>Choose Your Plan</Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              {/* Monthly Plan */}
              <Card
                bg={bgColor}
                borderColor={borderColor}
                borderWidth="1px"
                _hover={{ borderColor: 'teal.400', shadow: 'md' }}
                transition="all 0.2s"
              >
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    <Heading size="md">Monthly</Heading>
                    <HStack align="baseline">
                      <Text fontSize="3xl" fontWeight="bold">$29</Text>
                      <Text color="gray.500">/month</Text>
                    </HStack>
                    <Text color="gray.600" fontSize="sm">
                      Perfect for trying out WorshipCenter
                    </Text>
                    <List spacing={2}>
                      {[
                        'Unlimited services',
                        'Unlimited songs & team members',
                        'Team scheduling',
                        'CCLI reporting',
                        'Mobile app access',
                      ].map((feature) => (
                        <ListItem key={feature} display="flex" alignItems="center">
                          <ListIcon as={FiCheck} color="teal.500" />
                          <Text fontSize="sm">{feature}</Text>
                        </ListItem>
                      ))}
                    </List>
                    <Button
                      colorScheme="teal"
                      variant="outline"
                      type="button"
                      isLoading={checkoutLoading === 'monthly'}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSubscribe('monthly');
                      }}
                    >
                      Subscribe Monthly
                    </Button>
                  </VStack>
                </CardBody>
              </Card>

              {/* Yearly Plan */}
              <Card
                bg="teal.50"
                borderColor="teal.400"
                borderWidth="2px"
                position="relative"
              >
                <Badge
                  colorScheme="teal"
                  position="absolute"
                  top="-2"
                  right="4"
                  px={3}
                  py={1}
                  borderRadius="full"
                >
                  Save 2 months
                </Badge>
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    <Heading size="md">Yearly</Heading>
                    <HStack align="baseline">
                      <Text fontSize="3xl" fontWeight="bold">$290</Text>
                      <Text color="gray.500">/year</Text>
                    </HStack>
                    <Text color="gray.600" fontSize="sm">
                      Best value — save $58 per year
                    </Text>
                    <List spacing={2}>
                      {[
                        'Everything in Monthly',
                        '2 months free',
                        'Priority support',
                        'Early access to new features',
                      ].map((feature) => (
                        <ListItem key={feature} display="flex" alignItems="center">
                          <ListIcon as={FiCheck} color="teal.500" />
                          <Text fontSize="sm">{feature}</Text>
                        </ListItem>
                      ))}
                    </List>
                    <Button
                      colorScheme="teal"
                      type="button"
                      isLoading={checkoutLoading === 'yearly'}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSubscribe('yearly');
                      }}
                    >
                      Subscribe Yearly
                    </Button>
                  </VStack>
                </CardBody>
              </Card>
            </SimpleGrid>
          </Box>
        )}

        {/* FAQs */}
        <Box>
          <Heading size="md" mb={4}>Frequently Asked Questions</Heading>
          <VStack align="stretch" spacing={4}>
            <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
              <CardBody>
                <Text fontWeight="medium" mb={2}>Can I cancel anytime?</Text>
                <Text color="gray.600" fontSize="sm">
                  Yes, you can cancel your subscription at any time from this page. You'll continue to have access until the end of your billing period.
                </Text>
              </CardBody>
            </Card>
            <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
              <CardBody>
                <Text fontWeight="medium" mb={2}>What payment methods do you accept?</Text>
                <Text color="gray.600" fontSize="sm">
                  We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe.
                </Text>
              </CardBody>
            </Card>
            <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
              <CardBody>
                <Text fontWeight="medium" mb={2}>Is there a per-user fee?</Text>
                <Text color="gray.600" fontSize="sm">
                  No! WorshipCenter includes unlimited team members at no extra cost. Add your entire worship team without worrying about the price.
                </Text>
              </CardBody>
            </Card>
          </VStack>
        </Box>
        {/* Sync Subscription - for troubleshooting */}
        <Box textAlign="right">
          <SyncSubscriptionButton />
        </Box>
      </VStack>
    </Container>
  );
}
