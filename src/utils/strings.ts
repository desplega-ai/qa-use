/**
 * Converts a test name to a safe filename slug.
 * - Lowercases the string
 * - Replaces non-alphanumeric characters with hyphens
 * - Removes leading/trailing hyphens
 */
export function toSafeFilename(name: string, fallback = 'unnamed-test'): string {
  return (name || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build a unique filename slug for a cloud test.
 *
 * Test names can collide within an org — multiple Test rows may share the
 * same `name` by design. To avoid filesystem collisions on `pull`, we always
 * suffix the safe-name slug with a short prefix of the test UUID.
 *
 * Returns just the slug (no extension); callers add `.yaml` / `.json`.
 *
 * @example toUniqueTestFilename("Verify EASM", "275282ed-d6d8-…") → "verify-easm-275282ed"
 */
export function toUniqueTestFilename(name: string, id: string | undefined | null): string {
  const safeName = toSafeFilename(name || '');
  if (!id) return safeName;
  const shortId = id.replace(/-/g, '').slice(0, 8);
  return shortId ? `${safeName}-${shortId}` : safeName;
}

/**
 * Test whether a string looks like a canonical UUID (v4-ish, hyphenated).
 *
 * Used to disambiguate between `--id <uuid>` and `--id <name>` in commands
 * that accept either. A name that happens to match this shape is
 * indistinguishable from a UUID — but names containing whitespace or `:` /
 * special chars (the common case in this product) won't trigger.
 */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
