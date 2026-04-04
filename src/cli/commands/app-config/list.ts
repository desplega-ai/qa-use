/**
 * qa-use app-config list - List app configurations
 */

import { Command } from 'commander';
import { apiCall, paginationQuery, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, warning } from '../../lib/output.js';
import { type Column, formatTimestamp, printTable, truncate } from '../../lib/table.js';

export const listCommand = new Command('list')
  .description('List app configurations')
  .option('--limit <n>', 'Limit results (default: 20)', '20')
  .option('--offset <n>', 'Skip N results', '0')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const query = paginationQuery(options);

      const configs = (await apiCall(config, 'GET', '/api/v1/app-configs', {
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
          key: 'app_url',
          header: 'APP_URL',
          width: 40,
          format: (v) => truncate(String(v ?? '-'), 40),
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

      printTable(columns, configs, {
        json: options.json,
        title: `App Configurations (${configs.length} result${configs.length === 1 ? '' : 's'})`,
        emptyMessage: warning('No app configurations found'),
        limit,
        offset,
      });
    } catch (err) {
      console.log(error(`Failed to list app configurations: ${formatError(err)}`));
      process.exit(1);
    }
  });
