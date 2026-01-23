/**
 * qa-use browser hover - Hover over element
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { success, error } from '../../lib/output.js';

interface HoverOptions {
  sessionId?: string;
}

/**
 * Normalize ref by stripping leading @ if present
 */
function normalizeRef(ref: string): string {
  return ref.startsWith('@') ? ref.slice(1) : ref;
}

export const hoverCommand = new Command('hover')
  .description('Hover over an element')
  .argument('<ref>', 'Element ref (e.g., "e3" or "@e3")')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .action(async (ref: string, options: HoverOptions) => {
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

      // Execute hover action
      const result = await client.executeAction(resolved.id, {
        type: 'hover',
        ref: normalizedRef,
      });

      if (result.success) {
        console.log(success(`Hovering over element ${normalizedRef}`));
        await touchSession(resolved.id);
      } else {
        const hint = result.error || 'Hover failed';
        console.log(error(`${hint}. Use 'qa-use browser snapshot' to see available elements.`));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to hover over element'));
      process.exit(1);
    }
  });
