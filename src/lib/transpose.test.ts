import { describe, expect, it } from 'vitest';
import {
  capoSuggestions,
  parseKey,
  semitonesBetween,
  transposeChord,
  transposeChordPro,
  transposeKey,
} from './transpose';

describe('parseKey', () => {
  it('parses major and minor keys', () => {
    expect(parseKey('G')).toEqual({ root: 'G', minor: false });
    expect(parseKey('Bbm')).toEqual({ root: 'Bb', minor: true });
    expect(parseKey('F# minor')).toEqual({ root: 'F#', minor: true });
    expect(parseKey('Cmaj')).toEqual({ root: 'C', minor: false });
  });

  it('rejects values that are not keys', () => {
    expect(parseKey('Verse')).toBeNull();
    expect(parseKey('')).toBeNull();
  });
});

describe('transposeChord', () => {
  it('transposes natural, sharp and flat roots', () => {
    expect(transposeChord('C', 2)).toBe('D');
    expect(transposeChord('F#', 1)).toBe('G');
    expect(transposeChord('G#', 2)).toBe('A#');
    expect(transposeChord('Bb', 2)).toBe('C');
    expect(transposeChord('B', 1)).toBe('C');
  });

  it('uses flats for flat target keys', () => {
    expect(transposeChord('A', 1, 'Bb')).toBe('Bb');
    expect(transposeChord('C', 3, 'Eb')).toBe('Eb');
    expect(transposeChord('D', 1, 'Eb')).toBe('Eb');
    expect(transposeChord('C', 1, 'Db')).toBe('Db');
    expect(transposeChord('G', 2, 'Bb')).toBe('A');
    expect(transposeChord('C', 3, 'Bbm')).toBe('Eb');
  });

  it('uses sharps for sharp target keys', () => {
    expect(transposeChord('C', 2, 'D')).toBe('D');
    expect(transposeChord('F', 1, 'G')).toBe('F#');
    expect(transposeChord('Bb', 2, 'C')).toBe('C');
  });

  it('keeps common chord suffixes', () => {
    expect(transposeChord('Am7', 2)).toBe('Bm7');
    expect(transposeChord('Cmaj7', 2)).toBe('Dmaj7');
    expect(transposeChord('Dsus4', 2)).toBe('Esus4');
    expect(transposeChord('Gadd9', 2)).toBe('Aadd9');
    expect(transposeChord('Bdim', 1)).toBe('Cdim');
    expect(transposeChord('Faug', 1)).toBe('F#aug');
    expect(transposeChord('E7sus4', 3)).toBe('G7sus4');
    expect(transposeChord('Am7b5', 2)).toBe('Bm7b5');
  });

  it('transposes slash-chord basses', () => {
    expect(transposeChord('G/B', 2)).toBe('A/C#');
    expect(transposeChord('Am7/G', 2)).toBe('Bm7/A');
    expect(transposeChord('C/E', 3, 'Eb')).toBe('Eb/G');
  });

  it('leaves non-chord tokens untouched', () => {
    expect(transposeChord('N.C.', 5)).toBe('N.C.');
    expect(transposeChord('Intro', 5)).toBe('Intro');
    expect(transposeChord('Verse 1', 5)).toBe('Verse 1');
    expect(transposeChord('x2', 2)).toBe('x2');
    expect(transposeChord('C6/9', 2)).toBe('C6/9');
  });

  it('round trips through +12 and -12 semitones', () => {
    const chords = ['C', 'F#', 'Bb', 'G/B', 'Am7', 'Ebsus4', 'Dmaj7/F#'];
    for (const chord of chords) {
      expect(transposeChord(transposeChord(chord, 12), -12)).toBe(chord);
    }
  });
});

describe('transposeKey', () => {
  it('chooses conventional spellings for the target key', () => {
    expect(transposeKey('G', 1)).toBe('Ab');
    expect(transposeKey('C', 1)).toBe('Db');
    expect(transposeKey('A', 1)).toBe('Bb');
    expect(transposeKey('E', 1)).toBe('F');
    expect(transposeKey('Am', 1)).toBe('Bbm');
    expect(transposeKey('Em', 1)).toBe('Fm');
    expect(transposeKey('D', 1)).toBe('Eb');
  });

  it('preserves the mode', () => {
    expect(transposeKey('G', 2)).toBe('A');
    expect(transposeKey('Gm', 2)).toBe('Am');
    expect(transposeKey('F#m', 12)).toBe('F#m');
  });
});

describe('semitonesBetween', () => {
  it('returns the upward distance between keys', () => {
    expect(semitonesBetween('G', 'A')).toBe(2);
    expect(semitonesBetween('A', 'G')).toBe(10);
    expect(semitonesBetween('C', 'C')).toBe(0);
    expect(semitonesBetween('Bb', 'D')).toBe(4);
    expect(semitonesBetween('Am', 'Cm')).toBe(3);
  });

  it('returns 0 for values that are not keys', () => {
    expect(semitonesBetween('Verse', 'A')).toBe(0);
  });
});

describe('transposeChordPro', () => {
  const chart = [
    '{title: Amazing Grace}',
    '{key: G}',
    '{comment: Verse 1}',
    '[G]Amazing [C]grace, how [G/B]sweet the [D7]sound',
    'That [Em]saved a wretch like [C]me',
    '[Verse 2]I once was lost',
  ].join('\n');

  it('transposes bracketed chords and the key directive only', () => {
    const result = transposeChordPro(chart, 2);

    expect(result).toContain('{key: A}');
    expect(result).toContain('[A]Amazing [D]grace, how [A/C#]sweet the [E7]sound');
    expect(result).toContain('[F#m]saved a wretch like [D]me');
    // Lyrics, comments, titles and non-chord markers are untouched.
    expect(result).toContain('{title: Amazing Grace}');
    expect(result).toContain('{comment: Verse 1}');
    expect(result).toContain('That ');
    expect(result).toContain('like ');
    expect(result).toContain('[Verse 2]I once was lost');
  });

  it('honours an explicit target key for spelling and the directive', () => {
    const result = transposeChordPro('{key: G}\n[G] [D] [Em]', 1, 'Ab');

    expect(result).toBe('{key: Ab}\n[Ab] [Eb] [Fm]');
  });

  it('leaves the chart unchanged for a full octave', () => {
    expect(transposeChordPro(chart, 12)).toBe(chart);
  });

  it('does not transpose other directives that contain chord-looking text', () => {
    const result = transposeChordPro('{key: C}\n{comment: [C] [G]}\n[C]text', 2);
    expect(result).toContain('{comment: [C] [G]}');
    expect(result).toContain('[D]text');
  });
});

describe('capoSuggestions', () => {
  it('returns up to three common major shapes sorted by capo', () => {
    expect(capoSuggestions('C')).toEqual([
      { capo: 0, shapeKey: 'C' },
      { capo: 3, shapeKey: 'A' },
      { capo: 5, shapeKey: 'G' },
    ]);

    expect(capoSuggestions('G')).toEqual([
      { capo: 0, shapeKey: 'G' },
      { capo: 3, shapeKey: 'E' },
      { capo: 5, shapeKey: 'D' },
    ]);
  });

  it('handles enharmonic keys and keeps capo within 0–7', () => {
    expect(capoSuggestions('Bb')).toEqual([
      { capo: 1, shapeKey: 'A' },
      { capo: 3, shapeKey: 'G' },
      { capo: 6, shapeKey: 'E' },
    ]);

    for (const suggestion of capoSuggestions('F#')) {
      expect(suggestion.capo).toBeGreaterThanOrEqual(0);
      expect(suggestion.capo).toBeLessThanOrEqual(7);
    }
  });

  it('uses minor shapes for minor keys', () => {
    expect(capoSuggestions('Am')).toEqual([
      { capo: 0, shapeKey: 'Am' },
      { capo: 5, shapeKey: 'Em' },
      { capo: 7, shapeKey: 'Dm' },
    ]);
    expect(capoSuggestions('Bm')).toEqual([
      { capo: 2, shapeKey: 'Am' },
      { capo: 7, shapeKey: 'Em' },
    ]);
  });

  it('returns no suggestions for invalid keys', () => {
    expect(capoSuggestions('Verse')).toEqual([]);
    expect(capoSuggestions('')).toEqual([]);
  });
});
