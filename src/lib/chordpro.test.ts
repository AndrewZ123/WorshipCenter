import { describe, expect, it } from 'vitest';
import { parseChordPro } from './chordpro';

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
