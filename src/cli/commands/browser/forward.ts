/**
 * qa-use browser forward - Navigate forward in browser history
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error, success } from '../../lib/output.js';
import { formatDownloads, formatSnapshotDiff } from '../../lib/snapshot-diff.js';

interface ForwardOptions {
  sessionId?: string;
  diff?: boolean;
}

export const forwardCommand = new Command('forward')
  .description('Navigate forward in browser history')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('--no-diff', 'Disable snapshot diff output')
  .action(async (options: ForwardOptions) => {
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

      const action: {
        type: 'forward';
        include_snapshot_diff?: boolean;
      } = { type: 'forward' };
      if (options.diff !== false) {
        action.include_snapshot_diff = true;
      }

      const result = await client.executeAction(resolved.id, action);

      if (result.success) {
        console.log(success('Navigated forward'));

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
        console.log(error(result.error || 'Navigation failed'));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to navigate forward'));
      process.exit(1);
    }
  });
