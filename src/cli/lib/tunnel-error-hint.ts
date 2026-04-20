/**
 * Triage-hint formatter for structured tunnel errors.
 *
 * The brainstorm defines the user-facing copy:
 *   × Auto-tunnel failed for <target>
 *     Attempted: start tunnel via <provider>
 *     Likely cause: <subclass-specific>
 *     Next steps:
 *       • Retry: ...
 *       • Skip tunnel: --no-tunnel ...
 *       • Check tunnel status: `qa-use tunnel status`
 *
 * Each tunnel-error subclass picks its own "likely cause" line.
 */

import {
  TunnelAuthError,
  type TunnelError,
  TunnelNetworkError,
  TunnelQuotaError,
} from '../../../lib/tunnel/errors.js';

function likelyCause(err: TunnelError): string {
  if (err instanceof TunnelNetworkError) {
    return 'network timeout or connectivity issue reaching the tunnel provider';
  }
  if (err instanceof TunnelAuthError) {
    return 'authentication rejected (bad or expired API key)';
  }
  if (err instanceof TunnelQuotaError) {
    return 'tunnel quota / rate-limit exceeded, or subdomain already in use';
  }
  return 'unknown failure from the tunnel provider';
}

/**
 * Return a multi-line string ready to print to stderr.
 */
export function formatTunnelFailure(err: TunnelError): string {
  const target = err.target ?? '<unknown target>';
  const provider = err.provider ?? 'localtunnel';

  const lines: string[] = [
    `× Auto-tunnel failed for ${target}`,
    `  Attempted: start tunnel via ${provider}`,
    `  Likely cause: ${likelyCause(err)}`,
  ];
  if (err.message) {
    lines.push(`  Error: ${err.message}`);
  }
  lines.push('  Next steps:');
  lines.push('    • Retry: the failure may be transient');
  lines.push(
    '    • Skip tunnel: rerun with --no-tunnel (only works if the backend can reach your target)'
  );
  lines.push('    • Check tunnel status: `qa-use tunnel status`');

  return lines.join('\n');
}
