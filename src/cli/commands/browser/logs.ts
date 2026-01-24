/**
 * qa-use browser logs - View session logs (console, network)
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import type { ConsoleLogLevel } from '../../../../lib/api/browser-types.js';
import { resolveSessionId } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error } from '../../lib/output.js';

interface ConsoleLogsOptions {
  sessionId?: string;
  level?: ConsoleLogLevel;
  limit?: string;
  json?: boolean;
}

interface NetworkLogsOptions {
  sessionId?: string;
  status?: string;
  urlPattern?: string;
  limit?: string;
  json?: boolean;
}

const consoleCommand = new Command('console')
  .description('View console logs from a session')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('-l, --level <level>', 'Filter by log level (log, warn, error, info, debug)')
  .option('--limit <n>', 'Maximum number of entries', '100')
  .option('--json', 'Output as JSON')
  .action(async (options: ConsoleLogsOptions) => {
    try {
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      const client = new BrowserApiClient(config.api_url);
      client.setApiKey(config.api_key);

      const resolved = await resolveSessionId({
        explicitId: options.sessionId,
        client,
      });

      const result = await client.getConsoleLogs(resolved.id, {
        level: options.level,
        limit: options.limit ? parseInt(options.limit, 10) : undefined,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Console logs (${result.total} total):\n`);
        for (const log of result.logs) {
          const prefix = log.level.toUpperCase().padEnd(5);
          console.log(`[${prefix}] ${log.text}`);
          if (log.url) console.log(`        at ${log.url}`);
        }
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to get console logs'));
      process.exit(1);
    }
  });

const networkCommand = new Command('network')
  .description('View network request logs from a session')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('--status <codes>', 'Filter by status codes (e.g., "4xx,5xx")')
  .option('--url-pattern <pattern>', 'Filter by URL pattern (e.g., "*api*")')
  .option('--limit <n>', 'Maximum number of entries', '100')
  .option('--json', 'Output as JSON')
  .action(async (options: NetworkLogsOptions) => {
    try {
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      const client = new BrowserApiClient(config.api_url);
      client.setApiKey(config.api_key);

      const resolved = await resolveSessionId({
        explicitId: options.sessionId,
        client,
      });

      const result = await client.getNetworkLogs(resolved.id, {
        status: options.status,
        url_pattern: options.urlPattern,
        limit: options.limit ? parseInt(options.limit, 10) : undefined,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Network requests (${result.total} total):\n`);
        for (const req of result.requests) {
          const statusColor = req.status >= 400 ? '!' : ' ';
          console.log(
            `${statusColor}${req.method.padEnd(6)} ${req.status} ${req.url} (${req.duration_ms}ms)`
          );
        }
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to get network logs'));
      process.exit(1);
    }
  });

export const logsCommand = new Command('logs')
  .description('View session logs')
  .addCommand(consoleCommand)
  .addCommand(networkCommand);
