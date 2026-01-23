/**
 * qa-use browser wait - Wait for a fixed duration
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { success, error } from '../../lib/output.js';

interface WaitOptions {
  sessionId?: string;
}

export const waitCommand = new Command('wait')
  .description('Wait for a specified duration')
  .argument('<ms>', 'Duration to wait in milliseconds')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .action(async (msStr: string, options: WaitOptions) => {
    try {
      // Load configuration
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      // Parse duration
      const durationMs = parseInt(msStr, 10);
      if (isNaN(durationMs) || durationMs <= 0) {
        console.log(error('Duration must be a positive number in milliseconds'));
        process.exit(1);
      }

      if (durationMs > 60000) {
        console.log(error('Maximum wait duration is 60000ms (1 minute)'));
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

      // Execute wait action
      const result = await client.executeAction(resolved.id, {
        type: 'wait',
        duration_ms: durationMs,
      });

      if (result.success) {
        // Format duration for display
        const displayDuration = durationMs >= 1000 ? `${durationMs / 1000}s` : `${durationMs}ms`;
        console.log(success(`Waited ${displayDuration}`));
        await touchSession(resolved.id);
      } else {
        console.log(error(result.error || 'Wait failed'));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to wait'));
      process.exit(1);
    }
  });
