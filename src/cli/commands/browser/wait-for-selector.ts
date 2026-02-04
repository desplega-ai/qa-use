/**
 * qa-use browser wait-for-selector - Wait for CSS selector to reach a state
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error, success } from '../../lib/output.js';
import { formatSnapshotDiff } from '../../lib/snapshot-diff.js';

interface WaitForSelectorOptions {
  sessionId?: string;
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
  timeout?: string;
  diff?: boolean;
}

export const waitForSelectorCommand = new Command('wait-for-selector')
  .description('Wait for CSS selector to reach a state')
  .argument('<selector>', 'CSS selector to wait for')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('--state <state>', 'State to wait for (visible|hidden|attached|detached)', 'visible')
  .option('--timeout <ms>', 'Timeout in milliseconds', '30000')
  .option('--no-diff', 'Disable snapshot diff output')
  .action(async (selector: string, options: WaitForSelectorOptions) => {
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

      const state = options.state as 'visible' | 'hidden' | 'attached' | 'detached';
      if (!['visible', 'hidden', 'attached', 'detached'].includes(state)) {
        console.log(error('Invalid state. Must be: visible, hidden, attached, or detached'));
        process.exit(1);
      }

      const action: {
        type: 'wait_for_selector';
        selector: string;
        state: 'visible' | 'hidden' | 'attached' | 'detached';
        include_snapshot_diff?: boolean;
      } = {
        type: 'wait_for_selector',
        selector,
        state,
      };
      if (options.diff !== false) {
        action.include_snapshot_diff = true;
      }

      const result = await client.executeAction(resolved.id, action);

      if (result.success) {
        console.log(success(`Selector "${selector}" is ${state}`));

        if (result.snapshot_diff) {
          console.log('');
          console.log(formatSnapshotDiff(result.snapshot_diff));
        }

        await touchSession(resolved.id);
      } else {
        console.log(error(result.error || 'Wait for selector failed'));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to wait for selector'));
      process.exit(1);
    }
  });
