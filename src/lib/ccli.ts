/**
 * Shared CCLI number rules. Kept dependency-free so both the zod schema and
 * client-side inputs use exactly the same limits.
 */

export const CCLI_NUMBER_MAX_LENGTH = 10;

/** Keep digits only and cap the value at the CCLI maximum length. */
export function normalizeCcliNumber(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, CCLI_NUMBER_MAX_LENGTH);
}
