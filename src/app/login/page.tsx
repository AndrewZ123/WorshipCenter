'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Flex, VStack, Heading, Text, Input, Button, FormControl,
  FormLabel, Link as ChakraLink, Alert, AlertIcon, Card, CardBody,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login, loading: authLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await login(email, password);
    if (success) {
      // Redirect immediately — AppLayout will show a spinner while profile loads
      router.replace('/dashboard');
    } else {
      setError('Invalid email or password.');
      setLoading(false);
    }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.50" px={{ base: '4', md: '4' }} py={{ base: '6', md: '0' }}>
      <Box w="full" maxW="440px">
        <VStack spacing={{ base: '4', md: '6' }} mb={{ base: '6', md: '8' }} textAlign="center">
          <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" color="brand.500">♫ WorshipCenter</Text>
          <Heading size={{ base: 'md', md: 'lg' }} fontWeight="700" color="gray.800">Welcome back</Heading>
          <Text color="gray.500" fontSize={{ base: 'sm', md: 'md' }}>Sign in to manage your services and team</Text>
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
                  <FormLabel fontWeight="600">Email</FormLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourchurch.org"
                    size="md"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontWeight="600">Password</FormLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    size="md"
                  />
                </FormControl>

                <Button type="submit" w="full" size="lg" isLoading={loading}>
                  Sign In
                </Button>
              </VStack>
            </form>
          </CardBody>
        </Card>

        <Text mt="6" textAlign="center" color="gray.500" fontSize="sm">
          Don&apos;t have an account?{' '}
          <ChakraLink color="brand.500" fontWeight="600" href="/signup">
            Create your church
          </ChakraLink>
        </Text>
      </Box>
    </Flex>
  );
}
