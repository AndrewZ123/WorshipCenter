/**
 * Church URL slug display helpers.
 *
 * Some historically-created churches have no `slug` column value. We never
 * make the field look editable, and we never depend on a slug write: the
 * Settings page simply shows a deterministic, read-only identifier.
 */

export function slugifyChurchName(value: string | null | undefined): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
}

/**
 * Derive a stable display slug for a church without one. Appends a short
 * fragment of the church id so two churches with the same name do not display
 * the exact same identifier.
 */
export function deriveChurchSlug(
  name: string | null | undefined,
  churchId?: string | null
): string {
  const base = slugifyChurchName(name) || 'church';
  const suffix = (churchId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toLowerCase();
  return suffix ? `${base}-${suffix}` : base;
}

/** What the read-only Church URL Slug field should display. */
export function getDisplayChurchSlug(
  slug: string | null | undefined,
  name: string | null | undefined,
  churchId?: string | null
): string {
  const trimmed = (slug || '').trim();
  return trimmed || deriveChurchSlug(name, churchId);
}
