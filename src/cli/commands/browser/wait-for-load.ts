/**
 * qa-use browser wait-for-load - Wait for page load state
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error, success } from '../../lib/output.js';
import { formatSnapshotDiff } from '../../lib/snapshot-diff.js';

interface WaitForLoadOptions {
  sessionId?: string;
  state?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: string;
  diff?: boolean;
}

export const waitForLoadCommand = new Command('wait-for-load')
  .description('Wait for page load state')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('--state <state>', 'Load state to wait for (load|domcontentloaded|networkidle)', 'load')
  .option('--timeout <ms>', 'Timeout in milliseconds', '30000')
  .option('--no-diff', 'Disable snapshot diff output')
  .action(async (options: WaitForLoadOptions) => {
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

      const state = options.state as 'load' | 'domcontentloaded' | 'networkidle';
      if (!['load', 'domcontentloaded', 'networkidle'].includes(state)) {
        console.log(error('Invalid state. Must be: load, domcontentloaded, or networkidle'));
        process.exit(1);
      }

      const action: {
        type: 'wait_for_load';
        state: 'load' | 'domcontentloaded' | 'networkidle';
        include_snapshot_diff?: boolean;
      } = {
        type: 'wait_for_load',
        state,
      };
      if (options.diff !== false) {
        action.include_snapshot_diff = true;
      }

      const result = await client.executeAction(resolved.id, action);

      if (result.success) {
        console.log(success(`Page reached ${state} state`));

        if (result.snapshot_diff) {
          console.log('');
          console.log(formatSnapshotDiff(result.snapshot_diff));
        }

        await touchSession(resolved.id);
      } else {
        console.log(error(result.error || 'Wait for load failed'));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to wait for load'));
      process.exit(1);
    }
  });
