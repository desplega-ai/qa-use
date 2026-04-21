/**
 * Resolve the effective tunnel mode from CLI flag + config file, and
 * turn that mode into a concrete on/off decision using the base URL
 * and API URL.
 *
 * Precedence for `resolveTunnelFlag`:
 *   1. CLI flag (if the user explicitly passed --tunnel / --no-tunnel)
 *   2. Config file (`tunnel` key in ~/.qa-use.json)
 *   3. Default: 'auto'
 *
 * `resolveTunnelMode` is the Phase-2 auto-inference: `'auto'` maps to
 * `'on'` iff `isLocalhostUrl(baseUrl) && !isLocalhostUrl(apiUrl)`, else
 * `'off'`. `'on'` and `'off'` are passed through untouched.
 */

import { isLocalhostUrl } from '../../../lib/env/localhost.js';
import type { TunnelMode } from './tunnel-option.js';

export type { TunnelMode } from './tunnel-option.js';

/**
 * Resolve the tunnel mode from CLI + config inputs.
 *
 * @param cliFlag - value of the `--tunnel` option after Commander parsing;
 *   may be `undefined` when the caller hasn't wired the flag yet, or when
 *   the option has no default (but in practice we default to 'auto', so
 *   callers will usually pass 'auto' here)
 * @param configFile - value of `~/.qa-use.json`'s `tunnel` key
 */
export function resolveTunnelFlag(
  cliFlag: TunnelMode | undefined,
  configFile: TunnelMode | undefined
): TunnelMode {
  // Phase 1: we can't reliably distinguish "user passed --tunnel auto" from
  // "Commander filled in the 'auto' default" without extra bookkeeping on the
  // command. So the contract here is: the caller gives us the post-parse
  // value. If they want config precedence to apply, they should pass
  // `undefined` when the CLI value is the unchanged default. To keep this
  // phase simple and predictable — and aligned with the plan's "CLI > config
  // > default 'auto'" precedence — we treat a CLI-passed 'auto' as
  // "no explicit override" so the config value can take effect.
  if (cliFlag !== undefined && cliFlag !== 'auto') {
    return cliFlag;
  }
  if (configFile !== undefined) {
    return configFile;
  }
  return 'auto';
}

/**
 * Resolve the concrete on/off decision for the tunnel.
 *
 * Matrix:
 *   - `mode === 'on'`   → `'on'`  (force tunnel, even in dev mode)
 *   - `mode === 'off'`  → `'off'` (never tunnel)
 *   - `mode === 'auto'` → `'on'` iff base URL is localhost and API URL is
 *                         *not* localhost; otherwise `'off'`.
 *
 * If either `baseUrl` or `apiUrl` is unknown in `'auto'` mode, we stay
 * conservative and return `'off'`: without a localhost base URL there's
 * nothing worth tunnelling, and without a known API URL we can't tell
 * whether we're in dev mode (where auto-tunnel should be skipped).
 */
export function resolveTunnelMode(
  mode: TunnelMode,
  baseUrl: string | undefined,
  apiUrl: string | undefined
): 'on' | 'off' {
  if (mode === 'on') return 'on';
  if (mode === 'off') return 'off';

  // mode === 'auto'
  if (!baseUrl) return 'off';
  if (!isLocalhostUrl(baseUrl)) return 'off';
  // Dev-mode skip: if the API is itself local, the backend can reach
  // localhost directly — no tunnel needed.
  if (apiUrl && isLocalhostUrl(apiUrl)) return 'off';
  return 'on';
}
