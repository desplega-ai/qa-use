/**
 * Operator-level "force headless" override.
 *
 * When `QA_USE_FORCE_HEADLESS` is set to a truthy value, qa-use refuses
 * to launch a visible (headful) browser. Any explicit headful request
 * — `--no-headless`, `--headful`, `defaults.headless: false`, or an MCP
 * client passing `headless: false` — fails with a clear error.
 *
 * This is a hard policy switch for environments that must guarantee no
 * visible browser ever opens (CI, locked-down hosts, security policy).
 *
 * The env var is read via `getEnv` so it also resolves through the
 * `~/.qa-use.json` env block, consistent with other `QA_USE_*` vars.
 */

import { getEnv } from './index.js';

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

/**
 * Returns `true` when force-headless is active.
 */
export function isForceHeadless(): boolean {
  const raw = getEnv('QA_USE_FORCE_HEADLESS');
  if (!raw) return false;
  return TRUTHY.has(raw.trim().toLowerCase());
}

/**
 * Throw if force-headless is on AND the caller explicitly asked for
 * headful (`requested === false`). `undefined` and `true` pass through.
 *
 * `source` is interpolated into the error so the user can see which
 * input triggered it (e.g. `"--no-headless flag"`).
 */
export function assertHeadlessAllowed(requested: boolean | undefined, source: string): void {
  if (requested !== false) return;
  if (!isForceHeadless()) return;
  throw new Error(
    `Headful browser mode is disabled by QA_USE_FORCE_HEADLESS.\n` +
      `Triggered by: ${source}.\n` +
      `Unset the env var or remove the headful request to proceed.`
  );
}

/**
 * Resolve the effective headless value at a launch site.
 *
 * - Asserts that an explicit `false` is not silently overridden.
 * - When force-headless is on, coerces `undefined` to `true`.
 * - Otherwise returns the requested value unchanged (callers keep
 *   their existing `?? true` defaulting downstream).
 */
export function resolveForcedHeadless(
  requested: boolean | undefined,
  source = 'browser launch options'
): boolean | undefined {
  assertHeadlessAllowed(requested, source);
  if (isForceHeadless()) return true;
  return requested;
}
