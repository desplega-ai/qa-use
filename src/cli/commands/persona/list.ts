/**
 * qa-use persona list - List personas
 */

import { Command } from 'commander';
import { apiCall, paginationQuery, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, warning } from '../../lib/output.js';
import { type Column, formatTimestamp, printTable, truncate } from '../../lib/table.js';

export const listCommand = new Command('list')
  .description('List personas')
  .option('--limit <n>', 'Limit results (default: 20)', '20')
  .option('--offset <n>', 'Skip N results', '0')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const query = paginationQuery(options);

      const personas = (await apiCall(config, 'GET', '/api/v1/personas', {
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
          key: 'description',
          header: 'DESCRIPTION',
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

      printTable(columns, personas, {
        json: options.json,
        title: `Personas (${personas.length} result${personas.length === 1 ? '' : 's'})`,
        emptyMessage: warning('No personas found'),
        limit,
        offset,
      });
    } catch (err) {
      console.log(error(`Failed to list personas: ${formatError(err)}`));
      process.exit(1);
    }
  });
