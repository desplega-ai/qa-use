/**
 * qa-use test runs info - Show detailed test run information
 */

import { Command } from 'commander';
import { apiCall, requireApiKey } from '../../../lib/api-helpers.js';
import { loadConfig } from '../../../lib/config.js';
import { error, formatError } from '../../../lib/output.js';
import { formatDuration, formatStatus, formatTimestamp } from '../../../lib/table.js';

const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
};

function printField(label: string, value: string | undefined | null): void {
  const display = value ?? '-';
  console.log(`  ${colors.gray}${label.padEnd(18)}${colors.reset} ${display}`);
}

export const infoCommand = new Command('info')
  .description('Show detailed test run information')
  .argument('<run-id>', 'Test run ID (UUID)')
  .option('--json', 'Output as JSON')
  .action(async (runId, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const run = (await apiCall(config, 'GET', `/api/v1/test-runs/${runId}`)) as Record<
        string,
        unknown
      >;

      if (options.json) {
        console.log(JSON.stringify(run, null, 2));
        return;
      }

      console.log(`${colors.cyan}Test Run Details${colors.reset}\n`);

      printField('ID', String(run.id ?? '-'));
      printField('Status', formatStatus(String(run.run_status ?? run.status ?? '-')));
      printField('Test ID', String(run.test_id ?? '-'));
      if (run.test_name) {
        printField('Test Name', String(run.test_name));
      }
      printField('Duration', formatDuration(run.duration_seconds as number | undefined));
      printField('Created', formatTimestamp(String(run.created_at ?? '')));
      if (run.started_at) {
        printField('Started', formatTimestamp(String(run.started_at)));
      }
      if (run.completed_at) {
        printField('Completed', formatTimestamp(String(run.completed_at)));
      }
      if (run.app_url) {
        printField('App URL', String(run.app_url));
      }

      // Error info
      if (run.error || run.error_message) {
        console.log(`\n  ${colors.gray}Error:${colors.reset}`);
        console.log(`  ${run.error || run.error_message}`);
      }

      // Config details
      const configData = run.config ?? run.run_config;
      if (configData && typeof configData === 'object') {
        console.log(`\n  ${colors.gray}Config:${colors.reset}`);
        const cfg = configData as Record<string, unknown>;
        for (const [key, value] of Object.entries(cfg)) {
          if (value !== undefined && value !== null) {
            const display = typeof value === 'object' ? JSON.stringify(value) : String(value);
            printField(`  ${key}`, display);
          }
        }
      }
    } catch (err) {
      console.log(error(`Failed to fetch test run: ${formatError(err)}`));
      process.exit(1);
    }
  });
