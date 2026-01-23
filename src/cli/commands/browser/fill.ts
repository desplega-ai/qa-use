/**
 * qa-use browser fill - Fill input field
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { success, error } from '../../lib/output.js';

interface FillOptions {
  sessionId?: string;
}

/**
 * Normalize ref by stripping leading @ if present
 */
function normalizeRef(ref: string): string {
  return ref.startsWith('@') ? ref.slice(1) : ref;
}

export const fillCommand = new Command('fill')
  .description('Fill an input field with a value')
  .argument('<ref>', 'Element ref (e.g., "e4" or "@e4")')
  .argument('<value>', 'Value to fill')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .action(async (ref: string, value: string, options: FillOptions) => {
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

      // Execute fill action
      const result = await client.executeAction(resolved.id, {
        type: 'fill',
        ref: normalizedRef,
        value,
      });

      if (result.success) {
        // Truncate value for display if too long
        const displayValue = value.length > 50 ? value.slice(0, 47) + '...' : value;
        console.log(success(`Filled ${normalizedRef} with "${displayValue}"`));
        await touchSession(resolved.id);
      } else {
        const hint = result.error || 'Fill failed';
        console.log(error(`${hint}. Use 'qa-use browser snapshot' to see available elements.`));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to fill input'));
      process.exit(1);
    }
  });
