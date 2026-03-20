'use client';

import React, { useState } from 'react';
import {
  Box, Flex, VStack, Heading, Text, Input, Button, FormControl,
  FormLabel, Link as ChakraLink, Alert, AlertIcon, Card, CardBody,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    const success = await resetPassword(email);
    if (success) {
      setSuccess(true);
    } else {
      setError('Unable to send reset email. Please try again.');
    }
    setLoading(false);
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.50" px={{ base: '4', md: '4' }} py={{ base: '6', md: '0' }}>
      <Box w="full" maxW="440px">
        <VStack spacing={{ base: '4', md: '6' }} mb={{ base: '6', md: '8' }} textAlign="center">
          <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" color="brand.500">♫ WorshipCenter</Text>
          <Heading size={{ base: 'md', md: 'lg' }} fontWeight="700" color="gray.800">Reset your password</Heading>
          <Text color="gray.500" fontSize={{ base: 'sm', md: 'md' }}>
            {success 
              ? 'Check your email for a password reset link'
              : 'Enter your email and we\'ll send you a reset link'
            }
          </Text>
        </VStack>

        <Card>
          <CardBody p={{ base: '5', md: '8' }}>
            {!success ? (
              <form onSubmit={handleSubmit}>
                <VStack spacing={{ base: '4', md: '5' }}>
                  {error && (
                    <Alert status="error" borderRadius="lg" fontSize="sm">
                      <AlertIcon />
                      {error}
                    </Alert>
                  )}

                  <FormControl isRequired>
                    <FormLabel fontWeight="600">Email</FormLabel>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@yourchurch.org"
                      size="md"
                    />
                  </FormControl>

                  <Button type="submit" w="full" size="lg" isLoading={loading}>
                    Send Reset Link
                  </Button>
                </VStack>
              </form>
            ) : (
              <VStack spacing={{ base: '4', md: '5' }}>
                <Alert status="success" borderRadius="lg" fontSize="sm">
                  <AlertIcon />
                  Password reset email sent!
                </Alert>
                <Text color="gray.600" fontSize="sm" textAlign="center">
                  Check your inbox for a link to reset your password. The link will expire in 1 hour.
                </Text>
                <Button w="full" size="lg" onClick={() => router.push('/login')}>
                  Back to Login
                </Button>
              </VStack>
            )}
          </CardBody>
        </Card>

        {!success && (
          <Text mt="6" textAlign="center" color="gray.500" fontSize="sm">
            Remember your password?{' '}
            <ChakraLink color="brand.500" fontWeight="600" href="/login">
              Sign in
            </ChakraLink>
          </Text>
        )}
      </Box>
    </Flex>
  );
}