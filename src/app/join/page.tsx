'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Flex, VStack, Heading, Text, Input, Button, FormControl,
  FormLabel, Alert, AlertIcon, Card, CardBody, Spinner,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/store';

function JoinForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  
  const [isValidInvite, setIsValidInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [churchName, setChurchName] = useState('');
  const [churchId, setChurchId] = useState('');
  const [memberName, setMemberName] = useState('');

  const { join } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function validateInvite() {
      // Expected format: /join?e=email@domain.com&c=church_id
      const paramEmail = searchParams.get('e');
      const paramChurchId = searchParams.get('c');

      if (!paramEmail || !paramChurchId) {
        setError('Invalid invitation link. Missing parameters.');
        setPageLoading(false);
        return;
      }

      // Check if the church exists
      const church = await db.churches.getById(paramChurchId);
      if (!church) {
        setError('Invalid invitation link. Church not found.');
        setPageLoading(false);
        return;
      }

      // Check if the team member profile exists
      const members = await db.teamMembers.getByChurch(paramChurchId);
      const profile = members.find(m => m.email.toLowerCase() === paramEmail.toLowerCase());

      if (!profile) {
        setError(`No team member profile found for ${paramEmail} at this church. Ask your worship leader for a new invite.`);
        setPageLoading(false);
        return;
      }
      
      // Check if they already have a user account
      const existingUser = await db.users.getByEmail(paramEmail);
      if (existingUser) {
        setError(`An account already exists for ${paramEmail}. Please log in instead.`);
        setPageLoading(false);
        return;
      }

      setInviteEmail(paramEmail);
      setChurchId(paramChurchId);
      setChurchName(church.name);
      setMemberName(profile.name);
      setIsValidInvite(true);
      setPageLoading(false);
    }

    validateInvite();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await join(inviteEmail, churchId, password);
    if (success) {
      router.push('/dashboard');
    } else {
      setError('Activation failed. Ensure your password is at least 6 characters, or you may already have an account.');
    }
    setLoading(false);
  };

  if (pageLoading) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="gray.50">
        <Spinner size="xl" color="brand.500" />
      </Flex>
    );
  }

  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.50" px="4">
      <Box w="full" maxW="440px">
        <VStack spacing="6" mb="8" textAlign="center">
          <Text fontSize="3xl" fontWeight="800" color="brand.500">♫ WorshipCenter</Text>
          <Heading size="lg" fontWeight="700" color="gray.800">Join the Team</Heading>
          {isValidInvite ? (
            <Text color="gray.500">
              You've been invited to join <strong>{churchName}</strong>. Activate your account below.
            </Text>
          ) : (
            <Text color="gray.500">Oops, something went wrong with your invite.</Text>
          )}
        </VStack>

        <Card>
          <CardBody p="8">
            {error && !isValidInvite && (
              <Alert status="error" borderRadius="lg" fontSize="sm">
                <AlertIcon />
                {error}
              </Alert>
            )}

            {isValidInvite && (
              <form onSubmit={handleSubmit}>
                <VStack spacing="5">
                  {error && (
                    <Alert status="error" borderRadius="lg" fontSize="sm">
                      <AlertIcon />
                      {error}
                    </Alert>
                  )}

                  <Box w="full" textAlign="left" bg="brand.50" p="4" borderRadius="lg" border="1px solid" borderColor="brand.100">
                    <Text fontSize="sm" color="gray.500" fontWeight="500">Joining as</Text>
                    <Text fontWeight="600">{memberName}</Text>
                    <Text fontSize="sm" color="gray.600">{inviteEmail}</Text>
                  </Box>

                  <FormControl isRequired>
                    <FormLabel fontWeight="600">Create a Password</FormLabel>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      size="md"
                    />
                  </FormControl>

                  <Button type="submit" w="full" size="lg" isLoading={loading} isDisabled={password.length < 6}>
                    Activate Account
                  </Button>
                </VStack>
              </form>
            )}
          </CardBody>
        </Card>

        {(!isValidInvite || error.includes('already exists')) && (
          <Text mt="6" textAlign="center">
            <Button variant="link" colorScheme="brand" onClick={() => router.push('/login')}>
              Go to Login
            </Button>
          </Text>
        )}
      </Box>
    </Flex>
  );
}

export default function JoinPage() {
  return (
    <React.Suspense fallback={
      <Flex minH="100vh" align="center" justify="center" bg="gray.50">
        <Spinner size="xl" color="brand.500" />
      </Flex>
    }>
      <JoinForm />
    </React.Suspense>
  );
}
