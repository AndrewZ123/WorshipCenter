'use client';

import React, { useState } from 'react';
import {
  Badge,
  Box,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  Textarea,
  VStack,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { ArrowLeftRight, Calendar } from 'lucide-react';
import { apiUrl, getAuthHeaders, parseJsonSafe } from '@/lib/api-base';
import { formatServiceDate } from '@/lib/formatDate';
import { hasActiveSwap } from '@/lib/swaps/ui';
import type { AssignmentSwapStatus } from '@/lib/types';
import Button from '@/components/ui/Button';

const NOTE_MAX_LENGTH = 500;

export interface ActiveSwap {
  id: string;
  status: AssignmentSwapStatus;
}

interface SwapRequestActionProps {
  assignmentId: string;
  role: string;
  serviceTitle: string;
  serviceDate: string;
  serviceTime?: string | null;
  activeSwap?: ActiveSwap | null;
  onChanged?: () => void | Promise<void>;
  showBadge?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * One reusable entry point for requesting or cancelling a swap. All state
 * transitions stay server-side in /api/swaps.
 */
export default function SwapRequestAction({
  assignmentId,
  role,
  serviceTitle,
  serviceDate,
  serviceTime,
  activeSwap,
  onChanged,
  showBadge = true,
  size = 'sm',
}: SwapRequestActionProps) {
  const toast = useToast();
  const requestModal = useDisclosure();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const active = activeSwap && hasActiveSwap(activeSwap.status) ? activeSwap : null;

  const handleRequest = async () => {
    try {
      setSubmitting(true);
      const response = await fetch(apiUrl('/api/swaps'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          assignmentId,
          note: note.trim() || undefined,
        }),
      });
      const result = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(result.error || 'Failed to request swap');
      }

      toast({
        title: 'Swap requested',
        description: 'Qualified teammates have been notified.',
        status: 'success',
      });
      requestModal.onClose();
      setNote('');
      await onChanged?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to request swap',
        status: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!active) return;
    try {
      setCancelling(true);
      const response = await fetch(apiUrl(`/api/swaps/${active.id}/cancel`), {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      const result = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel swap');
      }

      toast({ title: 'Swap request cancelled', status: 'info' });
      await onChanged?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel swap',
        status: 'error',
      });
    } finally {
      setCancelling(false);
    }
  };

  if (active) {
    return (
      <HStack spacing="2" flexShrink="0">
        {showBadge && (
          <Badge
            variant="subtle"
            colorScheme={active.status === 'claimed' ? 'blue' : 'yellow'}
            fontSize="xs"
            borderRadius="full"
            px="2"
            textTransform="capitalize"
          >
            {active.status === 'claimed' ? 'Swap claimed' : 'Swap requested'}
          </Badge>
        )}
        <Button
          variant="destructive"
          size={size}
          onClick={handleCancel}
          isLoading={cancelling}
        >
          Cancel swap
        </Button>
      </HStack>
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        size={size}
        leftIcon={ArrowLeftRight}
        onClick={requestModal.onOpen}
      >
        Request swap
      </Button>

      <Modal
        isOpen={requestModal.isOpen}
        onClose={requestModal.onClose}
        isCentered
        size="md"
      >
        <ModalOverlay backdropBlur="sm" />
        <ModalContent borderRadius="2xl">
          <ModalHeader fontWeight="700">Request a swap</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing="4" align="stretch">
              <Box bg="teal.50" borderRadius="lg" p="4" border="1px solid" borderColor="teal.100">
                <Text fontWeight="600" fontSize="sm" color="teal.800">
                  {serviceTitle}
                </Text>
                <HStack spacing="2" mt="1" color="teal.600" fontSize="sm" wrap="wrap">
                  <Calendar size={13} />
                  <Text>{formatServiceDate(serviceDate, serviceTime || undefined)}</Text>
                  <Text>·</Text>
                  <Text>{formatRole(role)}</Text>
                </HStack>
              </Box>
              <FormControl>
                <FormLabel fontSize="sm">Note for your teammates (optional)</FormLabel>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={NOTE_MAX_LENGTH}
                  rows={3}
                  placeholder="Let the team know why you need coverage."
                />
                <FormHelperText fontSize="xs">
                  {note.length}/{NOTE_MAX_LENGTH} characters
                </FormHelperText>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap="2">
            <Button variant="ghost" onClick={requestModal.onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleRequest}
              isLoading={submitting}
            >
              Request swap
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
