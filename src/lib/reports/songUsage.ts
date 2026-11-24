/**
 * Song usage frequency summary for the reports page.
 *
 * This is intentionally separate from `ccliCsv.ts`: the CCLI export stays the
 * single source of truth for that file format, while this helper answers the
 * simpler on-screen question "how often was each song played in this range?".
 */

export interface SongUsageEntry {
  /** Usage date as `YYYY-MM-DD`. */
  date: string;
  songId?: string | null;
  title?: string | null;
  songTitle?: string | null;
  artist?: string | null;
  ccliNumber?: string | null;
  ccli_number?: string | null;
}

export interface SongFrequencyRow {
  songKey: string;
  songId: string | null;
  title: string;
  artist: string;
  ccliNumber: string;
  timesPlayed: number;
  dates: string[];
  lastUsed: string;
}

function entryTitle(entry: SongUsageEntry): string {
  return (entry.title ?? entry.songTitle ?? '').trim();
}

function entryCcli(entry: SongUsageEntry): string {
  return (entry.ccliNumber ?? entry.ccli_number ?? '').toString().trim();
}

function entryKey(entry: SongUsageEntry): string {
  const songId = entry.songId?.trim();
  if (songId) return `id:${songId}`;
  return `title:${entryTitle(entry)}|${entry.artist ?? ''}|${entryCcli(entry)}`;
}

function entryDate(entry: SongUsageEntry): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(entry.date || '');
  return match ? match[1] : null;
}

interface Accumulator {
  songId: string | null;
  title: string;
  artist: string;
  ccliNumber: string;
  timesPlayed: number;
  dates: Set<string>;
}

/**
 * Aggregate usage rows per song, most played first. Songs with the same id are
 * merged even if their titles differ; id-less rows fall back to title/artist.
 */
export function summarizeSongUsage(
  entries: readonly SongUsageEntry[]
): SongFrequencyRow[] {
  const aggregates = new Map<string, Accumulator>();

  for (const entry of entries) {
    const title = entryTitle(entry);
    if (!title) continue;

    const key = entryKey(entry);
    let aggregate = aggregates.get(key);

    if (!aggregate) {
      aggregate = {
        songId: entry.songId?.trim() || null,
        title,
        artist: (entry.artist ?? '').trim(),
        ccliNumber: entryCcli(entry),
        timesPlayed: 0,
        dates: new Set<string>(),
      };
      aggregates.set(key, aggregate);
    } else {
      if (!aggregate.artist && entry.artist) {
        aggregate.artist = entry.artist.trim();
      }
      if (!aggregate.ccliNumber) {
        aggregate.ccliNumber = entryCcli(entry);
      }
    }

    aggregate.timesPlayed++;
    const date = entryDate(entry);
    if (date) aggregate.dates.add(date);
  }

  return Array.from(aggregates.entries())
    .map(([songKey, aggregate]) => {
      const dates = Array.from(aggregate.dates).sort();
      return {
        songKey,
        songId: aggregate.songId,
        title: aggregate.title,
        artist: aggregate.artist,
        ccliNumber: aggregate.ccliNumber,
        timesPlayed: aggregate.timesPlayed,
        dates,
        lastUsed: dates[dates.length - 1] ?? '',
      };
    })
    .sort((a, b) => {
      if (b.timesPlayed !== a.timesPlayed) return b.timesPlayed - a.timesPlayed;
      return a.title.localeCompare(b.title);
    });
}
