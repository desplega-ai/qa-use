/**
 * qa-use browser list - List browser sessions
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { loadStoredSessions, isSessionStale } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error, warning } from '../../lib/output.js';

export const listCommand = new Command('list')
  .description('List browser sessions')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    try {
      // Load configuration
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      // Create client and set API key
      const client = new BrowserApiClient(config.api_url);
      client.setApiKey(config.api_key);

      // Fetch sessions from API
      const sessions = await client.listSessions();

      // Load locally stored sessions for marking
      const storedSessions = await loadStoredSessions();
      const storedIds = new Set(storedSessions.map((s) => s.id));

      if (options.json) {
        // JSON output
        const output = sessions.map((s) => ({
          id: s.id,
          status: s.status,
          created_at: s.created_at,
          url: s.url,
          local: storedIds.has(s.id),
        }));
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      // Human-readable output
      if (sessions.length === 0) {
        console.log(warning('No browser sessions found.'));
        return;
      }

      console.log(`Found ${sessions.length} session(s):\n`);

      // Table header
      console.log('ID                                    Status    Created            URL');
      console.log('─'.repeat(90));

      for (const session of sessions) {
        const isLocal = storedIds.has(session.id);
        const localMarker = isLocal ? ' *' : '  ';

        // Format created time
        const createdAt = new Date(session.created_at);
        const createdStr = createdAt.toISOString().replace('T', ' ').slice(0, 19);

        // Format URL (truncate if too long)
        const url = session.url || '-';
        const truncatedUrl = url.length > 30 ? url.slice(0, 27) + '...' : url;

        // Status with color indicator
        let statusStr = session.status.padEnd(8);
        if (session.status === 'active') {
          statusStr = `\x1b[32m${statusStr}\x1b[0m`; // Green
        } else if (session.status === 'starting') {
          statusStr = `\x1b[33m${statusStr}\x1b[0m`; // Yellow
        } else if (session.status === 'closed' || session.status === 'closing') {
          statusStr = `\x1b[90m${statusStr}\x1b[0m`; // Gray
        }

        console.log(
          `${session.id}${localMarker}${statusStr}  ${createdStr}  ${truncatedUrl}`
        );
      }

      console.log('');
      console.log('* = tracked locally (auto-resolved with -s flag)');

      // Check for stale local sessions
      const staleSessions = storedSessions.filter(isSessionStale);
      if (staleSessions.length > 0) {
        console.log('');
        console.log(
          warning(`${staleSessions.length} stale local session(s) will be cleaned up automatically.`)
        );
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to list sessions'));
      process.exit(1);
    }
  });
