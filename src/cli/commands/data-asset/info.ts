/**
 * qa-use data-asset info - Show detailed data asset information
 */

import { Command } from 'commander';
import { apiCall, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError } from '../../lib/output.js';
import { formatTimestamp } from '../../lib/table.js';

const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
};

function printField(label: string, value: string | undefined | null): void {
  const display = value ?? '-';
  console.log(`  ${colors.gray}${label.padEnd(18)}${colors.reset} ${display}`);
}

function formatSize(bytes: unknown): string {
  const n = Number(bytes);
  if (Number.isNaN(n) || n < 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export const infoCommand = new Command('info')
  .description('Show detailed data asset information')
  .argument('<id>', 'Data asset ID (UUID)')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const asset = (await apiCall(config, 'GET', `/api/v1/data-assets/${id}`)) as Record<
        string,
        unknown
      >;

      if (options.json) {
        console.log(JSON.stringify(asset, null, 2));
        return;
      }

      console.log(`${colors.cyan}Data Asset Details${colors.reset}\n`);

      printField('ID', String(asset.id ?? '-'));
      printField('Name', String(asset.name ?? '-'));
      printField('Type', String(asset.type ?? '-'));
      printField('Size', formatSize(asset.size));
      printField('Created', formatTimestamp(String(asset.created_at ?? '')));
      printField('Updated', formatTimestamp(String(asset.updated_at ?? '')));

      if (asset.download_url) {
        printField('Download URL', String(asset.download_url));
      }

      // Print any additional top-level fields that aren't already shown
      const knownKeys = new Set([
        'id',
        'name',
        'type',
        'size',
        'created_at',
        'updated_at',
        'download_url',
      ]);
      for (const [key, value] of Object.entries(asset)) {
        if (knownKeys.has(key) || value === undefined || value === null) continue;
        const display = typeof value === 'object' ? JSON.stringify(value) : String(value);
        printField(key, display);
      }
    } catch (err) {
      console.log(error(`Failed to fetch data asset: ${formatError(err)}`));
      process.exit(1);
    }
  });
