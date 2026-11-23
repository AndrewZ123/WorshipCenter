/**
 * CCLI usage report builder.
 *
 * Accepts raw song_usage rows joined with song metadata, aggregates them per
 * song for an optional date range, and returns a CSV string ready to download.
 * Pure and framework-free so the export logic is easy to test.
 */

export interface CcliUsageRow {
  /** ISO date (YYYY-MM-DD) of the service the song was used in. */
  date: string;
  songId?: string;
  song_id?: string;
  title?: string;
  songTitle?: string;
  artist?: string | null;
  ccliNumber?: string | null;
  ccli_number?: string | null;
}

export interface CcliCsvOptions {
  dateFrom?: string;
  dateTo?: string;
  // Aliases make the helper convenient from either naming convention.
  from?: string;
  to?: string;
}

const HEADER = [
  'Song Title',
  'Artist',
  'CCLI Number',
  'Times Used',
  'First Used',
  'Last Used',
  'Service Dates',
];

interface Aggregate {
  title: string;
  artist: string;
  ccliNumber: string;
  dates: string[];
}

function csvCell(value: string): string {
  let cell = value;

  // Formula-injection guard: prefix spreadsheet control characters.
  if (/^[=+\-@]/.test(cell)) {
    cell = `'${cell}`;
  }

  if (/[",\r\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function rowTitle(row: CcliUsageRow): string {
  return (row.title ?? row.songTitle ?? '').trim();
}

function rowCcli(row: CcliUsageRow): string {
  return (row.ccliNumber ?? row.ccli_number ?? '').toString().trim();
}

function rowSongKey(row: CcliUsageRow): string {
  const id = row.songId ?? row.song_id;
  if (id) return `id:${id}`;
  return `title:${rowTitle(row)}|${row.artist ?? ''}|${rowCcli(row)}`;
}

/**
 * Build the CCLI CSV. Every song with usage inside the range appears exactly
 * once, including songs that have no CCLI number (the column is left blank).
 */
export function buildCcliCsv(
  rows: CcliUsageRow[],
  options: CcliCsvOptions | string = {},
  legacyDateTo?: string
): string {
  const resolved = typeof options === 'string'
    ? { dateFrom: options, dateTo: legacyDateTo }
    : options;
  const dateFrom = resolved.dateFrom ?? resolved.from ?? '';
  const dateTo = resolved.dateTo ?? resolved.to ?? '';

  const aggregates = new Map<string, Aggregate>();

  for (const row of rows) {
    if (dateFrom && row.date < dateFrom) continue;
    if (dateTo && row.date > dateTo) continue;

    const key = rowSongKey(row);
    let aggregate = aggregates.get(key);
    if (!aggregate) {
      aggregate = {
        title: rowTitle(row),
        artist: (row.artist ?? '').trim(),
        ccliNumber: rowCcli(row),
        dates: [],
      };
      aggregates.set(key, aggregate);
    } else {
      if (!aggregate.artist && row.artist) aggregate.artist = row.artist.trim();
      if (!aggregate.ccliNumber) aggregate.ccliNumber = rowCcli(row);
    }

    if (row.date) {
      aggregate.dates.push(row.date);
    }
  }

  const records = Array.from(aggregates.values()).sort((a, b) => {
    const byTitle = a.title.localeCompare(b.title);
    if (byTitle !== 0) return byTitle;
    return a.artist.localeCompare(b.artist);
  });

  const lines = [HEADER.map(csvCell).join(',')];

  for (const record of records) {
    const dates = Array.from(new Set(record.dates)).sort();
    const firstUsed = dates[0] ?? '';
    const lastUsed = dates[dates.length - 1] ?? '';

    lines.push([
      csvCell(record.title),
      csvCell(record.artist),
      csvCell(record.ccliNumber),
      csvCell(String(record.dates.length)),
      csvCell(firstUsed),
      csvCell(lastUsed),
      csvCell(dates.join(';')),
    ].join(','));
  }

  return lines.join('\n');
}
