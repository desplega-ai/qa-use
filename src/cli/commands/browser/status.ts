/**
 * qa-use browser status - Get session status
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { success, error, info } from '../../lib/output.js';

interface StatusOptions {
  sessionId?: string;
  json?: boolean;
}

export const statusCommand = new Command('status')
  .description('Get session status and details')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('--json', 'Output as JSON')
  .action(async (options: StatusOptions) => {
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

      // Resolve session ID
      const resolved = await resolveSessionId({
        explicitId: options.sessionId,
        client,
        verify: false, // We'll get the session anyway
      });

      // Get session details
      const session = await client.getSession(resolved.id);

      if (options.json) {
        console.log(JSON.stringify(session, null, 2));
        return;
      }

      // Human-readable output
      console.log('');
      console.log(`Session ID:   ${session.id}`);

      // Status with color
      let statusDisplay: string;
      switch (session.status) {
        case 'active':
          statusDisplay = `\x1b[32m${session.status}\x1b[0m`; // Green
          break;
        case 'starting':
          statusDisplay = `\x1b[33m${session.status}\x1b[0m`; // Yellow
          break;
        case 'closed':
        case 'closing':
          statusDisplay = `\x1b[90m${session.status}\x1b[0m`; // Gray
          break;
        default:
          statusDisplay = session.status;
      }
      console.log(`Status:       ${statusDisplay}`);

      // Created time
      const createdAt = new Date(session.created_at);
      console.log(`Created:      ${createdAt.toISOString()}`);

      // Updated time if available
      if (session.updated_at) {
        const updatedAt = new Date(session.updated_at);
        console.log(`Updated:      ${updatedAt.toISOString()}`);
      }

      // Current URL
      if (session.url) {
        console.log(`URL:          ${session.url}`);
      }

      // Viewport
      if (session.viewport) {
        console.log(`Viewport:     ${session.viewport}`);
      }

      // Headless mode
      if (session.headless !== undefined) {
        console.log(`Headless:     ${session.headless}`);
      }

      // Timeout
      if (session.timeout) {
        console.log(`Timeout:      ${session.timeout}s`);
      }

      console.log('');

      // Show source if auto-resolved
      if (resolved.source === 'stored') {
        console.log(info('(Session auto-resolved from local storage)'));
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to get session status'));
      process.exit(1);
    }
  });
