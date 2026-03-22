'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box, Flex, VStack, Text, HStack, Menu, MenuButton,
  MenuList, MenuItem, Divider, useDisclosure, IconButton, Drawer,
  DrawerOverlay, DrawerContent, DrawerCloseButton, DrawerBody,
  useColorMode, useColorModeValue, Badge, Switch,
  Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverBody,
  PopoverCloseButton,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/store';
import type { Notification } from '@/lib/types';
import { TrialBanner, TrialExpiredBanner, FloatingSubscribeCTA } from './TrialBanner';
import { useSubscription } from '@/lib/useSubscription';
import Avatar from '@/components/ui/Avatar';

// Lucide icons
import { 
  Calendar, Home, Music, Users, BarChart2, CreditCard, Menu as MenuIcon,
  LogOut, Settings, Bell, Moon, Sun, Repeat, Church, Smartphone, X, MessageCircle, HelpCircle
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: Home },
  { label: 'Services', href: '/services', icon: Calendar },
  { label: 'Songs', href: '/songs', icon: Music },
  { label: 'Team', href: '/team', icon: Users },
  { label: 'Team Chat', href: '/chat', icon: MessageCircle },
  { label: 'Song Usage', href: '/usage', icon: BarChart2 },
];

// Nav items hidden from team members
const TEAM_HIDDEN_ITEMS = ['/team', '/usage'];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, church, logout } = useAuth();
  const { colorMode, toggleColorMode } = useColorMode();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // PWA install prompt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showIOSInstall, setShowIOSInstall] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);

  // Color mode values at top level
  const sidebarBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const notificationBg = useColorModeValue('teal.50', 'teal.900');

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandalone = ('standalone' in navigator) && (navigator as { standalone?: boolean }).standalone;
    if (isIOS && !isInStandalone) setShowIOSInstall(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  useEffect(() => {
    async function loadNotifications() {
      if (user) {
        setUnreadCount(await db.notifications.getUnreadCount(user.id));
        const all = await db.notifications.getByUser(user.id);
        setNotifications(all.slice(0, 5));
      }
    }
    loadNotifications();
  }, [user]);

  const handleNav = (href: string) => {
    router.push(href);
    onClose?.();
  };

  const handleMarkAllRead = async () => {
    if (user) {
      await db.notifications.markAllRead(user.id);
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  return (
    <Flex direction="column" h="full" bg={sidebarBg} borderRight="1px solid" borderColor={borderColor}>
      {/* Logo Header */}
      <Box px="6" py="5">
        <HStack spacing={0}>
          <Text fontSize="xl" fontWeight="800" color="gray.800" letterSpacing="-0.5px">
            Worship
          </Text>
          <Text fontSize="xl" fontWeight="800" color="teal.600" letterSpacing="-0.5px">
            Center
          </Text>
        </HStack>
        
        {/* Workspace row */}
        {church && (
          <HStack
            mt="3"
            px="3"
            py="2"
            bg="gray.50"
            borderRadius="lg"
            spacing="2"
          >
            <Church size={16} className="text-gray-500" />
            <Text fontSize="sm" fontWeight="500" color="gray.700" noOfLines={1}>
              {church.name}
            </Text>
          </HStack>
        )}
      </Box>

      <Divider borderColor={borderColor} />

      {/* Primary Nav */}
      <VStack spacing="1" px="3" py="4" align="stretch" flex="1">
        {NAV_ITEMS.map((item) => {
          // Team members: hide Team management and Song Usage pages
          if (user?.role === 'team' && TEAM_HIDDEN_ITEMS.includes(item.href)) return null;

          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const IconComponent = item.icon;
          
          return (
            <HStack
              key={item.href}
              px="4"
              py="2.5"
              borderRadius="lg"
              cursor="pointer"
              bg={isActive ? 'teal.50' : 'transparent'}
              color={isActive ? 'teal.700' : textColor}
              fontWeight={isActive ? '600' : '500'}
              borderLeft={isActive ? '3px solid' : '3px solid transparent'}
              borderColor={isActive ? 'teal.600' : 'transparent'}
              marginLeft={isActive ? '-3px' : '0'}
              paddingLeft={isActive ? 'calc(1rem + 3px)' : '1rem'}
              _hover={{ bg: isActive ? 'teal.50' : hoverBg, color: isActive ? 'teal.700' : 'gray.800' }}
              transition="all 0.15s ease"
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
            {colorMode === 'light' ? <Moon size={16} /> : <Sun size={16} />}
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

      {/* PWA Install chip */}
      {!installDismissed && (installPrompt || showIOSInstall) && (
        <Box
          mx="3" mb="2" px="3" py="2"
          borderRadius="lg"
          bg="teal.50"
          border="1px solid"
          borderColor="teal.100"
        >
          <HStack justify="space-between">
            <HStack spacing="2">
              <Smartphone size={14} className="text-teal-600" />
              <Text fontSize="xs" color="teal.700" fontWeight="500">
                Install App
              </Text>
            </HStack>
            <HStack spacing="1">
              {installPrompt && (
                <Box
                  as="button"
                  fontSize="xs"
                  color="teal.600"
                  fontWeight="600"
                  onClick={handleInstall}
                  cursor="pointer"
                  _hover={{ color: 'teal.700' }}
                >
                  Install
                </Box>
              )}
              <Box
                as="button"
                p="1"
                color="teal.400"
                _hover={{ color: 'teal.600' }}
                onClick={() => setInstallDismissed(true)}
                cursor="pointer"
              >
                <X size={12} />
              </Box>
            </HStack>
          </HStack>
        </Box>
      )}

      {/* Notifications + User section */}
      {user && (
        <Box px="4" py="4" borderTop="1px solid" borderColor={borderColor}>
          {/* Notification bell */}
          <Popover placement="top-start">
            <PopoverTrigger>
              <HStack
                spacing="3" px="3" py="2" borderRadius="lg"
                cursor="pointer" _hover={{ bg: hoverBg }} transition="all 0.15s ease"
                mb="2" position="relative"
                role="button"
                tabIndex={0}
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              >
                <Bell size={20} />
                <Text fontSize="sm" color={textColor}>Notifications</Text>
                {unreadCount > 0 && (
                  <Badge
                    colorScheme="red"
                    variant="solid"
                    borderRadius="full"
                    fontSize="xs"
                    ml="auto"
                    aria-hidden="true"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </HStack>
            </PopoverTrigger>
            <PopoverContent borderRadius="xl" maxW="320px" zIndex={50}>
              <PopoverCloseButton />
              <PopoverHeader fontWeight="700" borderBottom="1px solid" borderColor={borderColor}>
                <HStack justify="space-between" pr="8">
                  <Text>Notifications</Text>
                  {unreadCount > 0 && (
                    <Text
                      fontSize="xs" color="teal.500" cursor="pointer"
                      _hover={{ textDecoration: 'underline' }}
                      onClick={handleMarkAllRead}
                    >
                      Mark all read
                    </Text>
                  )}
                </HStack>
              </PopoverHeader>
              <PopoverBody p="0" maxH="300px" overflowY="auto">
                {notifications.length === 0 ? (
                  <Text p="4" fontSize="sm" color="gray.400" textAlign="center">No notifications</Text>
                ) : (
                  notifications.map((n) => (
                    <Box
                      key={n.id} px="4" py="3"
                      bg={n.read ? 'transparent' : notificationBg}
                      borderBottom="1px solid" borderColor={borderColor}
                      cursor="pointer"
                      _hover={{ bg: hoverBg }}
                      onClick={async () => {
                        await db.notifications.markRead(n.id, user.id);
                        setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
                        setUnreadCount((c) => Math.max(0, c - (n.read ? 0 : 1)));
                        if (n.service_id) router.push(`/services/${n.service_id}`);
                      }}
                    >
                      <Text fontSize="sm" fontWeight={n.read ? '400' : '600'}>{n.title}</Text>
                      <Text fontSize="xs" color="gray.500" mt="0.5">{n.message}</Text>
                    </Box>
                  ))
                )}
              </PopoverBody>
            </PopoverContent>
          </Popover>

          <Menu placement="top-start">
            <MenuButton w="full">
              <HStack spacing="3" px="2" py="2" borderRadius="lg" _hover={{ bg: hoverBg }} transition="all 0.15s ease">
                <Avatar size="sm" name={user.name} src={user.avatar_url} />
                <Box flex="1" textAlign="left">
                  <Text fontSize="sm" fontWeight="600" noOfLines={1}>{user.name}</Text>
                  <Text fontSize="xs" color="gray.500" noOfLines={1}>{user.email}</Text>
                </Box>
              </HStack>
            </MenuButton>
            <MenuList zIndex={50}>
              <MenuItem
                icon={<Settings size={16} />}
                onClick={() => { router.push('/settings'); onClose?.(); }}
                fontSize="sm"
              >
                Settings
              </MenuItem>
              {user?.role === 'admin' && (
                <MenuItem
                  icon={<CreditCard size={16} />}
                  onClick={() => { router.push('/settings/billing'); onClose?.(); }}
                  fontSize="sm"
                >
                  Billing
                </MenuItem>
              )}
              <MenuItem
                icon={<HelpCircle size={16} />}
                as="a"
                href="mailto:support@worshipcenter.app"
                fontSize="sm"
              >
                Help & Support
              </MenuItem>
              <Divider my={1} />
              <MenuItem
                icon={<LogOut size={16} />}
                onClick={() => { logout(); router.push('/login'); }}
                fontSize="sm"
                color="red.500"
              >
                Sign out
              </MenuItem>
            </MenuList>
          </Menu>
        </Box>
      )}
    </Flex>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const mainBg = useColorModeValue('gray.50', 'gray.900');
  const headerBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');

  return (
    <Flex h="100vh" overflow="hidden">
      {/* Desktop sidebar */}
      <Box
        display={{ base: 'none', lg: 'block' }}
        w="260px"
        flexShrink={0}
        h="100vh"
        position="sticky"
        top="0"
      >
        <SidebarContent />
      </Box>

      {/* Mobile header bar */}
      <Box
        display={{ base: 'block', lg: 'none' }}
        position="fixed"
        top="0"
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
          />
          <HStack spacing={0}>
            <Text fontSize="lg" fontWeight="800" color="gray.800" letterSpacing="-0.5px">
              Worship
            </Text>
            <Text fontSize="lg" fontWeight="800" color="teal.600" letterSpacing="-0.5px">
              Center
            </Text>
          </HStack>
        </Flex>
      </Box>

      {/* Mobile drawer */}
      <Drawer isOpen={isOpen} placement="left" onClose={onClose} size="xs">
        <DrawerOverlay bg="blackAlpha.300" backdropFilter="blur(4px)" />
          <DrawerContent 
            maxW="260px"
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
          paddingTop: ['calc(56px + env(safe-area-inset-top))', null, null, '0'],
        }}
      >
        {/* Trial status banners */}
        <TrialBanner />
        <TrialExpiredBanner />
        
        <Box w="full" maxW="100vw" overflowX="hidden">
          {children}
        </Box>
        
        {/* Floating subscribe CTA for trial users */}
        <FloatingSubscribeCTA />
      </Box>
    </Flex>
  );
}