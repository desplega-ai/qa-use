/**
 * qa-use suite info - Show detailed test suite information
 */

import { Command } from 'commander';
import { apiCall, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError } from '../../lib/output.js';
import { formatTimestamp } from '../../lib/table.js';

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
  .description('Show detailed test suite information')
  .argument('<id>', 'Test suite ID (UUID)')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const suite = (await apiCall(config, 'GET', `/api/v1/test-suites/${id}`)) as Record<
        string,
        unknown
      >;

      if (options.json) {
        console.log(JSON.stringify(suite, null, 2));
        return;
      }

      console.log(`${colors.cyan}Test Suite Details${colors.reset}\n`);

      printField('ID', String(suite.id ?? '-'));
      printField('Name', String(suite.name ?? '-'));
      printField('Description', String(suite.description ?? '-'));
      printField('Created', formatTimestamp(String(suite.created_at ?? '')));
      printField('Updated', formatTimestamp(String(suite.updated_at ?? '')));

      // Test IDs
      const testIds = suite.test_ids;
      if (Array.isArray(testIds) && testIds.length > 0) {
        console.log(`\n  ${colors.gray}Tests (${testIds.length}):${colors.reset}`);
        for (const tid of testIds) {
          console.log(`    • ${tid}`);
        }
      } else {
        printField('Tests', 'none');
      }

      // Schedule info if present
      const schedule = suite.schedule;
      if (schedule && typeof schedule === 'object') {
        console.log(`\n  ${colors.gray}Schedule:${colors.reset}`);
        const sched = schedule as Record<string, unknown>;
        for (const [key, value] of Object.entries(sched)) {
          if (value !== undefined && value !== null) {
            const display = typeof value === 'object' ? JSON.stringify(value) : String(value);
            printField(`  ${key}`, display);
          }
        }
      }
    } catch (err) {
      console.log(error(`Failed to fetch test suite: ${formatError(err)}`));
      process.exit(1);
    }
  });
