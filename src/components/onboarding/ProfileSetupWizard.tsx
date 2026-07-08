'use client';

import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalFooter, Button, FormControl, FormLabel, Input,
  VStack, Text, useToast, Box, HStack, Avatar,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/store';
import { useTour } from '@/lib/tour/TourContext';
import { VOLUNTEER_TOUR_STEPS, VOLUNTEER_MOBILE_TOUR_STEPS, getStepsForRole } from '@/lib/tour/steps';

const SETUP_STEPS = [
  { id: 'name', title: 'Your Name', description: 'Help your team know who you are.' },
  { id: 'phone', title: 'Phone Number', description: 'So your team can reach you if needed.' },
  { id: 'roles', title: 'Your Roles', description: 'What do you do? Select your role(s) on the team.' },
  { id: 'done', title: 'You are ready!', description: 'Let us take a quick tour of the app.' },
];

export default function ProfileSetupWizard() {
  const { user, church } = useAuth();
  const toast = useToast();
  const tour = useTour();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rolesStr, setRolesStr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !church) return;
    const key = `profile_setup_completed_${user.id}`;
    const completed = localStorage.getItem(key) === 'true';
    const needsSetup = !user.name || !completed;
    setIsOpen(needsSetup);
    if (user.name) setName(user.name);
  }, [user, church]);

  const handleSave = async () => {
    if (!user || !church) return;
    setSaving(true);
    try {
      if (user.team_member_id) {
        await db.teamMembers.update(user.team_member_id, church.id, {
          name: name.trim() || user.name,
          phone: phone.trim() || undefined,
          roles: rolesStr.split(',').map(r => r.trim()).filter(Boolean).length > 0
            ? rolesStr.split(',').map(r => r.trim()).filter(Boolean)
            : undefined,
        });
      }
      const key = `profile_setup_completed_${user.id}`;
      localStorage.setItem(key, 'true');
      setIsOpen(false);

      if (step === SETUP_STEPS.length - 1) {
        const isMobile = window.innerWidth < 992;
        const allSteps = isMobile ? VOLUNTEER_MOBILE_TOUR_STEPS : VOLUNTEER_TOUR_STEPS;
        tour.start(getStepsForRole(allSteps, 'volunteer'));
      }

      toast({ title: 'Profile saved!', status: 'success', duration: 2000 });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({ title: 'Error saving profile', status: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (step < SETUP_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleSave();
    }
  };

  const handleSkip = () => {
    if (user) {
      const key = `profile_setup_completed_${user.id}`;
      localStorage.setItem(key, 'true');
    }
    setIsOpen(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => {}} closeOnOverlayClick={false} closeOnEsc={false} size="md" isCentered>
      <ModalOverlay backdropBlur="sm" />
      <ModalContent borderRadius="2xl" mx="4">
        <ModalHeader fontWeight="700">
          <HStack spacing="2">
            <Box flex="1">
              <Text>{SETUP_STEPS[step].title}</Text>
              <Text fontSize="sm" fontWeight="400" color="gray.500" mt="1">
                Step {step + 1} of {SETUP_STEPS.length}
              </Text>
            </Box>
            <Button variant="ghost" size="xs" color="gray.400" onClick={handleSkip}>
              Skip
            </Button>
          </HStack>
        </ModalHeader>
        <ModalBody>
          <Text fontSize="sm" color="gray.500" mb="4">{SETUP_STEPS[step].description}</Text>

          {step === 0 && (
            <FormControl>
              <FormLabel fontWeight="600" fontSize="sm">Full Name</FormLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                borderRadius="lg"
                autoFocus
              />
            </FormControl>
          )}

          {step === 1 && (
            <FormControl>
              <FormLabel fontWeight="600" fontSize="sm">Phone Number</FormLabel>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                borderRadius="lg"
                autoFocus
              />
              <Text fontSize="xs" color="gray.400" mt="1">Optional, but helpful for team communication.</Text>
            </FormControl>
          )}

          {step === 2 && (
            <FormControl>
              <FormLabel fontWeight="600" fontSize="sm">Your Roles</FormLabel>
              <Input
                value={rolesStr}
                onChange={(e) => setRolesStr(e.target.value)}
                placeholder="e.g., Vocalist, Guitar, Keys, Drums"
                borderRadius="lg"
                autoFocus
              />
              <Text fontSize="xs" color="gray.400" mt="1">Comma-separated. Let your team know what you do.</Text>
            </FormControl>
          )}

          {step === 3 && (
            <VStack spacing="3" align="center" py="4">
              <Avatar name={name || 'You'} size="xl" />
              <Text fontWeight="600" textAlign="center">
                {name || 'You'} is ready to go!
              </Text>
              <Text fontSize="sm" color="gray.500" textAlign="center">
                After saving, we will show you around the app with a quick tour.
              </Text>
            </VStack>
          )}

          {/* Progress dots */}
          <HStack justify="center" spacing="2" mt="6">
            {SETUP_STEPS.map((_, i) => (
              <Box
                key={i}
                w="8px" h="8px"
                borderRadius="full"
                bg={i === step ? 'teal.500' : 'gray.200'}
                transition="all 0.2s"
              />
            ))}
          </HStack>
        </ModalBody>
        <ModalFooter gap="2">
          <Button variant="ghost" onClick={handleSkip} size="sm">Skip Setup</Button>
          <Button colorScheme="teal" onClick={handleNext} isLoading={saving} fontWeight="600">
            {step < SETUP_STEPS.length - 1 ? 'Next' : 'Save & Start Tour'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
