'use client';

import { useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, Button, FormControl, FormLabel, Input,
  VStack, HStack, IconButton, Switch, useToast, Text, Box,
} from '@chakra-ui/react';
import { Plus, Trash2 } from 'lucide-react';

interface PollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (question: string, options: string[], isMultipleChoice: boolean) => Promise<void>;
}

export default function PollModal({ isOpen, onClose, onCreate }: PollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isMultipleChoice, setIsMultipleChoice] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreate = async () => {
    if (!question.trim()) {
      toast({ title: 'Question is required', status: 'error', duration: 2000 });
      return;
    }
    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      toast({ title: 'At least 2 options are required', status: 'error', duration: 2000 });
      return;
    }

    setLoading(true);
    try {
      await onCreate(question.trim(), validOptions, isMultipleChoice);
      setQuestion('');
      setOptions(['', '']);
      setIsMultipleChoice(false);
      onClose();
    } catch (error) {
      toast({ title: 'Failed to create poll', status: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay backdropBlur="sm" />
      <ModalContent borderRadius="2xl" mx="4">
        <ModalHeader fontWeight="700">Create Poll</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing="4" align="stretch">
            <FormControl isRequired>
              <FormLabel fontWeight="600" fontSize="sm">Question</FormLabel>
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What would you like to ask?"
                borderRadius="lg"
              />
            </FormControl>

            <FormControl>
              <FormLabel fontWeight="600" fontSize="sm">Options</FormLabel>
              <VStack spacing="2">
                {options.map((option, i) => (
                  <HStack key={i} w="full" spacing="2">
                    <Box
                      w="6"
                      h="6"
                      borderRadius="full"
                      border="2px solid"
                      borderColor="gray.300"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      fontSize="xs"
                      fontWeight="600"
                      color="gray.500"
                      flexShrink={0}
                    >
                      {String.fromCharCode(65 + i)}
                    </Box>
                    <Input
                      value={option}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      size="sm"
                      borderRadius="lg"
                    />
                    {options.length > 2 && (
                      <IconButton
                        aria-label="Remove option"
                        icon={<Trash2 size={14} />}
                        size="xs"
                        variant="ghost"
                        color="red.400"
                        onClick={() => removeOption(i)}
                      />
                    )}
                  </HStack>
                ))}
              </VStack>
              <Button
                size="xs"
                variant="ghost"
                leftIcon={<Plus size={14} />}
                mt="2"
                onClick={addOption}
                color="teal.500"
              >
                Add Option
              </Button>
            </FormControl>

            <HStack justify="space-between">
              <Text fontSize="sm" color="gray.600">Allow multiple choices</Text>
              <Switch
                isChecked={isMultipleChoice}
                onChange={(e) => setIsMultipleChoice(e.target.checked)}
                colorScheme="teal"
                size="sm"
              />
            </HStack>
          </VStack>
        </ModalBody>
        <ModalFooter gap="2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button colorScheme="teal" onClick={handleCreate} isLoading={loading} fontWeight="600">
            Create Poll
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
