/**
 * qa-use check-schedule list - List remote check schedules
 */

import { Command } from 'commander';
import { apiCall, paginationQuery, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, warning } from '../../lib/output.js';
import { type Column, formatTimestamp, printTable, truncate } from '../../lib/table.js';

export interface CheckScheduleListOptions {
  appConfig?: string;
  q?: string;
  limit?: string;
  offset?: string;
  json?: boolean;
}

export function buildCheckScheduleListQuery(
  options: CheckScheduleListOptions
): Record<string, string> {
  const query = paginationQuery(options);
  if (options.appConfig) query.app_config_id = options.appConfig;
  if (options.q) query.q = options.q;
  return query;
}

function countValues(value: unknown): string {
  return Array.isArray(value) ? String(value.length) : '-';
}

export function createCheckScheduleListColumns(): Column[] {
  return [
    { key: 'id', header: 'ID', width: 36 },
    {
      key: 'name',
      header: 'NAME',
      width: 30,
      format: (v) => truncate(String(v ?? '-'), 30),
    },
    {
      key: 'app_config_id',
      header: 'APP_CONFIG',
      width: 36,
      format: (v) => String(v ?? '-'),
    },
    {
      key: 'cron_expression',
      header: 'CRON',
      width: 20,
      format: (v) => truncate(String(v ?? '-'), 20),
    },
    {
      key: 'timezone',
      header: 'TZ',
      width: 16,
      format: (v) => String(v ?? 'UTC'),
    },
    {
      key: 'enabled',
      header: 'ENABLED',
      width: 7,
      format: (v) => (v === undefined || v === null ? '-' : String(v)),
    },
    {
      key: 'check_ids',
      header: 'CHECKS',
      width: 6,
      format: (v) => countValues(v),
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
  .description('List remote check schedules')
  .option('--app-config <id>', 'Filter by app_config_id')
  .option('--q <query>', 'Search check schedules')
  .option('--limit <n>', 'Limit results (default: 20)', '20')
  .option('--offset <n>', 'Skip N results', '0')
  .option('--json', 'Output as JSON')
  .action(async (options: CheckScheduleListOptions) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const schedules = (await apiCall(config, 'GET', '/api/v1/check-schedules', {
        query: buildCheckScheduleListQuery(options),
      })) as Array<Record<string, unknown>>;

      const limit = Number.parseInt(options.limit ?? '20', 10);
      const offset = Number.parseInt(options.offset ?? '0', 10);

      printTable(createCheckScheduleListColumns(), schedules, {
        json: options.json,
        title: `Check Schedules (${schedules.length} result${schedules.length === 1 ? '' : 's'})`,
        emptyMessage: warning('No check schedules found'),
        limit,
        offset,
      });
    } catch (err) {
      console.log(error(`Failed to list check schedules: ${formatError(err)}`));
      process.exit(1);
    }
  });
