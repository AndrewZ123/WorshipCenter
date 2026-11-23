import { describe, expect, it } from 'vitest';
import { serviceStatusMark } from './pdf-status';

describe('serviceStatusMark', () => {
  it.each(['confirmed', 'declined', 'pending', 'unknown'])(
    'returns an ASCII-only mark for %s',
    (status) => {
      const mark = serviceStatusMark(status);

      // jsPDF's Helvetica font is WinAnsi-only; anything outside printable
      // ASCII can render as garbage such as "%Ë".
      expect(mark).toMatch(/^[\x20-\x7E]+$/);
    }
  );

  it('uses distinct marks for confirmed, declined, and pending', () => {
    expect(serviceStatusMark('confirmed')).toBe('Y');
    expect(serviceStatusMark('declined')).toBe('N');
    expect(serviceStatusMark('pending')).toBe('-');
  });
});
