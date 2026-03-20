'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Spinner,
  Divider,
  Icon,
  Flex,
} from '@chakra-ui/react';
import { FiLock, FiCreditCard } from 'react-icons/fi';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase';
import { getStripePublishableKey } from '@/lib/stripe';

// Initialize Stripe
const stripePromise = loadStripe(getStripePublishableKey());

interface PaymentFormProps {
  priceType: 'monthly' | 'yearly';
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

function CheckoutForm({ priceType, amount, onSuccess, onCancel }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    async function initializePayment() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('No active session');
          setIsInitializing(false);
          return;
        }

        const response = await fetch('/api/billing/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ priceType }),
        });

        const data = await response.json();
        if (data.error) {
          setError(data.error);
        } else {
          setClientSecret(data.clientSecret);
        }
        setIsInitializing(false);
      } catch (err) {
        setError('Failed to initialize payment');
        setIsInitializing(false);
      }
    }

    initializePayment();
  }, [priceType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || 'Payment failed');
      setIsLoading(false);
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/settings/billing`,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message || 'Payment failed');
      setIsLoading(false);
      return;
    }

    // Payment succeeded, confirm subscription
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('No active session');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/billing/confirm-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          paymentIntentId: paymentIntent?.id,
          priceType,
        }),
      });

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        onSuccess();
      }
    } catch (err) {
      setError('Failed to activate subscription');
    }

    setIsLoading(false);
  };

  if (isInitializing) {
    return (
      <Flex justify="center" align="center" py={12}>
        <Spinner size="xl" color="teal.500" />
      </Flex>
    );
  }

  if (error && !clientSecret) {
    return (
      <Alert status="error" borderRadius="lg">
        <AlertIcon />
        <AlertTitle>Initialization Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const displayAmount = (amount / 100).toFixed(2);
  const period = priceType === 'yearly' ? 'year' : 'month';

  return (
    <VStack spacing={6} align="stretch">
      {/* Order Summary */}
      <Box p={6} bg="gray.50" borderRadius="lg">
        <VStack spacing={3} align="stretch">
          <HStack justify="space-between">
            <Text color="gray.600">WorshipCenter Subscription</Text>
            <Text fontWeight="semibold">${displayAmount}/{period}</Text>
          </HStack>
          <Divider />
          <HStack justify="space-between">
            <Text fontWeight="bold">Total</Text>
            <Text fontWeight="bold" color="teal.500" fontSize="xl">
              ${displayAmount}
            </Text>
          </HStack>
        </VStack>
      </Box>

      {/* Payment Form */}
      <form onSubmit={handleSubmit}>
        <VStack spacing={4} align="stretch">
          {/* Security Notice */}
          <HStack spacing={2} color="gray.500" fontSize="sm">
            <Icon as={FiLock} />
            <Text>Secure payment powered by Stripe</Text>
          </HStack>

          {/* Payment Element */}
          <Box
            p={4}
            bg="white"
            borderRadius="lg"
            borderWidth="1px"
            borderColor="gray.200"
          >
            <PaymentElement
              options={{
                layout: {
                  type: 'tabs',
                  defaultCollapsed: false,
                },
              }}
            />
          </Box>

          {/* Error Message */}
          {error && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            colorScheme="teal"
            size="lg"
            width="full"
            isLoading={isLoading}
            isDisabled={!stripe || !elements || isLoading}
            leftIcon={<FiCreditCard />}
          >
            {isLoading ? 'Processing...' : `Pay $${displayAmount}`}
          </Button>

          {/* Cancel Button */}
          <Button
            variant="ghost"
            onClick={onCancel}
            isDisabled={isLoading}
          >
            Cancel
          </Button>
        </VStack>
      </form>

      {/* Footer Notice */}
      <Text fontSize="sm" color="gray.500" textAlign="center">
        By completing your purchase, you agree to our Terms of Service.
        Your payment method will be saved for future billing.
      </Text>
    </VStack>
  );
}

interface EmbeddedPaymentFormProps {
  priceType: 'monthly' | 'yearly';
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function EmbeddedPaymentForm({
  priceType,
  amount,
  onSuccess,
  onCancel,
}: EmbeddedPaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    async function initializePayment() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsInitializing(false);
          return;
        }

        const response = await fetch('/api/billing/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ priceType }),
        });

        const data = await response.json();
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        }
        setIsInitializing(false);
      } catch (err) {
        setIsInitializing(false);
      }
    }

    initializePayment();
  }, [priceType]);

  if (isInitializing) {
    return (
      <Flex justify="center" align="center" py={12}>
        <Spinner size="xl" color="teal.500" />
      </Flex>
    );
  }

  if (!clientSecret) {
    return (
      <Alert status="error" borderRadius="lg">
        <AlertIcon />
        <AlertTitle>Unable to initialize payment</AlertTitle>
        <AlertDescription>Please try again or contact support.</AlertDescription>
      </Alert>
    );
  }

  // Custom styling to match Chakra UI theme
  const appearance = {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#319795', // Teal.500
      colorPrimaryText: '#ffffff',
      colorText: '#2D3748', // gray.800
      colorTextSecondary: '#718096', // gray.500
      colorBackground: '#ffffff',
      colorDanger: '#E53E3E', // red.500
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      fontSizeBase: '16px',
      spacingUnit: '4px',
      borderRadius: '8px',
      colorSuccess: '#48BB78', // green.500
      colorWarning: '#ECC94B', // yellow.400
      colorInfo: '#4299E1', // blue.400
    },
  } as const;

  const options = {
    clientSecret,
    appearance,
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm
        priceType={priceType}
        amount={amount}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}