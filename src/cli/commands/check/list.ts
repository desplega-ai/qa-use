/**
 * qa-use check list - List remote API checks
 */

import { Command } from 'commander';
import { apiCall, paginationQuery, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, warning } from '../../lib/output.js';
import {
  type Column,
  formatStatus,
  formatTimestamp,
  printTable,
  truncate,
} from '../../lib/table.js';

export interface CheckListOptions {
  appConfig?: string;
  q?: string;
  limit?: string;
  offset?: string;
  json?: boolean;
}

export function buildCheckListQuery(options: CheckListOptions): Record<string, string> {
  const query = paginationQuery(options);
  if (options.appConfig) query.app_config_id = options.appConfig;
  if (options.q) query.q = options.q;
  return query;
}

export function createCheckListColumns(): Column[] {
  return [
    { key: 'id', header: 'ID', width: 36 },
    {
      key: 'name',
      header: 'NAME',
      width: 30,
      format: (v) => truncate(String(v ?? '-'), 30),
    },
    {
      key: 'check_type',
      header: 'TYPE',
      width: 12,
      format: (v) => String(v ?? '-'),
    },
    {
      key: 'app_config_id',
      header: 'APP_CONFIG',
      width: 36,
      format: (v) => String(v ?? '-'),
    },
    {
      key: 'status',
      header: 'STATUS',
      width: 11,
      format: (v, row) => formatStatus(String(v ?? row.run_status ?? '-')),
    },
    {
      key: 'updated_at',
      header: 'UPDATED',
      width: 19,
      format: (v, row) => formatTimestamp(String(v ?? row.created_at ?? '')),
    },
  ];
}

export const listCommand = new Command('list')
  .description('List remote API checks')
  .option('--app-config <id>', 'Filter by app_config_id')
  .option('--q <query>', 'Search checks')
  .option('--limit <n>', 'Limit results (default: 20)', '20')
  .option('--offset <n>', 'Skip N results', '0')
  .option('--json', 'Output as JSON')
  .action(async (options: CheckListOptions) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const checks = (await apiCall(config, 'GET', '/api/v1/checks', {
        query: buildCheckListQuery(options),
      })) as Array<Record<string, unknown>>;

      const limit = Number.parseInt(options.limit ?? '20', 10);
      const offset = Number.parseInt(options.offset ?? '0', 10);

      printTable(createCheckListColumns(), checks, {
        json: options.json,
        title: `Checks (${checks.length} result${checks.length === 1 ? '' : 's'})`,
        emptyMessage: warning('No checks found'),
        limit,
        offset,
      });
    } catch (err) {
      console.log(error(`Failed to list checks: ${formatError(err)}`));
      process.exit(1);
    }
  });
