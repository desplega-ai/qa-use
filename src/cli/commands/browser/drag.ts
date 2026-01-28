/**
 * qa-use browser drag - Drag element to target
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { success, error } from '../../lib/output.js';

interface DragOptions {
  sessionId?: string;
  text?: string;
  target?: string;
  targetSelector?: string;
}

/**
 * Normalize ref by stripping leading @ if present
 */
function normalizeRef(ref: string): string {
  return ref.startsWith('@') ? ref.slice(1) : ref;
}

export const dragCommand = new Command('drag')
  .description('Drag an element to a target element')
  .argument('[ref]', 'Source element ref from snapshot (e.g., "e3" or "@e3")')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('-t, --text <description>', 'Semantic source element description (AI-based)')
  .option('--target <ref>', 'Target element ref')
  .option('--target-selector <selector>', 'Target CSS selector')
  .action(async (ref: string | undefined, options: DragOptions) => {
    try {
      // Validate source (ref or --text)
      if (!ref && !options.text) {
        console.log(error('Either <ref> argument or --text option is required for source element'));
        process.exit(1);
      }

      // Validate target (--target or --target-selector)
      if (!options.target && !options.targetSelector) {
        console.log(error('Either --target <ref> or --target-selector <selector> is required'));
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

      // Build action
      const action: {
        type: 'drag_and_drop';
        ref?: string;
        text?: string;
        target_ref?: string;
        target_selector?: string;
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

      const result = await client.executeAction(resolved.id, action);

      if (result.success) {
        const source = ref ? `element ${normalizeRef(ref)}` : `"${options.text}"`;
        const target = options.target
          ? `element ${normalizeRef(options.target)}`
          : `selector "${options.targetSelector}"`;
        console.log(success(`Dragged ${source} to ${target}`));
        await touchSession(resolved.id);
      } else {
        const hint = result.error || 'Drag failed';
        console.log(error(`${hint}. Use 'qa-use browser snapshot' to see available elements.`));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to drag element'));
      process.exit(1);
    }
  });
