'use client';

import { Box, Text, VStack, HStack, Badge, useColorModeValue } from '@chakra-ui/react';
import type { Service, Church, ServiceItem, Song, ServiceAssignment, TeamMember } from '@/lib/types';
import { Calendar, Clock, Music, FileText, Users } from 'lucide-react';

interface ShareData {
  service: Service;
  church: Pick<Church, 'name'> | null;
  items: ServiceItem[];
  songs: Song[];
  assignments: ServiceAssignment[];
  teamMembers: TeamMember[];
}

const STATUS_COLORS: Record<string, string> = { draft: 'gray', finalized: 'blue', completed: 'green' };
const ASSIGNMENT_STATUS_COLORS: Record<string, string> = { pending: 'orange', confirmed: 'green', declined: 'red' };

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function roleLabel(role: string) {
  return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function ShareView({ data, isDemo }: { data: ShareData | null; isDemo?: boolean }) {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const headingColor = useColorModeValue('gray.900', 'white');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const subtextColor = useColorModeValue('gray.500', 'gray.400');
  const sectionBg = useColorModeValue('gray.50', 'gray.700');

  if (!data) {
    return (
      <Box minH="100dvh" display="flex" alignItems="center" justifyContent="center" px="6">
        <VStack spacing="4" textAlign="center">
          {isDemo ? (
            <>
              <Text fontSize="2xl" fontWeight="bold" color={headingColor}>Demo Preview</Text>
              <Text color={textColor} maxW="sm">
                This is a demo service link. Share links work with real services in the full app.
              </Text>
            </>
          ) : (
            <>
              <Text fontSize="3xl" fontWeight="bold" color={headingColor}>Not Found</Text>
              <Text color={textColor} maxW="sm">
                This shared service could not be found. It may have been removed or sharing may have been disabled.
              </Text>
            </>
          )}
        </VStack>
      </Box>
    );
  }

  const { service, church, items, songs, assignments, teamMembers } = data;

  const songMap = new Map(songs.map(s => [s.id, s]));
  const memberMap = new Map(teamMembers.map(m => [m.id, m]));

  const confirmedAssignments = assignments.filter(a => a.status === 'confirmed' || a.status === 'pending');
  const groupedAssignments = confirmedAssignments.reduce<Record<string, ServiceAssignment[]>>((acc, a) => {
    if (!acc[a.role]) acc[a.role] = [];
    acc[a.role].push(a);
    return acc;
  }, {});

  const totalDuration = items.reduce((sum, item) => sum + (item.duration_minutes || 0), 0);

  return (
    <Box minH="100dvh" bg={useColorModeValue('gray.50', 'gray.900')}>
      <Box maxW="680px" mx="auto" px={{ base: '4', md: '6' }} py={{ base: '6', md: '10' }}>
        {/* Church name */}
        {church && (
          <Text fontSize="sm" fontWeight="600" color="teal.500" textTransform="uppercase" letterSpacing="wider" mb="2">
            {church.name}
          </Text>
        )}

        {/* Service title */}
        <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" color={headingColor} lineHeight="1.2" mb="3">
          {service.title}
        </Text>

        {/* Meta row */}
        <HStack spacing="4" flexWrap="wrap" color={subtextColor} fontSize="sm" mb="5">
          <HStack spacing="1.5">
            <Calendar size={14} />
            <Text>{formatDate(service.date)}</Text>
          </HStack>
          <HStack spacing="1.5">
            <Clock size={14} />
            <Text>{service.time}</Text>
          </HStack>
          <Badge colorScheme={STATUS_COLORS[service.status]} variant="subtle" fontSize="xs" px="2" py="0.5" borderRadius="full">
            {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
          </Badge>
          {totalDuration > 0 && (
            <Text color={subtextColor}>~{totalDuration} min</Text>
          )}
        </HStack>

        {/* Notes */}
        {service.notes && (
          <Box bg={sectionBg} borderRadius="lg" p="4" mb="6" fontSize="sm" color={textColor} whiteSpace="pre-wrap">
            {service.notes}
          </Box>
        )}

        {/* Service Order */}
        <Box mb="6">
          <HStack spacing="2" mb="3">
            <Music size={16} color={subtextColor} />
            <Text fontSize="sm" fontWeight="700" color={subtextColor} textTransform="uppercase" letterSpacing="wider">
              Service Order
            </Text>
          </HStack>

          {items.length === 0 ? (
            <Text fontSize="sm" color={subtextColor} fontStyle="italic">No items have been added yet.</Text>
          ) : (
            <VStack spacing="2" align="stretch">
              {items.map((item, i) => {
                const song = item.song_id ? songMap.get(item.song_id) : null;
                return (
                  <Box key={item.id} bg={cardBg} borderRadius="lg" border="1px solid" borderColor={borderColor} p="3.5">
                    <HStack justify="space-between" align="flex-start" gap="2">
                      <HStack spacing="3" align="flex-start" minW="0" flex="1">
                        <Box minW="24px" pt="1px" color={subtextColor}>
                          {item.type === 'song' ? <Music size={16} /> : <FileText size={16} />}
                        </Box>
                        <Box minW="0" flex="1">
                          <Text fontWeight="600" fontSize="sm" color={headingColor}>
                            {item.type === 'song' && song ? song.title : item.title}
                          </Text>
                          {item.type === 'song' && song?.artist && (
                            <Text fontSize="xs" color={subtextColor} mt="0.5">{song.artist}</Text>
                          )}
                          {item.type === 'song' && song && !song.artist && item.notes && (
                            <Text fontSize="xs" color={subtextColor} mt="0.5">{item.notes}</Text>
                          )}
                          {item.type === 'segment' && item.notes && (
                            <Text fontSize="xs" color={subtextColor} mt="0.5">{item.notes}</Text>
                          )}
                        </Box>
                      </HStack>
                      <HStack spacing="2" flexShrink={0}>
                        {item.key && (
                          <Badge colorScheme="purple" variant="subtle" fontSize="xs" borderRadius="md" px="2">
                            {item.key}
                          </Badge>
                        )}
                        {item.duration_minutes && (
                          <Text fontSize="xs" color={subtextColor} whiteSpace="nowrap">{item.duration_minutes}m</Text>
                        )}
                      </HStack>
                    </HStack>
                  </Box>
                );
              })}
            </VStack>
          )}
        </Box>

        {/* Team */}
        {assignments.length > 0 && (
          <Box mb="6">
            <HStack spacing="2" mb="3">
              <Users size={16} color={subtextColor} />
              <Text fontSize="sm" fontWeight="700" color={subtextColor} textTransform="uppercase" letterSpacing="wider">
                Team ({assignments.length})
              </Text>
            </HStack>

            <VStack spacing="2" align="stretch">
              {Object.entries(groupedAssignments).map(([role, roleAssignments]) => (
                <Box key={role} bg={cardBg} borderRadius="lg" border="1px solid" borderColor={borderColor} p="3.5">
                  <Text fontSize="xs" fontWeight="700" color={subtextColor} textTransform="uppercase" letterSpacing="wider" mb="2">
                    {roleLabel(role)}
                  </Text>
                  {roleAssignments.map(a => {
                    const member = a.team_member_id ? memberMap.get(a.team_member_id) : null;
                    return (
                      <HStack key={a.id} spacing="2" mb="1.5" _last={{ mb: 0 }}>
                        <Box w="6px" h="6px" borderRadius="full" bg={ASSIGNMENT_STATUS_COLORS[a.status] || 'gray.400'} />
                        <Text fontSize="sm" color={headingColor}>{member?.name || 'Unknown'}</Text>
                        <Badge colorScheme={ASSIGNMENT_STATUS_COLORS[a.status]} variant="subtle" fontSize="xs" borderRadius="full" px="2">
                          {a.status}
                        </Badge>
                      </HStack>
                    );
                  })}
                </Box>
              ))}
            </VStack>
          </Box>
        )}

        {/* Footer */}
        <Box pt="6" borderTop="1px solid" borderColor={borderColor} mt="6">
          <Text fontSize="xs" color={subtextColor} textAlign="center">
            Shared from WorshipCenter
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
