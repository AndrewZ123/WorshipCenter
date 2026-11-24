/**
 * ChordPro chart storage helpers.
 *
 * Charts typed or pasted in the song editor are stored exactly where uploaded
 * ChordPro files already live: a song_files row whose file_url is a text data
 * URL. The song detail viewer decodes that URL, so transpose/capo controls work
 * the same for pasted and uploaded charts.
 */

import type { SongFile } from './types';
import type { ChordChartPdfSong } from './chord-chart-pdf';
import { parseChordPro } from './chordpro';
import {
  capoSuggestions,
  parseKey,
  semitonesBetween,
  transposeChordPro,
} from './transpose';
import { formatKey } from './formatKey';

export const CHORD_PRO_MAX_LENGTH = 50_000;

export interface ChartViewerKey {
  /** The chart's own key: `{key}` directive, else the song's default key. */
  sourceKey: string;
  /** Key this context displays: the service item key when set, else the source key. */
  displayKey: string;
  /** Semitones from the source key to an explicit service key (0 otherwise). */
  semitones: number;
  /** Capo hint, only when a service key actually transposes the chart. */
  capoLabel?: string;
}

export interface ChartView extends ChartViewerKey {
  /** ChordPro text already transposed for this context. */
  chart: string;
}

/** Format a capo suggestion for the PDF and stage chart headers. */
export function formatChartCapoLabel(displayKey: string): string | undefined {
  const capo = capoSuggestions(displayKey)[0];
  if (!capo) return undefined;

  return capo.capo === 0
    ? `No capo - ${formatKey(capo.shapeKey)} shapes`
    : `Capo ${capo.capo} - play ${formatKey(capo.shapeKey)} shapes`;
}

/**
 * One source of truth for chart keys.
 *
 * The display key is the service item key when the chart is opened from a
 * service, otherwise the chart's own key. A capo hint only makes sense when
 * the service key actually changes the chart; untransposed charts never carry
 * one. Nothing here reads browser storage: an ad-hoc viewer transpose is
 * display-only and must not leak into PDFs, the stage display or other views.
 */
export function resolveChartViewerKey(params: {
  chartText?: string | null;
  defaultKey?: string | null;
  serviceKey?: string | null;
}): ChartViewerKey {
  const chartKey = params.chartText ? parseChordPro(params.chartText).meta.key.trim() : '';
  const sourceKey = parseKey(chartKey)
    ? chartKey
    : parseKey(params.defaultKey || '')
      ? (params.defaultKey || '').trim()
      : '';

  const serviceKey = formatKey(params.serviceKey || '');
  const hasServiceKey = Boolean(serviceKey) && Boolean(parseKey(serviceKey));

  if (!sourceKey) {
    return {
      sourceKey: '',
      displayKey: hasServiceKey ? serviceKey : '',
      semitones: 0,
      capoLabel: undefined,
    };
  }

  const displayKey = hasServiceKey ? serviceKey : sourceKey;
  const semitones = hasServiceKey ? semitonesBetween(sourceKey, displayKey) : 0;

  return {
    sourceKey,
    displayKey,
    semitones,
    capoLabel: semitones === 0 ? undefined : formatChartCapoLabel(displayKey),
  };
}

/**
 * Resolve the key and chord text for a chart in a given context. Both chart
 * PDFs and the stage display go through this so they always agree.
 */
export function buildChartView(params: {
  chartText?: string | null;
  defaultKey?: string | null;
  serviceKey?: string | null;
}): ChartView {
  const key = resolveChartViewerKey(params);
  const raw = params.chartText || '';
  const chart = key.semitones === 0
    ? raw
    : transposeChordPro(raw, key.semitones, key.displayKey || undefined);

  return { ...key, chart };
}

/** Build one printable chart, with no browser-local transpose involved. */
export function buildChartPdfSong(params: {
  title: string;
  artist?: string | null;
  ccli?: string | null;
  chartText?: string | null;
  defaultKey?: string | null;
  serviceKey?: string | null;
}): ChordChartPdfSong | null {
  if (!(params.chartText || '').trim()) return null;

  const view = buildChartView(params);

  return {
    title: params.title,
    artist: params.artist || undefined,
    key: view.displayKey || undefined,
    originalKey: view.semitones === 0 ? undefined : (view.sourceKey || undefined),
    capo: view.capoLabel,
    ccli: params.ccli || undefined,
    chart: view.chart,
  };
}

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
