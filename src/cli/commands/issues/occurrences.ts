/**
 * qa-use issues occurrences - List occurrences for an issue
 */

import { Command } from 'commander';
import { apiCall, paginationQuery, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, warning } from '../../lib/output.js';
import { type Column, formatTimestamp, printTable, truncate } from '../../lib/table.js';

export const occurrencesCommand = new Command('occurrences')
  .description('List occurrences for an issue')
  .argument('<id>', 'Issue ID (UUID)')
  .option('--limit <n>', 'Limit results (default: 20)', '20')
  .option('--offset <n>', 'Skip N results', '0')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const query = paginationQuery(options);

      const occurrences = (await apiCall(config, 'GET', `/api/v1/issues/${id}/occurrences`, {
        query,
      })) as Array<Record<string, unknown>>;

      const columns: Column[] = [
        { key: 'id', header: 'OCCURRENCE_ID', width: 36 },
        { key: 'test_run_id', header: 'TEST_RUN_ID', width: 36 },
        {
          key: 'timestamp',
          header: 'TIMESTAMP',
          width: 19,
          format: (v) => formatTimestamp(String(v ?? '')),
        },
        {
          key: 'error_message',
          header: 'ERROR_MESSAGE',
          width: 40,
          format: (v) => truncate(String(v ?? '-'), 40),
        },
      ];

      const limit = Number.parseInt(options.limit, 10);
      const offset = Number.parseInt(options.offset, 10);

      printTable(columns, occurrences, {
        json: options.json,
        title: `Occurrences (${occurrences.length} result${occurrences.length === 1 ? '' : 's'})`,
        emptyMessage: warning('No occurrences found'),
        limit,
        offset,
      });
    } catch (err) {
      console.log(error(`Failed to list occurrences: ${formatError(err)}`));
      process.exit(1);
    }
  });
