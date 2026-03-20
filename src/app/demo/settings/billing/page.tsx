'use client';

import { useState } from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  Card,
  CardBody,
  Badge,
  Icon,
  SimpleGrid,
  List,
  ListItem,
  ListIcon,
  useColorModeValue,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { FiCheck, FiCreditCard, FiCalendar } from 'react-icons/fi';

export default function DemoBillingPage() {
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');

  const handleSubscribe = async (priceType: 'monthly' | 'yearly') => {
    setIsLoadingCheckout(true);
    // Simulate checkout redirect
    setTimeout(() => {
      setIsLoadingCheckout(false);
      alert(`This is a demo! In the real app, you would be redirected to Stripe checkout for the ${priceType} plan.`);
    }, 1000);
  };

  return (
    <Box p={{ base: '4', md: '8' }} maxW="1100px" mx="auto">
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading size="lg" mb={2} color={textColor}>Billing & Subscription</Heading>
          <Text color={subtextColor}>Manage your WorshipCenter subscription</Text>
        </Box>

        {/* Demo Mode Alert */}
        <Alert status="info" borderRadius="lg">
          <AlertIcon />
          <Box>
            <AlertTitle>Demo Mode</AlertTitle>
            <AlertDescription>
              This is a demo environment. Subscription changes won't actually be processed.
              Purchase the full app to manage your real subscription.
            </AlertDescription>
          </Box>
        </Alert>

        {/* Current Status Card */}
        <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
          <CardBody>
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between">
                <HStack>
                  <Icon as={FiCreditCard} boxSize={5} color="brand.500" />
                  <Heading size="md" color={textColor}>Subscription Status</Heading>
                </HStack>
                <Badge
                  colorScheme="green"
                  fontSize="sm"
                  px={3}
                  py={1}
                  borderRadius="full"
                >
                  Active (Demo)
                </Badge>
              </HStack>

              <HStack color={subtextColor}>
                <Icon as={FiCalendar} />
                <Text>
                  Demo includes full access to all features
                </Text>
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        {/* Pricing Cards */}
        <Box>
          <Heading size="md" mb={4} color={textColor}>Choose Your Plan</Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            {/* Monthly Plan */}
            <Card
              bg={bgColor}
              borderColor={borderColor}
              borderWidth="1px"
              _hover={{ borderColor: 'brand.400', shadow: 'md' }}
              transition="all 0.2s"
            >
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <Heading size="md" color={textColor}>Monthly</Heading>
                  <HStack align="baseline">
                    <Text fontSize="3xl" fontWeight="bold" color={textColor}>$29</Text>
                    <Text color={subtextColor}>/month</Text>
                  </HStack>
                  <Text color={subtextColor} fontSize="sm">
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
                        <ListIcon as={FiCheck} color="brand.500" />
                        <Text fontSize="sm" color={textColor}>{feature}</Text>
                      </ListItem>
                    ))}
                  </List>
                  <Button
                    colorScheme="brand"
                    variant="outline"
                    onClick={() => handleSubscribe('monthly')}
                    isLoading={isLoadingCheckout}
                    isDisabled={isLoadingCheckout}
                  >
                    Subscribe Monthly
                  </Button>
                </VStack>
              </CardBody>
            </Card>

            {/* Yearly Plan */}
            <Card
              bg={useColorModeValue('brand.50', 'gray.700')}
              borderColor="brand.400"
              borderWidth="2px"
              position="relative"
            >
              <Badge
                colorScheme="brand"
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
                  <Heading size="md" color={textColor}>Yearly</Heading>
                  <HStack align="baseline">
                    <Text fontSize="3xl" fontWeight="bold" color={textColor}>$290</Text>
                    <Text color={subtextColor}>/year</Text>
                  </HStack>
                  <Text color={subtextColor} fontSize="sm">
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
                        <ListIcon as={FiCheck} color="brand.500" />
                        <Text fontSize="sm" color={textColor}>{feature}</Text>
                      </ListItem>
                    ))}
                  </List>
                  <Button
                    colorScheme="brand"
                    onClick={() => handleSubscribe('yearly')}
                    isLoading={isLoadingCheckout}
                    isDisabled={isLoadingCheckout}
                  >
                    Subscribe Yearly
                  </Button>
                </VStack>
              </CardBody>
            </Card>
          </SimpleGrid>
        </Box>

        {/* FAQs */}
        <Box>
          <Heading size="md" mb={4} color={textColor}>Frequently Asked Questions</Heading>
          <VStack align="stretch" spacing={4}>
            <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
              <CardBody>
                <Text fontWeight="medium" mb={2} color={textColor}>Can I cancel anytime?</Text>
                <Text color={subtextColor} fontSize="sm">
                  Yes, you can cancel your subscription at any time from this page. You'll continue to have access until the end of your billing period.
                </Text>
              </CardBody>
            </Card>
            <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
              <CardBody>
                <Text fontWeight="medium" mb={2} color={textColor}>What payment methods do you accept?</Text>
                <Text color={subtextColor} fontSize="sm">
                  We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe.
                </Text>
              </CardBody>
            </Card>
            <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
              <CardBody>
                <Text fontWeight="medium" mb={2} color={textColor}>Is there a per-user fee?</Text>
                <Text color={subtextColor} fontSize="sm">
                  No! WorshipCenter includes unlimited team members at no extra cost. Add your entire worship team without worrying about the price.
                </Text>
              </CardBody>
            </Card>
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
}