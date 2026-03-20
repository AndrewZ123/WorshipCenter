'use client';

import React, { useRef } from 'react';
import {
  AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader,
  AlertDialogContent, AlertDialogOverlay, Button, Icon,
} from '@chakra-ui/react';
import { AlertTriangle, Trash2, UserX, FileX } from 'lucide-react';

export type ConfirmVariant = 'destructive' | 'warning' | 'info';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  icon?: 'trash' | 'user' | 'file' | 'warning';
}

const variantConfig = {
  destructive: {
    colorScheme: 'red',
    icon: Trash2,
  },
  warning: {
    colorScheme: 'orange',
    icon: AlertTriangle,
  },
  info: {
    colorScheme: 'teal',
    icon: AlertTriangle,
  },
};

const iconMap = {
  trash: Trash2,
  user: UserX,
  file: FileX,
  warning: AlertTriangle,
};

/**
 * ConfirmModal - Use for every destructive action
 * - Delete service → "Delete Service?" / "This will permanently delete [Service Name] and all its items."
 * - Delete song → "Remove Song?" / "This will remove [Song Name] from your library."
 * - Remove team member → "Remove [Name]?" / "They will no longer appear in your team or future service assignments."
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  icon,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  
  const config = variantConfig[variant];
  const IconComponent = icon ? iconMap[icon] : config.icon;

  return (
    <AlertDialog 
      isOpen={isOpen} 
      leastDestructiveRef={cancelRef} 
      onClose={onClose} 
      isCentered
      motionPreset="scale"
    >
      <AlertDialogOverlay backdropBlur="sm">
        <AlertDialogContent 
          borderRadius="2xl"
          boxShadow="xl"
          maxW="400px"
        >
          <AlertDialogHeader 
            fontWeight="700" 
            fontSize="lg"
            display="flex"
            alignItems="center"
            gap={3}
            pb={2}
          >
            <Icon 
              as={IconComponent} 
              boxSize={5} 
              color={variant === 'destructive' ? 'red.500' : variant === 'warning' ? 'orange.500' : 'teal.500'} 
            />
            {title}
          </AlertDialogHeader>
          
          <AlertDialogBody color="gray.600">
            {message}
          </AlertDialogBody>
          
          <AlertDialogFooter gap={2}>
            <Button 
              ref={cancelRef} 
              onClick={onClose} 
              variant="ghost"
              color="gray.600"
              _hover={{ bg: 'gray.100' }}
            >
              {cancelLabel}
            </Button>
            <Button 
              colorScheme={config.colorScheme}
              onClick={() => { onConfirm(); onClose(); }}
              borderRadius="lg"
              fontWeight="600"
            >
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}

/**
 * Hook to manage confirm dialog state
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [config, setConfig] = React.useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
    variant?: ConfirmVariant;
    icon?: 'trash' | 'user' | 'file' | 'warning';
  } | null>(null);

  const confirm = React.useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    options?: {
      confirmLabel?: string;
      variant?: ConfirmVariant;
      icon?: 'trash' | 'user' | 'file' | 'warning';
    }
  ) => {
    setConfig({
      title,
      message,
      onConfirm,
      ...options,
    });
    setIsOpen(true);
  }, []);

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    setConfig(null);
  }, []);

  return {
    isOpen,
    config,
    confirm,
    handleClose,
    ConfirmDialog: config ? (
      <ConfirmDialog
        isOpen={isOpen}
        onClose={handleClose}
        onConfirm={config.onConfirm}
        title={config.title}
        message={config.message}
        confirmLabel={config.confirmLabel}
        variant={config.variant}
        icon={config.icon}
      />
    ) : null,
  };
}