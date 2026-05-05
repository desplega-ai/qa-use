/**
 * UUID validation helpers.
 *
 * Lifted from `src/cli/commands/test/info.ts` so multiple commands can share
 * the same regex without re-importing each other's command modules.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isFullUuid(value: string): boolean {
  return UUID_RE.test(value);
}
