/**
 * qa-use browser get-blocks - Get recorded blocks (test steps) from the session
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error } from '../../lib/output.js';

interface GetBlocksOptions {
  sessionId?: string;
  json?: boolean;
}

export const getBlocksCommand = new Command('get-blocks')
  .description('Get recorded blocks (test steps) from the session')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('--json', 'Output raw JSON (default)', true)
  .action(async (options: GetBlocksOptions) => {
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

      const blocks = await client.getBlocks(resolved.id);

      // Output as JSON (default and only mode for now)
      console.log(JSON.stringify(blocks, null, 2));
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to get blocks'));
      process.exit(1);
    }
  });
