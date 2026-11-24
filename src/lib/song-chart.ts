/**
 * ChordPro chart storage helpers.
 *
 * Charts typed or pasted in the song editor are stored exactly where uploaded
 * ChordPro files already live: a song_files row whose file_url is a text data
 * URL. The song detail viewer decodes that URL, so transpose/capo controls work
 * the same for pasted and uploaded charts.
 */

import type { SongFile } from './types';

export const CHORD_PRO_MAX_LENGTH = 50_000;

export function normalizeChordProText(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

export function isChordProWithinLimit(text: string): boolean {
  return text.length <= CHORD_PRO_MAX_LENGTH;
}

export function chordChartFileName(title: string): string {
  const base = (title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${base || 'chord-chart'}.chordpro`;
}

/** Encode text as the same data-URL shape FileReader produces for uploads. */
export function encodeTextFileDataUrl(text: string): string {
  const bytes = new TextEncoder().encode(normalizeChordProText(text));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:text/plain;base64,${btoa(binary)}`;
}

export function decodeTextFileDataUrl(dataUrl: string): string {
  try {
    const base64 = dataUrl.split(',')[1] || '';
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

/** True for the text-based ChordPro formats the viewer can render. */
export function isChordProFileName(fileName: string): boolean {
  return /\.(cho|chordpro|chopro|crd|pro)$/i.test(fileName);
}

/** First file in a song's list that can be shown in the ChordPro viewer. */
export function findChordProFile(files: SongFile[]): SongFile | undefined {
  return files.find((file) => isChordProFileName(file.file_name));
}

export function buildChordProFileInput(params: {
  songId: string;
  title: string;
  chart: string;
  uploadedBy?: string | null;
}): Omit<SongFile, 'id' | 'created_at'> {
  const chart = normalizeChordProText(params.chart);

  return {
    song_id: params.songId,
    file_url: encodeTextFileDataUrl(chart),
    file_name: chordChartFileName(params.title),
    type: 'chord_chart',
    file_size: new TextEncoder().encode(chart).length,
    mime_type: 'text/plain',
    arrangement_id: null,
    version_id: null,
    is_primary: false,
    uploaded_by: params.uploadedBy || null,
  };
}
