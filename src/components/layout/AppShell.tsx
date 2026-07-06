'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box, Flex, VStack, Text, HStack, Menu, MenuButton,
  MenuList, MenuItem, Divider, useDisclosure, IconButton, Drawer,
  DrawerOverlay, DrawerContent, DrawerCloseButton, DrawerBody,
  useColorMode, useColorModeValue, Badge, Switch,   Portal,
} from '@chakra-ui/react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/store';
import type { Notification } from '@/lib/types';
import { TrialBanner, TrialExpiredBanner, FloatingSubscribeCTA } from './TrialBanner';
import BottomNav from './BottomNav';
import Avatar from '@/components/ui/Avatar';
import TourOverlay from '@/components/onboarding/TourOverlay';
import { useTour } from '@/lib/tour/TourContext';
import { TOUR_STEPS, MOBILE_TOUR_STEPS } from '@/lib/tour/steps';

// Lucide icons
import { 
  Calendar, Home, Music, Users, BarChart2, CreditCard,
  LogOut, Settings, Bell, Moon, Sun, Repeat, Church, MessageCircle, HelpCircle,
  CheckSquare, FileBarChart, Sparkles
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: Home },
  { label: 'Services', href: '/services', icon: Calendar },
  { label: 'My Tasks', href: '/tasks', icon: CheckSquare },
  { label: 'Songs', href: '/songs', icon: Music },
  { label: 'Team', href: '/team', icon: Users },
  { label: 'Team Chat', href: '/chat', icon: MessageCircle },
  { label: 'Song Usage', href: '/usage', icon: BarChart2 },
  { label: 'Reports', href: '/reports', icon: FileBarChart },
];

// Nav items hidden from team members
const TEAM_HIDDEN_ITEMS = ['/team', '/usage', '/reports'];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, church, logout } = useAuth();
  const { colorMode, toggleColorMode } = useColorMode();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const { start } = useTour();
  const [isMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 62em)').matches;
  })

  // Color mode values at top level
  const sidebarBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const notificationBg = useColorModeValue('teal.50', 'teal.900');
  const logoColor = useColorModeValue('gray.800', 'gray.100');
  const logoAccent = useColorModeValue('teal.600', 'teal.300');
  const churchBg = useColorModeValue('gray.50', 'gray.700');
  const iconColor = useColorModeValue('gray.500', 'gray.400');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const actionHoverBg = useColorModeValue('gray.100', 'gray.600');
  const activeNavBg = useColorModeValue('teal.50', 'rgba(13,148,136,0.15)');
  const activeNavColor = useColorModeValue('teal.700', 'teal.300');

  useEffect(() => {
    async function loadNotifications() {
      if (user) {
        setUnreadCount(await db.notifications.getUnreadCount(user.id));
        const all = await db.notifications.getByUser(user.id);
        setNotifications(all.slice(0, 5));
      }
    }
    loadNotifications();
  }, [user?.id]);

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
      <Box px="4" py="4">
        <HStack spacing={0}>
          <Text fontSize="lg" fontWeight="800" color={logoColor} letterSpacing="-0.5px">
            Worship
          </Text>
          <Text fontSize="lg" fontWeight="800" color={logoAccent} letterSpacing="-0.5px">
            Center
          </Text>
        </HStack>
        
        {/* Workspace row */}
        {church && (
          <HStack
            mt="2"
            px="2"
            py="1.5"
            bg={churchBg}
            borderRadius="md"
            spacing="2"
          >
            <Church size={16} color={iconColor} />
            <Text fontSize="sm" fontWeight="500" color={textColor} noOfLines={1}>
              {church.name}
            </Text>
          </HStack>
        )}
      </Box>

      <Divider borderColor={borderColor} />

      {/* Primary Nav */}
      <VStack spacing="0.5" px="2" py="3" align="stretch" flex="1">
        {NAV_ITEMS.map((item) => {
          if (user?.role === 'team' && TEAM_HIDDEN_ITEMS.includes(item.href)) return null;

          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const IconComponent = item.icon;
          
          const tourAttr = `nav-${item.href.replace(/^\//, '')}`;
          return (
            <HStack
              key={item.href}
              data-tour={tourAttr}
              px="3"
              py="2.5"
              borderRadius="md"
              cursor="pointer"
              bg={isActive ? activeNavBg : 'transparent'}
              color={isActive ? activeNavColor : textColor}
              fontWeight={isActive ? '600' : '500'}
              borderLeft={isActive ? '3px solid' : '3px solid transparent'}
              borderColor={isActive ? logoAccent : 'transparent'}
              pl="calc(0.75rem + 3px)"
              _hover={{ bg: isActive ? activeNavBg : hoverBg, color: isActive ? activeNavColor : logoColor }}
              transition="all 0.15s ease"
              onClick={() => handleNav(item.href)}
              role="button"
              tabIndex={0}
            >
              <Box flexShrink={0}>
                <IconComponent size={20} />
              </Box>
              <Text fontSize="sm" fontWeight="500">{item.label}</Text>
            </HStack>
          );
        })}

      </VStack>

      {/* Dark mode toggle */}
      <Box px="4" py="3" borderTop="1px solid" borderColor={borderColor}>
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
            aria-label="Toggle dark mode"
          />
        </HStack>
        <HStack spacing="2" mt="2">
          <HelpCircle size={12} />
          <Text
            fontSize="xs"
            color={subtextColor}
            cursor="pointer"
            _hover={{ color: logoAccent }}
            onClick={() => window.open('/support', '_blank')}
          >
            Support
          </Text>
          <Text fontSize="xs" color={subtextColor}>·</Text>
          <Text
            fontSize="xs"
            color={subtextColor}
            cursor="pointer"
            _hover={{ color: logoAccent }}
            onClick={() => window.open('/privacy', '_blank')}
          >
            Privacy
          </Text>
          <Text fontSize="xs" color={subtextColor}>·</Text>
          <Text
            fontSize="xs"
            color={subtextColor}
            cursor="pointer"
            _hover={{ color: logoAccent }}
            onClick={() => window.open('/terms', '_blank')}
          >
            Terms
          </Text>
        </HStack>
      </Box>

      {/* Notifications + User section */}
      {user && (
        <Box px="3" py="2" borderTop="1px solid" borderColor={borderColor}>
          {/* Notification bell */}
          <Box position="relative">
            <HStack
              spacing="2" px="2" py="2" borderRadius="md"
              cursor="pointer" _hover={{ bg: hoverBg }} transition="all 0.15s ease"
              mb="1"
              role="button"
              tabIndex={0}
              onClick={() => setShowNotifications((s) => !s)}
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            >
              <Bell size={18} />
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

            {showNotifications && (
              <>
                <Box
                  position="fixed"
                  inset="0"
                  zIndex={1799}
                  onClick={() => setShowNotifications(false)}
                />
                <Portal>
                  <Box
                    position="fixed"
                    left="270px"
                    bottom="80px"
                    w="360px"
                    maxH="380px"
                    bg={sidebarBg}
                    borderRadius="xl"
                    border="1px solid"
                    borderColor={borderColor}
                    boxShadow="0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)"
                    zIndex={1800}
                    display="flex"
                    flexDir="column"
                  >
                    <HStack justify="space-between" px="4" py="3" borderBottom="1px solid" borderColor={borderColor}>
                      <Text fontWeight="700" fontSize="sm">Notifications</Text>
                      <HStack spacing="3">
                        {notifications.length > 0 && (
                          <Text
                            fontSize="xs" color="red.400" cursor="pointer"
                            _hover={{ textDecoration: 'underline', color: 'red.500' }}
                            onClick={async () => {
                              await db.notifications.deleteAll(user.id);
                              setNotifications([]);
                              setUnreadCount(0);
                            }}
                          >
                            Clear all
                          </Text>
                        )}
                        {unreadCount > 0 && (
                          <Text
                            fontSize="xs" color={logoAccent} cursor="pointer"
                            _hover={{ textDecoration: 'underline' }}
                            onClick={handleMarkAllRead}
                          >
                            Mark all read
                          </Text>
                        )}
                        <Text fontSize="xs" color="gray.400" cursor="pointer" _hover={{ color: 'gray.600' }} onClick={() => setShowNotifications(false)}>✕</Text>
                      </HStack>
                    </HStack>
                    <Box overflowY="auto" flex="1">
                      {notifications.length === 0 ? (
                        <Text p="4" fontSize="sm" color={iconColor} textAlign="center">No notifications</Text>
                      ) : (
                        notifications.map((n) => (
                          <HStack
                            key={n.id} px="4" py="2.5"
                            bg={n.read ? 'transparent' : notificationBg}
                            borderBottom="1px solid" borderColor={borderColor}
                            cursor="pointer"
                            _hover={{ bg: hoverBg }}
                            spacing="2"
                            align="start"
                          >
                            <Box
                              flex="1"
                              onClick={async () => {
                                await db.notifications.markRead(n.id, user.id);
                                setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
                                setUnreadCount((c) => Math.max(0, c - (n.read ? 0 : 1)));
                                if (n.service_id) router.push(`/services/${n.service_id}`);
                              }}
                            >
                              <Text fontSize="sm" fontWeight={n.read ? '400' : '600'}>{n.title}</Text>
                              <Text fontSize="xs" color={subtextColor} mt="0.5" noOfLines={2}>{n.message}</Text>
                            </Box>
                            <Text
                              as="span"
                              fontSize="xs"
                              color="gray.400"
                              cursor="pointer"
                              flexShrink={0}
                              mt="0.5"
                              _hover={{ color: 'red.400' }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                await db.notifications.delete(n.id, user.id);
                                setNotifications((prev) => prev.filter((x) => x.id !== n.id));
                                if (!n.read) setUnreadCount((c) => Math.max(0, c - 1));
                              }}
                              aria-label="Delete notification"
                            >
                              ✕
                            </Text>
                          </HStack>
                        ))
                      )}
                    </Box>
                  </Box>
                </Portal>
              </>
            )}
          </Box>

          <Menu placement="top-start">
            <MenuButton w="full">
              <HStack spacing="2" px="2" py="2" borderRadius="md" _hover={{ bg: hoverBg }} transition="all 0.15s ease">
                <Avatar size="sm" name={user.name} src={user.avatar_url} />
                <Box flex="1" textAlign="left">
                  <Text fontSize="sm" fontWeight="600" noOfLines={1}>{user.name}</Text>
                  <Text fontSize="xs" color={subtextColor} noOfLines={1}>{user.email}</Text>
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
                onClick={() => { window.open('/support', '_blank'); onClose?.(); }}
                fontSize="sm"
              >
                Help & Support
              </MenuItem>
              <MenuItem
                icon={<HelpCircle size={16} />}
                onClick={() => { window.open('/privacy', '_blank'); onClose?.(); }}
                fontSize="sm"
              >
                Privacy Policy
              </MenuItem>
              <MenuItem
                icon={<Sparkles size={16} />}
                onClick={() => { start(isMobile ? MOBILE_TOUR_STEPS : TOUR_STEPS); onClose?.(); }}
                fontSize="sm"
              >
                Take the Tour
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
  const { setDrawerControls, start } = useTour();
  const mainBg = useColorModeValue('gray.50', 'gray.900');
  const headerBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const logoColor = useColorModeValue('gray.800', 'gray.100');
  const logoAccent = useColorModeValue('teal.600', 'teal.300');

  // Register drawer controls so TourOverlay can open/close it
  useEffect(() => {
    setDrawerControls(onOpen, onClose);
    return () => setDrawerControls(() => {}, () => {});
  }, [onOpen, onClose, setDrawerControls]);

  // Determine if mobile — use matchMedia to avoid SSR flash
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 62em)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);



  return (
    <>
      <TourOverlay />
      <Flex h="100dvh" overflow="hidden">
      {/* Desktop sidebar */}
      <Box
        display={{ base: 'none', lg: 'block' }}
        w="260px"
        flexShrink={0}
        h="100dvh"
        position="sticky"
        top="0"
        sx={{ paddingTop: 'env(safe-area-inset-top)' }}
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
        zIndex="1000"
        sx={{
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <Flex h="48px" align="center" justify="center" px="4">
          <HStack spacing={0}>
            <Text fontSize="md" fontWeight="800" color={logoColor} letterSpacing="-0.5px">
              Worship
            </Text>
            <Text fontSize="md" fontWeight="800" color={logoAccent} letterSpacing="-0.5px">
              Center
            </Text>
          </HStack>
        </Flex>
      </Box>

      {/* Mobile drawer */}
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
            size="md" 
            top="12px" 
            right="12px"
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
        overflowY={isOpen ? 'hidden' : 'auto'}
        overflowX="hidden"
        bg={mainBg}
        className="main-content"
        sx={{
          paddingTop: ['calc(48px + env(safe-area-inset-top))', null, null, 'env(safe-area-inset-top, 0px)'],
          paddingBottom: { base: 'calc(48px + env(safe-area-inset-bottom))', lg: '0' },
        }}
      >
        {/* Trial status banners */}
        <TrialBanner />
        <TrialExpiredBanner />
        
        <Box w="full">
          {children}
        </Box>
      </Box>

      {/* Bottom navigation - outside scroll container */}
      <BottomNav onOpenDrawer={onOpen} />

      {/* Floating subscribe CTA for trial users */}
      <FloatingSubscribeCTA />
    </Flex>
    </>
  );
}
