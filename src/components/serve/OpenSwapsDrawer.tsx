'use client';

import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Text,
} from '@chakra-ui/react';
import SwapSection from './SwapSection';

interface OpenSwapsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The Team tab's quick look at claimable swaps. Reuses SwapSection's open-swap
 * cards and claim flow so the drawer and /serve stay consistent.
 */
export default function OpenSwapsDrawer({ isOpen, onClose }: OpenSwapsDrawerProps) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="md">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader pb="2">
          <Text as="span" fontWeight="700">
            Open swaps
          </Text>
          <Text fontSize="sm" fontWeight="400" color="gray.500" mt="1">
            Claim a shift a teammate needs covered.
          </Text>
        </DrawerHeader>
        <DrawerBody px={{ base: '4', md: '6' }}>
          <SwapSection mode="open" />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
