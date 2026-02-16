/**
 * qa-use browser focus - Focus element by ref or semantic text
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { normalizeRef } from '../../lib/browser-utils.js';
import { loadConfig } from '../../lib/config.js';
import { error, success } from '../../lib/output.js';
import { formatDownloads, formatSnapshotDiff } from '../../lib/snapshot-diff.js';

interface FocusOptions {
  sessionId?: string;
  text?: string;
  diff?: boolean;
}

export const focusCommand = new Command('focus')
  .description('Focus an element by ref or semantic description')
  .argument('[ref]', 'Element ref from snapshot (e.g., "e3" or "@e3")')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('-t, --text <description>', 'Semantic element description (AI-based, slower)')
  .option('--no-diff', 'Disable snapshot diff output')
  .action(async (ref: string | undefined, options: FocusOptions) => {
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
      const action: {
        type: 'focus';
        ref?: string;
        text?: string;
        include_snapshot_diff?: boolean;
      } = { type: 'focus' };
      if (ref) {
        action.ref = normalizeRef(ref);
      } else if (options.text) {
        action.text = options.text;
      }
      if (options.diff !== false) {
        action.include_snapshot_diff = true;
      }

      const result = await client.executeAction(resolved.id, action);

      if (result.success) {
        const target = ref ? `element ${normalizeRef(ref)}` : `"${options.text}"`;
        console.log(success(`Focused ${target}`));

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
        const hint = result.error || 'Focus failed';
        console.log(error(`${hint}. Use 'qa-use browser snapshot' to see available elements.`));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to focus element'));
      process.exit(1);
    }
  });
