/**
 * qa-use browser generate-test - Generate test YAML from recorded session blocks
 */

import * as fs from 'node:fs/promises';
import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error, success } from '../../lib/output.js';

interface GenerateTestOptions {
  sessionId?: string;
  name: string;
  appConfig?: string;
  output?: string;
}

export const generateTestCommand = new Command('generate-test')
  .description('Generate test YAML from recorded session blocks')
  .requiredOption('-n, --name <name>', 'Name for the generated test')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('-a, --app-config <id>', 'App config ID')
  .option('-o, --output <path>', 'Output file path (prints to stdout if not specified)')
  .action(async (options: GenerateTestOptions) => {
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

      const result = await client.generateTest(resolved.id, {
        name: options.name,
        ...(options.appConfig && { app_config: options.appConfig }),
      });

      if (options.output) {
        await fs.writeFile(options.output, result.yaml);
        console.log(success(`Test written to ${options.output} (${result.block_count} blocks)`));
      } else {
        console.log(result.yaml);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to generate test'));
      process.exit(1);
    }
  });
