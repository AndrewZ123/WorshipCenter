import { describe, expect, it } from 'vitest';
import { parseChordPro, splitChordProLine } from './chordpro';

describe('parseChordPro line endings', () => {
  it('parses pasted text with Windows CRLF line endings', () => {
    const parsed = parseChordPro(
      '{title: Amazing Grace}\r\n{key: G}\r\n[G]Amazing [C]grace\r\n[G]How sweet [D]the sound\r\n',
    );

    expect(parsed.meta.title).toBe('Amazing Grace');
    expect(parsed.meta.key).toBe('G');
    expect(parsed.lines[0]).toEqual({
      chords: ['G', 'C'],
      text: 'Amazing grace',
    });
    expect(parsed.lines[1]).toEqual({
      chords: ['G', 'D'],
      text: 'How sweet the sound',
    });
  });
});

describe('splitChordProLine', () => {
  it('keeps each chord above the lyric that follows it', () => {
    expect(splitChordProLine('[G]Amazing [C]grace')).toEqual([
      { chord: 'G', lyric: 'Amazing ' },
      { chord: 'C', lyric: 'grace' },
    ]);
  });

  it('preserves leading text and spacing', () => {
    expect(splitChordProLine('Amazing [C] grace')).toEqual([
      { chord: '', lyric: 'Amazing ' },
      { chord: 'C', lyric: ' grace' },
    ]);
  });

  it('marks chord-only segments separately', () => {
    expect(splitChordProLine('[G][C]grace')).toEqual([
      { chord: 'G', lyric: '' },
      { chord: 'C', lyric: 'grace' },
    ]);
    expect(splitChordProLine('[G]')).toEqual([{ chord: 'G', lyric: '' }]);
  });

  it('handles lyric-only and empty lines', () => {
    expect(splitChordProLine('No chords here')).toEqual([
      { chord: '', lyric: 'No chords here' },
    ]);
    expect(splitChordProLine('')).toEqual([]);
  });
});
