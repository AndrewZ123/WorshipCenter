'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { DemoProvider, useDemo } from '@/lib/demo/context';
import { StoreProvider } from '@/lib/StoreContext';
import { createDemoStore } from '@/lib/demo/store';
import { DemoAuthProvider } from '@/lib/demo/auth';
import {
  Box, Flex, VStack, Text, HStack, Menu, MenuButton,
  MenuList, MenuItem, Divider, IconButton, Drawer,
  DrawerOverlay, DrawerContent, DrawerCloseButton, DrawerBody,
  useDisclosure, useColorModeValue, Badge, Switch,
  Button, useToast, useColorMode,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import Avatar from '@/components/ui/Avatar';

// Lucide icons
import { 
  Calendar, Home, Music, Users, BarChart2, CreditCard, Menu as MenuIcon,
  RefreshCw, ExternalLink, Moon, Repeat, Building2
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/demo', icon: Home },
  { label: 'Services', href: '/demo/services', icon: Calendar },
  { label: 'Songs', href: '/demo/songs', icon: Music },
  { label: 'Team', href: '/demo/team', icon: Users },
  { label: 'Song Usage', href: '/demo/usage', icon: BarChart2 },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Billing', href: '/demo/settings/billing', icon: CreditCard },
];

// Demo Banner
function DemoBanner() {
  const { resetDemo } = useDemo();
  const toast = useToast();
  const bannerBg = useColorModeValue('teal.600', 'teal.500');
  
  const handleReset = () => {
    resetDemo();
    toast({
      title: 'Demo reset!',
      description: 'All data has been restored to its original state.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };
  
  return (
    <Box bg={bannerBg} color="white" py="2" px="4">
      <Flex maxW="7xl" mx="auto" align="center" justify="space-between" flexWrap="wrap" gap="2">
        <HStack spacing="2">
          <Badge colorScheme="whiteAlpha" variant="solid" fontSize="xs" borderRadius="full" px="2">DEMO MODE</Badge>
          <Text fontSize="sm">Explore WorshipCenter with sample data</Text>
        </HStack>
        <HStack spacing="3">
          <Button
            size="xs"
            variant="ghost"
            color="white"
            leftIcon={<RefreshCw size={14} />}
            onClick={handleReset}
            _hover={{ bg: 'whiteAlpha.200' }}
            borderRadius="lg"
          >
            Reset Demo
          </Button>
          <Button
            size="xs"
            colorScheme="whiteAlpha"
            bg="white"
            color="teal.600"
            as={NextLink}
            href={process.env.NEXT_PUBLIC_APP_URL + '/signup' || '/signup'}
            rightIcon={<ExternalLink size={14} />}
            _hover={{ bg: 'gray.100' }}
            borderRadius="lg"
            fontWeight="600"
          >
            Sign Up Free
          </Button>
        </HStack>
      </Flex>
    </Box>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, church } = useDemo();
  const { colorMode, toggleColorMode } = useColorMode();

  const sidebarBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const activeBg = useColorModeValue('teal.50', 'teal.900');
  const activeColor = useColorModeValue('teal.700', 'teal.200');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const headingColor = useColorModeValue('gray.900', 'white');

  const handleNav = (href: string) => {
    router.push(href);
    onClose?.();
  };

  return (
    <Flex direction="column" h="full" bg={sidebarBg} borderRight="1px solid" borderColor={borderColor}>
      {/* Logo */}
      <Box px="5" py="5">
        <HStack spacing="0">
          <Text fontSize="xl" fontWeight="800" color={headingColor} letterSpacing="-0.5px">
            Worship
          </Text>
          <Text fontSize="xl" fontWeight="800" color="teal.600" letterSpacing="-0.5px">
            Center
          </Text>
        </HStack>
        {church && (
          <HStack 
            spacing="2" 
            mt="3" 
            bg="gray.50" 
            borderRadius="lg" 
            px="3" 
            py="2"
          >
            <Building2 size={14} className="text-gray-400" />
            <Text fontSize="sm" fontWeight="500" color="gray.700" noOfLines={1}>
              {church.name}
            </Text>
          </HStack>
        )}
      </Box>

      <Divider borderColor={borderColor} />

      {/* Nav links */}
      <VStack spacing="1" px="3" py="4" align="stretch" flex="1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/demo' && pathname.startsWith(item.href));
          const IconComponent = item.icon;
          return (
            <HStack
              key={item.href}
              px="4"
              py="2.5"
              borderRadius="lg"
              cursor="pointer"
              bg={isActive ? activeBg : 'transparent'}
              color={isActive ? activeColor : textColor}
              fontWeight={isActive ? '600' : '500'}
              borderLeft={isActive ? '3px solid' : '3px solid transparent'}
              borderLeftColor={isActive ? 'teal.600' : 'transparent'}
              _hover={{ bg: isActive ? activeBg : hoverBg, color: isActive ? activeColor : 'gray.800' }}
              transition="all 0.15s"
              onClick={() => handleNav(item.href)}
              role="button"
              tabIndex={0}
            >
              <Box flexShrink={0}>
                <IconComponent size={20} className={isActive ? 'text-teal-600' : ''} />
              </Box>
              <Text fontSize="sm">{item.label}</Text>
            </HStack>
          );
        })}
        
        {/* Admin section */}
        <Divider borderColor={borderColor} my="2" />
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const IconComponent = item.icon;
          return (
            <HStack
              key={item.href}
              px="4"
              py="2.5"
              borderRadius="lg"
              cursor="pointer"
              bg={isActive ? activeBg : 'transparent'}
              color={isActive ? activeColor : textColor}
              fontWeight={isActive ? '600' : '500'}
              borderLeft={isActive ? '3px solid' : '3px solid transparent'}
              borderLeftColor={isActive ? 'teal.600' : 'transparent'}
              _hover={{ bg: isActive ? activeBg : hoverBg, color: isActive ? activeColor : 'gray.800' }}
              transition="all 0.15s"
              onClick={() => handleNav(item.href)}
              role="button"
              tabIndex={0}
            >
              <Box flexShrink={0}>
                <IconComponent size={20} />
              </Box>
              <Text fontSize="sm">{item.label}</Text>
            </HStack>
          );
        })}
      </VStack>

      {/* Dark mode toggle */}
      <Box px="6" py="3" borderTop="1px solid" borderColor={borderColor}>
        <HStack justify="space-between">
          <HStack spacing="2">
            <Moon size={16} className="text-gray-400" />
            <Text fontSize="sm" color={textColor}>Dark mode</Text>
          </HStack>
          <Switch 
            size="sm" 
            isChecked={colorMode === 'dark'} 
            onChange={toggleColorMode} 
            colorScheme="teal" 
          />
        </HStack>
      </Box>

      {/* User section */}
      {user && (
        <Box px="4" py="4" borderTop="1px solid" borderColor={borderColor}>
          <Menu placement="top-start">
            <MenuButton w="full">
              <HStack spacing="3" px="2" py="2" borderRadius="lg" _hover={{ bg: hoverBg }} transition="all 0.15s">
                <Avatar name={user.name} size="sm" />
                <Box flex="1" textAlign="left">
                  <Text fontSize="sm" fontWeight="600" noOfLines={1}>{user.name}</Text>
                  <Text fontSize="xs" color="gray.500" noOfLines={1}>{user.email}</Text>
                </Box>
              </HStack>
            </MenuButton>
            <MenuList borderRadius="xl" zIndex={50}>
              <MenuItem
                icon={<ExternalLink size={16} />}
                as={NextLink}
                href={process.env.NEXT_PUBLIC_APP_URL + '/signup' || '/signup'}
                fontSize="sm"
                borderRadius="lg"
              >
                Sign Up for Real Account
              </MenuItem>
            </MenuList>
          </Menu>
        </Box>
      )}
      
      {/* Demo notice */}
      <Box px="4" pb="4">
        <Text fontSize="xs" color="gray.400" textAlign="center">
          Changes won't be saved
        </Text>
      </Box>
    </Flex>
  );
}

// Demo Shell - Navigation and Layout (matches AppShell)
function DemoShell({ children }: { children: React.ReactNode }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const mainBg = useColorModeValue('gray.50', 'gray.900');
  const headerBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const headingColor = useColorModeValue('gray.900', 'white');

  return (
    <Flex h="100vh" overflow="hidden" direction="column">
      <DemoBanner />
      
      <Flex flex="1" overflow="hidden">
        {/* Desktop sidebar */}
        <Box
          display={{ base: 'none', lg: 'block' }}
          w="260px"
          flexShrink={0}
          h="calc(100vh - 44px)"
          position="sticky"
          top="0"
          overflowY="auto"
        >
          <SidebarContent />
        </Box>

        {/* Mobile header bar */}
        <Box
          display={{ base: 'block', lg: 'none' }}
          position="fixed"
          top="44px"
          left="0"
          right="0"
          bg={headerBg}
          borderBottom="1px solid"
          borderColor={borderColor}
          zIndex="10"
          sx={{
            paddingTop: 'env(safe-area-inset-top)',
          }}
        >
          <Flex h="56px" align="center" px="4">
            <IconButton
              aria-label="Open menu"
              icon={<MenuIcon size={24} />}
              variant="ghost"
              size="lg"
              onClick={onOpen}
              mr="3"
              minW="44px"
              color="gray.500"
              _hover={{ color: 'gray.700', bg: 'gray.100' }}
            />
            <HStack spacing="0">
              <Text fontSize="lg" fontWeight="800" color={headingColor} letterSpacing="-0.5px">
                Worship
              </Text>
              <Text fontSize="lg" fontWeight="800" color="teal.600" letterSpacing="-0.5px">
                Center
              </Text>
            </HStack>
          </Flex>
        </Box>

        {/* Mobile drawer - slides in from left as a card */}
        <Drawer isOpen={isOpen} placement="left" onClose={onClose} size="xs">
          <DrawerOverlay bg="blackAlpha.300" backdropFilter="blur(4px)" />
          <DrawerContent 
            maxW="280px"
            borderRadius="0 16px 16px 0"
            boxShadow="2xl"
            m="0"
            mt="env(safe-area-inset-top)"
          >
            <DrawerCloseButton 
              size="lg" 
              top="16px" 
              right="16px"
              zIndex="20"
              borderRadius="full"
            />
            <DrawerBody p="0" pt="0">
              <SidebarContent onClose={onClose} />
            </DrawerBody>
          </DrawerContent>
        </Drawer>

        {/* Main content */}
        <Box 
          flex="1" 
          overflowY="auto" 
          overflowX="hidden"
          bg={mainBg}
          className="main-content"
          sx={{
            paddingTop: ['calc(100px + env(safe-area-inset-top))', null, null, '0'],
            '@media (min-width: 62em)': {
              paddingTop: '0',
            },
          }}
        >
          <Box w="full" maxW="100vw" overflowX="hidden">
            {children}
          </Box>
        </Box>
      </Flex>
    </Flex>
  );
}

// Demo Layout Wrapper with Store Provider
function DemoLayoutInner({ children }: { children: React.ReactNode }) {
  const demoContext = useDemo();
  
  const demoStore = React.useMemo(
    () => createDemoStore(() => demoContext),
    [demoContext]
  );
  
  return (
    <DemoAuthProvider>
      <StoreProvider store={demoStore}>
        <DemoShell>{children}</DemoShell>
      </StoreProvider>
    </DemoAuthProvider>
  );
}

// Demo Layout - wraps everything in the correct order
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoProvider>
      <DemoLayoutInner>{children}</DemoLayoutInner>
    </DemoProvider>
  );
}