/**
 * qa-use test runs list - List test run history
 */

import { Command } from 'commander';
import { apiCall, paginationQuery, requireApiKey } from '../../../lib/api-helpers.js';
import { loadConfig } from '../../../lib/config.js';
import { error, formatError, warning } from '../../../lib/output.js';
import {
  type Column,
  formatDuration,
  formatStatus,
  formatTimestamp,
  printTable,
  truncate,
} from '../../../lib/table.js';

export const listCommand = new Command('list')
  .description('List test run history')
  .argument('[test-name]', 'Filter by test name (optional)')
  .option('--id <uuid>', 'Filter by test ID')
  .option(
    '--status <status>',
    'Filter by run status (pending, running, passed, failed, cancelled, timeout)'
  )
  .option('--limit <n>', 'Limit results (default: 20)', '20')
  .option('--offset <n>', 'Skip N results', '0')
  .option('--json', 'Output as JSON')
  .action(async (testName, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      // Resolve test name to ID if provided
      let testId = options.id;
      let testDisplayName: string | undefined;

      if (testName && !testId) {
        // Search for test by name via API
        const testsData = (await apiCall(config, 'GET', '/api/v1/tests', {
          query: { query: testName, limit: '10' },
        })) as Array<{ id: string; name: string }>;

        const exactMatch = testsData.find((t) => t.name === testName);
        const partialMatches = testsData.filter((t) =>
          t.name.toLowerCase().includes(testName.toLowerCase())
        );

        if (exactMatch) {
          testId = exactMatch.id;
          testDisplayName = exactMatch.name;
        } else if (partialMatches.length === 1) {
          testId = partialMatches[0].id;
          testDisplayName = partialMatches[0].name;
        } else if (partialMatches.length > 1) {
          console.log(error(`Multiple tests match "${testName}":`));
          for (const t of partialMatches.slice(0, 5)) {
            console.log(`  • ${t.name} (${t.id})`);
          }
          console.log('\nUse --id <uuid> to specify exactly.');
          process.exit(1);
        } else {
          console.log(error(`No test found matching "${testName}"`));
          process.exit(1);
        }
      }

      // Build query params
      const query: Record<string, string> = {
        ...paginationQuery(options),
      };
      if (testId) query.test_id = testId;
      if (options.status) query.run_status = options.status;

      // Fetch test runs
      const runs = (await apiCall(config, 'GET', '/api/v1/test-runs', { query })) as Array<
        Record<string, unknown>
      >;

      // Define columns
      const columns: Column[] = [
        { key: 'id', header: 'ID', width: 36 },
        { key: 'test_id', header: 'TEST ID', width: 36 },
        {
          key: 'run_status',
          header: 'STATUS',
          width: 11,
          format: (v) => formatStatus(String(v ?? '-')),
        },
        {
          key: 'duration_seconds',
          header: 'DURATION',
          width: 10,
          format: (v) => formatDuration(v as number | undefined),
        },
        {
          key: 'created_at',
          header: 'CREATED',
          width: 19,
          format: (v) => formatTimestamp(String(v ?? '')),
        },
      ];

      // If responses include test_name, show it instead of test_id
      if (runs.length > 0 && runs[0].test_name) {
        columns[1] = {
          key: 'test_name',
          header: 'TEST',
          width: 30,
          format: (v) => truncate(String(v ?? '-'), 30),
        };
      }

      // Title
      const limit = Number.parseInt(options.limit, 10);
      const offset = Number.parseInt(options.offset, 10);
      let title: string;
      if (testDisplayName) {
        title = `Test Runs for: ${testDisplayName} (${runs.length} run${runs.length === 1 ? '' : 's'})`;
      } else {
        title = `Test Runs (${runs.length} result${runs.length === 1 ? '' : 's'})`;
      }

      // Empty message
      let emptyMessage: string;
      if (testId) {
        emptyMessage = warning(
          `No runs found for test${testDisplayName ? ` "${testDisplayName}"` : ''}`
        );
      } else if (options.status) {
        emptyMessage = warning(`No runs found with status "${options.status}"`);
      } else {
        emptyMessage = warning('No test runs found');
      }

      printTable(columns, runs, {
        json: options.json,
        title,
        emptyMessage,
        limit,
        offset,
      });
    } catch (err) {
      console.log(error(`Failed to list test runs: ${formatError(err)}`));
      process.exit(1);
    }
  });
