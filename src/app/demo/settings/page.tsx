'use client';

import { useState, useEffect } from 'react';
import {
  Box, Heading, Text, VStack, HStack, Button, Card, CardBody,
  Input, FormControl, FormLabel, Avatar, useColorModeValue, useToast,
  Badge, Divider, useColorMode, Switch,
} from '@chakra-ui/react';
import { useDemo } from '@/lib/demo/context';
import { useRouter } from 'next/navigation';
import { useTour } from '@/lib/tour/TourContext';
import { TOUR_STEPS, MOBILE_TOUR_STEPS } from '@/lib/tour/steps';
import { Sparkles, User, Home, HelpCircle, Sun, Moon } from 'lucide-react';

export default function DemoSettingsPage() {
  const { user, church, resetDemo } = useDemo();
  const { colorMode, toggleColorMode } = useColorMode();
  const { start } = useTour();
  const router = useRouter();
  const toast = useToast();

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <Box px={{ base: '4', md: '8' }} pt={{ base: '2', md: '8' }} pb={{ base: '4', md: '8' }} maxW="800px" mx="auto">
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading size="lg" mb={2} color={textColor}>Settings</Heading>
          <Text color={subtextColor}>Manage your account and church settings</Text>
        </Box>

        {/* Profile Settings */}
        <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
          <CardBody>
            <VStack align="stretch" spacing={6}>
              <HStack spacing={4}>
                <User size={20} color="var(--chakra-colors-teal-500)" />
                <Heading size="md" color={textColor}>Profile (Demo)</Heading>
              </HStack>
              <Divider />
              <HStack spacing={6} align="center">
                <Avatar size="xl" name={user?.name || 'Demo User'} bg="teal.500" color="white" />
                <Box>
                  <Text fontWeight="medium" color={textColor}>Profile Picture</Text>
                  <Text fontSize="sm" color={subtextColor}>Demo uses a sample profile</Text>
                </Box>
              </HStack>
              <FormControl>
                <FormLabel color={textColor}>Name</FormLabel>
                <Input value={user?.name || ''} isReadOnly bg={useColorModeValue('gray.50', 'gray.700')} color={subtextColor} />
              </FormControl>
              <FormControl>
                <FormLabel color={textColor}>Email</FormLabel>
                <Input value={user?.email || ''} isReadOnly bg={useColorModeValue('gray.50', 'gray.700')} color={subtextColor} />
                <Text fontSize="sm" color={subtextColor} mt="1">This is a demo account. Changes aren't saved permanently.</Text>
              </FormControl>
              <FormControl>
                <FormLabel color={textColor}>Role</FormLabel>
                <HStack>
                  <Badge colorScheme="purple" fontSize="sm" px={3} py={1} borderRadius="full">
                    {user?.role === 'admin' ? 'Worship Leader (Admin)' : user?.role === 'leader' ? 'Leader' : 'Team Member'}
                  </Badge>
                </HStack>
              </FormControl>
            </VStack>
          </CardBody>
        </Card>

        {/* Church Settings */}
        {church && (
          <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
            <CardBody>
              <VStack align="stretch" spacing={6}>
                <HStack spacing={4}>
                  <Home size={20} color="var(--chakra-colors-teal-500)" />
                  <Heading size="md" color={textColor}>Church Settings</Heading>
                  <Badge colorScheme="purple" ml="auto">Demo</Badge>
                </HStack>
                <Divider />
                <FormControl>
                  <FormLabel color={textColor}>Church Name</FormLabel>
                  <Input value={church.name} isReadOnly bg={useColorModeValue('gray.50', 'gray.700')} color={subtextColor} />
                </FormControl>
                <FormControl>
                  <FormLabel color={textColor}>Church URL Slug</FormLabel>
                  <Input value={church.slug} isReadOnly bg={useColorModeValue('gray.50', 'gray.700')} color={subtextColor} />
                  <Text fontSize="sm" color={subtextColor} mt="1">The unique identifier for your church. Demo data is read-only.</Text>
                </FormControl>
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* Walkthrough Tour */}
        <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
          <CardBody>
            <HStack spacing={4} align="flex-start">
              <Box p="3" borderRadius="lg" bg="teal.50" color="teal.600" flexShrink={0}>
                <Sparkles size={22} />
              </Box>
              <VStack align="stretch" spacing={3} flex="1">
                <Box>
                  <Heading size="md" color={textColor}>Walkthrough Tour</Heading>
                  <Text fontSize="sm" color={subtextColor} mt="1">
                    Take a guided tour of WorshipCenter to learn about every section and feature.
                  </Text>
                </Box>
                <Button
                  colorScheme="teal"
                  size="sm"
                  alignSelf="flex-start"
                  leftIcon={<Sparkles size={16} />}
                  onClick={() => {
                    const isMobile = window.matchMedia('(max-width: 62em)').matches;
                    start(isMobile ? MOBILE_TOUR_STEPS : TOUR_STEPS);
                    router.push('/demo');
                  }}
                  borderRadius="lg"
                  fontWeight="600"
                >
                  Start Walkthrough
                </Button>
              </VStack>
            </HStack>
          </CardBody>
        </Card>

        {/* Dark Mode Toggle */}
        <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
          <CardBody>
            <HStack justify="space-between">
              <HStack spacing="4">
                {colorMode === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                <Box>
                  <Heading size="sm" color={textColor}>Dark Mode</Heading>
                  <Text fontSize="sm" color={subtextColor}>Toggle between light and dark themes</Text>
                </Box>
              </HStack>
              <Switch size="lg" isChecked={colorMode === 'dark'} onChange={toggleColorMode} colorScheme="teal" />
            </HStack>
          </CardBody>
        </Card>

        {/* Support Section */}
        <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
          <CardBody>
            <HStack spacing={4}>
              <Box p="3" borderRadius="lg" bg="teal.50" color="teal.600" flexShrink={0}>
                <HelpCircle size={22} />
              </Box>
              <Box flex="1">
                <Heading size="md" color={textColor}>Need Help?</Heading>
                <Text fontSize="sm" color={subtextColor} mt="1">
                  Contact us at support@worshipcenter.app or visit our support page.
                </Text>
              </Box>
              <Button as="a" href="/support" target="_blank" size="sm" colorScheme="teal" variant="outline">
                Visit Support
              </Button>
            </HStack>
          </CardBody>
        </Card>

        {/* Danger Zone */}
        <Card bg={bgColor} borderColor="red.200" borderWidth="1px">
          <CardBody>
            <VStack align="stretch" spacing={4}>
              <Heading size="md" color="red.500">Reset Demo</Heading>
              <Text fontSize="sm" color={subtextColor}>
                Restore all demo data to its original state. Any changes you made will be lost.
              </Text>
              <Button
                colorScheme="red"
                variant="outline"
                size="sm"
                leftIcon={<Sparkles size={16} />}
                onClick={() => {
                  resetDemo();
                  toast({ title: 'Demo reset!', description: 'All data restored to original state.', status: 'success', duration: 3000 });
                  router.push('/demo');
                }}
                alignSelf="flex-start"
              >
                Reset Demo Data
              </Button>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
}
