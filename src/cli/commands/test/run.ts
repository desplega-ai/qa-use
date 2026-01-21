/**
 * qa-use test run - Run test definitions
 */

import { Command } from 'commander';
import { loadConfig } from '../../lib/config.js';
import { loadTestWithDeps, loadAllTests, applyVariableOverrides } from '../../lib/loader.js';
import { runTest } from '../../lib/runner.js';
import { error, success } from '../../lib/output.js';
import { ApiClient } from '../../../../lib/api/index.js';

function collectVars(value: string, previous: Record<string, string>) {
  const [key, val] = value.split('=');
  return { ...previous, [key]: val };
}

export const runCommand = new Command('run')
  .description('Run a test definition')
  .argument('[test]', 'Test name or path (e.g., auth/login)')
  .option('--id <uuid>', 'Run cloud test by ID instead of local file')
  .option('--all', 'Run all tests in test directory')
  .option('--persist', 'Save test to cloud after run')
  .option('--no-headless', 'Show browser window')
  .option('--no-autofix', 'Disable AI self-healing')
  .option('--screenshots', 'Capture screenshots at each step')
  .option('--var <key=value...>', 'Variable overrides', collectVars, {})
  .option('--app-config-id <uuid>', 'App config ID to use')
  .option('--timeout <seconds>', 'Timeout in seconds', '300')
  .action(async (test, options) => {
    try {
      const config = await loadConfig();

      // Check API key
      if (!config.api_key) {
        console.log(error('API key not configured'));
        console.log('  Run `qa-use setup` to configure');
        process.exit(1);
      }

      // Initialize API client
      const client = new ApiClient(config.api_url);
      client.setApiKey(config.api_key);

      let testDefinitions;

      if (options.id) {
        // Run by cloud ID - no local definition needed
        testDefinitions = undefined;
      } else if (options.all) {
        // Load all test definitions
        console.log('Loading all tests...');
        testDefinitions = await loadAllTests(config.test_directory || './qa-tests');
        console.log(success(`Loaded ${testDefinitions.length} tests\n`));
      } else if (test) {
        // Load specific test and its dependencies
        console.log(`Loading test: ${test}...`);
        testDefinitions = await loadTestWithDeps(test, config.test_directory || './qa-tests');
        console.log(success(`Loaded ${testDefinitions.length} test(s)\n`));
      } else {
        console.log(error('Usage: qa-use test run <test-name>'));
        console.log('       qa-use test run --id <uuid>');
        console.log('       qa-use test run --all');
        process.exit(1);
      }

      // Apply variable overrides
      if (testDefinitions && Object.keys(options.var).length > 0) {
        applyVariableOverrides(testDefinitions, options.var);
        console.log(success(`Applied ${Object.keys(options.var).length} variable overrides\n`));
      }

      // Run the test with SSE streaming
      const result = await runTest(client, {
        test_definitions: testDefinitions,
        test_id: options.id,
        persist: options.persist || config.defaults?.persist || false,
        headless: options.headless !== false && (config.defaults?.headless ?? true),
        allow_fix: options.autofix !== false && (config.defaults?.allow_fix ?? true),
        capture_screenshots: options.screenshots || false,
      });

      // Print result summary
      if (result.assets) {
        console.log('\nAssets:');
        if (result.assets.recording_url) {
          console.log(`  Recording: ${result.assets.recording_url}`);
        }
        if (result.assets.har_url) {
          console.log(`  HAR: ${result.assets.har_url}`);
        }
      }

      // Exit with appropriate code
      if (result.status !== 'passed') {
        process.exit(1);
      }
    } catch (err) {
      console.log(error(`Test execution failed: ${err}`));
      process.exit(1);
    }
  });
