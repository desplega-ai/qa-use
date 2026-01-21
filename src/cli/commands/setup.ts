/**
 * qa-use setup - Interactive API key configuration
 */

import { Command } from 'commander';
import { saveConfig, loadConfig } from '../lib/config.js';
import { ApiClient } from '../../../lib/api/index.js';
import { success, error } from '../lib/output.js';
import * as readline from 'readline/promises';

export const setupCommand = new Command('setup')
  .description('Configure API key and default settings')
  .action(async () => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log('🔧 QA-Use Setup\n');

      // Load existing config
      const config = await loadConfig();

      // Ask for API key
      const apiKey = await rl.question(
        `API Key${config.api_key ? ` (current: ${config.api_key.slice(0, 8)}...)` : ''}: `
      );

      if (apiKey.trim()) {
        // Validate API key
        const client = new ApiClient();
        client.setApiKey(apiKey.trim());

        console.log('\n  Validating API key...');
        const validation = await client.validateApiKey();

        if (validation.success) {
          config.api_key = apiKey.trim();
          console.log(success('API key validated'));

          // Get default app config if available
          if (validation.data?.app_config?.id) {
            config.default_app_config_id = validation.data.app_config.id;
            console.log(success(`Default app config: ${validation.data.app_config.id}`));
          }
        } else {
          console.log(error(`Invalid API key: ${validation.message}`));
          process.exit(1);
        }
      }

      // Ask for test directory
      const testDir = await rl.question(
        `Test directory (default: ${config.test_directory || './qa-tests'}): `
      );
      if (testDir.trim()) {
        config.test_directory = testDir.trim();
      }

      // Save configuration
      await saveConfig(config);
      console.log('\n' + success('Configuration saved to .qa-use-tests.json'));
    } catch (err) {
      console.log(error(`Setup failed: ${err}`));
      process.exit(1);
    } finally {
      rl.close();
    }
  });
