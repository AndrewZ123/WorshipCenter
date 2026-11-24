import { describe, expect, it } from 'vitest';
import {
  asciiSafePdfText,
  buildChordChartPDF,
  chordChartPdfFileName,
  type ChordChartPdfDoc,
} from './chord-chart-pdf';

interface RecordedCall {
  method: string;
  args: unknown[];
}

function createRecordingDoc(): { doc: ChordChartPdfDoc; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const doc: ChordChartPdfDoc = {
    setFont: (...args) => calls.push({ method: 'setFont', args }),
    setFontSize: (...args) => calls.push({ method: 'setFontSize', args }),
    setTextColor: (...args) => calls.push({ method: 'setTextColor', args }),
    text: (...args) => calls.push({ method: 'text', args }),
    getTextWidth: (text) => text.length * 1.5,
    splitTextToSize: (text) => [text],
    addPage: () => calls.push({ method: 'addPage', args: [] }),
    save: (...args) => calls.push({ method: 'save', args }),
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
  };

  return { doc, calls };
}

function textArgs(calls: RecordedCall[]): string[] {
  return calls
    .filter((call) => call.method === 'text')
    .flatMap((call) => {
      const value = call.args[0];
      return Array.isArray(value) ? value : [String(value)];
    });
}

describe('asciiSafePdfText', () => {
  it('normalizes musical symbols, quotes and accents for Helvetica', () => {
    expect(asciiSafePdfText('Key B♭ “Café” — ♯')).toBe('Key Bb "Cafe" - #');
    expect(asciiSafePdfText('naïve • chorus')).toBe('naive - chorus');
  });
});

describe('buildChordChartPDF', () => {
  it('prints the title, artist, displayed key, capo and CCLI', () => {
    const { doc, calls } = createRecordingDoc();

    buildChordChartPDF(doc, [
      {
        title: 'La la Placeholder',
        artist: 'Original Test Song',
        key: 'D',
        originalKey: 'C',
        capo: 'Capo 2 - play C shapes',
        ccli: '123456',
        chart: '{title: La la Placeholder}\n{key: D}\n[D]La la [A]la\n',
      },
    ]);

    const printed = textArgs(calls).join('\n');
    expect(printed).toContain('La la Placeholder');
    expect(printed).toContain('Original Test Song');
    expect(printed).toContain('Key: D');
    expect(printed).toContain('Original key: C');
    expect(printed).toContain('Capo 2 - play C shapes');
    expect(printed).toContain('CCLI: 123456');
    // The already-transposed chart is what gets printed, not the original key.
    expect(printed).toContain('D');
    expect(printed).toContain('A');
    expect(printed).toContain('La la ');
    expect(printed).toContain('la');
  });

  it('prints chord and lyric rows and keeps every text call ASCII-only', () => {
    const { doc, calls } = createRecordingDoc();

    buildChordChartPDF(doc, [
      {
        title: 'Café ♯ Song',
        key: 'B♭',
        chart: '{key: Bb}\n[G]La la [C]la\n',
      },
    ]);

    const printed = textArgs(calls);
    expect(printed).toContain('Cafe # Song');
    expect(printed).toContain('Key: Bb');
    expect(printed).toContain('G');
    expect(printed).toContain('La la ');
    expect(printed).toContain('C');
    expect(printed).toContain('la');

    for (const value of printed) {
      expect(value).toMatch(/^[\x00-\x7F]*$/);
    }
  });

  it('starts each additional song on a new page', () => {
    const { doc, calls } = createRecordingDoc();

    buildChordChartPDF(doc, [
      { title: 'First', key: 'C', chart: '[C]La la' },
      { title: 'Second', key: 'G', chart: '[G]La la' },
    ]);

    expect(calls.filter((call) => call.method === 'addPage')).toHaveLength(1);
    expect(textArgs(calls)).toEqual(expect.arrayContaining(['Second', 'Key: G']));
  });

  it('builds a safe download file name', () => {
    expect(chordChartPdfFileName('La la Placeholder')).toBe('la-la-placeholder.pdf');
    expect(chordChartPdfFileName('   ')).toBe('chord-chart.pdf');
  });
});
