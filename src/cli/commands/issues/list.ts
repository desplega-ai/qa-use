/**
 * qa-use issues list - List issues
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

export const listCommand = new Command('list')
  .description('List issues')
  .option('--limit <n>', 'Limit results (default: 20)', '20')
  .option('--offset <n>', 'Skip N results', '0')
  .option('--json', 'Output as JSON')
  .option('--status <status>', 'Filter by status')
  .action(async (options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const query = paginationQuery(options);
      if (options.status) {
        query.status = options.status;
      }

      const issues = (await apiCall(config, 'GET', '/api/v1/issues', {
        query,
      })) as Array<Record<string, unknown>>;

      const columns: Column[] = [
        { key: 'id', header: 'ID', width: 36 },
        {
          key: 'title',
          header: 'TITLE/DESCRIPTION',
          width: 40,
          format: (v, row) => {
            const title = String(v ?? row.description ?? '-');
            return truncate(title, 40);
          },
        },
        {
          key: 'status',
          header: 'STATUS',
          width: 9,
          format: (v) => formatStatus(String(v ?? '-')),
        },
        {
          key: 'occurrence_count',
          header: 'OCCURRENCES',
          width: 11,
          format: (v) => String(v ?? '-'),
        },
        {
          key: 'last_seen',
          header: 'LAST_SEEN',
          width: 19,
          format: (v) => formatTimestamp(String(v ?? '')),
        },
      ];

      const limit = Number.parseInt(options.limit, 10);
      const offset = Number.parseInt(options.offset, 10);

      printTable(columns, issues, {
        json: options.json,
        title: `Issues (${issues.length} result${issues.length === 1 ? '' : 's'})`,
        emptyMessage: warning('No issues found'),
        limit,
        offset,
      });
    } catch (err) {
      console.log(error(`Failed to list issues: ${formatError(err)}`));
      process.exit(1);
    }
  });
