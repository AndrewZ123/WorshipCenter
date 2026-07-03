'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Box, Flex, Text, useColorModeValue } from '@chakra-ui/react';
import { Home, Calendar, CheckSquare, Music, MessageCircle, MoreHorizontal } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Services', href: '/services', icon: Calendar },
  { label: 'Tasks', href: '/tasks', icon: CheckSquare },
  { label: 'Songs', href: '/songs', icon: Music },
  { label: 'More', href: '', icon: MoreHorizontal, isMore: true },
];

export default function BottomNav({ onOpenDrawer }: { onOpenDrawer?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const activeColor = useColorModeValue('teal.600', 'teal.300');
  const inactiveColor = useColorModeValue('gray.400', 'gray.500');

  const isActive = (href: string) => {
    if (!href) return false;
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
  };

  return (
    <Box
      display={{ base: 'block', lg: 'none' }}
      position="fixed"
      bottom="0"
      left="0"
      right="0"
      zIndex="999"
      bg={bg}
      borderTop="1px solid"
      borderColor={borderColor}
      sx={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Flex h="56px" align="center" justify="space-around" px="2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
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
              color={active ? activeColor : inactiveColor}
              onClick={() => {
                if (item.isMore) {
                  onOpenDrawer?.();
                } else {
                  router.push(item.href);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={item.label}
              _hover={{ color: activeColor }}
              transition="color 0.15s ease"
            >
              <Icon size={22} />
              <Text fontSize="10px" fontWeight={active ? '600' : '500'} mt="2px">
                {item.label}
              </Text>
            </Flex>
          );
        })}
      </Flex>
    </Box>
  );
}
