'use client';

import { Box } from '@chakra-ui/react';
import SongUsageSection from '@/components/reports/SongUsageSection';

export default function UsagePage() {
  return (
    <Box px={{ base: '4', md: '8' }} pt={{ base: '2', md: '8' }} pb={{ base: '4', md: '8' }} maxW="1100px" mx="auto">
      <SongUsageSection />
    </Box>
  );
}
