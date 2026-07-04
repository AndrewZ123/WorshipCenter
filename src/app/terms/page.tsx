import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  Divider,
  List,
  ListItem,
} from '@chakra-ui/react';
import { FileText, ArrowRight } from 'lucide-react';

export default function TermsPage() {
  return (
    <Container maxW="3xl" py={{ base: 8, md: 16 }} px={{ base: 4, md: 8 }}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Box mb={4} display="flex" justifyContent="center">
            <Box p={3} borderRadius="lg" bg="teal.50" color="teal.600">
              <FileText size={32} />
            </Box>
          </Box>
          <Heading as="h1" size="xl" mb={2}>
            Terms of Service
          </Heading>
          <Text color="gray.500" fontSize="sm">
            Last updated: July 4, 2026
          </Text>
        </Box>

        <Divider />

        <VStack spacing={6} align="stretch">
          <Box>
            <Heading as="h2" size="md" mb={3}>1. Acceptance of Terms</Heading>
            <Text color="gray.600" lineHeight="tall">
              By accessing or using WorshipCenter ("the Service"), you agree to be bound by these Terms of Service.
              If you do not agree, do not use the Service.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="md" mb={3}>2. Description of Service</Heading>
            <Text color="gray.600" lineHeight="tall">
              WorshipCenter is a church service planning and management platform. It allows churches to plan services,
              manage song libraries, coordinate team members, communicate via chat, and track service debriefs.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="md" mb={3}>3. User Accounts</Heading>
            <List spacing={3}>
              {[
                'You must be at least 13 years old to use the Service',
                'You are responsible for maintaining the confidentiality of your account credentials',
                'You are responsible for all activity under your account',
                'You must provide accurate and complete information when creating an account',
                'You may not create multiple accounts or share accounts with unauthorized users',
              ].map((item, i) => (
                <ListItem key={i} display="flex" alignItems="flex-start" gap={3}>
                  <Box mt={1} color="teal.500" flexShrink={0}>
                    <ArrowRight size={16} />
                  </Box>
                  <Text color="gray.600">{item}</Text>
                </ListItem>
              ))}
            </List>
          </Box>

          <Box>
            <Heading as="h2" size="md" mb={3}>4. User Content and Conduct</Heading>
            <Text color="gray.600" lineHeight="tall" mb={3}>
              You retain ownership of all content you submit to the Service (chat messages, service plans,
              song data, debriefs). By submitting content, you grant us a license to store, display, and
              process that content as necessary to provide the Service.
            </Text>
            <Text color="gray.600" lineHeight="tall" mb={3}>
              You agree not to use the Service to:
            </Text>
            <List spacing={2}>
              {[
                'Post harassing, abusive, threatening, or obscene content',
                'Post content that violates any applicable law or regulation',
                'Post content that infringes on the intellectual property rights of others',
                'Upload malware, viruses, or harmful code',
                'Interfere with the operation of the Service',
                'Attempt to access another user\'s account or data without authorization',
              ].map((item, i) => (
                <ListItem key={i} display="flex" alignItems="flex-start" gap={3}>
                  <Box mt={1} color="teal.500" flexShrink={0}>
                    <ArrowRight size={16} />
                  </Box>
                  <Text color="gray.600">{item}</Text>
                </ListItem>
              ))}
            </List>
          </Box>

          <Box>
            <Heading as="h2" size="md" mb={3}>5. Content Moderation</Heading>
            <Text color="gray.600" lineHeight="tall">
              WorshipCenter provides reporting mechanisms for inappropriate content. Church administrators
              are responsible for moderating content within their church. We reserve the right to remove
              content and suspend accounts that violate these terms.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="md" mb={3}>6. Subscription and Payments</Heading>
            <Text color="gray.600" lineHeight="tall">
              Paid subscriptions are billed monthly or annually as selected. Subscriptions auto-renew
              unless canceled. You can cancel at any time via the Stripe Customer Portal in Settings.
              No refunds are provided for partial billing periods. We reserve the right to change
              pricing with 30 days notice.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="md" mb={3}>7. Termination</Heading>
            <Text color="gray.600" lineHeight="tall">
              You may delete your account at any time from Settings. We may suspend or terminate
              access for violations of these terms. Upon termination, your data will be deleted
              within 30 days except where required for legal or tax purposes.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="md" mb={3}>8. Limitation of Liability</Heading>
            <Text color="gray.600" lineHeight="tall">
              The Service is provided "as is" without warranties of any kind. WorshipCenter is not
              liable for any damages arising from the use of the Service. In no event shall our
              liability exceed the amount paid by you in the 12 months preceding the claim.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="md" mb={3}>9. Changes to Terms</Heading>
            <Text color="gray.600" lineHeight="tall">
              We may modify these terms at any time. We will notify you of material changes via
              email or in-app notification. Continued use after changes constitutes acceptance.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="md" mb={3}>10. Contact</Heading>
            <Text color="gray.600" lineHeight="tall">
              Questions about these terms? Contact us at support@worshipcenter.app.
            </Text>
          </Box>
        </VStack>
      </VStack>
    </Container>
  );
}
