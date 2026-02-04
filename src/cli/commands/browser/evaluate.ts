/**
 * qa-use browser evaluate - Execute JavaScript in browser context
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { normalizeRef } from '../../lib/browser-utils.js';
import { loadConfig } from '../../lib/config.js';
import { error } from '../../lib/output.js';

interface EvaluateOptions {
  sessionId?: string;
  ref?: string;
  text?: string;
  json?: boolean;
}

export const evaluateCommand = new Command('evaluate')
  .description('Execute JavaScript in browser context')
  .argument('<expression>', 'JavaScript expression to evaluate (e.g., "document.title")')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('-r, --ref <ref>', 'Element ref for element-scoped evaluation (el => ...)')
  .option('-t, --text <description>', 'Semantic element description for element-scoped evaluation')
  .option('--json', 'Output raw JSON result')
  .action(async (expression: string, options: EvaluateOptions) => {
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

      // Build action
      const action: {
        type: 'evaluate';
        expression: string;
        ref?: string;
        text?: string;
      } = {
        type: 'evaluate',
        expression,
      };

      if (options.ref) {
        action.ref = normalizeRef(options.ref);
      } else if (options.text) {
        action.text = options.text;
      }

      const result = await client.executeAction(resolved.id, action);

      if (result.success) {
        const data = result.data as { result?: unknown };
        if (options.json) {
          console.log(JSON.stringify(data.result, null, 2));
        } else {
          // Pretty print based on type
          const value = data.result;
          if (typeof value === 'string') {
            console.log(value);
          } else if (value === null || value === undefined) {
            console.log(String(value));
          } else {
            console.log(JSON.stringify(value, null, 2));
          }
        }
        await touchSession(resolved.id);
      } else {
        console.log(error(result.error || 'Evaluation failed'));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to evaluate expression'));
      process.exit(1);
    }
  });
