import jsPDF from 'jspdf';
import { splitChordProLine } from './chordpro';

/**
 * Printable chord charts use jsPDF's built-in Helvetica, which is WinAnsi
 * only. Every string that reaches the document is reduced to ASCII first so
 * flats, curly quotes and other Unicode never render as garbage.
 */
export function asciiSafePdfText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•·]/g, '-')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '?');
}

export interface ChordChartPdfSong {
  title: string;
  artist?: string;
  /** Key the chart is displayed in after transposition. */
  key?: string;
  /** Original chart key when it differs from the displayed key. */
  originalKey?: string;
  /** Already-formatted capo suggestion, for example "Capo 2 - play G shapes". */
  capo?: string;
  ccli?: string;
  /** ChordPro text, already transposed for display. */
  chart: string;
}

/** Minimal jsPDF surface used by the builder, so tests can pass a recorder. */
export interface ChordChartPdfDoc {
  setFont(fontName: string, fontStyle?: string): void;
  setFontSize(size: number): void;
  setTextColor(r: number, g?: number, b?: number): void;
  text(text: string | string[], x: number, y: number, options?: unknown): void;
  getTextWidth(text: string): number;
  splitTextToSize(text: string, maxWidth: number): string[];
  addPage(): void;
  save(filename: string): void;
  internal: {
    pageSize: {
      getWidth(): number;
      getHeight(): number;
    };
  };
}

const MARGIN = 15;
const CHORD_SIZE = 9;
const LYRIC_SIZE = 11;
const LINE_HEIGHT = 6.4;

interface ChartLine {
  kind: 'lyric' | 'comment' | 'blank';
  text: string;
}

function chartLines(chart: string): ChartLine[] {
  return chart.replace(/\r\n?/g, '\n').split('\n').map((raw) => {
    const line = raw.trimEnd();

    if (!line.trim()) return { kind: 'blank', text: '' };

    if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
      const inner = line.trim().slice(1, -1);
      const colon = inner.indexOf(':');
      if (colon !== -1) {
        const directive = inner.slice(0, colon).trim().toLowerCase();
        const value = inner.slice(colon + 1).trim();
        if (directive === 'comment' || directive === 'c') {
          return { kind: 'comment', text: value };
        }
      }
      // Title/key/artist/capo/CCLI are already rendered in the header.
      return { kind: 'blank', text: '' };
    }

    return { kind: 'lyric', text: line };
  });
}

function drawSong(doc: ChordChartPdfDoc, song: ChordChartPdfSong, isFirst: boolean): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  if (!isFirst) doc.addPage();

  let y = MARGIN + 5;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  for (const line of doc.splitTextToSize(asciiSafePdfText(song.title || 'Chord chart'), contentWidth)) {
    doc.text(line, MARGIN, y);
    y += 8;
  }

  if (song.artist) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(70, 70, 70);
    doc.text(asciiSafePdfText(song.artist), MARGIN, y);
    y += 7;
  }

  const details: string[] = [];
  if (song.key) details.push(`Key: ${song.key}`);
  if (song.originalKey && song.originalKey !== song.key) {
    details.push(`Original key: ${song.originalKey}`);
  }
  if (song.capo) details.push(song.capo);
  if (song.ccli) details.push(`CCLI: ${song.ccli}`);

  if (details.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(45, 145, 140);
    doc.text(asciiSafePdfText(details.join('   |   ')), MARGIN, y);
    y += 6;
  }

  y += 2;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN + 5;
    }
  };

  for (const line of chartLines(song.chart || '')) {
    if (line.kind === 'blank') {
      y += LINE_HEIGHT;
      continue;
    }

    if (line.kind === 'comment') {
      ensureSpace(LINE_HEIGHT * 2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(45, 145, 140);
      doc.text(asciiSafePdfText(line.text), MARGIN, y);
      y += LINE_HEIGHT + 2;
      continue;
    }

    const segments = splitChordProLine(line.text);
    if (segments.length === 0) {
      y += LINE_HEIGHT;
      continue;
    }

    ensureSpace(LINE_HEIGHT * 2 + 2);
    let x = MARGIN;
    let chordBaseline = y;

    for (const segment of segments) {
      const chord = asciiSafePdfText(segment.chord);
      const lyric = asciiSafePdfText(segment.lyric);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(CHORD_SIZE);
      const chordWidth = chord ? doc.getTextWidth(chord) : 0;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(LYRIC_SIZE);
      const lyricWidth = lyric ? doc.getTextWidth(lyric) : 0;
      const spaceWidth = doc.getTextWidth(' ');
      const width = Math.max(chordWidth, lyricWidth, spaceWidth);

      if (x > MARGIN && x + width > pageWidth - MARGIN) {
        chordBaseline += LINE_HEIGHT * 2;
        if (chordBaseline + LINE_HEIGHT > pageHeight - MARGIN) {
          doc.addPage();
          y = MARGIN + 5;
          chordBaseline = y;
        }
        x = MARGIN;
      }

      if (chord) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(CHORD_SIZE);
        doc.setTextColor(45, 145, 140);
        doc.text(chord, x, chordBaseline);
      }

      if (lyric) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(LYRIC_SIZE);
        doc.setTextColor(30, 30, 30);
        doc.text(lyric, x, chordBaseline + LINE_HEIGHT);
      }

      x += width;
    }

    y = chordBaseline + LINE_HEIGHT * 2 + 1.5;
  }
}

/** Pure builder: all layout decisions go through the supplied document. */
export function buildChordChartPDF(
  doc: ChordChartPdfDoc,
  songs: ChordChartPdfSong[],
): void {
  songs.forEach((song, index) => drawSong(doc, song, index === 0));
}

export function chordChartPdfFileName(title: string): string {
  const base = (title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'chord-chart'}.pdf`;
}

export function generateChordChartPDF(
  songs: ChordChartPdfSong[],
  fileName?: string,
): void {
  const doc = new jsPDF();
  buildChordChartPDF(doc as unknown as ChordChartPdfDoc, songs);
  const name = fileName || chordChartPdfFileName(songs.map((song) => song.title).join('-'));
  doc.save(name);
}
