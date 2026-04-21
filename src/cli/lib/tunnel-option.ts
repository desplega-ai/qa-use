/**
 * Tri-state `--tunnel` option helper for Commander commands.
 *
 * Shape:
 *   --tunnel [auto|on|off]   (default: auto; bare --tunnel = on)
 *   --no-tunnel              (alias for --tunnel off)
 *
 * Invalid values are rejected at parse time with a clear error.
 *
 * Bare `--tunnel` (no value) is preserved as sugar for `--tunnel on`, which
 * matches the pre-tri-state UX. Commander represents the bare form by passing
 * the literal string `"true"` (or `undefined` depending on argv shape) through
 * to the parser, so we map both to `'on'`.
 */

import { type Command, InvalidArgumentError, Option } from 'commander';

export type TunnelMode = 'auto' | 'on' | 'off';

const VALID_MODES: readonly TunnelMode[] = ['auto', 'on', 'off'] as const;

/**
 * Parser for --tunnel [mode]. Accepts 'auto' | 'on' | 'off'.
 * - Bare `--tunnel` (no value) → 'on' (backward-compat sugar).
 * - `--no-tunnel` (boolean `false`) → 'off'.
 * - Invalid strings are rejected.
 */
function parseTunnelMode(value: unknown): TunnelMode {
  // `--no-tunnel` arrives here as the boolean `false` (Commander's
  // --no-<flag> negation semantics). Map it to 'off'.
  if (value === false) {
    return 'off';
  }

  // Bare `--tunnel` (no value). With the `[mode]` optional-arg form,
  // Commander substitutes the literal string `"true"` as a placeholder
  // when the flag is present without an explicit value. Treat that and
  // `undefined` as the backward-compat sugar → 'on'.
  if (value === undefined || value === true || value === 'true') {
    return 'on';
  }

  if (typeof value !== 'string') {
    throw new InvalidArgumentError(
      `Invalid --tunnel value. Expected one of: ${VALID_MODES.join(', ')}.`
    );
  }

  const normalized = value.toLowerCase() as TunnelMode;
  if (!VALID_MODES.includes(normalized)) {
    throw new InvalidArgumentError(
      `Invalid --tunnel value: "${value}". Expected one of: ${VALID_MODES.join(', ')}.`
    );
  }
  return normalized;
}

/**
 * Attach the tri-state `--tunnel` option to a Commander command.
 *
 * The option is stored under the property name `tunnel` on the options
 * object. Callers can read it as a `TunnelMode`.
 *
 * Also registers `--no-tunnel` as an alias that resolves to `'off'`, and
 * accepts bare `--tunnel` (no value) as sugar for `--tunnel on`.
 */
export function addTunnelOption(command: Command): Command {
  const option = new Option(
    '--tunnel [mode]',
    'Tunnel mode: auto (localhost-only), on (force, default when flag present without value), off (never)'
  )
    .default('auto' as TunnelMode)
    .argParser(parseTunnelMode);

  command.addOption(option);

  // `--no-tunnel` as an alias for `--tunnel off`. Commander treats this as a
  // separate boolean option that, when present, sets the `tunnel` property to
  // `false`. Normalise that to `'off'` in a preAction hook so downstream
  // consumers only ever see a `TunnelMode` string.
  command.option('--no-tunnel', 'Disable tunnel (alias for --tunnel off)');

  command.hook('preAction', (cmd) => {
    const opts = cmd.opts();
    if (opts.tunnel === false) {
      cmd.setOptionValue('tunnel', 'off');
    } else if (opts.tunnel === true || opts.tunnel === 'true') {
      // Bare `--tunnel` with no argParser invocation path (belt-and-braces):
      // some Commander versions skip argParser when the optional arg is absent.
      cmd.setOptionValue('tunnel', 'on');
    }
  });

  return command;
}
