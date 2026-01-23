/**
 * qa-use browser close - Close a browser session
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, removeStoredSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { success, error, info } from '../../lib/output.js';

interface CloseOptions {
  sessionId?: string;
}

export const closeCommand = new Command('close')
  .description('Close a browser session')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .action(async (options: CloseOptions) => {
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
      });

      console.log(info(`Closing session ${resolved.id}...`));

      // Close session on API
      await client.deleteSession(resolved.id);

      // Remove from local storage
      await removeStoredSession(resolved.id);

      console.log(success(`Session ${resolved.id} closed successfully`));

      // Show source if auto-resolved
      if (resolved.source === 'stored') {
        console.log(info('(Session was auto-resolved from local storage)'));
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to close session'));
      process.exit(1);
    }
  });
