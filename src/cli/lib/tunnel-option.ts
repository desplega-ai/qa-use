/**
 * Tri-state `--tunnel` option helper for Commander commands.
 *
 * Shape:
 *   --tunnel <auto|on|off>   (default: auto)
 *   --no-tunnel              (alias for --tunnel off)
 *
 * Invalid values are rejected at parse time with a clear error.
 */

import { type Command, InvalidArgumentError, Option } from 'commander';

export type TunnelMode = 'auto' | 'on' | 'off';

const VALID_MODES: readonly TunnelMode[] = ['auto', 'on', 'off'] as const;

/**
 * Parser for --tunnel <mode>. Accepts only 'auto' | 'on' | 'off'.
 * Handles the special Commander behaviour where `--no-tunnel` passes the
 * boolean `false` through here.
 */
function parseTunnelMode(value: unknown): TunnelMode {
  // `--no-tunnel` arrives here as the boolean `false` (Commander's
  // --no-<flag> negation semantics). Map it to 'off'.
  if (value === false) {
    return 'off';
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
 * Also registers `--no-tunnel` as an alias that resolves to `'off'`.
 */
export function addTunnelOption(command: Command): Command {
  const option = new Option(
    '--tunnel <mode>',
    'Tunnel mode: auto (localhost-only), on (force), off (never)'
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
    }
  });

  return command;
}
