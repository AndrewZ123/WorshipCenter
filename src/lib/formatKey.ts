/**
 * Format a musical key for display without losing the lowercase flat.
 *
 * Keys can come from ChordPro directives, the key selector, or stored song
 * metadata, so normalize accidentals and the root letter while keeping minor
 * suffixes and slash-key halves intact (for example `a♭m` → `Abm`).
 */
export function formatKey(key: string | null | undefined): string {
  const value = (key || '').trim();
  if (!value) return '';

  return value.split('/').map(formatKeyPart).join('/');
}

function formatKeyPart(part: string): string {
  const match = part.match(/^([A-Ga-g])([#bB♯♭]?)(.*)$/);
  if (!match) return part;

  const accidental =
    match[2] === '♯' ? '#' : match[2] === '♭' || match[2] === 'B' ? 'b' : match[2];

  return `${match[1].toUpperCase()}${accidental}${match[3]}`;
}
