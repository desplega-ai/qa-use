/**
 * Normalize element ref by stripping quotes and @ symbol
 *
 * Handles standard refs (e31), @ prefixed refs (@e31), and custom selectors
 * (__custom__data-testid=...) when wrapped in quotes.
 *
 * Examples:
 * - "e31" → e31
 * - 'e31' → e31
 * - @e31 → e31
 * - "@e31" → e31
 * - e31 → e31
 * - "__custom__data-testid=rf__node-1" → __custom__data-testid=rf__node-1
 * - '__custom__data-testid=rf__node-2' → __custom__data-testid=rf__node-2
 *
 * @param ref - Element ref from snapshot or user input
 * @returns Normalized ref without quotes or @ prefix
 */
export function normalizeRef(ref: string): string {
  let normalized = ref;

  // Strip surrounding quotes (both single and double)
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }

  // Strip leading @ symbol
  if (normalized.startsWith('@')) {
    normalized = normalized.slice(1);
  }

  return normalized;
}
