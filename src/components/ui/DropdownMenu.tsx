'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Box, VStack, Text, Icon, Portal } from '@chakra-ui/react';
import { MoreVertical, Edit, Trash2, Copy, ExternalLink } from 'lucide-react';

export interface DropdownItem {
  label: string;
  icon?: React.ComponentType<{ size?: number }>;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

interface DropdownMenuProps {
  items: DropdownItem[];
  trigger?: React.ReactNode;
}

/**
 * DropdownMenu - Three-dot overflow menu
 * Used for actions like Edit, Duplicate, Delete
 */
export default function DropdownMenu({ items, trigger }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        triggerRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <Box position="relative">
      <Box
        as="button"
        ref={triggerRef}
        p={2}
        borderRadius="lg"
        bg="transparent"
        color="gray.400"
        _hover={{ bg: 'gray.100', color: 'gray.600' }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open menu"
        transition="all 0.15s ease"
      >
        {trigger || <MoreVertical size={20} />}
      </Box>

      {isOpen && (
        <Portal>
          <Box
            ref={menuRef}
            position="fixed"
            zIndex={50}
            bg="white"
            borderRadius="xl"
            boxShadow="lg"
            border="1px solid"
            borderColor="gray.100"
            py={1}
            minW="160px"
            style={{
              top: triggerRef.current
                ? triggerRef.current.getBoundingClientRect().bottom + 8
                : 0,
              left: triggerRef.current
                ? triggerRef.current.getBoundingClientRect().right - 160
                : 0,
            }}
          >
            <VStack spacing={0} align="stretch">
              {items.map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <Box
                    key={index}
                    as="button"
                    px={4}
                    py={3}
                    display="flex"
                    alignItems="center"
                    gap={3}
                    textAlign="left"
                    width="100%"
                    minH="44px"
                    bg="transparent"
                    color={item.variant === 'destructive' ? 'red.600' : 'gray.700'}
                    _hover={{
                      bg: item.variant === 'destructive' ? 'red.50' : 'gray.50',
                    }}
                    fontSize="sm"
                    fontWeight="medium"
                    transition="all 0.15s ease"
                    onClick={() => {
                      item.onClick();
                      setIsOpen(false);
                    }}
                  >
                    {IconComponent && <IconComponent size={18} />}
                    <span>{item.label}</span>
                  </Box>
                );
              })}
            </VStack>
          </Box>
        </Portal>
      )}
    </Box>
  );
}

/**
 * Common menu item presets
 */
export const menuItems = {
  edit: (onClick: () => void): DropdownItem => ({
    label: 'Edit',
    icon: Edit,
    onClick,
  }),
  duplicate: (onClick: () => void): DropdownItem => ({
    label: 'Duplicate',
    icon: Copy,
    onClick,
  }),
  delete: (onClick: () => void): DropdownItem => ({
    label: 'Delete',
    icon: Trash2,
    onClick,
    variant: 'destructive',
  }),
  view: (onClick: () => void): DropdownItem => ({
    label: 'View',
    icon: ExternalLink,
    onClick,
  }),
};