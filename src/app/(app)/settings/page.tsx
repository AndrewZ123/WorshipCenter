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
} from '@chakra-ui/react';
import { FiCamera, FiUser, FiHome } from 'react-icons/fi';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const { user, church } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [userName, setUserName] = useState('');
  const [churchName, setChurchName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
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
      const { error } = await supabase
        .from('users')
        .update({ name: userName.trim() })
        .eq('id', user.id);
      
      if (error) throw error;
      
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
    <Box p={{ base: '4', md: '8' }} maxW="800px" mx="auto">
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
      </VStack>
    </Box>
  );
}