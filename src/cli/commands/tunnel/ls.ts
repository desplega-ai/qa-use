/**
 * qa-use tunnel ls - List active tunnels in the registry.
 *
 * Scans `~/.qa-use/tunnels/*.json`, reconciles against owning PID, and
 * renders a table (or JSON) with target, public URL, refcount, TTL
 * remaining.
 */

import { Command } from 'commander';
import { type TunnelRecord, tunnelRegistry } from '../../../../lib/tunnel/registry.js';
import { error, formatError, warning } from '../../lib/output.js';
import { type Column, printTable, truncate } from '../../lib/table.js';

function formatTtl(record: TunnelRecord): string {
  if (record.ttlExpiresAt === null || record.ttlExpiresAt === undefined) {
    return '-';
  }
  const remaining = record.ttlExpiresAt - Date.now();
  if (remaining <= 0) return 'expiring';
  if (remaining < 1000) return '<1s';
  const seconds = Math.ceil(remaining / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.ceil(seconds / 60)}m`;
}

function formatAge(record: TunnelRecord): string {
  const age = Math.max(0, Date.now() - record.startedAt);
  const seconds = Math.floor(age / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

export const lsCommand = new Command('ls')
  .description('List active tunnels in the registry')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    try {
      const records = tunnelRegistry.list();

      if (options.json) {
        console.log(JSON.stringify(records, null, 2));
        return;
      }

      const columns: Column[] = [
        { key: 'id', header: 'ID', width: 10 },
        {
          key: 'target',
          header: 'TARGET',
          width: 30,
          format: (v) => truncate(String(v ?? '-'), 30),
        },
        {
          key: 'publicUrl',
          header: 'PUBLIC URL',
          width: 40,
          format: (v) => truncate(String(v ?? '-'), 40),
        },
        {
          key: 'refcount',
          header: 'REF',
          width: 4,
          format: (v) => String(v ?? 0),
        },
        { key: 'pid', header: 'PID', width: 7 },
        {
          key: 'age',
          header: 'AGE',
          width: 5,
          format: (_v, row) => formatAge(row as unknown as TunnelRecord),
        },
        {
          key: 'ttl',
          header: 'TTL',
          width: 8,
          format: (_v, row) => formatTtl(row as unknown as TunnelRecord),
        },
      ];

      printTable(columns, records as unknown as Array<Record<string, unknown>>, {
        title: `Active Tunnels (${records.length} entr${records.length === 1 ? 'y' : 'ies'})`,
        emptyMessage: warning('No active tunnels'),
      });
    } catch (err) {
      console.log(error(`Failed to list tunnels: ${formatError(err)}`));
      process.exit(1);
    }
  });
