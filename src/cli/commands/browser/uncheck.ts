/**
 * qa-use browser uncheck - Uncheck a checkbox by ref or semantic text
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { success, error } from '../../lib/output.js';

interface UncheckOptions {
  sessionId?: string;
  text?: string;
}

/**
 * Normalize ref by stripping leading @ if present
 */
function normalizeRef(ref: string): string {
  return ref.startsWith('@') ? ref.slice(1) : ref;
}

export const uncheckCommand = new Command('uncheck')
  .description('Uncheck a checkbox by ref or semantic description')
  .argument('[ref]', 'Element ref from snapshot (e.g., "e3" or "@e3")')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('-t, --text <description>', 'Semantic element description (AI-based, slower)')
  .action(async (ref: string | undefined, options: UncheckOptions) => {
    try {
      // Validate that either ref or --text is provided
      if (!ref && !options.text) {
        console.log(error('Either <ref> argument or --text option is required'));
        process.exit(1);
      }

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

      // Build action with either ref or text
      const action: { type: 'uncheck'; ref?: string; text?: string } = { type: 'uncheck' };
      if (ref) {
        action.ref = normalizeRef(ref);
      } else if (options.text) {
        action.text = options.text;
      }

      const result = await client.executeAction(resolved.id, action);

      if (result.success) {
        const target = ref ? `checkbox ${normalizeRef(ref)}` : `"${options.text}"`;
        console.log(success(`Unchecked ${target}`));
        await touchSession(resolved.id);
      } else {
        console.log(error(result.error || 'Uncheck failed'));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to uncheck checkbox'));
      process.exit(1);
    }
  });
