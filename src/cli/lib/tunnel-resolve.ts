/**
 * Resolve the effective tunnel mode from CLI flag + config file.
 *
 * Precedence:
 *   1. CLI flag (if the user explicitly passed --tunnel / --no-tunnel)
 *   2. Config file (`tunnel` key in ~/.qa-use.json)
 *   3. Default: 'auto'
 *
 * Phase 1 note: this module only resolves the *mode*. The actual
 * on/off decision (auto-inference based on base URL + API URL) lands
 * in Phase 2. For now the caller still treats `'auto'` like the old
 * "no tunnel unless explicitly asked" behaviour.
 */

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
