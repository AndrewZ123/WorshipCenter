'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  Card,
  CardBody,
  Input,
  FormControl,
  FormLabel,
  FormHelperText,
  Avatar,
  IconButton,
  Icon,
  useColorModeValue,
  useToast,
  Spinner,
  Badge,
  Divider,
  Flex,
  Textarea,
} from '@chakra-ui/react';
import { FiCamera, FiUser, FiHome, FiHelpCircle, FiAlertTriangle } from 'react-icons/fi';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/StoreContext';
import { useTour } from '@/lib/tour/TourContext';
import { TOUR_STEPS, MOBILE_TOUR_STEPS } from '@/lib/tour/steps';
import { Sparkles, Calendar, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { TeamMemberPreference, TeamMemberBlockoutDate } from '@/lib/types';

export default function SettingsPage() {
  const { user, church, deleteAccount } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { start } = useTour();
  const { confirm: confirmDelete, ConfirmDialog: DeleteConfirmDialog } = useConfirmDialog();
  
  const [userName, setUserName] = useState('');
  const [churchName, setChurchName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Preferences & Blockout state
  const store = useStore();
  const [preference, setPreference] = useState<TeamMemberPreference | null>(null);
  const [blockoutDates, setBlockoutDates] = useState<TeamMemberBlockoutDate[]>([]);
  const [prefFrequency, setPrefFrequency] = useState<number | null>(null);
  const [prefNotes, setPrefNotes] = useState('');
  const [savingPref, setSavingPref] = useState(false);
  const [newBlockoutStart, setNewBlockoutStart] = useState('');
  const [newBlockoutEnd, setNewBlockoutEnd] = useState('');
  const [newBlockoutReason, setNewBlockoutReason] = useState('');
  const [addingBlockout, setAddingBlockout] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  
  useEffect(() => {
    if (user) {
      setUserName(user.name);
      setAvatarUrl(user.avatar_url || null);
    }
    if (church) {
      setChurchName(church.name);
    }
  }, [user, church]);

  // Load preferences and blockout dates for the logged-in user
  useEffect(() => {
    if (!church || !user?.team_member_id) return;
    (async () => {
      try {
        setLoadingPrefs(true);
        const pref = await store.preferences.getByTeamMember(user.team_member_id!, church.id);
        setPreference(pref);
        setPrefFrequency(pref?.max_weekly_frequency ?? null);
        setPrefNotes(pref?.availability_notes || '');
        const blockouts = await store.blockoutDates.getByTeamMember(user.team_member_id!, church.id);
        setBlockoutDates(blockouts);
      } catch (error) {
        console.error('Error loading availability:', error);
      } finally {
        setLoadingPrefs(false);
      }
    })();
  }, [church, user?.team_member_id]);
  
  // Preferences & Blockout handlers
  const handleSavePreference = async () => {
    if (!church || !user?.team_member_id) return;
    try {
      setSavingPref(true);
      const updated = await store.preferences.upsert(user.team_member_id, church.id, {
        max_weekly_frequency: prefFrequency,
        availability_notes: prefNotes,
      });
      if (updated) setPreference(updated);
      toast({ title: 'Preferences saved', status: 'success', duration: 2000 });
    } catch (error) {
      console.error('Error saving preference:', error);
      toast({ title: 'Error saving preferences', status: 'error', duration: 3000 });
    } finally {
      setSavingPref(false);
    }
  };

  const handleAddBlockout = async () => {
    if (!church || !user?.team_member_id || !newBlockoutStart || !newBlockoutEnd) return;
    try {
      setAddingBlockout(true);
      const created = await store.blockoutDates.create({
        team_member_id: user.team_member_id,
        church_id: church.id,
        start_date: newBlockoutStart,
        end_date: newBlockoutEnd,
        reason: newBlockoutReason,
      });
      if (created) {
        setBlockoutDates(prev => [...prev, created]);
        setNewBlockoutStart('');
        setNewBlockoutEnd('');
        setNewBlockoutReason('');
      }
      toast({ title: 'Blockout date added', status: 'success', duration: 2000 });
    } catch (error) {
      console.error('Error adding blockout:', error);
      toast({ title: 'Error adding blockout date', status: 'error', duration: 3000 });
    } finally {
      setAddingBlockout(false);
    }
  };

  const handleDeleteBlockout = async (id: string) => {
    if (!church) return;
    try {
      const ok = await store.blockoutDates.delete(id, church.id);
      if (ok) {
        setBlockoutDates(prev => prev.filter(b => b.id !== id));
        toast({ title: 'Blockout date removed', status: 'info', duration: 2000 });
      }
    } catch (error) {
      console.error('Error deleting blockout:', error);
      toast({ title: 'Error removing blockout date', status: 'error', duration: 3000 });
    }
  };

  const formatDateRange = (start: string, end: string) => {
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const s = new Date(start + 'T00:00:00').toLocaleDateString('en-US', opts);
    const e = new Date(end + 'T00:00:00').toLocaleDateString('en-US', opts);
    return start === end ? s : `${s} – ${e}`;
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file', status: 'error', duration: 3000 });
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Image must be less than 2MB', status: 'error', duration: 3000 });
      return;
    }
    
    setIsUploadingAvatar(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);
      
      // Update user profile with avatar URL
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);
      
      if (updateError) throw updateError;
      
      // Also update the team_member record linked to this user
      const { error: teamMemberError } = await supabase
        .from('team_members')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);
      
      if (teamMemberError) {
        console.error('Error updating team_member avatar:', teamMemberError);
        // Don't throw - the user update succeeded, team_member update is secondary
      }
      
      setAvatarUrl(publicUrl);
      toast({ title: 'Avatar updated!', status: 'success', duration: 3000 });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({ title: 'Upload failed', description: 'Could not upload avatar. Storage may not be configured.', status: 'error', duration: 3000 });
    } finally {
      setIsUploadingAvatar(false);
    }
  };
  
  const handleSaveProfile = async () => {
    if (!user || !userName.trim()) {
      toast({ title: 'Name required', status: 'error', duration: 3000 });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Update user profile
      const { error: userError } = await supabase
        .from('users')
        .update({ name: userName.trim() })
        .eq('id', user.id);
      
      if (userError) throw userError;
      
      // Also update the team_member record linked to this user
      const { error: teamMemberError } = await supabase
        .from('team_members')
        .update({ name: userName.trim() })
        .eq('user_id', user.id);
      
      if (teamMemberError) {
        console.error('Error updating team_member name:', teamMemberError);
        // Don't throw - the user update succeeded, team_member update is secondary
      }
      
      toast({ title: 'Profile updated!', status: 'success', duration: 3000 });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({ title: 'Update failed', status: 'error', duration: 3000 });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveChurch = async () => {
    if (!church || !churchName.trim()) {
      toast({ title: 'Church name required', status: 'error', duration: 3000 });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('churches')
        .update({ name: churchName.trim() })
        .eq('id', church.id);
      
      if (error) throw error;
      
      toast({ title: 'Church settings updated!', status: 'success', duration: 3000 });
    } catch (error) {
      console.error('Error updating church:', error);
      toast({ title: 'Update failed', status: 'error', duration: 3000 });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!user) {
    return (
      <Box p={8} display="flex" justifyContent="center">
        <Spinner size="lg" />
      </Box>
    );
  }
  
  return (
    <Box px={{ base: '4', md: '8' }} pb={{ base: '4', md: '8' }} maxW="800px" mx="auto">
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading size="lg" mb={2} color={textColor}>Settings</Heading>
          <Text color={subtextColor}>Manage your account and church settings</Text>
        </Box>
        
        {/* Profile Settings */}
        <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
          <CardBody>
            <VStack align="stretch" spacing={6}>
              <HStack spacing={4}>
                <Icon as={FiUser} boxSize={5} color="brand.500" />
                <Heading size="md" color={textColor}>Profile Settings</Heading>
              </HStack>
              
              <Divider />
              
              {/* Avatar */}
              <HStack spacing={6} align="center">
                <Box position="relative">
                  <Avatar
                    size="xl"
                    name={user.name}
                    src={avatarUrl || undefined}
                    bg="brand.500"
                    color="white"
                  />
                  <IconButton
                    aria-label="Change avatar"
                    icon={<FiCamera />}
                    size="sm"
                    borderRadius="full"
                    position="absolute"
                    bottom="0"
                    right="0"
                    onClick={handleAvatarClick}
                    isLoading={isUploadingAvatar}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    style={{ display: 'none' }}
                  />
                </Box>
                <Box>
                  <Text fontWeight="medium" color={textColor}>Profile Picture</Text>
                  <Text fontSize="sm" color={subtextColor}>Click to upload a new avatar (max 2MB)</Text>
                </Box>
              </HStack>
              
              {/* Name */}
              <FormControl>
                <FormLabel color={textColor}>Name</FormLabel>
                <Input
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Your name"
                  bg={useColorModeValue('white', 'gray.700')}
                />
              </FormControl>
              
              {/* Email (read-only) */}
              <FormControl>
                <FormLabel color={textColor}>Email</FormLabel>
                <Input
                  value={user.email}
                  isReadOnly
                  bg={useColorModeValue('gray.50', 'gray.700')}
                  color={subtextColor}
                />
                <FormHelperText color={subtextColor}>
                  Email cannot be changed. Contact support if needed.
                </FormHelperText>
              </FormControl>
              
              {/* Role */}
              <FormControl>
                <FormLabel color={textColor}>Role</FormLabel>
                <HStack>
                  <Badge
                    colorScheme={user.role === 'admin' ? 'purple' : user.role === 'leader' ? 'blue' : 'gray'}
                    fontSize="sm"
                    px={3}
                    py={1}
                    borderRadius="full"
                  >
                    {user.role === 'admin' ? 'Worship Leader (Admin)' : user.role === 'leader' ? 'Leader' : 'Team Member'}
                  </Badge>
                </HStack>
              </FormControl>
              
              <Button
                colorScheme="brand"
                onClick={handleSaveProfile}
                isLoading={isLoading}
                alignSelf="flex-start"
              >
                Save Profile
              </Button>
            </VStack>
          </CardBody>
        </Card>
        
        {/* Church Settings (Admin only) */}
        {user.role === 'admin' && church && (
          <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
            <CardBody>
              <VStack align="stretch" spacing={6}>
                <HStack spacing={4}>
                  <Icon as={FiHome} boxSize={5} color="brand.500" />
                  <Heading size="md" color={textColor}>Church Settings</Heading>
                  <Badge colorScheme="purple" ml="auto">Admin Only</Badge>
                </HStack>
                
                <Divider />
                
                {/* Church Name */}
                <FormControl>
                  <FormLabel color={textColor}>Church Name</FormLabel>
                  <Input
                    value={churchName}
                    onChange={(e) => setChurchName(e.target.value)}
                    placeholder="Your church name"
                    bg={useColorModeValue('white', 'gray.700')}
                  />
                </FormControl>
                
                {/* Church Slug (read-only) */}
                <FormControl>
                  <FormLabel color={textColor}>Church URL Slug</FormLabel>
                  <Input
                    value={church.slug}
                    isReadOnly
                    bg={useColorModeValue('gray.50', 'gray.700')}
                    color={subtextColor}
                  />
                  <FormHelperText color={subtextColor}>
                    The unique identifier for your church. Cannot be changed.
                  </FormHelperText>
                </FormControl>
                
          <Button
            colorScheme="brand"
            onClick={handleSaveChurch}
            isLoading={isLoading}
            alignSelf="flex-start"
          >
            Save Church Settings
          </Button>
        </VStack>
      </CardBody>
    </Card>
  )}

  {/* My Availability (shown for all users with a team_member_id) */}
  {user?.team_member_id && (
    <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
      <CardBody>
        <VStack align="stretch" spacing={6}>
          <HStack spacing={4}>
            <Box p="3" borderRadius="lg" bg="orange.50" color="orange.600" flexShrink={0}>
              <Calendar size={22} />
            </Box>
            <Box flex="1">
              <Heading size="md" color={textColor}>My Availability</Heading>
              <Text fontSize="sm" color={subtextColor} mt="1">
                Set your preferences and blockout dates to help leaders schedule you.
              </Text>
            </Box>
          </HStack>

          <Divider />

          {loadingPrefs ? (
            <Spinner size="sm" alignSelf="center" />
          ) : (
            <>
              {/* Max Weekly Frequency */}
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Max Services Per Week</FormLabel>
                <HStack spacing="3">
                  <Input
                    type="number"
                    min={1}
                    max={7}
                    value={prefFrequency ?? ''}
                    onChange={(e) => setPrefFrequency(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="No limit"
                    borderRadius="lg"
                    w="120px"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPrefFrequency(null)}
                    isDisabled={prefFrequency === null}
                    borderRadius="lg"
                  >
                    No Limit
                  </Button>
                </HStack>
                <FormHelperText fontSize="xs" color={subtextColor}>
                  How many times per week are you willing to serve? Leave blank for no limit.
                </FormHelperText>
              </FormControl>

              {/* Availability Notes */}
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Availability Notes</FormLabel>
                <Textarea
                  value={prefNotes}
                  onChange={(e) => setPrefNotes(e.target.value)}
                  placeholder="e.g., prefers evening services, available only on weekends..."
                  borderRadius="lg"
                  rows={2}
                />
              </FormControl>

              <Button
                colorScheme="teal"
                size="sm"
                alignSelf="flex-start"
                onClick={handleSavePreference}
                isLoading={savingPref}
                fontWeight="600"
                borderRadius="lg"
              >
                Save Preferences
              </Button>

              <Divider />

              {/* Blockout Dates */}
              <Box>
                <Text fontWeight="600" fontSize="sm" color={textColor} mb="1">Blockout Dates</Text>
                <Text fontSize="xs" color={subtextColor} mb="3">
                  Dates when you're unavailable for service.
                </Text>

                {blockoutDates.length > 0 ? (
                  <VStack spacing="2" align="stretch" mb="4">
                    {blockoutDates.map((bd) => (
                      <Flex
                        key={bd.id}
                        justify="space-between"
                        align="center"
                        p="3"
                        borderRadius="lg"
                        border="1px solid"
                        borderColor={borderColor}
                      >
                        <HStack spacing="3">
                          <Calendar size={16} color="var(--chakra-colors-orange-400)" />
                          <Box>
                            <Text fontSize="sm" fontWeight="500" color={textColor}>
                              {formatDateRange(bd.start_date, bd.end_date)}
                            </Text>
                            {bd.reason && (
                              <Text fontSize="xs" color={subtextColor}>{bd.reason}</Text>
                            )}
                          </Box>
                        </HStack>
                        <IconButton
                          aria-label="Remove blockout date"
                          icon={<Trash2 size={14} />}
                          variant="ghost"
                          size="xs"
                          color="gray.400"
                          _hover={{ color: 'red.500', bg: 'red.50' }}
                          onClick={() => handleDeleteBlockout(bd.id)}
                        />
                      </Flex>
                    ))}
                  </VStack>
                ) : (
                  <Text fontSize="sm" color="gray.400" fontStyle="italic" mb="4">No blockout dates set.</Text>
                )}

                {/* Add Blockout */}
                <Box p="3" borderRadius="lg" border="1px dashed" borderColor={borderColor}>
                  <Text fontSize="sm" fontWeight="500" color={textColor} mb="2">Add Blockout Date</Text>
                  <VStack spacing="3" align="stretch">
                    <HStack spacing="3">
                      <FormControl>
                        <FormLabel fontWeight="600" fontSize="xs">Start Date</FormLabel>
                        <Input
                          type="date"
                          size="sm"
                          value={newBlockoutStart}
                          onChange={(e) => setNewBlockoutStart(e.target.value)}
                          borderRadius="lg"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontWeight="600" fontSize="xs">End Date</FormLabel>
                        <Input
                          type="date"
                          size="sm"
                          value={newBlockoutEnd}
                          onChange={(e) => setNewBlockoutEnd(e.target.value)}
                          borderRadius="lg"
                        />
                      </FormControl>
                    </HStack>
                    <FormControl>
                      <FormLabel fontWeight="600" fontSize="xs">Reason (optional)</FormLabel>
                      <Input
                        size="sm"
                        value={newBlockoutReason}
                        onChange={(e) => setNewBlockoutReason(e.target.value)}
                        placeholder="e.g., Vacation, Medical, Personal"
                        borderRadius="lg"
                      />
                    </FormControl>
                    <Button
                      colorScheme="orange"
                      size="sm"
                      alignSelf="flex-start"
                      onClick={handleAddBlockout}
                      isLoading={addingBlockout}
                      isDisabled={!newBlockoutStart || !newBlockoutEnd}
                      fontWeight="600"
                      borderRadius="lg"
                      leftIcon={<Plus size={16} />}
                    >
                      Add Blockout
                    </Button>
                  </VStack>
                </Box>
              </Box>
            </>
          )}
        </VStack>
      </CardBody>
    </Card>
  )}

  {/* Support Section */}
  <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
    <CardBody>
      <VStack align="stretch" spacing={4}>
        <HStack spacing={4}>
          <Box p="3" borderRadius="lg" bg="teal.50" color="teal.600" flexShrink={0}>
            <FiHelpCircle size={22} />
          </Box>
          <Box flex="1">
            <Heading size="md" color={textColor}>Need Help?</Heading>
            <Text fontSize="sm" color={subtextColor} mt="1">
              Contact us at support@worshipcenter.app or visit our support page.
            </Text>
          </Box>
          <Button
            as="a"
            href="/support"
            target="_blank"
            size="sm"
            colorScheme="teal"
            variant="outline"
          >
            Visit Support
          </Button>
        </HStack>
      </VStack>
    </CardBody>
  </Card>

  {/* Danger Zone */}
  <Card bg={bgColor} borderColor="red.200" borderWidth="1px">
    <CardBody>
      <VStack align="stretch" spacing={4}>
        <HStack spacing={4}>
          <Box p="3" borderRadius="lg" bg="red.50" color="red.500" flexShrink={0}>
            <FiAlertTriangle size={22} />
          </Box>
          <Box>
            <Heading size="md" color="red.500">Danger Zone</Heading>
            <Text fontSize="sm" color={subtextColor} mt="1">
              Permanently delete your account and all associated data. This action cannot be undone.
            </Text>
          </Box>
        </HStack>
        <Button
          colorScheme="red"
          variant="outline"
          size="sm"
          onClick={() => {
            confirmDelete(
              'Delete Account',
              'This will permanently delete your account and all associated data, including your user profile, messages, and contributions. This action cannot be undone.',
              async () => {
                setIsDeleting(true);
                try {
                  const result = await deleteAccount();
                  if (result.success) {
                    toast({ title: 'Account deleted', status: 'success', duration: 3000 });
                    router.push('/login');
                  } else {
                    toast({ title: 'Deletion failed', description: result.error || 'Please try again or contact support.', status: 'error', duration: 5000 });
                  }
                } catch (error) {
                  toast({ title: 'Deletion failed', description: 'An unexpected error occurred.', status: 'error', duration: 5000 });
                } finally {
                  setIsDeleting(false);
                }
              },
              { confirmLabel: 'Delete My Account', variant: 'destructive', icon: 'user' }
            );
          }}
          isDisabled={isDeleting}
          isLoading={isDeleting}
          leftIcon={<FiAlertTriangle size={16} />}
          alignSelf="flex-start"
        >
          Delete Account
        </Button>
      </VStack>
    </CardBody>
  </Card>
  {DeleteConfirmDialog}

        {/* Walkthrough Tour */}
        <Card bg={bgColor} borderColor={borderColor} borderWidth="1px">
          <CardBody>
            <HStack spacing={4} align="flex-start">
              <Box
                p="3"
                borderRadius="lg"
                bg="teal.50"
                color="teal.600"
                flexShrink={0}
              >
                <Sparkles size={22} />
              </Box>
              <VStack align="stretch" spacing={3} flex="1">
                <Box>
                  <Heading size="md" color={textColor}>Walkthrough Tour</Heading>
                  <Text fontSize="sm" color={subtextColor} mt="1">
                    Take a guided tour of WorshipCenter to learn about every section and feature.
                  </Text>
                </Box>
                <Button
                  colorScheme="teal"
                  size="sm"
                  alignSelf="flex-start"
                  leftIcon={<Sparkles size={16} />}
                  onClick={() => {
                    const isMobile = window.matchMedia('(max-width: 62em)').matches;
                    start(isMobile ? MOBILE_TOUR_STEPS : TOUR_STEPS);
                    router.push('/dashboard');
                  }}
                  borderRadius="lg"
                  fontWeight="600"
                >
                  Start Walkthrough
                </Button>
              </VStack>
            </HStack>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
}