/**
 * Transpose helpers for chord charts.
 *
 * Everything here is pure and display-only: callers decide whether a
 * transposed chart is ever persisted. ChordPro input is left byte-for-byte
 * intact outside of bracketed `[chords]` and the `{key: ...}` directive.
 */

/**
 * Browser-local transpose offset. This is display-only and intentionally not
 * part of the song record, so every chart viewer uses the same per-song key.
 */
export const TRANSPOSE_STORAGE_PREFIX = 'wc:song-transpose:';
export const TRANSPOSE_LIMIT = 11;

export function clampTranspose(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-TRANSPOSE_LIMIT, Math.min(TRANSPOSE_LIMIT, Math.trunc(value)));
}

/** Read the browser-local display transpose for a song, safely. */
export function readStoredTransposeOffset(
  songId: string,
  storage?: Pick<Storage, 'getItem'> | null,
): number {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return 0;
    return clampTranspose(Number.parseInt(target.getItem(`${TRANSPOSE_STORAGE_PREFIX}${songId}`) || '0', 10));
  } catch {
    return 0;
  }
}

const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

const NATURAL_PITCH: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

// Major key signatures that are written with flats (F, Bb, Eb, Ab, Db, Gb).
const FLAT_MAJOR_PITCHES = new Set([5, 10, 3, 8, 1, 6]);
// Relative minor equivalents: Dm, Gm, Cm, Fm, Bbm, Ebm.
const FLAT_MINOR_PITCHES = new Set([2, 7, 0, 5, 10, 3]);

const COMMON_MAJOR_SHAPES = ['C', 'G', 'D', 'A', 'E'] as const;
const COMMON_MINOR_SHAPES = ['Am', 'Em', 'Dm'] as const;

const KEY_RE = /^([A-Ga-g])([#b♯♭]?)\s*(m|min|minor|maj|major)?$/;
// Chord suffixes we understand. Anything containing other letters (for
// example lyric markers such as [Verse] or [Intro]) is left untouched.
const CHORD_SUFFIX_RE = /^(?:(?:maj|min|dim|aug|sus|add|no|alt|m|M|°|ø|\+|-|#|b|\d|\(|\))*)$/;

export interface ParsedKey {
  /** Root note with a normalized accidental (`#` or `b`). */
  root: string;
  minor: boolean;
}

export interface CapoSuggestion {
  /** Capo fret, 0–7. */
  capo: number;
  /** Open chord shape to play with the capo on. */
  shapeKey: string;
}

function normalizeAccidental(accidental: string): string {
  if (accidental === '♯') return '#';
  if (accidental === '♭') return 'b';
  return accidental;
}

function pitchClass(note: string): number {
  const match = note.match(/^([A-G])([#b]?)$/);
  if (!match) return 0;
  const base = NATURAL_PITCH[match[1]];
  if (match[2] === '#') return (base + 1) % 12;
  if (match[2] === 'b') return (base + 11) % 12;
  return base;
}

function normalizeSemitones(semitones: number): number {
  const rounded = Math.round(Number(semitones) || 0);
  return ((rounded % 12) + 12) % 12;
}

export function parseKey(key: string): ParsedKey | null {
  if (!key) return null;
  const match = key.trim().match(KEY_RE);
  if (!match) return null;
  const suffix = (match[3] || '').toLowerCase();
  return {
    root: `${match[1].toUpperCase()}${normalizeAccidental(match[2])}`,
    minor: suffix === 'm' || suffix === 'min' || suffix === 'minor',
  };
}

/** True when a key is conventionally written with flats. */
export function usesFlatsForKey(key: string): boolean {
  const parsed = parseKey(key);
  if (!parsed) return false;
  if (parsed.root.includes('b')) return true;
  if (parsed.root.includes('#')) return false;
  const pc = pitchClass(parsed.root);
  return parsed.minor ? FLAT_MINOR_PITCHES.has(pc) : FLAT_MAJOR_PITCHES.has(pc);
}

function transposeNote(note: string, semitones: number, preferFlats: boolean): string {
  const pc = (pitchClass(note) + normalizeSemitones(semitones)) % 12;
  return preferFlats ? FLAT_NOTES[pc] : SHARP_NOTES[pc];
}

/** Transpose a key name while preserving its major/minor mode. */
export function transposeKey(key: string, semitones: number): string {
  const parsed = parseKey(key);
  if (!parsed) return key;

  const offset = normalizeSemitones(semitones);
  if (offset === 0) return key.trim();

  const targetPitch = (pitchClass(parsed.root) + offset) % 12;
  const preferFlats = parsed.minor
    ? FLAT_MINOR_PITCHES.has(targetPitch)
    : FLAT_MAJOR_PITCHES.has(targetPitch);

  const root = transposeNote(parsed.root, offset, preferFlats);
  return parsed.minor ? `${root}m` : root;
}

interface ParsedChord {
  root: string;
  suffix: string;
  bass?: string;
}

function parseChord(chord: string): ParsedChord | null {
  if (!chord) return null;
  let body = chord;

  let bass: string | undefined;
  const slashIndex = body.lastIndexOf('/');
  if (slashIndex !== -1) {
    const bassMatch = body.slice(slashIndex + 1).match(/^([A-Ga-g])([#b♯♭]?)$/);
    // A slash that is not followed by a note (e.g. C6/9) is not a guitar
    // slash chord; leave the token alone rather than guessing.
    if (!bassMatch) return null;
    bass = `${bassMatch[1].toUpperCase()}${normalizeAccidental(bassMatch[2])}`;
    body = body.slice(0, slashIndex);
  }

  const match = body.match(/^([A-Ga-g])([#b♯♭]?)(.*)$/);
  if (!match) return null;

  const root = `${match[1].toUpperCase()}${normalizeAccidental(match[2])}`;
  const suffix = match[3];
  if (!CHORD_SUFFIX_RE.test(suffix)) return null;

  return { root, suffix, bass };
}

/**
 * Transpose a single chord symbol by N semitones.
 *
 * Slash-chord basses are transposed too. Tokens that are not chords
 * (lyric markers, "N.C.", counts, comments) are returned unchanged.
 */
export function transposeChord(chord: string, semitones: number, targetKey?: string): string {
  const parsed = parseChord(chord);
  if (!parsed) return chord;

  // Preserve the original spelling for a full-octave/no-op transposition.
  if (normalizeSemitones(semitones) === 0) return chord;

  const preferFlats = targetKey
    ? usesFlatsForKey(targetKey)
    : parsed.root.includes('b');

  const root = transposeNote(parsed.root, semitones, preferFlats);
  const bass = parsed.bass
    ? `/${transposeNote(parsed.bass, semitones, preferFlats)}`
    : '';

  return `${root}${parsed.suffix}${bass}`;
}

/** Number of semitones going up from one key to another (0–11). */
export function semitonesBetween(fromKey: string, toKey: string): number {
  const from = parseKey(fromKey);
  const to = parseKey(toKey);
  if (!from || !to) return 0;
  return (pitchClass(to.root) - pitchClass(from.root) + 12) % 12;
}

const KEY_DIRECTIVE_RE = /^(\s*)\{\s*(key|k)\s*:\s*([^}]*)\}(\s*)$/i;
const BRACKETED_CHORD_RE = /\[([^\]]*)\]/g;
const FULL_DIRECTIVE_RE = /^\s*\{[^}]*\}\s*$/;

/**
 * Transpose only bracketed `[chords]` and the `{key: ...}` directive.
 * Lyrics, comments and every other directive stay exactly as written.
 */
export function transposeChordPro(text: string, semitones: number, targetKey?: string): string {
  if (!text) return text;

  const lines = text.split('\n');

  let originalKey = '';
  for (const line of lines) {
    const match = line.match(KEY_DIRECTIVE_RE);
    if (match) {
      originalKey = match[3].trim();
      break;
    }
  }

  const computedTarget = targetKey?.trim()
    || (originalKey ? transposeKey(originalKey, semitones) : undefined);
  const spellingKey = computedTarget || originalKey || undefined;

  return lines
    .map((line) => {
      const directive = line.match(KEY_DIRECTIVE_RE);
      if (directive) {
        const nextKey = computedTarget
          || (directive[3].trim() ? transposeChord(directive[3].trim(), semitones) : '');
        if (!nextKey) return line;
        return `${directive[1]}{${directive[2]}: ${nextKey}}${directive[4]}`;
      }

      // Comments and other directives are never transposed.
      if (FULL_DIRECTIVE_RE.test(line)) return line;

      return line.replace(BRACKETED_CHORD_RE, (_match, chord: string) => {
        return `[${transposeChord(chord, semitones, spellingKey)}]`;
      });
    })
    .join('\n');
}

/**
 * Capo options for a target key. Returns up to three common open shapes,
 * sorted by lowest capo first. Both the capo fret and shape stay in 0–7.
 */
export function capoSuggestions(targetKey: string): CapoSuggestion[] {
  const parsed = parseKey(targetKey);
  if (!parsed) return [];

  const targetPitch = pitchClass(parsed.root);
  const shapes = parsed.minor ? COMMON_MINOR_SHAPES : COMMON_MAJOR_SHAPES;

  const suggestions: CapoSuggestion[] = [];
  for (const shapeKey of shapes) {
    const shape = parseKey(shapeKey);
    if (!shape) continue;
    const shapePitch = pitchClass(shape.root);
    for (let capo = 0; capo <= 7; capo++) {
      if ((shapePitch + capo) % 12 === targetPitch) {
        suggestions.push({ capo, shapeKey });
      }
    }
  }

  suggestions.sort((a, b) => a.capo - b.capo);
  return suggestions.slice(0, 3);
}
