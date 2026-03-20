'use client';

import React, { useState, useEffect } from 'react';
import {
  Box, Flex, VStack, Heading, Text, Input, Button, FormControl,
  FormLabel, Link as ChakraLink, Alert, AlertIcon, Card, CardBody,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function NewPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { updatePassword } = useAuth();
  const router = useRouter();
  const [isSessionValid, setIsSessionValid] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsSessionValid(true);
      } else {
        // If no session, check if we came from a recovery link
        // The session should be restored automatically by Supabase from the URL hash
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          setIsSessionValid(!!retrySession);
          setCheckingSession(false);
        }, 500);
      }
      setCheckingSession(false);
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const success = await updatePassword(password);
    if (success) {
      // Sign out after password update for security
      await supabase.auth.signOut();
      router.push('/login');
    } else {
      setError('Unable to update password. The link may have expired.');
    }
    setLoading(false);
  };

  if (checkingSession) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="gray.50">
        <Text color="gray.500">Loading...</Text>
      </Flex>
    );
  }

  if (!isSessionValid) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="gray.50" px={{ base: '4', md: '4' }} py={{ base: '6', md: '0' }}>
        <Box w="full" maxW="440px">
          <Card>
            <CardBody p={{ base: '5', md: '8' }}>
              <VStack spacing={{ base: '4', md: '5' }}>
                <Alert status="error" borderRadius="lg" fontSize="sm">
                  <AlertIcon />
                  Invalid or expired reset link
                </Alert>
                <Text color="gray.600" fontSize="sm" textAlign="center">
                  This password reset link has expired or is invalid. Please request a new one.
                </Text>
                <Button w="full" size="lg" onClick={() => router.push('/reset-password')}>
                  Request New Link
                </Button>
              </VStack>
            </CardBody>
          </Card>
        </Box>
      </Flex>
    );
  }

  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.50" px={{ base: '4', md: '4' }} py={{ base: '6', md: '0' }}>
      <Box w="full" maxW="440px">
        <VStack spacing={{ base: '4', md: '6' }} mb={{ base: '6', md: '8' }} textAlign="center">
          <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" color="brand.500">♫ WorshipCenter</Text>
          <Heading size={{ base: 'md', md: 'lg' }} fontWeight="700" color="gray.800">Set new password</Heading>
          <Text color="gray.500" fontSize={{ base: 'sm', md: 'md' }}>
            Enter your new password below
          </Text>
        </VStack>

        <Card>
          <CardBody p={{ base: '5', md: '8' }}>
            <form onSubmit={handleSubmit}>
              <VStack spacing={{ base: '4', md: '5' }}>
                {error && (
                  <Alert status="error" borderRadius="lg" fontSize="sm">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}

                <FormControl isRequired>
                  <FormLabel fontWeight="600">New Password</FormLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    size="md"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontWeight="600">Confirm Password</FormLabel>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    size="md"
                  />
                </FormControl>

                <Button type="submit" w="full" size="lg" isLoading={loading}>
                  Update Password
                </Button>
              </VStack>
            </form>
          </CardBody>
        </Card>

        <Text mt="6" textAlign="center" color="gray.500" fontSize="sm">
          Remember your password?{' '}
          <ChakraLink color="brand.500" fontWeight="600" href="/login">
            Sign in
          </ChakraLink>
        </Text>
      </Box>
    </Flex>
  );
}