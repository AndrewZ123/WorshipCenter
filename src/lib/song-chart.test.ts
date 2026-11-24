import { describe, expect, it } from 'vitest';
import type { SongFile } from './types';
import {
  CHORD_PRO_MAX_LENGTH,
  buildChordProFileInput,
  chordChartFileName,
  decodeTextFileDataUrl,
  findChordProFile,
  isChordProFileName,
  isChordProWithinLimit,
  normalizeChordProText,
  resolveChartViewerKey,
} from './song-chart';
import { transposeChordPro } from './transpose';

describe('song chart helpers', () => {
  it('normalizes Windows line endings', () => {
    expect(normalizeChordProText('a\r\nb\rc\n')).toBe('a\nb\nc\n');
  });

  it('enforces the 50k character limit', () => {
    expect(isChordProWithinLimit('x'.repeat(CHORD_PRO_MAX_LENGTH))).toBe(true);
    expect(isChordProWithinLimit('x'.repeat(CHORD_PRO_MAX_LENGTH + 1))).toBe(false);
  });

  it('builds a safe chord chart file name', () => {
    expect(chordChartFileName('Amazing Grace!')).toBe('amazing-grace.chordpro');
    expect(chordChartFileName('   ')).toBe('chord-chart.chordpro');
  });

  it('stores a pasted chart as a song_files text chart', () => {
    const input = buildChordProFileInput({
      songId: 'song-1',
      title: 'Amazing Grace',
      chart: '{title: Amazing Grace}\r\n[G]Amazing [C]grace\r\n',
      uploadedBy: 'user-1',
    });

    expect(input).toMatchObject({
      song_id: 'song-1',
      file_name: 'amazing-grace.chordpro',
      type: 'chord_chart',
      mime_type: 'text/plain',
      arrangement_id: null,
      version_id: null,
      is_primary: false,
      uploaded_by: 'user-1',
    });
    expect(input.file_url.startsWith('data:text/plain;base64,')).toBe(true);
    expect(decodeTextFileDataUrl(input.file_url)).toBe(
      '{title: Amazing Grace}\n[G]Amazing [C]grace\n',
    );
  });

  it('finds ChordPro files including legacy .pro uploads', () => {
    const files = [
      { id: '1', file_name: 'chart.pdf' },
      { id: '2', file_name: 'song.cho' },
      { id: '3', file_name: 'other.pro' },
    ] as SongFile[];

    expect(findChordProFile(files)?.id).toBe('2');
  });

  it('recognizes .crd and .chordpro attachments for the viewer', () => {
    expect(isChordProFileName('song.crd')).toBe(true);
    expect(isChordProFileName('SONG.CHORDPRO')).toBe(true);
    expect(isChordProFileName('chart.pdf')).toBe(false);
  });
});

describe('chart viewer key', () => {
  const chart = '[G]Amazing [C]grace [G]sweet [D]sound';

  it('opens at the default key with no transpose', () => {
    const viewer = resolveChartViewerKey({ chartText: chart, defaultKey: 'G' });

    expect(viewer).toEqual({ sourceKey: 'G', semitones: 0 });
    expect(transposeChordPro(chart, viewer.semitones)).toBe(chart);
  });

  it('prefers the chart key directive over the song default key', () => {
    const viewer = resolveChartViewerKey({
      chartText: `{key: Bb}\n${chart}`,
      defaultKey: 'G',
    });

    expect(viewer).toEqual({ sourceKey: 'Bb', semitones: 0 });
  });

  it('opens transposed when a service key is passed in', () => {
    const viewer = resolveChartViewerKey({
      chartText: chart,
      defaultKey: 'G',
      serviceKey: 'A',
    });

    expect(viewer).toEqual({ sourceKey: 'G', semitones: 2 });
    expect(transposeChordPro(chart, viewer.semitones, 'A')).toBe(
      '[A]Amazing [D]grace [A]sweet [E]sound',
    );
  });

  it('starts at zero every time a song is reopened', () => {
    // There is deliberately no stored transpose to restore: the same input
    // always yields the same opening offset.
    expect(resolveChartViewerKey({ chartText: chart, defaultKey: 'G' }).semitones).toBe(0);
    expect(resolveChartViewerKey({ chartText: chart, defaultKey: 'G' }).semitones).toBe(0);
  });

  it('handles flat keys and enharmonic service keys', () => {
    expect(
      resolveChartViewerKey({ chartText: '{key: Gb}', defaultKey: 'G', serviceKey: 'F#' }),
    ).toEqual({ sourceKey: 'Gb', semitones: 0 });
    expect(
      resolveChartViewerKey({ chartText: '{key: Bb}', defaultKey: 'G', serviceKey: 'Db' }),
    ).toEqual({ sourceKey: 'Bb', semitones: 3 });
  });
});
