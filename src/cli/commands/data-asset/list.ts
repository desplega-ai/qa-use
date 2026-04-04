/**
 * qa-use data-asset list - List data assets
 */

import { Command } from 'commander';
import { apiCall, paginationQuery, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, warning } from '../../lib/output.js';
import { type Column, formatTimestamp, printTable, truncate } from '../../lib/table.js';

function formatSize(bytes: unknown): string {
  const n = Number(bytes);
  if (Number.isNaN(n) || n < 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export const listCommand = new Command('list')
  .description('List data assets')
  .option('--limit <n>', 'Limit results (default: 20)', '20')
  .option('--offset <n>', 'Skip N results', '0')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const query = paginationQuery(options);

      const assets = (await apiCall(config, 'GET', '/api/v1/data-assets', {
        query,
      })) as Array<Record<string, unknown>>;

      const columns: Column[] = [
        { key: 'id', header: 'ID', width: 36 },
        {
          key: 'name',
          header: 'NAME',
          width: 30,
          format: (v) => truncate(String(v ?? '-'), 30),
        },
        {
          key: 'type',
          header: 'TYPE',
          width: 15,
          format: (v) => String(v ?? '-'),
        },
        {
          key: 'size',
          header: 'SIZE',
          width: 12,
          format: (v) => formatSize(v),
        },
        {
          key: 'created_at',
          header: 'CREATED',
          width: 19,
          format: (v) => formatTimestamp(String(v ?? '')),
        },
      ];

      const limit = Number.parseInt(options.limit, 10);
      const offset = Number.parseInt(options.offset, 10);

      printTable(columns, assets, {
        json: options.json,
        title: `Data Assets (${assets.length} result${assets.length === 1 ? '' : 's'})`,
        emptyMessage: warning('No data assets found'),
        limit,
        offset,
      });
    } catch (err) {
      console.log(error(`Failed to list data assets: ${formatError(err)}`));
      process.exit(1);
    }
  });
