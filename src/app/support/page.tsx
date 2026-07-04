'use client';

import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  Card,
  CardBody,
  Divider,
  Link,
  Button,
  useColorModeValue,
} from '@chakra-ui/react';
import { Mail, MessageCircle, HelpCircle, ExternalLink, ArrowLeft } from 'lucide-react';
import NextLink from 'next/link';

const faqs = [
  {
    q: 'How do I reset my password?',
    a: 'Go to the login page and click "Forgot password?" to receive a password reset email.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'Go to Settings &gt; Billing and click "Manage Subscription" to cancel via the Stripe Customer Portal. Your account will remain active until the end of the current billing period.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Go to Settings and scroll to the "Danger Zone" section at the bottom. Click "Delete Account" and follow the confirmation prompts. This action is irreversible.',
  },
  {
    q: 'How do I invite team members?',
    a: 'Navigate to Team and click "Invite Members." Enter their email addresses and select their roles. They will receive an invitation email.',
  },
  {
    q: 'How do I report inappropriate content in chat?',
    a: 'Hover over the message in Team Chat and click the "More" menu (three dots), then select "Report Message." Your church admin will be notified.',
  },
];

export default function SupportPage() {
  const bgColor = useColorModeValue('gray.50', 'gray.800');
  const cardBg = useColorModeValue('white', 'gray.700');

  return (
    <Container maxW="3xl" py={{ base: 8, md: 16 }} px={{ base: 4, md: 8 }}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Link
            as={NextLink}
            href="/login"
            color="teal.600"
            fontSize="sm"
            display="inline-flex"
            alignItems="center"
            gap={1}
            mb={4}
          >
            <ArrowLeft size={14} />
            Back to login
          </Link>
          <Box textAlign="center" mb={6}>
            <Box mb={4} display="flex" justifyContent="center">
              <Box p={3} borderRadius="lg" bg="teal.50" color="teal.600">
                <HelpCircle size={32} />
              </Box>
            </Box>
            <Heading as="h1" size="xl" mb={2}>
              Support
            </Heading>
            <Text color="gray.500">
              Get help with WorshipCenter. We are here to assist you.
            </Text>
          </Box>
        </Box>

        {/* Contact Methods */}
        <VStack spacing={4}>
          <Card w="full" bg={cardBg}>
            <CardBody display="flex" alignItems="center" gap={4}>
              <Box p={3} borderRadius="lg" bg="teal.50" color="teal.600" flexShrink={0}>
                <Mail size={24} />
              </Box>
              <Box flex="1">
                <Text fontWeight="600">Email Support</Text>
                <Text fontSize="sm" color="gray.500">
                  Send us an email and we will respond within 24 hours
                </Text>
                <Link href="mailto:support@worshipcenter.app" color="teal.600" fontWeight="500" fontSize="sm" mt={1} display="inline-block">
                  support@worshipcenter.app
                </Link>
              </Box>
            </CardBody>
          </Card>

          <Card w="full" bg={cardBg}>
            <CardBody display="flex" alignItems="center" gap={4}>
              <Box p={3} borderRadius="lg" bg="teal.50" color="teal.600" flexShrink={0}>
                <MessageCircle size={24} />
              </Box>
              <Box flex="1">
                <Text fontWeight="600">In-App Chat Support</Text>
                <Text fontSize="sm" color="gray.500">
                  Log in and use the Team Chat or contact your church admin for assistance
                </Text>
              </Box>
            </CardBody>
          </Card>
        </VStack>

        <Divider />

        {/* FAQs */}
        <Box>
          <Heading as="h2" size="lg" mb={6}>
            Frequently Asked Questions
          </Heading>
          <VStack spacing={4} align="stretch">
            {faqs.map((faq, i) => (
              <Card key={i} bg={cardBg}>
                <CardBody>
                  <Text fontWeight="600" mb={2}>
                    {faq.q}
                  </Text>
                  <Text color="gray.600" fontSize="sm" lineHeight="tall">
                    {faq.a}
                  </Text>
                </CardBody>
              </Card>
            ))}
          </VStack>
        </Box>

        <Divider />

        {/* More help */}
        <Box textAlign="center" bg={bgColor} p={6} borderRadius="lg">
          <Heading as="h3" size="sm" mb={2}>
            Still need help?
          </Heading>
          <Text color="gray.500" fontSize="sm" mb={4}>
            We are happy to answer any questions you have.
          </Text>
          <Button
            as="a"
            href="mailto:support@worshipcenter.app"
            colorScheme="teal"
            size="lg"
            rightIcon={<ExternalLink size={16} />}
          >
            Contact Support
          </Button>
        </Box>
      </VStack>
    </Container>
  );
}
