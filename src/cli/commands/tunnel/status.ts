/**
 * qa-use tunnel status - Show detail for a single tunnel entry.
 *
 * Accepts either a target URL or a hash ID (as reported by `tunnel ls`).
 */

import { Command } from 'commander';
import { type TunnelRecord, tunnelRegistry } from '../../../../lib/tunnel/registry.js';
import { error, formatError } from '../../lib/output.js';

const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
};

function printField(label: string, value: string): void {
  console.log(`  ${colors.gray}${label.padEnd(14)}${colors.reset} ${value}`);
}

function resolve(identifier: string): TunnelRecord | null {
  // Accept bare hash (10 hex chars).
  if (/^[a-f0-9]{10}$/i.test(identifier)) {
    return tunnelRegistry.getByHash(identifier.toLowerCase());
  }
  return tunnelRegistry.get(identifier);
}

export const statusCommand = new Command('status')
  .description('Show detail for a single tunnel entry (by target URL or hash ID)')
  .argument('<target-or-hash>', 'Target URL (e.g. http://localhost:3000) or tunnel hash ID')
  .option('--json', 'Output as JSON')
  .action(async (identifier: string, options: { json?: boolean }) => {
    try {
      const record = resolve(identifier);

      if (!record) {
        if (options.json) {
          console.log('null');
        } else {
          console.log(error(`No active tunnel for ${identifier}`));
        }
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(record, null, 2));
        return;
      }

      console.log(`${colors.cyan}Tunnel${colors.reset}\n`);
      printField('ID', record.id);
      printField('Target', record.target);
      printField('Public URL', record.publicUrl);
      printField('PID', String(record.pid));
      printField('Refcount', String(record.refcount));
      printField('Started', new Date(record.startedAt).toISOString());
      printField(
        'TTL Expires',
        record.ttlExpiresAt ? new Date(record.ttlExpiresAt).toISOString() : '-'
      );
    } catch (err) {
      console.log(error(`Failed to fetch tunnel: ${formatError(err)}`));
      process.exit(1);
    }
  });
