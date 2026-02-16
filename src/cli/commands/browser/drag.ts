/**
 * qa-use browser drag - Drag element to target or by pixel offset
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { normalizeRef } from '../../lib/browser-utils.js';
import { loadConfig } from '../../lib/config.js';
import { error, success } from '../../lib/output.js';
import { formatDownloads, formatSnapshotDiff } from '../../lib/snapshot-diff.js';

interface DragOptions {
  sessionId?: string;
  text?: string;
  target?: string;
  targetSelector?: string;
  deltaX?: string;
  deltaY?: string;
  diff?: boolean;
}

export const dragCommand = new Command('drag')
  .description(
    `Drag an element to a target or by pixel offset

Two modes:
  1. Target mode:   drag <ref> --target <target-ref>
                    drag <ref> --target-selector ".drop-zone"
  2. Relative mode: drag <ref> --delta-x 100 --delta-y 50

Examples:
  drag e5 --target e10              # Drag e5 to e10
  drag e5 --target-selector "#drop" # Drag e5 to CSS selector
  drag e5 --delta-x 100             # Drag e5 right by 100px
  drag e5 --delta-x -50 --delta-y 30 # Drag e5 left 50px, down 30px
  drag -t "card" --delta-x 200      # Drag by semantic text`
  )
  .argument('[ref]', 'Source element ref from snapshot (e.g., "e3" or "@e3")')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('-t, --text <description>', 'Semantic source element description (AI-based)')
  .option('--target <ref>', 'Target element ref (target mode)')
  .option('--target-selector <selector>', 'Target CSS selector (target mode)')
  .option('--delta-x <pixels>', 'Drag by X pixels (relative mode)')
  .option('--delta-y <pixels>', 'Drag by Y pixels (relative mode)')
  .option('--no-diff', 'Disable snapshot diff output')
  .action(async (ref: string | undefined, options: DragOptions) => {
    try {
      // Validate source (ref or --text)
      if (!ref && !options.text) {
        console.log(error('Either <ref> argument or --text option is required for source element'));
        process.exit(1);
      }

      // Check if relative drag mode
      const isRelativeDrag = options.deltaX !== undefined || options.deltaY !== undefined;

      if (isRelativeDrag) {
        // Relative drag mode - delta_x/delta_y required
        if (options.target || options.targetSelector) {
          console.log(error('Cannot use --target/--target-selector with --delta-x/--delta-y'));
          process.exit(1);
        }
      } else {
        // Standard drag mode - target required
        if (!options.target && !options.targetSelector) {
          console.log(
            error(
              'Either --target <ref>, --target-selector <selector>, or --delta-x/--delta-y is required'
            )
          );
          process.exit(1);
        }
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

      let result;

      if (isRelativeDrag) {
        // Relative drag action
        const action: {
          type: 'relative_drag_and_drop';
          ref?: string;
          text?: string;
          delta_x: number;
          delta_y: number;
          include_snapshot_diff?: boolean;
        } = {
          type: 'relative_drag_and_drop',
          delta_x: parseInt(options.deltaX || '0', 10),
          delta_y: parseInt(options.deltaY || '0', 10),
        };

        if (ref) {
          action.ref = normalizeRef(ref);
        } else if (options.text) {
          action.text = options.text;
        }
        if (options.diff !== false) {
          action.include_snapshot_diff = true;
        }

        result = await client.executeAction(resolved.id, action);

        if (result.success) {
          const source = ref ? `element ${normalizeRef(ref)}` : `"${options.text}"`;
          console.log(
            success(`Dragged ${source} by (${action.delta_x}, ${action.delta_y}) pixels`)
          );

          if (result.snapshot_diff) {
            console.log('');
            console.log(formatSnapshotDiff(result.snapshot_diff));
          }

          if (result.downloads?.length) {
            console.log('');
            console.log(formatDownloads(result.downloads));
          }

          await touchSession(resolved.id);
        }
      } else {
        // Standard drag action
        const action: {
          type: 'drag_and_drop';
          ref?: string;
          text?: string;
          target_ref?: string;
          target_selector?: string;
          include_snapshot_diff?: boolean;
        } = { type: 'drag_and_drop' };

        if (ref) {
          action.ref = normalizeRef(ref);
        } else if (options.text) {
          action.text = options.text;
        }

        if (options.target) {
          action.target_ref = normalizeRef(options.target);
        } else if (options.targetSelector) {
          action.target_selector = options.targetSelector;
        }

        if (options.diff !== false) {
          action.include_snapshot_diff = true;
        }

        result = await client.executeAction(resolved.id, action);

        if (result.success) {
          const source = ref ? `element ${normalizeRef(ref)}` : `"${options.text}"`;
          const target = options.target
            ? `element ${normalizeRef(options.target)}`
            : `selector "${options.targetSelector}"`;
          console.log(success(`Dragged ${source} to ${target}`));

          if (result.snapshot_diff) {
            console.log('');
            console.log(formatSnapshotDiff(result.snapshot_diff));
          }

          if (result.downloads?.length) {
            console.log('');
            console.log(formatDownloads(result.downloads));
          }

          await touchSession(resolved.id);
        }
      }

      if (!result.success) {
        const hint = result.error || 'Drag failed';
        console.log(error(`${hint}. Use 'qa-use browser snapshot' to see available elements.`));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to drag element'));
      process.exit(1);
    }
  });
