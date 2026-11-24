import { describe, expect, it } from 'vitest';
import type { SongFile } from './types';
import {
  CHORD_PRO_MAX_LENGTH,
  buildChartPdfSong,
  buildChordProFileInput,
  chordChartFileName,
  decodeTextFileDataUrl,
  findChordProFile,
  isChordProFileName,
  isChordProWithinLimit,
  normalizeChordProText,
  resolveChartViewerKey,
} from './song-chart';
import { TRANSPOSE_STORAGE_PREFIX, transposeChordPro } from './transpose';

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

  it('opens at the source key with no transpose and no capo', () => {
    const viewer = resolveChartViewerKey({ chartText: chart, defaultKey: 'G' });

    expect(viewer).toEqual({
      sourceKey: 'G',
      displayKey: 'G',
      semitones: 0,
      capoLabel: undefined,
    });
    expect(transposeChordPro(chart, viewer.semitones)).toBe(chart);
  });

  it('prefers the chart key directive over the song default key', () => {
    const viewer = resolveChartViewerKey({
      chartText: `{key: Bb}\n${chart}`,
      defaultKey: 'G',
    });

    expect(viewer).toMatchObject({
      sourceKey: 'Bb',
      displayKey: 'Bb',
      semitones: 0,
    });
    expect(viewer.capoLabel).toBeUndefined();
  });

  it('opens transposed when a service key is passed in', () => {
    const viewer = resolveChartViewerKey({
      chartText: chart,
      defaultKey: 'G',
      serviceKey: 'A',
    });

    expect(viewer).toMatchObject({
      sourceKey: 'G',
      displayKey: 'A',
      semitones: 2,
    });
    expect(viewer.capoLabel).toBeDefined();
    expect(transposeChordPro(chart, viewer.semitones, viewer.displayKey)).toBe(
      '[A]Amazing [D]grace [A]sweet [E]sound',
    );
  });

  it('starts at zero every time a song is reopened', () => {
    // There is deliberately no stored transpose to restore: the same input
    // always yields the same opening offset.
    expect(resolveChartViewerKey({ chartText: chart, defaultKey: 'G' }).semitones).toBe(0);
    expect(resolveChartViewerKey({ chartText: chart, defaultKey: 'G' }).semitones).toBe(0);
  });

  it('formats flat service keys as Ab, never AB', () => {
    const viewer = resolveChartViewerKey({
      chartText: chart,
      defaultKey: 'G',
      serviceKey: 'AB',
    });

    expect(viewer.displayKey).toBe('Ab');
    expect(viewer.semitones).toBe(1);
    expect(viewer.capoLabel).toBe('Capo 1 - play G shapes');
  });

  it('handles enharmonic service keys without a capo', () => {
    expect(
      resolveChartViewerKey({ chartText: '{key: Gb}', defaultKey: 'G', serviceKey: 'F#' }),
    ).toMatchObject({ sourceKey: 'Gb', displayKey: 'F#', semitones: 0 });
    expect(
      resolveChartViewerKey({ chartText: '{key: Bb}', defaultKey: 'G', serviceKey: 'Db' }),
    ).toMatchObject({ sourceKey: 'Bb', displayKey: 'Db', semitones: 3 });
  });

  it('derives the stage display key from the same helper', () => {
    // The stage loader passes the service item key through this helper.
    const stage = resolveChartViewerKey({
      chartText: chart,
      defaultKey: 'G',
      serviceKey: 'G',
    });

    expect(stage).toMatchObject({
      sourceKey: 'G',
      displayKey: 'G',
      semitones: 0,
    });
    expect(stage.capoLabel).toBeUndefined();
  });
});

describe('chart PDF input', () => {
  const testSongChart = [
    '{title: Test Song One}',
    '{key: G}',
    '[G]Test [C]song [G]one [D]two',
  ].join('\n');

  it('keeps Test Song One at G, chords unchanged and no capo despite stale storage', () => {
    const globalWithStorage = globalThis as { localStorage?: unknown };
    const previousStorage = globalWithStorage.localStorage;
    globalWithStorage.localStorage = {
      getItem: (key: string) =>
        key === `${TRANSPOSE_STORAGE_PREFIX}test-song-one` ? '1' : null,
    };

    try {
      const pdfSong = buildChartPdfSong({
        title: 'Test Song One',
        chartText: testSongChart,
        defaultKey: 'G',
        serviceKey: 'G',
      });

      expect(pdfSong).toMatchObject({
        title: 'Test Song One',
        key: 'G',
        chart: testSongChart,
      });
      expect(pdfSong?.originalKey).toBeUndefined();
      expect(pdfSong?.capo).toBeUndefined();
      expect(pdfSong?.chart).toContain('[G]Test [C]song [G]one [D]two');
    } finally {
      if (previousStorage === undefined) delete globalWithStorage.localStorage;
      else globalWithStorage.localStorage = previousStorage;
    }
  });

  it('exports a song page chart at its source key when no service key is given', () => {
    const pdfSong = buildChartPdfSong({
      title: 'Test Song One',
      chartText: testSongChart,
      defaultKey: 'G',
    });

    expect(pdfSong?.key).toBe('G');
    expect(pdfSong?.originalKey).toBeUndefined();
    expect(pdfSong?.capo).toBeUndefined();
    expect(pdfSong?.chart).toBe(testSongChart);
  });

  it('transposes and labels only when the service key differs from the source', () => {
    const pdfSong = buildChartPdfSong({
      title: 'Test Song One',
      chartText: testSongChart,
      defaultKey: 'G',
      serviceKey: 'A',
    });

    expect(pdfSong?.key).toBe('A');
    expect(pdfSong?.originalKey).toBe('G');
    expect(pdfSong?.capo).toBeDefined();
    expect(pdfSong?.chart).toContain('[A]Test [D]song [A]one [E]two');
  });
});
