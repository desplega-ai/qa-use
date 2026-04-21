/**
 * Canonical localhost URL helpers.
 *
 * These live in `lib/env/` so they are usable from both the CLI layer and
 * library code (tunnel, browser) without forcing a dependency on `src/cli`.
 */

import { URL } from 'node:url';

/**
 * Check if a URL points to localhost.
 *
 * Matches:
 *   - `localhost`
 *   - `127.0.0.1`
 *   - `::1`
 *   - `*.localhost` (e.g., `foo.localhost`)
 *   - `0.0.0.0`
 */
export function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Node/Bun's URL parser returns IPv6 hosts wrapped in brackets
    // (e.g. "[::1]"). Strip them for comparison.
    const host = parsed.hostname.replace(/^\[|\]$/g, '');
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.endsWith('.localhost')
    );
  } catch {
    return false;
  }
}

/**
 * Get the port from a URL, defaulting to 443 for https and 80 otherwise.
 */
export function getPortFromUrl(url: string): number {
  try {
    const parsed = new URL(url);
    if (parsed.port) {
      return parseInt(parsed.port, 10);
    }
    return parsed.protocol === 'https:' ? 443 : 80;
  } catch {
    return 80;
  }
}
