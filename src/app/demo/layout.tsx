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
import TourOverlay from '@/components/onboarding/TourOverlay';
import { TourProvider, useTour } from '@/lib/tour/TourContext';
import { TOUR_STEPS, MOBILE_TOUR_STEPS } from '@/lib/tour/steps';

// Lucide icons
import { 
  Calendar, Home, Music, Users, BarChart2, CreditCard, Menu as MenuIcon,
  RefreshCw, ExternalLink, Moon, Repeat, Building2, PieChart, MessageSquare, CheckSquare, Sparkles,
  Settings, FileBarChart, MessageCircle
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
  { label: 'Tasks', href: '/demo/tasks', icon: CheckSquare },
  { label: 'Templates', href: '/demo/templates', icon: Repeat },
  { label: 'Song Usage', href: '/demo/usage', icon: BarChart2 },
  { label: 'Reports', href: '/demo/reports', icon: PieChart },
  { label: 'Team Chat', href: '/demo/chat', icon: MessageCircle },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Settings', href: '/demo/settings', icon: Settings },
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
    <Box bg={bannerBg} color="white" py="2" px="4" sx={{ paddingTop: 'env(safe-area-inset-top)' }}>
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
  const { start } = useTour();

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
            <Building2 size={14} color="var(--chakra-colors-gray-400)" />
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
          const tourAttr = `nav-${item.href.replace(/^\/demo\/?/, '') || 'dashboard'}`;
          return (
            <HStack
              key={item.href}
              data-tour={tourAttr}
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
        
        {/* Admin section */}
        <Divider borderColor={borderColor} my="2" />
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const IconComponent = item.icon;
          const tourAttr = `nav-${item.href.replace(/^\/demo\/?/, '') || 'dashboard'}`;
          return (
            <HStack
              key={item.href}
              data-tour={tourAttr}
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
            <Moon size={16} color="var(--chakra-colors-gray-400)" />
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
                icon={<Sparkles size={16} />}
                onClick={() => { 
                  const isMobile = window.matchMedia('(max-width: 62em)').matches;
                  start(isMobile ? MOBILE_TOUR_STEPS : TOUR_STEPS); onClose?.(); 
                }}
                fontSize="sm"
                borderRadius="lg"
              >
                Take the Tour
              </MenuItem>
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
  const { setDrawerControls } = useTour();
  const router = useRouter();
  const pathname = usePathname();
  const mainBg = useColorModeValue('gray.50', 'gray.900');
  const headerBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const headingColor = useColorModeValue('gray.900', 'white');
  const bottomNavActiveColor = useColorModeValue('teal.600', 'teal.300');
  const bottomNavInactiveColor = useColorModeValue('gray.400', 'gray.500');
  const bottomNavBg = useColorModeValue('white', 'gray.800');
  const bottomNavBorder = useColorModeValue('gray.200', 'gray.700');

  // Register drawer controls so TourOverlay can open/close it
  React.useEffect(() => {
    setDrawerControls(onOpen, onClose);
    return () => setDrawerControls(() => {}, () => {});
  }, [onOpen, onClose, setDrawerControls]);

  return (
    <Flex h="100dvh" overflow="hidden" direction="column">
      <TourOverlay />
      <DemoBanner />
      
      <Flex flex="1" overflow="hidden">
        {/* Desktop sidebar */}
        <Box
          display={{ base: 'none', lg: 'block' }}
          w="260px"
          flexShrink={0}
          h="calc(100dvh - 44px)"
          position="sticky"
          top="0"
          overflowY="auto"
          sx={{ paddingTop: 'env(safe-area-inset-top)' }}
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
          <Flex h="48px" align="center" px="4">
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
            maxW="240px"
            borderRadius="0 12px 12px 0"
            boxShadow="xl"
            m="0"
            sx={{ paddingTop: 'env(safe-area-inset-top)' }}
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
          minH="0"
          overflowY="auto" 
          overflowX="hidden"
          bg={mainBg}
          className="main-content"
        sx={{
            paddingTop: ['calc(92px + env(safe-area-inset-top))', null, null, 'env(safe-area-inset-top, 0px)'],
            paddingBottom: [
              'calc(48px + env(safe-area-inset-bottom))', 
              'calc(48px + env(safe-area-inset-bottom))', 
              null, 
              '0'
            ],
            '@media (min-width: 62em)': {
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: '0',
            },
          }}
        >
          <Box w="full" maxW="100vw" overflowX="hidden" display="flex" flexDir="column" flex="1" minH="0">
            {children}
          </Box>
        </Box>
      </Flex>

      {/* Mobile Bottom Nav */}
      <Box
        display={{ base: 'block', lg: 'none' }}
        position="fixed"
        bottom="0"
        left="0"
        right="0"
        zIndex="999"
        bg={bottomNavBg}
        borderTop="1px solid"
        borderColor={bottomNavBorder}
        className="bottom-nav"
        sx={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Flex h="48px" align="center" justify="space-around" px="2">
          {[
            { label: 'Home', href: '/demo' as const, icon: Home },
            { label: 'Services', href: '/demo/services' as const, icon: Calendar },
            { label: 'Tasks', href: '/demo/tasks' as const, icon: CheckSquare },
            { label: 'Chat', href: '/demo/chat' as const, icon: MessageCircle },
            { label: 'More', icon: MenuIcon, isMore: true },
          ].map((item: { label: string; href?: string; icon?: any; isMore?: boolean }) => {
            const active = !item.isMore && !!item.href && (pathname === item.href || (item.href !== '/demo' && pathname.startsWith(item.href)));
            const Icon = item.icon;
            return (
              <Flex
                key={item.label}
                direction="column"
                align="center"
                justify="center"
                flex="1"
                h="full"
                minH="44px"
                cursor="pointer"
                color={active ? bottomNavActiveColor : bottomNavInactiveColor}
                  onClick={() => {
                  if (item.isMore || !item.href) {
                    onOpen();
                  } else {
                    router.push(item.href);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={item.label}
                _hover={{ color: bottomNavActiveColor }}
                transition="color 0.15s"
              >
                <Icon size={20} />
                <Text fontSize="10px" fontWeight={active ? '600' : '500'} mt="1px">
                  {item.label}
                </Text>
              </Flex>
            );
          })}
        </Flex>
      </Box>
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
        <TourProvider>
          <DemoShell>{children}</DemoShell>
        </TourProvider>
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