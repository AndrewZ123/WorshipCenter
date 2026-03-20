'use client';

import React, { forwardRef } from 'react';
import { Button as ChakraButton, Tooltip, HStack, Box } from '@chakra-ui/react';
import { Icon, LucideIcon } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'icon';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface AppButtonProps {
  /** Button variant style */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Icon to show on the left */
  leftIcon?: LucideIcon;
  /** Icon to show on the right */
  rightIcon?: LucideIcon;
  /** Is the button disabled? */
  isDisabled?: boolean;
  /** Tooltip text to show when disabled */
  disabledTooltip?: string;
  /** Is the button loading? */
  isLoading?: boolean;
  /** Full width button */
  isFullWidth?: boolean;
  /** Children */
  children?: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Type attribute */
  type?: 'button' | 'submit' | 'reset';
  /** Href for link buttons */
  href?: string;
  /** Additional props */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const variantStyles: Record<ButtonVariant, object> = {
  primary: {
    bg: 'teal.600',
    color: 'white',
    _hover: { bg: 'teal.700' },
    _active: { bg: 'teal.800' },
  },
  secondary: {
    bg: 'white',
    color: 'gray.700',
    border: '1px solid',
    borderColor: 'gray.200',
    _hover: { borderColor: 'teal.300', bg: 'gray.50' },
    _active: { bg: 'gray.100' },
  },
  ghost: {
    bg: 'transparent',
    color: 'teal.600',
    _hover: { bg: 'teal.50' },
    _active: { bg: 'teal.100' },
  },
  destructive: {
    bg: 'transparent',
    color: 'red.600',
    _hover: { bg: 'red.50' },
    _active: { bg: 'red.100' },
  },
  icon: {
    bg: 'transparent',
    color: 'gray.400',
    p: 2,
    minW: 'auto',
    _hover: { bg: 'gray.100', color: 'gray.600' },
    _active: { bg: 'gray.200' },
  },
};

const sizeStyles: Record<ButtonSize, object> = {
  xs: {
    fontSize: 'xs',
    px: 2,
    py: 1,
    h: 'auto',
  },
  sm: {
    fontSize: 'sm',
    px: 3,
    py: 1.5,
    h: 'auto',
  },
  md: {
    fontSize: 'md',
    px: 4,
    py: 2,
    h: '44px',
  },
  lg: {
    fontSize: 'lg',
    px: 6,
    py: 3,
    h: '52px',
  },
};

/**
 * Global Button component with consistent variants
 */
const Button = forwardRef<HTMLButtonElement, AppButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      isDisabled = false,
      disabledTooltip,
      isLoading = false,
      isFullWidth = false,
      children,
      onClick,
      type = 'button',
      href,
      ...props
    },
    ref
  ) => {
    const buttonContent = (
      <ChakraButton
        ref={ref}
        type={type}
        onClick={onClick}
        isDisabled={isDisabled || isLoading}
        isLoading={isLoading}
        width={isFullWidth ? 'full' : 'auto'}
        borderRadius="lg"
        fontWeight="600"
        transition="all 0.15s ease"
        {...variantStyles[variant as ButtonVariant]}
        {...sizeStyles[size as ButtonSize]}
        as={href ? 'a' : undefined}
        href={href}
        {...props}
      >
        <HStack spacing={2}>
          {LeftIcon && <LeftIcon size={size === 'xs' ? 14 : size === 'sm' ? 16 : 20} />}
          {children && <span>{children}</span>}
          {RightIcon && <RightIcon size={size === 'xs' ? 14 : size === 'sm' ? 16 : 20} />}
        </HStack>
      </ChakraButton>
    );

    if (isDisabled && disabledTooltip) {
      return (
        <Tooltip label={disabledTooltip} placement="top">
          <Box opacity={0.5} cursor="not-allowed">
            {buttonContent}
          </Box>
        </Tooltip>
      );
    }

    return buttonContent;
  }
);

Button.displayName = 'Button';

export default Button;

/**
 * Icon button for toolbar/actions
 */
export interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'icon';
  onClick?: () => void;
  isDisabled?: boolean;
  isActive?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export function IconButton({
  icon: Icon,
  label,
  size = 'md',
  variant = 'ghost',
  onClick,
  isDisabled = false,
  isActive = false,
  ...props
}: IconButtonProps) {
  const iconSize = size === 'sm' ? 16 : 20;
  const p = size === 'sm' ? 1.5 : 2;
  
  return (
    <Tooltip label={label} placement="top">
      <ChakraButton
        p={p}
        minW="auto"
        h="auto"
        borderRadius="lg"
        bg={isActive ? 'teal.50' : 'transparent'}
        color={isActive ? 'teal.600' : 'gray.400'}
        _hover={{ bg: isActive ? 'teal.100' : 'gray.100', color: 'gray.600' }}
        onClick={onClick}
        isDisabled={isDisabled}
        transition="all 0.15s ease"
        aria-label={label}
        {...props}
      >
        <Icon size={iconSize} />
      </ChakraButton>
    </Tooltip>
  );
}