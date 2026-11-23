'use client';

import React, { useCallback, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { AlertCircle, Download, FileSpreadsheet } from 'lucide-react';
import { apiUrl, getAuthHeaders, parseJsonSafe } from '@/lib/api-base';
import {
  SONG_CSV_MAX_BYTES,
  SONG_CSV_MAX_ROWS,
  SONG_CSV_TEMPLATE,
  SONG_CSV_TEMPLATE_FILENAME,
  type SongCsvRowError,
  type SongImportPreviewRow,
} from '@/lib/songs/csvImport';

interface PreviewSummary {
  totalRows: number;
  newCount: number;
  duplicateCount: number;
  invalidCount: number;
}

interface PreviewResponse {
  summary: PreviewSummary;
  rows: SongImportPreviewRow[];
  errors: SongCsvRowError[];
}

interface ImportSummary {
  added: number;
  updated: number;
  skipped: number;
  failed: number;
  totalRows: number;
  invalidCount: number;
}

interface ImportResponse {
  summary: ImportSummary;
  errors: SongCsvRowError[];
}

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void | Promise<void>;
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsText(file);
  });
}

export default function CsvImportModal({
  isOpen,
  onClose,
  onImported,
}: CsvImportModalProps) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const mutedText = useColorModeValue('gray.500', 'gray.400');
  const subtleBg = useColorModeValue('gray.50', 'gray.700');
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  const rowHoverBg = useColorModeValue('gray.50', 'gray.700');

  const reset = useCallback(() => {
    setFile(null);
    setCsvText('');
    setPreview(null);
    setPreviewing(false);
    setImporting(false);
    setUpdateExisting(false);
    setError(null);
  }, []);

  const close = () => {
    reset();
    onClose();
  };

  const requestPreview = useCallback(async (text: string) => {
    setPreviewing(true);
    setError(null);
    try {
      const response = await fetch(apiUrl('/api/songs/import/csv'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ csv: text, mode: 'preview' }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(data?.error || 'Could not preview this CSV file.');
      }
      setPreview(data as PreviewResponse);
    } catch (err) {
      setPreview(null);
      setError(
        err instanceof Error ? err.message : 'Could not preview this CSV file.'
      );
    } finally {
      setPreviewing(false);
    }
  }, []);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selected = event.target.files?.[0];
    // Allow selecting the same file again after a failed preview.
    event.target.value = '';
    if (!selected) return;

    setFile(selected);
    setPreview(null);
    setError(null);

    if (selected.size > SONG_CSV_MAX_BYTES) {
      setCsvText('');
      setError(
        `That file is too large. Choose a CSV under ${
          SONG_CSV_MAX_BYTES / (1024 * 1024)
        } MB.`
      );
      return;
    }

    try {
      const text = await readFileText(selected);
      setCsvText(text);
      await requestPreview(text);
    } catch {
      setCsvText('');
      setError('Could not read that file. Please choose a CSV file.');
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([SONG_CSV_TEMPLATE], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = SONG_CSV_TEMPLATE_FILENAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const updatableDuplicates =
    preview?.rows.filter(
      (row) => row.status === 'duplicate' && row.matchSource === 'library'
    ).length ?? 0;

  const canImport = Boolean(
    csvText &&
      preview &&
      (preview.summary.newCount > 0 ||
        (updateExisting && updatableDuplicates > 0))
  );

  const handleImport = async () => {
    if (!csvText || !preview) return;
    setImporting(true);
    try {
      const response = await fetch(apiUrl('/api/songs/import/csv'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          csv: csvText,
          mode: 'import',
          updateExisting,
        }),
      });
      const data = (await parseJsonSafe(response)) as ImportResponse & {
        error?: string;
      };
      if (!response.ok || !data?.summary) {
        throw new Error(data?.error || 'Could not import songs.');
      }

      const summary = data.summary;
      const parts = [`${summary.added} added`];
      if (summary.updated > 0) parts.push(`${summary.updated} updated`);
      parts.push(`${summary.skipped} skipped`, `${summary.failed} failed`);

      toast({
        title: 'Song import complete',
        description: parts.join(', '),
        status: summary.failed > 0 ? 'warning' : 'success',
        duration: 5000,
      });

      await onImported();
      close();
    } catch (err) {
      toast({
        title: 'Import failed',
        description:
          err instanceof Error ? err.message : 'Could not import songs.',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setImporting(false);
    }
  };

  const importLabel = updateExisting && preview && preview.summary.newCount === 0
    ? `Update ${updatableDuplicates} existing song${updatableDuplicates === 1 ? '' : 's'}`
    : `Import ${preview?.summary.newCount ?? 0} new song${
        preview?.summary.newCount === 1 ? '' : 's'
      }`;

  return (
    <Modal isOpen={isOpen} onClose={close} isCentered size="4xl" scrollBehavior="inside">
      <ModalOverlay backdropBlur="sm" />
      <ModalContent borderRadius="2xl" mx="4">
        <ModalHeader fontWeight="700">Import songs from CSV</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb="6">
          <VStack spacing="4" align="stretch">
            <Text fontSize="sm" color={mutedText}>
              Upload a Planning Center Songs CSV export or a simple WorshipCenter
              CSV with title, artist, default key, CCLI number, and tags. Nothing
              is saved until you confirm the preview.
            </Text>

            <HStack justify="space-between" align="center" flexWrap="wrap" gap="2">
              <Text fontSize="xs" color={mutedText}>
                Up to {(SONG_CSV_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB and{' '}
                {SONG_CSV_MAX_ROWS.toLocaleString()} songs per file.
              </Text>
              <Button
                size="xs"
                variant="ghost"
                colorScheme="teal"
                leftIcon={<Download size={14} />}
                onClick={downloadTemplate}
              >
                Download example CSV
              </Button>
            </HStack>

            <Button
              as="label"
              htmlFor="song-csv-upload"
              variant="outline"
              w="full"
              h="110px"
              border="2px dashed"
              borderColor={preview ? 'teal.300' : borderColor}
              borderRadius="xl"
              cursor="pointer"
              display="flex"
              flexDirection="column"
              gap="2"
              _hover={{ borderColor: 'teal.400', bg: subtleBg }}
            >
              {previewing ? (
                <Spinner size="sm" color="teal.500" />
              ) : (
                <FileSpreadsheet
                  size={24}
                  color={preview ? 'var(--chakra-colors-teal-500)' : 'var(--chakra-colors-gray-400)'}
                />
              )}
              <Text fontSize="sm" color={preview ? 'teal.600' : mutedText}>
                {previewing
                  ? 'Checking rows against your song library...'
                  : file
                    ? file.name
                    : 'Click to select a CSV file'}
              </Text>
              <input
                id="song-csv-upload"
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </Button>

            {error && (
              <Alert status="error" borderRadius="lg">
                <AlertIcon />
                <AlertDescription fontSize="sm">{error}</AlertDescription>
              </Alert>
            )}

            {preview && (
              <>
                <HStack spacing="2" flexWrap="wrap">
                  <Badge colorScheme="gray" borderRadius="full" px="2.5" py="1">
                    {preview.summary.totalRows} row
                    {preview.summary.totalRows === 1 ? '' : 's'}
                  </Badge>
                  <Badge colorScheme="green" borderRadius="full" px="2.5" py="1">
                    {preview.summary.newCount} new
                  </Badge>
                  <Badge colorScheme="orange" borderRadius="full" px="2.5" py="1">
                    {preview.summary.duplicateCount} duplicate
                    {preview.summary.duplicateCount === 1 ? '' : 's'}
                  </Badge>
                  {preview.summary.invalidCount > 0 && (
                    <Badge colorScheme="red" borderRadius="full" px="2.5" py="1">
                      {preview.summary.invalidCount} invalid
                    </Badge>
                  )}
                </HStack>

                <Checkbox
                  isChecked={updateExisting}
                  onChange={(event) => setUpdateExisting(event.target.checked)}
                  size="sm"
                >
                  Update existing duplicates (key, CCLI, and tags only)
                </Checkbox>

                <Box
                  border="1px solid"
                  borderColor={borderColor}
                  borderRadius="lg"
                  overflow="hidden"
                >
                  <Box maxH="320px" overflowY="auto">
                    <Table size="sm" variant="simple">
                      <Thead bg={headerBg} position="sticky" top="0" zIndex="1">
                        <Tr>
                          <Th>Song</Th>
                          <Th>Artist</Th>
                          <Th>Key</Th>
                          <Th>CCLI</Th>
                          <Th>Tags</Th>
                          <Th>Status</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {preview.rows.map((row) => (
                          <Tr key={row.rowNumber} _hover={{ bg: rowHoverBg }}>
                            <Td fontSize="sm" fontWeight="500" maxW="200px">
                              {row.title}
                            </Td>
                            <Td fontSize="sm" color={mutedText}>
                              {row.artist || '—'}
                            </Td>
                            <Td fontSize="sm">{row.defaultKey || '—'}</Td>
                            <Td fontSize="sm">{row.ccliNumber || '—'}</Td>
                            <Td fontSize="sm" color={mutedText} maxW="200px">
                              {row.tags.length > 0 ? row.tags.join(', ') : '—'}
                            </Td>
                            <Td>
                              {row.status === 'new' ? (
                                <Badge colorScheme="green" borderRadius="full" px="2">
                                  New
                                </Badge>
                              ) : (
                                <HStack spacing="1.5">
                                  <Badge
                                    colorScheme="orange"
                                    borderRadius="full"
                                    px="2"
                                  >
                                    Duplicate
                                  </Badge>
                                  <Text fontSize="xs" color={mutedText}>
                                    {row.matchSource === 'file'
                                      ? 'earlier row'
                                      : row.matchedTitle || 'existing song'}
                                  </Text>
                                </HStack>
                              )}
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                </Box>

                {preview.errors.length > 0 && (
                  <Box
                    p="3"
                    bg={subtleBg}
                    borderRadius="lg"
                    maxH="140px"
                    overflowY="auto"
                  >
                    <HStack spacing="2" mb="1">
                      <AlertCircle size={14} color="var(--chakra-colors-red-500)" />
                      <Text fontSize="sm" fontWeight="600">
                        Rows that will be skipped
                      </Text>
                    </HStack>
                    <VStack align="stretch" spacing="1">
                      {preview.errors.map((rowError) => (
                        <Text
                          key={`${rowError.rowNumber}-${rowError.message}`}
                          fontSize="xs"
                          color={mutedText}
                        >
                          Row {rowError.rowNumber}: {rowError.message}
                        </Text>
                      ))}
                    </VStack>
                  </Box>
                )}
              </>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter gap="2">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            colorScheme="teal"
            onClick={handleImport}
            isDisabled={!canImport}
            isLoading={importing}
            fontWeight="600"
          >
            {importLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
