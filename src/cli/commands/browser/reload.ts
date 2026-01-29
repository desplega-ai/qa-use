/**
 * qa-use browser reload - Reload current page
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error, success } from '../../lib/output.js';

interface ReloadOptions {
  sessionId?: string;
}

export const reloadCommand = new Command('reload')
  .description('Reload current page')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .action(async (options: ReloadOptions) => {
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
        type: 'reload',
      });

      if (result.success) {
        console.log(success('Page reloaded'));
        await touchSession(resolved.id);
      } else {
        console.log(error(result.error || 'Reload failed'));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to reload page'));
      process.exit(1);
    }
  });
