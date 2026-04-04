/**
 * qa-use test list - List test definitions
 */

import * as path from 'node:path';
import { Command } from 'commander';
import { apiCall, paginationQuery, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { discoverTests, loadTestDefinition } from '../../lib/loader.js';
import { error, formatError } from '../../lib/output.js';
import {
  type Column,
  formatStatus,
  formatTimestamp,
  printTable,
  truncate,
} from '../../lib/table.js';

const cloudColumns: Column[] = [
  { key: 'id', header: 'ID', width: 10, format: (v) => truncate(String(v ?? '-'), 10) },
  { key: 'name', header: 'NAME' },
  { key: 'status', header: 'STATUS', format: (v) => formatStatus(String(v ?? '-')) },
  {
    key: 'tags',
    header: 'TAGS',
    format: (v) => (Array.isArray(v) && v.length > 0 ? v.join(', ') : '-'),
  },
  { key: 'updated_at', header: 'UPDATED', format: (v) => formatTimestamp(String(v ?? '')) },
];

const localColumns: Column[] = [
  { key: 'name', header: 'NAME' },
  { key: 'steps', header: 'STEPS', width: 5 },
  { key: 'deps', header: 'DEPS' },
  {
    key: 'tags',
    header: 'TAGS',
    format: (v) => (Array.isArray(v) && v.length > 0 ? v.join(', ') : '-'),
  },
];

export const listCommand = new Command('list')
  .description('List test definitions')
  .option('--cloud', 'List tests from cloud instead of local files')
  .option('--limit <number>', 'Maximum number of tests to list', '20')
  .option('--offset <number>', 'Offset for cloud pagination', '0')
  .option('--json', 'Output raw JSON')
  .action(async (options) => {
    try {
      const config = await loadConfig();
      const limit = Number.parseInt(options.limit, 10);
      const offset = Number.parseInt(options.offset, 10);

      if (options.cloud) {
        // Cloud mode
        requireApiKey(config);

        let rows: Record<string, unknown>[] = [];

        try {
          // Prefer /api/v1/tests for richer data
          const data = (await apiCall(config, 'GET', '/api/v1/tests', {
            query: paginationQuery({ limit: options.limit, offset: options.offset }),
          })) as Record<string, unknown>[] | { items: Record<string, unknown>[] };

          rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        } catch {
          // Fallback to legacy client
          const { createApiClient } = await import('../../lib/config.js');
          const client = createApiClient(config);
          const tests = await client.listTests({ limit });
          rows = tests.map((t) => ({
            id: t.id,
            name: t.name,
            status: undefined,
            tags: undefined,
            updated_at: undefined,
            dependency_test_ids: t.dependency_test_ids,
          }));
        }

        if (options.json) {
          console.log(JSON.stringify(rows, null, 2));
          return;
        }

        printTable(cloudColumns, rows, {
          title: 'Cloud Tests',
          emptyMessage: 'No tests found in cloud',
          limit,
          offset,
        });
      } else {
        // Local mode
        const testDir = config.test_directory || './qa-tests';
        const files = await discoverTests(testDir);

        if (files.length === 0) {
          if (options.json) {
            console.log('[]');
            return;
          }
          console.log(error(`No tests found in ${testDir}`));
          console.log('  Run `qa-use test init` to create example tests');
          return;
        }

        const rows: Record<string, unknown>[] = [];
        const resolvedTestDir = path.resolve(testDir);
        for (const file of files) {
          try {
            const def = await loadTestDefinition(file);
            const relativePath = path
              .relative(resolvedTestDir, file)
              .replace(/\.(yaml|yml|json)$/, '');
            rows.push({
              name: relativePath,
              steps: def.steps?.length ?? '-',
              deps: def.depends_on || '-',
              tags: def.tags,
            });
          } catch (err) {
            console.log(error(`Failed to load ${file}: ${formatError(err)}`));
          }
        }

        if (options.json) {
          console.log(JSON.stringify(rows, null, 2));
          return;
        }

        printTable(localColumns, rows, {
          title: 'Local Tests',
          emptyMessage: `No tests found in ${testDir}`,
        });
      }
    } catch (err) {
      console.log(error(`Failed to list tests: ${formatError(err)}`));
      process.exit(1);
    }
  });
