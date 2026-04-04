/**
 * qa-use usage - View usage statistics
 */

import { Command } from 'commander';
import { apiCall, paginationQuery, requireApiKey } from '../lib/api-helpers.js';
import { loadConfig } from '../lib/config.js';
import { error, formatError } from '../lib/output.js';
import { type Column, formatDuration, printTable } from '../lib/table.js';

const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
};

function printField(label: string, value: string | undefined | null): void {
  const display = value ?? '-';
  console.log(`  ${colors.gray}${label.padEnd(18)}${colors.reset} ${display}`);
}

export const usageCommand = new Command('usage')
  .description('View usage statistics')
  .option('--json', 'Output as JSON')
  .option('--detailed', 'Show detailed usage lines')
  .option('--limit <n>', 'Limit results (default: 20)', '20')
  .option('--offset <n>', 'Skip N results', '0')
  .action(async (options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      if (options.detailed) {
        // Detailed mode: GET /api/v1/usage/lines
        const query = paginationQuery(options);

        const lines = (await apiCall(config, 'GET', '/api/v1/usage/lines', {
          query,
        })) as Array<Record<string, unknown>>;

        const columns: Column[] = [
          { key: 'date', header: 'DATE', width: 12 },
          {
            key: 'runs',
            header: 'RUNS',
            width: 6,
            format: (v) => String(v ?? '-'),
          },
          {
            key: 'passed',
            header: 'PASSED',
            width: 8,
            format: (v) =>
              v !== undefined && v !== null ? `${colors.green}${v}${colors.reset}` : '-',
          },
          {
            key: 'failed',
            header: 'FAILED',
            width: 8,
            format: (v) =>
              v !== undefined && v !== null ? `${colors.red}${v}${colors.reset}` : '-',
          },
          {
            key: 'duration',
            header: 'DURATION',
            width: 10,
            format: (v) => formatDuration(v as number | undefined),
          },
          {
            key: 'cost',
            header: 'COST',
            width: 10,
            format: (v) => (v !== undefined && v !== null ? String(v) : '-'),
          },
        ];

        const limit = Number.parseInt(options.limit, 10);
        const offset = Number.parseInt(options.offset, 10);

        printTable(columns, lines, {
          json: options.json,
          title: `Usage Details (${lines.length} result${lines.length === 1 ? '' : 's'})`,
          emptyMessage: `${colors.gray}No usage data found${colors.reset}`,
          limit,
          offset,
        });
      } else {
        // Summary mode: GET /api/v1/usage
        const usage = (await apiCall(config, 'GET', '/api/v1/usage')) as Record<string, unknown>;

        if (options.json) {
          console.log(JSON.stringify(usage, null, 2));
          return;
        }

        console.log(`${colors.cyan}Usage Summary${colors.reset}\n`);

        printField('Period', String(usage.period ?? '-'));
        printField('Total Runs', String(usage.total_runs ?? '-'));
        printField('Passed', String(usage.passed ?? usage.passed_count ?? '-'));
        printField('Failed', String(usage.failed ?? usage.failed_count ?? '-'));
        printField(
          'Total Duration',
          formatDuration(
            typeof usage.total_duration === 'number'
              ? usage.total_duration
              : typeof usage.total_duration_seconds === 'number'
                ? usage.total_duration_seconds
                : undefined
          )
        );

        if (usage.cost !== undefined && usage.cost !== null) {
          printField('Cost', String(usage.cost));
        }
      }
    } catch (err) {
      console.log(error(`Failed to fetch usage: ${formatError(err)}`));
      process.exit(1);
    }
  });
