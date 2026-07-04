import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  Divider,
  List,
  ListItem,
  ListIcon,
  Link,
} from '@chakra-ui/react';
import { Shield, Mail, ArrowRight } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <Container maxW="3xl" py={{ base: 8, md: 16 }} px={{ base: 4, md: 8 }}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Box mb={4} display="flex" justifyContent="center">
            <Box p={3} borderRadius="lg" bg="teal.50" color="teal.600">
              <Shield size={32} />
            </Box>
          </Box>
          <Heading as="h1" size="xl" mb={2}>
            Privacy Policy
          </Heading>
          <Text color="gray.500" fontSize="sm">
            Last updated: July 4, 2026
          </Text>
        </Box>

        <Divider />

        <VStack spacing={6} align="stretch">
          <Box>
            <Heading as="h2" size="md" mb={3}>
              1. Introduction
            </Heading>
            <Text color="gray.600" lineHeight="tall">
              WorshipCenter ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your information when you use our mobile
              application and website (collectively, the "Service").
            </Text>
            <Text color="gray.600" lineHeight="tall" mt={3}>
              By using the Service, you agree to the collection and use of information in accordance with this policy.
              If you do not agree with our policies and practices, do not use the Service.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="md" mb={3}>
              2. Information We Collect
            </Heading>
            <Text color="gray.600" lineHeight="tall" mb={3}>
              We collect the following types of information to provide and improve our Service:
            </Text>
            <VStack spacing={4} align="stretch">
              <Box p={4} bg="gray.50" borderRadius="lg">
                <Text fontWeight="600" mb={1}>Account Information</Text>
                <Text fontSize="sm" color="gray.600">
                  Your name, email address, church name, and account credentials. This information is necessary
                  to create and maintain your account.
                </Text>
              </Box>
              <Box p={4} bg="gray.50" borderRadius="lg">
                <Text fontWeight="600" mb={1}>Church Data</Text>
                <Text fontSize="sm" color="gray.600">
                  Service plans, song libraries, team member information, schedules, and service debriefs you
                  create or manage within the app.
                </Text>
              </Box>
              <Box p={4} bg="gray.50" borderRadius="lg">
                <Text fontWeight="600" mb={1}>Payment Information</Text>
                <Text fontSize="sm" color="gray.600">
                  Subscription billing information is processed by Stripe, Inc. We do not store full credit card
                  numbers on our servers. Stripe's privacy policy applies to payment data.
                </Text>
              </Box>
              <Box p={4} bg="gray.50" borderRadius="lg">
                <Text fontWeight="600" mb={1}>Usage Data</Text>
                <Text fontSize="sm" color="gray.600">
                  We collect anonymous usage statistics (page views, feature interactions) to improve the app.
                  This data is not personally identifiable.
                </Text>
              </Box>
            </VStack>
          </Box>

          <Box>
            <Heading as="h2" size="md" mb={3}>
              3. How We Use Your Information
            </Heading>
            <List spacing={3}>
              {[
                'To provide, maintain, and improve the Service',
                'To process your subscription payments',
                'To send you service-related communications (assignments, schedule changes, reminders)',
                'To send administrative messages (account verification, password resets)',
                'To respond to your support inquiries',
                'To analyze usage patterns and improve app performance',
                'To comply with legal obligations',
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
            <Heading as="h2" size="md" mb={3}>
              4. Data Sharing and Disclosure
            </Heading>
            <Text color="gray.600" lineHeight="tall">
              We do not sell your personal information. We may share your information only in the following
              circumstances:
            </Text>
            <List spacing={3} mt={3}>
              {[
                'With service providers (Stripe for payments, Resend for email, Supabase for database hosting) who are contractually bound to protect your data',
                'To comply with legal process or enforceable governmental request',
                'To protect our rights, property, or safety, or the rights of other users',
                'With your consent or at your direction',
                'In connection with a business transfer (merger, acquisition, or sale of assets)',
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
            <Heading as="h2" size="md" mb={3}>
              5. Data Security
            </Heading>
            <Text color="gray.600" lineHeight="tall">
              We implement industry-standard security measures, including HTTPS encryption for all data in transit,
              encrypted database storage at rest, and strict access controls to your data. However, no method of
              electronic storage or transmission is 100% secure. We encourage you to use strong passwords and
              keep your login credentials confidential.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="md" mb={3}>
              6. Data Retention
            </Heading>
            <Text color="gray.600" lineHeight="tall">
              We retain your information for as long as your account is active. When you delete your account,
              we delete or anonymize your personal information within 30 days, except where we are required
              to retain certain records for legal or tax purposes (e.g., billing records for up to 7 years).
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="md" mb={3}>
              7. Your Rights
            </Heading>
            <Text color="gray.600" lineHeight="tall" mb={3}>
              Depending on your jurisdiction, you may have the following rights regarding your personal data:
            </Text>
            <List spacing={3}>
              {[
                'Access: Request a copy of the personal data we hold about you',
                'Correction: Request correction of inaccurate or incomplete data',
                'Deletion: Request deletion of your account and associated data (within the app or by contacting us)',
                'Portability: Request a copy of your data in a machine-readable format',
                'Objection: Object to processing of your data for certain purposes',
                'Withdrawal of consent: Withdraw consent at any time where we relied on consent to process your data',
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
            <Heading as="h2" size="md" mb={3}>
              8. Children&apos;s Privacy
            </Heading>
            <Text color="gray.600" lineHeight="tall">
              The Service is not intended for children under 13 years of age. We do not knowingly collect
              personal information from children under 13. If we become aware that a child under 13 has
              provided us with personal data, we will take steps to delete it.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="md" mb={3}>
              9. Third-Party Services
            </Heading>
            <Text color="gray.600" lineHeight="tall" mb={3}>
              The Service integrates with the following third-party services. Each service operates under its
              own privacy policy:
            </Text>
            <VStack spacing={2} align="stretch">
              {[
                { name: 'Supabase', url: 'https://supabase.com/privacy', desc: 'Database and authentication hosting' },
                { name: 'Stripe', url: 'https://stripe.com/privacy', desc: 'Payment processing for subscriptions' },
                { name: 'Resend', url: 'https://resend.com/privacy', desc: 'Email delivery for notifications' },
                { name: 'Twilio', url: 'https://www.twilio.com/legal/privacy', desc: 'SMS message delivery' },
                { name: 'Vercel', url: 'https://vercel.com/privacy', desc: 'Application hosting and analytics' },
                { name: 'Upstash', url: 'https://upstash.com/privacy', desc: 'Redis caching service' },
              ].map((service) => (
                <Box key={service.name} p={3} bg="gray.50" borderRadius="md">
                  <Text fontWeight="600" fontSize="sm">{service.name}</Text>
                  <Text fontSize="sm" color="gray.500">{service.desc}</Text>
                  <Link href={service.url} color="teal.600" fontSize="sm" isExternal>
                    {service.url}
                  </Link>
                </Box>
              ))}
            </VStack>
          </Box>

          <Box>
            <Heading as="h2" size="md" mb={3}>
              10. Changes to This Policy
            </Heading>
            <Text color="gray.600" lineHeight="tall">
              We may update this Privacy Policy from time to time. We will notify you of any material changes
              by posting the new policy on this page and, where appropriate, via in-app notification or email.
              Your continued use of the Service after changes take effect constitutes your acceptance of the
              revised policy.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="md" mb={3}>
              11. Contact Us
            </Heading>
            <Text color="gray.600" lineHeight="tall">
              If you have questions about this Privacy Policy or our data practices, please contact us:
            </Text>
            <Box p={4} bg="gray.50" borderRadius="lg" mt={3}>
              <VStack align="start" spacing={2}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Mail size={16} />
                  <Text fontWeight="600" fontSize="sm">support@worshipcenter.app</Text>
                </Box>
                <Text fontSize="sm" color="gray.500">
                  We will respond to your inquiry within 5 business days.
                </Text>
              </VStack>
            </Box>
          </Box>
        </VStack>
      </VStack>
    </Container>
  );
}
