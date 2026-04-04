/**
 * qa-use test runs logs - Fetch console/network logs for a test run
 */

import { Command } from 'commander';
import { apiCall, requireApiKey } from '../../../lib/api-helpers.js';
import { loadConfig } from '../../../lib/config.js';
import { error, formatError, warning } from '../../../lib/output.js';

const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function formatLogLevel(level: string): string {
  switch (level) {
    case 'error':
      return `${colors.red}ERROR${colors.reset}`;
    case 'warn':
    case 'warning':
      return `${colors.yellow}WARN ${colors.reset}`;
    default:
      return `${colors.gray}${level.toUpperCase().padEnd(5)}${colors.reset}`;
  }
}

export const logsCommand = new Command('logs')
  .description('Fetch console or network logs for a test run')
  .argument('<run-id>', 'Test run ID (UUID)')
  .option('--type <type>', 'Log type: console or network (default: console)', 'console')
  .option('--json', 'Output as JSON')
  .action(async (runId, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const query: Record<string, string> = {};
      if (options.type) query.type = options.type;

      const data = (await apiCall(config, 'GET', `/api/v1/test-runs/${runId}/logs`, {
        query,
      })) as unknown;

      if (options.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      // Handle both array and object responses
      const logs = Array.isArray(data)
        ? data
        : (data as Record<string, unknown>).logs
          ? ((data as Record<string, unknown>).logs as unknown[])
          : [];

      if (logs.length === 0) {
        console.log(warning(`No ${options.type} logs found for run ${runId}`));
        return;
      }

      console.log(
        `${colors.cyan}${options.type === 'network' ? 'Network' : 'Console'} Logs${colors.reset} (${logs.length} entries)\n`
      );

      for (const entry of logs) {
        if (typeof entry === 'string') {
          console.log(entry);
          continue;
        }

        const log = entry as Record<string, unknown>;

        if (options.type === 'network') {
          // Network log format
          const method = log.method ?? 'GET';
          const url = log.url ?? '';
          const status = log.status ?? '';
          const timestamp = log.timestamp
            ? `${colors.gray}${new Date(String(log.timestamp)).toISOString().slice(11, 23)}${colors.reset} `
            : '';
          console.log(`${timestamp}${method} ${status} ${url}`);
        } else {
          // Console log format
          const level = formatLogLevel(String(log.level ?? log.type ?? 'log'));
          const message = log.message ?? log.text ?? '';
          const timestamp = log.timestamp
            ? `${colors.gray}${new Date(String(log.timestamp)).toISOString().slice(11, 23)}${colors.reset} `
            : '';
          console.log(`${timestamp}${level} ${message}`);
        }
      }
    } catch (err) {
      console.log(error(`Failed to fetch logs: ${formatError(err)}`));
      process.exit(1);
    }
  });
