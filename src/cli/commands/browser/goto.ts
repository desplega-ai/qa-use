/**
 * qa-use browser goto - Navigate to URL
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error, success } from '../../lib/output.js';

interface GotoOptions {
  sessionId?: string;
}

export const gotoCommand = new Command('goto')
  .description('Navigate to a URL')
  .argument('<url>', 'URL to navigate to')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .action(async (url: string, options: GotoOptions) => {
    try {
      // Load configuration
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      // Validate URL - skip prefix if using variable syntax (backend handles substitution)
      const hasVarSyntax = url.startsWith('<var>') || url.startsWith('{{');
      if (!url.startsWith('http://') && !url.startsWith('https://') && !hasVarSyntax) {
        url = `https://${url}`;
      }

      // Create client and set API key
      const client = new BrowserApiClient(config.api_url);
      client.setApiKey(config.api_key);

      // Resolve session ID
      const resolved = await resolveSessionId({
        explicitId: options.sessionId,
        client,
      });

      // Execute goto action
      const result = await client.executeAction(resolved.id, {
        type: 'goto',
        url,
      });

      if (result.success) {
        console.log(success(`Navigated to ${url}`));
        // Update session timestamp
        await touchSession(resolved.id);
      } else {
        console.log(error(result.error || 'Navigation failed'));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to navigate'));
      process.exit(1);
    }
  });
