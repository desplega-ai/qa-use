/**
 * qa-use browser press - Press keyboard key
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { success, error } from '../../lib/output.js';

interface PressOptions {
  sessionId?: string;
}

// Common key names for reference
const COMMON_KEYS = [
  'Enter',
  'Tab',
  'Escape',
  'Backspace',
  'Delete',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Space',
];

export const pressCommand = new Command('press')
  .description('Press a keyboard key')
  .argument('<key>', `Key to press (e.g., "Enter", "Tab", "Escape")`)
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .action(async (key: string, options: PressOptions) => {
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

      // Execute press action
      const result = await client.executeAction(resolved.id, {
        type: 'press',
        key,
      });

      if (result.success) {
        console.log(success(`Pressed key: ${key}`));
        await touchSession(resolved.id);
      } else {
        const hint = result.error || 'Key press failed';
        console.log(error(hint));
        console.log(`Common keys: ${COMMON_KEYS.join(', ')}`);
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to press key'));
      process.exit(1);
    }
  });
