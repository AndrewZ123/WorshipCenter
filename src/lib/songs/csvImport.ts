/**
 * Song CSV import helpers.
 *
 * Handles both the simple WorshipCenter export shape
 * (`title,artist,default_key,ccli_number,tags`) and a Planning Center Songs
 * CSV export (`Title`, `Author(s)`, `CCLI #`, `Default Key`, `Themes`,
 * `Copyright`, ...). The parser is deliberately dependency-free so the same
 * code can run in the browser preview and in the API route.
 */

import { normalizeCcliNumber } from '@/lib/ccli';

export const SONG_CSV_MAX_BYTES = 2 * 1024 * 1024;
export const SONG_CSV_MAX_ROWS = 1000;
export const SONG_CSV_MAX_TITLE_LENGTH = 200;
export const SONG_CSV_MAX_ARTIST_LENGTH = 100;
export const SONG_CSV_MAX_TAGS = 20;
export const SONG_CSV_MAX_TAG_LENGTH = 50;
export const SONG_CSV_MAX_KEY_LENGTH = 10;

export type SongCsvColumn =
  | 'title'
  | 'artist'
  | 'default_key'
  | 'ccli_number'
  | 'tags'
  | 'copyright';

export interface SongCsvRow {
  /** Spreadsheet row number, with the header on row 1. */
  rowNumber: number;
  title: string;
  artist: string;
  /** Empty when the CSV did not provide a key; inserts fall back to "C". */
  defaultKey: string;
  ccliNumber: string;
  tags: string[];
  /** Recognized PCO metadata; there is no WorshipCenter column for it yet. */
  copyright: string;
}

export interface SongCsvRowError {
  rowNumber: number;
  message: string;
}

export interface SongCsvParseSuccess {
  ok: true;
  rows: SongCsvRow[];
  errors: SongCsvRowError[];
  /** Data rows with at least one non-empty cell. */
  totalRows: number;
  /** The header text detected for each mapped column. */
  columns: Partial<Record<SongCsvColumn, string>>;
}

export interface SongCsvParseFailure {
  ok: false;
  error: string;
}

export type SongCsvParseResult = SongCsvParseSuccess | SongCsvParseFailure;

export interface ExistingSongForImport {
  id: string;
  title: string;
  artist?: string | null;
  ccli_number?: string | null;
}

export type SongImportMatchSource = 'library' | 'file' | null;

export interface SongImportPreviewRow extends SongCsvRow {
  status: 'new' | 'duplicate';
  matchedSongId: string | null;
  matchedTitle: string | null;
  matchSource: SongImportMatchSource;
}

export interface SongImportPreviewSummary {
  totalRows: number;
  newCount: number;
  duplicateCount: number;
  invalidCount: number;
}

export interface SongImportPreview {
  rows: SongImportPreviewRow[];
  errors: SongCsvRowError[];
  summary: SongImportPreviewSummary;
}

const HEADER_ALIASES: Record<SongCsvColumn, string[]> = {
  title: ['title', 'song title', 'song name', 'song', 'name'],
  artist: [
    'artist',
    'author',
    'authors',
    'writer',
    'writers',
    'songwriter',
    'songwriters',
    'artist name',
    'author name',
  ],
  default_key: [
    'default key',
    'key',
    'song key',
    'original key',
    'starting key',
  ],
  ccli_number: [
    'ccli',
    'ccli#',
    'ccli number',
    'ccli no',
    'ccli song number',
    'ccli song #',
    'ccli id',
  ],
  tags: ['tags', 'tag', 'themes', 'theme', 'categories', 'category'],
  // Planning Center includes this column, but WorshipCenter songs have no
  // copyright field. We recognize it (so it is not treated as unknown) and
  // keep the value available for future use.
  copyright: [
    'copyright',
    'copyright info',
    'copyright notice',
    'publisher',
    'publishers',
  ],
};

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*#/g, '#')
    .replace(/[.:]+$/, '')
    .trim();
}

const HEADER_LOOKUP = new Map<string, SongCsvColumn>();
for (const [column, aliases] of Object.entries(HEADER_ALIASES) as Array<
  [SongCsvColumn, string[]]
>) {
  for (const alias of aliases) {
    HEADER_LOOKUP.set(normalizeHeader(alias), column);
  }
}

function cleanCell(value: string | undefined): string {
  return (value ?? '')
    .replace(/\u0000/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function utf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  // Fallback for exotic runtimes; ASCII-sized strings are the common case.
  return text.length;
}

/**
 * RFC 4180-style CSV reader. Supports quoted commas, escaped quotes (`""`),
 * embedded newlines inside quotes, CRLF/CR/LF row endings, and a UTF-8 BOM.
 */
export function parseCsvRecords(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === '') {
      inQuotes = true;
    } else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records;
}

function parseTags(value: string): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const part of value.split(/[|,;]/)) {
    const tag = cleanCell(part).slice(0, SONG_CSV_MAX_TAG_LENGTH);
    if (!tag) continue;

    const key = tag.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    tags.push(tag);
    if (tags.length >= SONG_CSV_MAX_TAGS) break;
  }

  return tags;
}

/**
 * Parse a CSV upload into validated song rows plus per-row errors.
 *
 * A bad row never aborts the file: it is reported in `errors` and the rest of
 * the rows continue. Empty files, missing headers, and oversized uploads are
 * fatal because there is nothing useful to preview.
 */
export function parseSongsCsv(text: string): SongCsvParseResult {
  if (typeof text !== 'string' || !text.replace(/^\uFEFF/, '').trim()) {
    return { ok: false, error: 'The CSV file is empty.' };
  }

  if (utf8ByteLength(text) > SONG_CSV_MAX_BYTES) {
    return {
      ok: false,
      error: `CSV file is too large. The maximum size is ${
        SONG_CSV_MAX_BYTES / (1024 * 1024)
      } MB.`,
    };
  }

  const records = parseCsvRecords(text);
  const headerIndex = records.findIndex((record) =>
    record.some((cell) => cell.trim() !== '')
  );

  if (headerIndex === -1) {
    return { ok: false, error: 'The CSV file is empty.' };
  }

  const header = records[headerIndex];
  const columnIndexes: Partial<Record<SongCsvColumn, number>> = {};
  const columns: Partial<Record<SongCsvColumn, string>> = {};

  header.forEach((headerCell, index) => {
    const column = HEADER_LOOKUP.get(normalizeHeader(headerCell));
    if (!column || columnIndexes[column] !== undefined) return;
    columnIndexes[column] = index;
    columns[column] = cleanCell(headerCell);
  });

  if (columnIndexes.title === undefined) {
    return {
      ok: false,
      error:
        'Missing title column. Add a "Title" column (or "title" for a WorshipCenter CSV) and try again.',
    };
  }

  const dataRows = records
    .slice(headerIndex + 1)
    .map((record, index) => ({ record, rowNumber: headerIndex + 2 + index }))
    .filter(({ record }) => record.some((cell) => cell.trim() !== ''));

  if (dataRows.length > SONG_CSV_MAX_ROWS) {
    return {
      ok: false,
      error: `CSV has too many rows. The maximum is ${SONG_CSV_MAX_ROWS.toLocaleString()} songs per import.`,
    };
  }

  const rows: SongCsvRow[] = [];
  const errors: SongCsvRowError[] = [];

  const cellAt = (record: string[], column: SongCsvColumn): string => {
    const index = columnIndexes[column];
    return index === undefined ? '' : cleanCell(record[index]);
  };

  for (const { record, rowNumber } of dataRows) {
    const title = cellAt(record, 'title');
    if (!title) {
      errors.push({ rowNumber, message: 'Title is required.' });
      continue;
    }
    if (title.length > SONG_CSV_MAX_TITLE_LENGTH) {
      errors.push({
        rowNumber,
        message: `Title is too long (maximum ${SONG_CSV_MAX_TITLE_LENGTH} characters).`,
      });
      continue;
    }

    const artist = cellAt(record, 'artist');
    if (artist.length > SONG_CSV_MAX_ARTIST_LENGTH) {
      errors.push({
        rowNumber,
        message: `Artist is too long (maximum ${SONG_CSV_MAX_ARTIST_LENGTH} characters).`,
      });
      continue;
    }

    const defaultKey = cellAt(record, 'default_key').slice(
      0,
      SONG_CSV_MAX_KEY_LENGTH
    );

    rows.push({
      rowNumber,
      title,
      artist,
      defaultKey,
      ccliNumber: normalizeCcliNumber(cellAt(record, 'ccli_number')),
      tags: parseTags(cellAt(record, 'tags')),
      copyright: cellAt(record, 'copyright'),
    });
  }

  return {
    ok: true,
    rows,
    errors,
    totalRows: dataRows.length,
    columns,
  };
}

/** Case-folded, whitespace-collapsed text used for duplicate matching. */
export function normalizeSongMatchText(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function songTitleArtistKey(
  title: string | null | undefined,
  artist: string | null | undefined
): string {
  return `${normalizeSongMatchText(title)}\u0000${normalizeSongMatchText(artist)}`;
}

/**
 * Match CSV rows against the church's current library.
 *
 * A row is a duplicate when its normalized CCLI matches an existing song, or —
 * only when the row has no CCLI — when normalized title + artist match. Rows
 * that repeat an earlier new row in the same file are also marked duplicate so
 * one upload cannot create the same song twice.
 */
export function buildSongImportPreview(
  parsed: SongCsvParseSuccess,
  existingSongs: ExistingSongForImport[]
): SongImportPreview {
  const existingByCcli = new Map<string, ExistingSongForImport>();
  const existingByTitleArtist = new Map<string, ExistingSongForImport>();

  for (const song of existingSongs) {
    const ccli = normalizeCcliNumber(song.ccli_number);
    if (ccli && !existingByCcli.has(ccli)) {
      existingByCcli.set(ccli, song);
    }

    const titleArtist = songTitleArtistKey(song.title, song.artist);
    if (!existingByTitleArtist.has(titleArtist)) {
      existingByTitleArtist.set(titleArtist, song);
    }
  }

  const fileByCcli = new Map<string, SongCsvRow>();
  const fileByTitleArtist = new Map<string, SongCsvRow>();

  const rows: SongImportPreviewRow[] = [];
  let newCount = 0;
  let duplicateCount = 0;

  for (const row of parsed.rows) {
    const ccli = normalizeCcliNumber(row.ccliNumber);
    let matchedSongId: string | null = null;
    let matchedTitle: string | null = null;
    let matchSource: SongImportMatchSource = null;

    if (ccli) {
      const existing = existingByCcli.get(ccli);
      if (existing) {
        matchedSongId = existing.id;
        matchedTitle = existing.title;
        matchSource = 'library';
      } else {
        const earlierRow = fileByCcli.get(ccli);
        if (earlierRow) {
          matchedTitle = earlierRow.title;
          matchSource = 'file';
        }
      }
    } else {
      const titleArtist = songTitleArtistKey(row.title, row.artist);
      const existing = existingByTitleArtist.get(titleArtist);
      if (existing) {
        matchedSongId = existing.id;
        matchedTitle = existing.title;
        matchSource = 'library';
      } else {
        const earlierRow = fileByTitleArtist.get(titleArtist);
        if (earlierRow) {
          matchedTitle = earlierRow.title;
          matchSource = 'file';
        }
      }
    }

    if (matchSource) {
      duplicateCount += 1;
      rows.push({
        ...row,
        status: 'duplicate',
        matchedSongId,
        matchedTitle,
        matchSource,
      });
      continue;
    }

    newCount += 1;
    rows.push({
      ...row,
      status: 'new',
      matchedSongId: null,
      matchedTitle: null,
      matchSource: null,
    });

    if (ccli) {
      fileByCcli.set(ccli, row);
    }
    // Index every new row by title + artist too, so a later row with no CCLI
    // can still be recognized as a repeat of this one.
    fileByTitleArtist.set(songTitleArtistKey(row.title, row.artist), row);
  }

  return {
    rows,
    errors: parsed.errors,
    summary: {
      totalRows: parsed.totalRows,
      newCount,
      duplicateCount,
      invalidCount: parsed.errors.length,
    },
  };
}

/**
 * A tiny, entirely fictional template. It uses Planning Center-style headers so
 * a PCO export works as-is, and the WorshipCenter header aliases are just as
 * valid. No lyrics or real song data belong here.
 */
export const SONG_CSV_TEMPLATE_FILENAME = 'worshipcenter-song-import-template.csv';
export const SONG_CSV_TEMPLATE = [
  'Title,Author,CCLI #,Default Key,Tags',
  '"Morning Light","Example Artist","0000001","G","praise, upbeat"',
  '"Quiet Waters","Example Band","0000002","D","communion|reflective"',
].join('\n');
