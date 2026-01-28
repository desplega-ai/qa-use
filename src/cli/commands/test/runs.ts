/**
 * qa-use test runs - List test run history
 */

import { Command } from 'commander';
import { loadConfig } from '../../lib/config.js';
import { ApiClient } from '../../../../lib/api/index.js';
import { error, warning } from '../../lib/output.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
};

function formatStatus(status: string): string {
  const padded = status.padEnd(9);
  switch (status) {
    case 'passed':
      return `${colors.green}${padded}${colors.reset}`;
    case 'failed':
      return `${colors.red}${padded}${colors.reset}`;
    case 'running':
    case 'pending':
      return `${colors.yellow}${padded}${colors.reset}`;
    case 'cancelled':
    case 'timeout':
    case 'skipped':
      return `${colors.gray}${padded}${colors.reset}`;
    default:
      return padded;
  }
}

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || seconds === null) return '-'.padEnd(10);
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`.padEnd(10);
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`.padEnd(10);
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

export const runsCommand = new Command('runs')
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

      if (!config.api_key) {
        console.log(error('API key not configured'));
        console.log('  Run `qa-use setup` to configure');
        process.exit(1);
      }

      const client = new ApiClient(config.api_url);
      client.setApiKey(config.api_key);

      // Resolve test name to ID if provided
      let testId = options.id;
      let testDisplayName: string | undefined;

      if (testName && !testId) {
        // Search for test by name in cloud
        const tests = await client.listTests({ query: testName, limit: 10 });
        const exactMatch = tests.find((t) => t.name === testName);
        const partialMatches = tests.filter((t) =>
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

      // Fetch test runs
      const runs = await client.listTestRuns({
        test_id: testId,
        run_status: options.status,
        limit: parseInt(options.limit),
        offset: parseInt(options.offset),
      });

      // JSON output
      if (options.json) {
        console.log(JSON.stringify(runs, null, 2));
        return;
      }

      // Human-readable output
      if (runs.length === 0) {
        if (testId) {
          console.log(warning(`No runs found for test${testDisplayName ? ` "${testDisplayName}"` : ''}`));
        } else if (options.status) {
          console.log(warning(`No runs found with status "${options.status}"`));
        } else {
          console.log(warning('No test runs found'));
        }
        return;
      }

      // Header
      if (testDisplayName) {
        console.log(`Test Runs for: ${testDisplayName} (${runs.length} run${runs.length === 1 ? '' : 's'})\n`);
      } else {
        console.log(`Test Runs (${runs.length} result${runs.length === 1 ? '' : 's'})\n`);
      }

      // Table header
      console.log('ID                                    STATUS     DURATION    CREATED');
      console.log('─'.repeat(85));

      for (const run of runs) {
        const statusStr = formatStatus(run.run_status);
        const durationStr = formatDuration(run.duration_seconds);
        const createdStr = formatTimestamp(run.created_at);

        console.log(`${run.id}  ${statusStr}${durationStr}${createdStr}`);
      }

      // Pagination hint
      if (runs.length === parseInt(options.limit)) {
        console.log(
          `\n${colors.gray}Use --offset ${parseInt(options.offset) + parseInt(options.limit)} to see more${colors.reset}`
        );
      }
    } catch (err) {
      console.log(error(`Failed to list test runs: ${err}`));
      process.exit(1);
    }
  });
