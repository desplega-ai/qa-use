/**
 * qa-use browser scroll - Scroll page
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import type { ScrollDirection } from '../../../../lib/api/browser-types.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { normalizeRef } from '../../lib/browser-utils.js';
import { loadConfig } from '../../lib/config.js';
import { error, success } from '../../lib/output.js';
import { formatDownloads, formatSnapshotDiff } from '../../lib/snapshot-diff.js';

interface ScrollOptions {
  sessionId?: string;
  ref?: string;
  text?: string;
  diff?: boolean;
}

const VALID_DIRECTIONS: ScrollDirection[] = ['up', 'down', 'left', 'right'];

export const scrollCommand = new Command('scroll')
  .description('Scroll the page')
  .argument('<direction>', 'Scroll direction: up, down, left, or right')
  .argument('[amount]', 'Scroll amount in pixels (default: 500)', '500')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('--ref <ref>', 'Element reference for scoped scrolling')
  .option('-t, --text <description>', 'Element text description (AI-resolved)')
  .option('--no-diff', 'Disable snapshot diff output')
  .action(async (direction: string, amountStr: string, options: ScrollOptions) => {
    try {
      // Load configuration
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      // Validate direction
      const normalizedDirection = direction.toLowerCase() as ScrollDirection;
      if (!VALID_DIRECTIONS.includes(normalizedDirection)) {
        console.log(
          error(`Invalid direction: ${direction}. Must be one of: ${VALID_DIRECTIONS.join(', ')}`)
        );
        process.exit(1);
      }

      // Parse amount
      const amount = parseInt(amountStr, 10);
      if (Number.isNaN(amount) || amount <= 0) {
        console.log(error('Amount must be a positive number'));
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

      // Execute scroll action
      const action: {
        type: 'scroll';
        direction: ScrollDirection;
        amount: number;
        ref?: string;
        text?: string;
        include_snapshot_diff?: boolean;
      } = {
        type: 'scroll',
        direction: normalizedDirection,
        amount,
      };
      if (options.ref) {
        action.ref = normalizeRef(options.ref);
      } else if (options.text) {
        action.text = options.text;
      }
      if (options.diff !== false) {
        action.include_snapshot_diff = true;
      }

      const result = await client.executeAction(resolved.id, action);

      if (result.success) {
        console.log(success(`Scrolled ${normalizedDirection} ${amount}px`));

        if (result.snapshot_diff) {
          console.log('');
          console.log(formatSnapshotDiff(result.snapshot_diff));
        }

        if (result.downloads?.length) {
          console.log('');
          console.log(formatDownloads(result.downloads));
        }

        await touchSession(resolved.id);
      } else {
        console.log(error(result.error || 'Scroll failed'));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to scroll'));
      process.exit(1);
    }
  });
