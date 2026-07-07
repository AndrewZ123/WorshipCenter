'use client';

import { Box } from '@chakra-ui/react';
import ServeSection from '@/components/serve/ServeSection';

export default function ServePage() {
  return (
    <Box p={{ base: '4', md: '8' }} pt={{ base: '2', md: '8' }} maxW="900px" w="full" mx="auto">
      <ServeSection />
    </Box>
  );
}
