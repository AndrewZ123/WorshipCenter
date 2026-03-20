'use client';

import { useState, useEffect } from 'react';
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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
} from '@chakra-ui/react';
import { FiCheck, FiCreditCard, FiCalendar, FiClock } from 'react-icons/fi';
import { useAuth } from '@/lib/auth';
import { useSubscription } from '@/lib/useSubscription';
import { supabase } from '@/lib/supabase';
import EmbeddedPaymentForm from '@/components/billing/EmbeddedPaymentForm';
import { PRICING } from '@/lib/stripe';

export default function BillingPage() {
  const { user } = useAuth();
  const { subscription, billingState, loading, refetch } = useSubscription();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedPriceType, setSelectedPriceType] = useState<'monthly' | 'yearly'>('monthly');
  const [success, setSuccess] = useState(false);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    // Check for success param from Stripe redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setSuccess(true);
      refetch();
    }
  }, [refetch]);

  const handleSubscribe = (priceType: 'monthly' | 'yearly') => {
    console.log('Subscribe clicked:', priceType);
    setSelectedPriceType(priceType);
    setShowPaymentForm(true);
    console.log('Modal state set to true');
  };

  const handlePaymentSuccess = () => {
    setShowPaymentForm(false);
    setSuccess(true);
    
    // Refetch subscription immediately
    refetch();
    
    // Poll for subscription updates to catch webhook processing
    let attempts = 0;
    const maxAttempts = 10;
    const pollInterval = setInterval(async () => {
      attempts++;
      await refetch();
      
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
      }
    }, 1000);
    
    // Clean up interval after max attempts
    setTimeout(() => clearInterval(pollInterval), maxAttempts * 1000);
  };

  const handlePaymentCancel = () => {
    setShowPaymentForm(false);
  };

  const getAmountForPriceType = (priceType: 'monthly' | 'yearly') => {
    return priceType === 'yearly' ? PRICING.yearlyPrice : PRICING.monthlyPrice;
  };

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
      </VStack>

      {/* Embedded Payment Modal */}
      <Modal
        isOpen={showPaymentForm}
        onClose={handlePaymentCancel}
        size="lg"
        isCentered
        closeOnOverlayClick={false}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <ModalHeader>
            <HStack>
              <Icon as={FiCreditCard} color="teal.500" />
              <Text>Complete Your Subscription</Text>
            </HStack>
          </ModalHeader>
          <ModalBody pb={6}>
            <EmbeddedPaymentForm
              priceType={selectedPriceType}
              amount={getAmountForPriceType(selectedPriceType)}
              onSuccess={handlePaymentSuccess}
              onCancel={handlePaymentCancel}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </Container>
  );
}