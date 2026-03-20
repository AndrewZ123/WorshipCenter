'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Flex, VStack, Heading, Text, Input, Button, FormControl,
  FormLabel, Link as ChakraLink, Alert, AlertIcon, Card, CardBody,
  FormHelperText, Progress, HStack, Icon, List, ListItem,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { FiCheck, FiX } from 'react-icons/fi';

// Password validation utility
function validatePassword(password: string): { 
  valid: boolean; 
  errors: string[];
  strength: number; // 0-100
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
} {
  const checks = {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const errors: string[] = [];
  if (!checks.length) errors.push("At least 12 characters");
  if (!checks.uppercase) errors.push("An uppercase letter");
  if (!checks.lowercase) errors.push("A lowercase letter");
  if (!checks.number) errors.push("A number");
  if (!checks.special) errors.push("A special character");

  // Calculate strength (0-100)
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const strength = (passedChecks / 5) * 100;

  return {
    valid: Object.values(checks).every(Boolean),
    errors,
    strength,
    checks,
  };
}

function getStrengthColor(strength: number): string {
  if (strength < 40) return 'red';
  if (strength < 80) return 'yellow';
  return 'green';
}

export default function SignupPage() {
  const [churchName, setChurchName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const router = useRouter();

  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const passwordsMatch = password === confirmPassword;
  const showPasswordFeedback = password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!passwordValidation.valid) {
      setError('Please meet all password requirements');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const success = await signup(churchName, name, email, password);
    if (success) {
      router.push('/dashboard');
    } else {
      setError('Registration failed. The email may already be in use.');
    }
    setLoading(false);
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.50" px={{ base: '4', md: '4' }} py={{ base: '6', md: '0' }}>
      <Box w="full" maxW="440px">
        <VStack spacing={{ base: '4', md: '6' }} mb={{ base: '6', md: '8' }} textAlign="center">
          <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" color="brand.500">♫ WorshipCenter</Text>
          <Heading size={{ base: 'md', md: 'lg' }} fontWeight="700" color="gray.800">Create your church</Heading>
          <Text color="gray.500" fontSize={{ base: 'sm', md: 'md' }}>Set up your church account and start planning services</Text>
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
                  <FormLabel fontSize="sm" fontWeight="600">Church Name</FormLabel>
                  <Input
                    type="text"
                    value={churchName}
                    onChange={(e) => setChurchName(e.target.value)}
                    placeholder="First Baptist Church"
                    size="lg"
                    autoComplete="organization"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="600">Your Name</FormLabel>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Smith"
                    size="lg"
                    autoComplete="name"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="600">Email</FormLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@church.org"
                    size="lg"
                    autoComplete="email"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="600">Password</FormLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    size="lg"
                    autoComplete="new-password"
                  />
                  {showPasswordFeedback && (
                    <Box mt="3">
                      <HStack justify="space-between" mb="1">
                        <Text fontSize="xs" color="gray.500">Password strength</Text>
                        <Text fontSize="xs" fontWeight="600" color={getStrengthColor(passwordValidation.strength)}>
                          {passwordValidation.strength < 40 ? 'Weak' : passwordValidation.strength < 80 ? 'Medium' : 'Strong'}
                        </Text>
                      </HStack>
                      <Progress 
                        value={passwordValidation.strength} 
                        colorScheme={getStrengthColor(passwordValidation.strength)} 
                        size="sm" 
                        borderRadius="full"
                      />
                      <List spacing="1" mt="2">
                        <ListItem fontSize="xs" display="flex" alignItems="center" color={passwordValidation.checks.length ? 'green.500' : 'gray.400'}>
                          <Icon as={passwordValidation.checks.length ? FiCheck : FiX} mr="1" />
                          At least 12 characters
                        </ListItem>
                        <ListItem fontSize="xs" display="flex" alignItems="center" color={passwordValidation.checks.uppercase ? 'green.500' : 'gray.400'}>
                          <Icon as={passwordValidation.checks.uppercase ? FiCheck : FiX} mr="1" />
                          An uppercase letter
                        </ListItem>
                        <ListItem fontSize="xs" display="flex" alignItems="center" color={passwordValidation.checks.lowercase ? 'green.500' : 'gray.400'}>
                          <Icon as={passwordValidation.checks.lowercase ? FiCheck : FiX} mr="1" />
                          A lowercase letter
                        </ListItem>
                        <ListItem fontSize="xs" display="flex" alignItems="center" color={passwordValidation.checks.number ? 'green.500' : 'gray.400'}>
                          <Icon as={passwordValidation.checks.number ? FiCheck : FiX} mr="1" />
                          A number
                        </ListItem>
                        <ListItem fontSize="xs" display="flex" alignItems="center" color={passwordValidation.checks.special ? 'green.500' : 'gray.400'}>
                          <Icon as={passwordValidation.checks.special ? FiCheck : FiX} mr="1" />
                          A special character (!@#$%^&*)
                        </ListItem>
                      </List>
                    </Box>
                  )}
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="600">Confirm Password</FormLabel>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    size="lg"
                    autoComplete="new-password"
                    isInvalid={confirmPassword.length > 0 && !passwordsMatch}
                  />
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <FormHelperText color="red.500" fontSize="xs">
                      Passwords do not match
                    </FormHelperText>
                  )}
                </FormControl>

                <Button 
                  type="submit" 
                  w="full" 
                  size="lg" 
                  isLoading={loading}
                  isDisabled={!passwordValidation.valid || !passwordsMatch}
                >
                  Create Church Account
                </Button>
              </VStack>
            </form>
          </CardBody>
        </Card>

        <Text mt="6" textAlign="center" color="gray.500" fontSize="sm">
          Already have an account?{' '}
          <ChakraLink color="brand.500" fontWeight="600" href="/login">
            Sign in
          </ChakraLink>
        </Text>
      </Box>
    </Flex>
  );
}