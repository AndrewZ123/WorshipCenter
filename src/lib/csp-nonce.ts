import { createHash, randomBytes } from 'crypto';

/**
 * Generate a CSP nonce for inline scripts and styles
 * Nonces are random, one-time-use tokens that allow specific inline scripts
 */
export function generateNonce(): string {
  const randomValue = randomBytes(16).toString('base64');
  const hash = createHash('sha256');
  hash.update(randomValue);
  return hash.digest('base64');
}

/**
 * Verify a CSP nonce matches expected format
 */
export function isValidNonce(nonce: string): boolean {
  return /^[A-Za-z0-9+/]+=*$/.test(nonce);
}