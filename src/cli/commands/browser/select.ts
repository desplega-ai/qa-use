/**
 * qa-use browser select - Select dropdown option by ref or semantic text
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error, success } from '../../lib/output.js';

interface SelectOptions {
  sessionId?: string;
  text?: string;
}

/**
 * Normalize ref by stripping leading @ if present
 */
function normalizeRef(ref: string): string {
  return ref.startsWith('@') ? ref.slice(1) : ref;
}

export const selectCommand = new Command('select')
  .description('Select a dropdown option by ref or semantic description')
  .argument('[ref]', 'Element ref from snapshot (e.g., "e5" or "@e5")')
  .argument('<value>', 'Option value to select')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('-t, --text <description>', 'Semantic element description (AI-based, slower)')
  .action(
    async (refOrValue: string, valueOrUndefined: string | undefined, options: SelectOptions) => {
      try {
        // Handle argument parsing: if --text is used, first arg is value; otherwise first is ref, second is value
        let ref: string | undefined;
        let value: string;

        if (options.text) {
          // When using --text, the first argument is the value
          value = refOrValue;
          if (!value) {
            console.log(error('Value argument is required'));
            process.exit(1);
          }
        } else {
          // Normal mode: first arg is ref, second is value
          ref = refOrValue;
          value = valueOrUndefined as string;
          if (!ref || !value) {
            console.log(
              error('Both <ref> and <value> arguments are required (or use --text with <value>)')
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

        // Build action with either ref or text
        const action: { type: 'select'; ref?: string; text?: string; value: string } = {
          type: 'select',
          value,
        };
        if (ref) {
          action.ref = normalizeRef(ref);
        } else if (options.text) {
          action.text = options.text;
        }

        const result = await client.executeAction(resolved.id, action);

        if (result.success) {
          const displayValue = value.length > 50 ? `${value.slice(0, 47)}...` : value;
          const target = ref ? normalizeRef(ref) : `"${options.text}"`;
          console.log(success(`Selected "${displayValue}" in ${target}`));
          await touchSession(resolved.id);
        } else {
          const hint = result.error || 'Select failed';
          console.log(error(`${hint}. Use 'qa-use browser snapshot' to see available elements.`));
          process.exit(1);
        }
      } catch (err) {
        console.log(error(err instanceof Error ? err.message : 'Failed to select option'));
        process.exit(1);
      }
    }
  );
