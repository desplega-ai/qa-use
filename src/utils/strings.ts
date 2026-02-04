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
