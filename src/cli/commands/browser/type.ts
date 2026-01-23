/**
 * qa-use browser type - Type text with keystroke delays
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { success, error } from '../../lib/output.js';

interface TypeOptions {
  sessionId?: string;
}

/**
 * Normalize ref by stripping leading @ if present
 */
function normalizeRef(ref: string): string {
  return ref.startsWith('@') ? ref.slice(1) : ref;
}

export const typeCommand = new Command('type')
  .description('Type text into an element with keystroke delays')
  .argument('<ref>', 'Element ref (e.g., "e4" or "@e4")')
  .argument('<text>', 'Text to type')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .action(async (ref: string, text: string, options: TypeOptions) => {
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

      // Normalize ref
      const normalizedRef = normalizeRef(ref);

      // Execute type action
      const result = await client.executeAction(resolved.id, {
        type: 'type',
        ref: normalizedRef,
        text,
      });

      if (result.success) {
        // Truncate text for display if too long
        const displayText = text.length > 50 ? text.slice(0, 47) + '...' : text;
        console.log(success(`Typed "${displayText}" into ${normalizedRef}`));
        await touchSession(resolved.id);
      } else {
        const hint = result.error || 'Type failed';
        console.log(error(`${hint}. Use 'qa-use browser snapshot' to see available elements.`));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to type text'));
      process.exit(1);
    }
  });
