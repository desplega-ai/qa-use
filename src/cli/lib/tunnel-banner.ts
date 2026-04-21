/**
 * Auto-tunnel banner helpers (stderr-only, TTY-aware).
 *
 * `printTunnelStartBanner` is the multi-line boxed notice shown when a
 * new tunnel is started. `printTunnelReuseBanner` is the short
 * single-line notice used when an existing tunnel is reused (Phase 3
 * consumer, but lands here so all banner copy lives in one place).
 *
 * Suppression rules — banner prints nothing when ANY of the following
 * hold:
 *   - `process.stderr.isTTY` is falsy (piped / redirected stderr)
 *   - `process.env.QA_USE_QUIET === '1'`
 *   - caller passes `{ quiet: true }`
 */

export interface TunnelBannerOptions {
  /** The detected target URL (usually the localhost base URL). */
  target: string;
  /** The public tunnel URL that was just created / reused. */
  publicUrl: string;
  /** Opt-in quiet flag from a `--json`/`--quiet` caller. */
  quiet?: boolean;
}

function shouldSuppress(quiet: boolean | undefined): boolean {
  if (quiet) return true;
  if (process.env.QA_USE_QUIET === '1') return true;
  if (!process.stderr.isTTY) return true;
  return false;
}

/**
 * Multi-line boxed banner printed on a fresh tunnel start.
 */
export function printTunnelStartBanner(options: TunnelBannerOptions): void {
  if (shouldSuppress(options.quiet)) return;

  const lines = [
    '╭─ Auto-tunnel active ──────────────────────────────',
    `│ Detected localhost target: ${options.target}`,
    '│ Remote backend cannot reach your machine directly,',
    '│ so qa-use is exposing it via:',
    '│',
    `│   ${options.publicUrl}`,
    '│',
    '│ Disable with --no-tunnel (or use a public URL).',
    '╰───────────────────────────────────────────────────',
  ];

  for (const line of lines) {
    console.error(line);
  }
}

/**
 * Single-line notice printed when an existing tunnel is reused.
 * Used by the Phase-3 registry layer; lives here so all banner copy
 * stays co-located.
 */
export function printTunnelReuseBanner(options: TunnelBannerOptions): void {
  if (shouldSuppress(options.quiet)) return;

  console.error(`↻ Auto-tunnel reuse: ${options.target} → ${options.publicUrl}`);
}
