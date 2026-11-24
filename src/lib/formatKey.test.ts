import { describe, expect, it } from 'vitest';
import { formatKey } from './formatKey';

describe('formatKey', () => {
  it('keeps flats lowercase', () => {
    expect(formatKey('Ab')).toBe('Ab');
    expect(formatKey('Gb')).toBe('Gb');
    expect(formatKey('Bbm')).toBe('Bbm');
  });

  it('normalizes an uppercase flat or unicode accidental', () => {
    expect(formatKey('AB')).toBe('Ab');
    expect(formatKey('GB')).toBe('Gb');
    expect(formatKey('a♭m')).toBe('Abm');
    expect(formatKey('f♯m')).toBe('F#m');
  });

  it('leaves slash keys and naturals intact', () => {
    expect(formatKey('C#/Db')).toBe('C#/Db');
    expect(formatKey('B')).toBe('B');
    expect(formatKey('c#m')).toBe('C#m');
  });

  it('handles empty values', () => {
    expect(formatKey('')).toBe('');
    expect(formatKey(null)).toBe('');
    expect(formatKey(undefined)).toBe('');
  });
});
