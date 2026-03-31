/**
 * qa-use setup - API key configuration (interactive and headless)
 */

import * as readline from 'node:readline/promises';
import { Command } from 'commander';
import { ApiClient } from '../../../lib/api/index.js';
import { configExists, loadConfig, saveConfig } from '../lib/config.js';
import { error, formatError, info, success, warning } from '../lib/output.js';

export const setupCommand = new Command('setup')
  .description('Configure API key and default settings')
  .option('--api-key <key>', 'API key for authentication')
  .option('--test-dir <path>', 'Test directory path (default: ./qa-tests)')
  .option('--api-url <url>', 'Override API base URL')
  .option('--skip-validation', 'Skip API key validation (offline/CI)')
  .option('-y, --yes', 'Auto-confirm with current/default values')
  .action(async (options) => {
    try {
      const config = await loadConfig();
      const hasExistingConfig = await configExists();
      const hasAnyOption = !!(
        options.apiKey ||
        options.testDir ||
        options.apiUrl ||
        options.skipValidation ||
        options.yes
      );

      // No-op: already configured and no options provided
      if (hasExistingConfig && config.api_key && !hasAnyOption) {
        console.log(success('Already configured (.qa-use.json)'));
        console.log(`  API key:    ${config.api_key.slice(0, 8)}...`);
        console.log(`  Test dir:   ${config.test_directory || './qa-tests'}`);
        if (config.default_app_config_id) {
          console.log(`  App config: ${config.default_app_config_id}`);
        }
        console.log(
          `\n  Run ${info("'qa-use info'")} for full details, or pass options to update.`
        );
        return;
      }

      // Determine mode
      const isHeadless = !!options.apiKey;
      const isAutoConfirm = !!options.yes;

      let apiKey: string | undefined;
      let testDir: string | undefined;

      if (isHeadless) {
        // Headless mode: all values from CLI options
        apiKey = options.apiKey;
        testDir = options.testDir || config.test_directory || './qa-tests';
      } else if (isAutoConfirm) {
        // Auto-confirm mode: use existing/default values
        apiKey = config.api_key;
        testDir = options.testDir || config.test_directory || './qa-tests';

        if (!apiKey) {
          console.log(
            error('No existing API key found. Use --api-key <key> or run interactive setup.')
          );
          process.exit(1);
        }
      } else {
        // Interactive mode
        console.log('🔧 QA-Use Setup\n');

        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        try {
          apiKey = (
            await rl.question(
              `API Key${config.api_key ? ` (current: ${config.api_key.slice(0, 8)}...)` : ''}: `
            )
          ).trim();

          if (!apiKey) {
            apiKey = config.api_key;
          }

          const testDirAnswer = (
            await rl.question(
              `Test directory (default: ${config.test_directory || './qa-tests'}): `
            )
          ).trim();

          testDir = testDirAnswer || config.test_directory || './qa-tests';
        } finally {
          rl.close();
        }
      }

      // Apply API URL override if provided
      if (options.apiUrl) {
        config.api_url = options.apiUrl;
      }

      // Validate and store API key
      if (apiKey) {
        if (options.skipValidation) {
          config.api_key = apiKey;
          console.log(warning("API key validation skipped. Run 'qa-use info' to verify."));
        } else {
          const client = new ApiClient(config.api_url);
          client.setApiKey(apiKey);

          console.log('  Validating API key...');
          const validation = await client.validateApiKey();

          if (validation.success) {
            config.api_key = apiKey;
            console.log(success('API key validated'));

            if (validation.data?.app_config?.id) {
              config.default_app_config_id = validation.data.app_config.id;
              console.log(success(`Default app config: ${validation.data.app_config.id}`));
            }
          } else {
            console.log(error(`Invalid API key: ${validation.message}`));
            process.exit(1);
          }
        }
      }

      // Set test directory
      if (testDir) {
        config.test_directory = testDir;
      }

      // Save configuration
      await saveConfig(config);
      console.log(`\n${success('Configuration saved to .qa-use.json')}`);
    } catch (err) {
      console.log(error(`Setup failed: ${formatError(err)}`));
      process.exit(1);
    }
  });

setupCommand.addHelpText(
  'after',
  `
Examples:
  qa-use setup                                    Interactive setup
  qa-use setup --api-key sk-xxx                   Non-interactive with validation
  qa-use setup --api-key sk-xxx --test-dir ./e2e  Custom test directory
  qa-use setup --api-key sk-xxx --skip-validation Offline/CI setup
  qa-use setup --yes                              Accept defaults for missing fields
  qa-use setup                                    No-op if already configured
`
);
