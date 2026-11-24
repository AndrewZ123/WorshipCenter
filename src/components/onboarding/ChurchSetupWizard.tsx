'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  HStack,
  Text,
  Box,
  IconButton,
  useToast,
} from '@chakra-ui/react';
import { Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import { useTour } from '@/lib/tour/TourContext';
import { apiUrl, getAuthHeaders, parseJsonSafe } from '@/lib/api-base';
import {
  CHURCH_SETUP_STEPS,
  CHURCH_SETUP_OPEN_EVENT,
  PROFILE_SETUP_COMPLETED_EVENT,
  churchSetupStorageKey,
  profileSetupStorageKey,
  hasTeamMemberBeyondCreator,
  isChurchSetupComplete,
  shouldOpenChurchSetup,
  validateChurchSetupService,
  validateChurchSetupTeamMember,
  validateChurchSetupSong,
  type ChurchSetupData,
  type ChurchSetupOpenDetail,
  type ChurchSetupStep,
  type ProfileSetupCompletedDetail,
} from '@/lib/church-setup';

interface TeamDraft {
  key: string;
  name: string;
  email: string;
  role: string;
}

let draftSequence = 0;
function newTeamDraft(): TeamDraft {
  draftSequence += 1;
  return { key: `draft-${draftSequence}`, name: '', email: '', role: '' };
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextSundayDate(): string {
  const date = new Date();
  const daysUntilSunday = (7 - date.getDay()) % 7;
  date.setDate(date.getDate() + daysUntilSunday);
  return toDateInputValue(date);
}

const STEP_META: Record<
  ChurchSetupStep,
  { title: string; description: string }
> = {
  service: {
    title: 'Create your first service',
    description:
      'Give your team a service to plan for. You can add songs and assignments later.',
  },
  team: {
    title: 'Invite your team',
    description:
      'Add the people who serve with you. Each person with an email gets an invitation link.',
  },
  songs: {
    title: 'Add your first song',
    description:
      'Start your song library with one song, or bulk-import a CSV export (including Planning Center).',
  },
};

function firstIssue(result: { success: false; error: { issues: { message: string }[] } }): string {
  return result.error.issues[0]?.message || 'Please check the details.';
}

export default function ChurchSetupWizard() {
  const { user, church } = useAuth();
  const store = useStore();
  const toast = useToast();
  const tour = useTour();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<ChurchSetupStep>('service');
  const [contentLoaded, setContentLoaded] = useState(false);
  const [setupFlagLoaded, setSetupFlagLoaded] = useState(false);
  const [serverSetupCompleted, setServerSetupCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [setupData, setSetupData] = useState<ChurchSetupData>({
    hasService: false,
    hasSong: false,
    hasTeamMemberBeyondCreator: false,
  });

  const [serviceTitle, setServiceTitle] = useState('Sunday Worship');
  const [serviceDate, setServiceDate] = useState(nextSundayDate);
  const [serviceTime, setServiceTime] = useState('09:00');

  const [teamDrafts, setTeamDrafts] = useState<TeamDraft[]>(() => [newTeamDraft()]);

  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [songKey, setSongKey] = useState('');

  const pendingOpenRef = useRef<ChurchSetupStep | null>(null);

  const stepIndex = CHURCH_SETUP_STEPS.indexOf(step);

  useEffect(() => {
    let cancelled = false;

    if (!user || !church) {
      return;
    }

    (async () => {
      try {
        const [services, songs, members, freshChurch] = await Promise.all([
          store.services.getByChurch(church.id),
          store.songs.getByChurch(church.id),
          store.teamMembers.getByChurch(church.id),
          // Fetch the church row explicitly so the server flag is known to
          // have loaded, rather than relying on a stale cached profile.
          store.churches.getById(church.id, church.id),
        ]);
        if (cancelled) return;
        if (!freshChurch) {
          throw new Error('Church not found');
        }

        setSetupData({
          hasService: services.length > 0,
          hasSong: songs.length > 0,
          hasTeamMemberBeyondCreator: hasTeamMemberBeyondCreator(members, {
            teamMemberId: user.team_member_id,
            userId: user.id,
            email: user.email,
          }),
        });
        setServerSetupCompleted(Boolean(freshChurch.onboarding_completed_at));
        setContentLoaded(true);
        setSetupFlagLoaded(true);
      } catch (error) {
        console.error('[ChurchSetup] Failed to load setup data:', error);
        // Never infer "brand new" from a failed load.
        if (!cancelled) {
          setContentLoaded(false);
          setSetupFlagLoaded(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, church, store]);

  const profileIsComplete = useCallback(() => {
    if (!user || typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(profileSetupStorageKey(user.id)) === 'true';
    } catch {
      return false;
    }
  }, [user]);

  const churchIsDismissed = useCallback(() => {
    if (!church || typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(churchSetupStorageKey(church.id)) === 'true';
    } catch {
      return false;
    }
  }, [church]);

  const openAt = useCallback((target: ChurchSetupStep) => {
    setStep(target);
    setIsOpen(true);
  }, []);

  const markServerCompleted = useCallback(async () => {
    if (!church || user?.role !== 'admin') return;
    try {
      await store.churches.markOnboardingComplete(church.id);
    } catch (error) {
      console.warn('[ChurchSetup] Failed to persist completion:', error);
    }
  }, [church, user?.role, store]);

  const markCompleted = useCallback(() => {
    if (!church || typeof window === 'undefined') return;
    try {
      localStorage.setItem(churchSetupStorageKey(church.id), 'true');
    } catch {
      // Storage can be unavailable in private/locked modes; the wizard still closes.
    }
    void markServerCompleted();
  }, [church, markServerCompleted]);

  const evaluateAutoOpen = useCallback(() => {
    if (
      !user ||
      !church ||
      !contentLoaded ||
      !setupFlagLoaded ||
      isOpen
    ) {
      return;
    }

    if (
      shouldOpenChurchSetup({
        ...setupData,
        role: user.role,
        setupCompleted: serverSetupCompleted || churchIsDismissed(),
        profileSetupCompleted: profileIsComplete(),
        contentLoaded,
        setupFlagLoaded,
      })
    ) {
      openAt('service');
    }
  }, [
    user,
    church,
    contentLoaded,
    setupFlagLoaded,
    serverSetupCompleted,
    isOpen,
    setupData,
    churchIsDismissed,
    profileIsComplete,
    openAt,
  ]);

  // Existing churches never auto-open. Persist the server flag once detected
  // (and backfill old localStorage-only skips) so new devices stay closed.
  useEffect(() => {
    if (
      !contentLoaded ||
      !setupFlagLoaded ||
      serverSetupCompleted ||
      user?.role !== 'admin'
    ) {
      return;
    }

    if (isChurchSetupComplete(setupData) || churchIsDismissed()) {
      markCompleted();
    }
  }, [
    contentLoaded,
    setupFlagLoaded,
    serverSetupCompleted,
    user?.role,
    setupData,
    churchIsDismissed,
    markCompleted,
  ]);

  // Dashboard CTAs / Setup guide open the wizard through this event.
  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<ChurchSetupOpenDetail>).detail || {};
      const target =
        detail.step && CHURCH_SETUP_STEPS.includes(detail.step)
          ? detail.step
          : 'service';

      // Never stack on top of the profile wizard or the post-profile tour.
      if (detail.deferForTour || tour.isActive || !profileIsComplete()) {
        pendingOpenRef.current = target;
        return;
      }

      openAt(target);
    };

    const handleProfileCompleted = (event: Event) => {
      const detail =
        (event as CustomEvent<ProfileSetupCompletedDetail>).detail || {};

      if (detail.deferForTour || tour.isActive) {
        if (!pendingOpenRef.current) pendingOpenRef.current = 'service';
        return;
      }

      const pending = pendingOpenRef.current;
      if (pending) {
        pendingOpenRef.current = null;
        openAt(pending);
        return;
      }

      evaluateAutoOpen();
    };

    window.addEventListener(CHURCH_SETUP_OPEN_EVENT, handleOpen);
    window.addEventListener(PROFILE_SETUP_COMPLETED_EVENT, handleProfileCompleted);
    return () => {
      window.removeEventListener(CHURCH_SETUP_OPEN_EVENT, handleOpen);
      window.removeEventListener(PROFILE_SETUP_COMPLETED_EVENT, handleProfileCompleted);
    };
  }, [tour.isActive, profileIsComplete, openAt, evaluateAutoOpen]);

  // Auto-open once data has loaded and any pending tour/profile step is done.
  useEffect(() => {
    if (isOpen || tour.isActive) return;

    const pending = pendingOpenRef.current;
    if (pending && profileIsComplete()) {
      pendingOpenRef.current = null;
      openAt(pending);
      return;
    }

    evaluateAutoOpen();
  }, [
    contentLoaded,
    setupFlagLoaded,
    isOpen,
    tour.isActive,
    profileIsComplete,
    openAt,
    evaluateAutoOpen,
  ]);

  const handleDismiss = useCallback(() => {
    markCompleted();
    pendingOpenRef.current = null;
    setIsOpen(false);
  }, [markCompleted]);

  const handleFinish = useCallback(
    (description?: string) => {
      markCompleted();
      pendingOpenRef.current = null;
      setIsOpen(false);
      toast({
        title: 'Setup saved',
        description,
        status: 'success',
        duration: 2500,
      });
    },
    [markCompleted, toast]
  );

  const sendTeamInvitation = useCallback(
    async (teamMemberId: string) => {
      if (!church) return;
      try {
        const response = await fetch(
          apiUrl('/api/notifications/send-team-invitation'),
          {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({ teamMemberId, churchId: church.id }),
          }
        );
        const result = await parseJsonSafe(response);

        if (!response.ok || result?.success === false) {
          toast({
            title: 'Invite email not sent',
            description:
              result?.error || 'You can send the invitation from the Team page.',
            status: 'warning',
            duration: 5000,
          });
        } else if (!result?.emailSent) {
          toast({
            title: 'Invite email not sent',
            description:
              result?.emailError ||
              'Email is not configured. Share the invite link from the Team page.',
            status: 'warning',
            duration: 5000,
          });
        }
      } catch {
        toast({
          title: 'Invite email not sent',
          description:
            'The member was added. You can send the invitation from the Team page.',
          status: 'warning',
          duration: 5000,
        });
      }
    },
    [church, toast]
  );

  const handleServiceNext = async () => {
    const parsed = validateChurchSetupService({
      title: serviceTitle,
      date: serviceDate,
      time: serviceTime,
    });

    if (!parsed.success) {
      toast({
        title: 'Check the service details',
        description: firstIssue(parsed),
        status: 'error',
        duration: 3000,
      });
      return;
    }
    if (!church) return;

    setSaving(true);
    try {
      await store.services.create({
        church_id: church.id,
        title: parsed.data.title,
        date: parsed.data.date,
        time: parsed.data.time,
        status: 'draft',
        notes: '',
      });
      setSetupData((prev) => ({ ...prev, hasService: true }));
      toast({ title: 'Service created', status: 'success', duration: 2000 });
      setStep('team');
    } catch (error) {
      console.error('[ChurchSetup] Failed to create service:', error);
      toast({
        title: 'Could not create service',
        description: 'Please try again.',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTeamNext = async () => {
    if (!church) return;

    const filledDrafts = teamDrafts.filter(
      (draft) => draft.name.trim() || draft.email.trim() || draft.role.trim()
    );

    if (filledDrafts.length === 0) {
      setStep('songs');
      return;
    }

    const validated: Array<{
      draft: TeamDraft;
      member: { name: string; email: string; role: string };
    }> = [];

    for (let index = 0; index < filledDrafts.length; index += 1) {
      const draft = filledDrafts[index];
      const parsed = validateChurchSetupTeamMember({
        name: draft.name,
        email: draft.email,
        role: draft.role,
      });

      if (!parsed.success) {
        toast({
          title: `Check member ${index + 1}`,
          description: firstIssue(parsed),
          status: 'error',
          duration: 3000,
        });
        return;
      }

      validated.push({ draft, member: parsed.data });
    }

    setSaving(true);
    const createdKeys: string[] = [];
    try {
      for (const { draft, member } of validated) {
        const created = await store.teamMembers.create({
          church_id: church.id,
          name: member.name,
          email: member.email,
          phone: '',
          roles: member.role ? [member.role] : [],
        });
        createdKeys.push(draft.key);
        await sendTeamInvitation(created.id);
      }

      setSetupData((prev) => ({
        ...prev,
        hasTeamMemberBeyondCreator: true,
      }));
      setTeamDrafts([newTeamDraft()]);
      setStep('songs');
      toast({
        title:
          validated.length === 1
            ? 'Team member invited'
            : 'Team members invited',
        description: 'They will receive an email invitation.',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('[ChurchSetup] Failed to invite team member:', error);
      setTeamDrafts((prev) =>
        prev.filter((draft) => !createdKeys.includes(draft.key))
      );
      toast({
        title: 'Could not add every team member',
        description: 'Please try again.',
        status: 'error',
        duration: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSongFinish = async () => {
    const parsed = validateChurchSetupSong({
      title: songTitle,
      artist: songArtist,
      key: songKey || undefined,
    });

    if (!parsed.success) {
      toast({
        title: 'Check the song details',
        description: firstIssue(parsed),
        status: 'error',
        duration: 3000,
      });
      return;
    }
    if (!church) return;

    setSaving(true);
    try {
      await store.songs.create({
        church_id: church.id,
        title: parsed.data.title,
        artist: parsed.data.artist || '',
        default_key: parsed.data.key || 'C',
        ccli_number: '',
        tags: [],
      });
      setSetupData((prev) => ({ ...prev, hasSong: true }));
      handleFinish('Your first song is in the library.');
    } catch (error) {
      console.error('[ChurchSetup] Failed to add song:', error);
      toast({
        title: 'Could not add song',
        description: 'Please try again.',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImportCsvSongs = () => {
    markCompleted();
    pendingOpenRef.current = null;
    setIsOpen(false);
    router.push('/songs?import=csv');
  };

  const handleImportChordProSongs = () => {
    markCompleted();
    pendingOpenRef.current = null;
    setIsOpen(false);
    router.push('/songs?import=chordpro');
  };

  const handleSkipStep = () => {
    if (step === 'service') {
      setStep('team');
      return;
    }
    if (step === 'team') {
      setStep('songs');
      return;
    }
    handleFinish('You can add songs from the Song Library anytime.');
  };

  const handlePrimaryAction = () => {
    if (step === 'service') {
      void handleServiceNext();
      return;
    }
    if (step === 'team') {
      void handleTeamNext();
      return;
    }
    void handleSongFinish();
  };

  const updateDraft = (key: string, field: keyof Omit<TeamDraft, 'key'>, value: string) => {
    setTeamDrafts((prev) =>
      prev.map((draft) =>
        draft.key === key ? { ...draft, [field]: value } : draft
      )
    );
  };

  if (!user || !church) return null;

  const meta = STEP_META[step];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleDismiss}
      closeOnOverlayClick
      size="md"
      isCentered
      scrollBehavior="inside"
    >
      <ModalOverlay backdropBlur="sm" />
      <ModalContent borderRadius="2xl" mx="4">
        <ModalHeader fontWeight="700">
          <HStack spacing="2" align="flex-start">
            <Box flex="1">
              <Text>{meta.title}</Text>
              <Text fontSize="sm" fontWeight="400" color="gray.500" mt="1">
                Step {stepIndex + 1} of {CHURCH_SETUP_STEPS.length}
              </Text>
            </Box>
            <Button
              variant="ghost"
              size="xs"
              color="gray.400"
              onClick={handleDismiss}
              minH="36px"
            >
              Skip setup
            </Button>
            <IconButton
              aria-label="Close setup"
              icon={<X size={16} />}
              variant="ghost"
              size="xs"
              color="gray.400"
              onClick={handleDismiss}
              minH="36px"
            />
          </HStack>
        </ModalHeader>

        <ModalBody>
          <Text fontSize="sm" color="gray.500" mb="4">
            {meta.description}
          </Text>

          {step === 'service' && (
            <VStack spacing="4" align="stretch">
              {setupData.hasService && (
                <Text fontSize="xs" color="teal.600" bg="teal.50" p="2" borderRadius="md">
                  You already have a service in this church. Creating another one is optional.
                </Text>
              )}
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Service title</FormLabel>
                <Input
                  value={serviceTitle}
                  onChange={(event) => setServiceTitle(event.target.value)}
                  placeholder="e.g. Sunday 9AM Worship"
                  borderRadius="lg"
                  autoFocus
                />
              </FormControl>
              <HStack spacing="3" align="flex-start">
                <FormControl isRequired>
                  <FormLabel fontWeight="600" fontSize="sm">Date</FormLabel>
                  <Input
                    type="date"
                    value={serviceDate}
                    onChange={(event) => setServiceDate(event.target.value)}
                    borderRadius="lg"
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontWeight="600" fontSize="sm">Time</FormLabel>
                  <Input
                    type="time"
                    value={serviceTime}
                    onChange={(event) => setServiceTime(event.target.value)}
                    borderRadius="lg"
                  />
                </FormControl>
              </HStack>
            </VStack>
          )}

          {step === 'team' && (
            <VStack spacing="3" align="stretch">
              {teamDrafts.map((draft, index) => (
                <Box
                  key={draft.key}
                  border="1px solid"
                  borderColor="gray.200"
                  borderRadius="lg"
                  p="3"
                >
                  <HStack justify="space-between" mb="2">
                    <Text fontSize="sm" fontWeight="600" color="gray.700">
                      Member {index + 1}
                    </Text>
                    {teamDrafts.length > 1 && (
                      <IconButton
                        aria-label={`Remove member ${index + 1}`}
                        icon={<Trash2 size={14} />}
                        size="xs"
                        variant="ghost"
                        color="gray.400"
                        onClick={() =>
                          setTeamDrafts((prev) =>
                            prev.filter((item) => item.key !== draft.key)
                          )
                        }
                      />
                    )}
                  </HStack>
                  <VStack spacing="3">
                    <FormControl isRequired>
                      <FormLabel fontWeight="600" fontSize="sm">Name</FormLabel>
                      <Input
                        value={draft.name}
                        onChange={(event) =>
                          updateDraft(draft.key, 'name', event.target.value)
                        }
                        placeholder="Full name"
                        borderRadius="lg"
                        autoFocus={index === 0}
                      />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel fontWeight="600" fontSize="sm">Email</FormLabel>
                      <Input
                        type="email"
                        value={draft.email}
                        onChange={(event) =>
                          updateDraft(draft.key, 'email', event.target.value)
                        }
                        placeholder="name@example.com"
                        borderRadius="lg"
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontWeight="600" fontSize="sm">Role</FormLabel>
                      <Input
                        value={draft.role}
                        onChange={(event) =>
                          updateDraft(draft.key, 'role', event.target.value)
                        }
                        placeholder="e.g. Vocalist, Guitar, Sound"
                        borderRadius="lg"
                      />
                    </FormControl>
                  </VStack>
                </Box>
              ))}
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => setTeamDrafts((prev) => [...prev, newTeamDraft()])}
              >
                Add another member
              </Button>
            </VStack>
          )}

          {step === 'songs' && (
            <VStack spacing="4" align="stretch">
              <FormControl isRequired>
                <FormLabel fontWeight="600" fontSize="sm">Song title</FormLabel>
                <Input
                  value={songTitle}
                  onChange={(event) => setSongTitle(event.target.value)}
                  placeholder="e.g. Amazing Grace"
                  borderRadius="lg"
                  autoFocus
                />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Artist</FormLabel>
                <Input
                  value={songArtist}
                  onChange={(event) => setSongArtist(event.target.value)}
                  placeholder="Optional"
                  borderRadius="lg"
                />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="600" fontSize="sm">Key</FormLabel>
                <Input
                  value={songKey}
                  onChange={(event) => setSongKey(event.target.value.toUpperCase())}
                  placeholder="e.g. G"
                  maxLength={2}
                  borderRadius="lg"
                />
              </FormControl>
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportCsvSongs}
                fontWeight="600"
              >
                Import songs from a CSV file
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleImportChordProSongs}
              >
                Import a ChordPro file instead
              </Button>
            </VStack>
          )}

          <HStack justify="center" spacing="2" mt="6">
            {CHURCH_SETUP_STEPS.map((item, index) => (
              <Box
                key={item}
                w="8px"
                h="8px"
                borderRadius="full"
                bg={index === stepIndex ? 'teal.500' : 'gray.200'}
                transition="all 0.2s"
              />
            ))}
          </HStack>
        </ModalBody>

        <ModalFooter gap="2" flexWrap="wrap">
          <Button
            variant="ghost"
            onClick={handleSkipStep}
            size="sm"
            minH="44px"
            isDisabled={saving}
          >
            {step === 'songs' ? 'Skip & finish' : 'Skip this step'}
          </Button>
          <Button
            colorScheme="teal"
            onClick={handlePrimaryAction}
            isLoading={saving}
            fontWeight="600"
            minH="44px"
          >
            {step === 'service'
              ? 'Save & continue'
              : step === 'team'
                ? 'Send invites & continue'
                : 'Add song & finish'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
