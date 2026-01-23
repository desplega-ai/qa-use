/**
 * qa-use browser back - Navigate back in browser history
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { success, error } from '../../lib/output.js';

interface BackOptions {
  sessionId?: string;
}

export const backCommand = new Command('back')
  .description('Navigate back in browser history')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .action(async (options: BackOptions) => {
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

      const result = await client.executeAction(resolved.id, {
        type: 'back',
      });

      if (result.success) {
        console.log(success('Navigated back'));
        await touchSession(resolved.id);
      } else {
        console.log(error(result.error || 'Navigation failed'));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to navigate back'));
      process.exit(1);
    }
  });
