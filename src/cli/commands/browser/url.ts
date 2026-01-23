/**
 * qa-use browser url - Get current page URL
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error } from '../../lib/output.js';

interface UrlOptions {
  sessionId?: string;
}

export const urlCommand = new Command('url')
  .description('Get the current page URL')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .action(async (options: UrlOptions) => {
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

      // Get URL
      const url = await client.getUrl(resolved.id);

      // Output just the URL
      console.log(url);

      // Update session timestamp
      await touchSession(resolved.id);
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to get URL'));
      process.exit(1);
    }
  });
