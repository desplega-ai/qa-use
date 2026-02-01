/**
 * qa-use test run - Run test definitions
 */

import { Command } from 'commander';
import { ApiClient } from '../../../../lib/api/index.js';
import { getAgentSessionId } from '../../../../lib/env/index.js';
import {
  type BrowserTunnelSession,
  getEffectiveWsUrl,
  startBrowserWithTunnel,
  stopBrowserWithTunnel,
} from '../../lib/browser.js';
import { loadConfig } from '../../lib/config.js';
import { downloadAssets } from '../../lib/download.js';
import {
  applyVariableOverrides,
  loadAllTests,
  loadTestWithDeps,
  resolveTestPath,
} from '../../lib/loader.js';
import {
  addDownloadedFile,
  clearDownloadedFiles,
  clearStepScreenshots,
  error,
  formatError,
  info,
  printDownloadedFilesSummary,
  printScreenshotsSummary,
  success,
} from '../../lib/output.js';
import { runTest } from '../../lib/runner.js';

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
  .option('--tunnel', 'Start local browser with tunnel (required for localhost URLs)')
  .option('--headful', 'Show browser window (use with --tunnel)')
  .option('--ws-url <url>', 'Use existing tunneled browser (from `browser create --tunnel`)')
  .option('--autofix', 'Enable AI self-healing (default: off)')
  .option('--screenshots', 'Capture screenshots at each step')
  .option(
    '--download',
    'Download all assets (screenshots, recordings, HAR) to /tmp/qa-use/downloads/'
  )
  .option('--var <key=value...>', 'Variable overrides', collectVars, {})
  .option('--app-config-id <uuid>', 'App config ID to use')
  .option('--timeout <seconds>', 'Timeout in seconds', '300')
  .option('--verbose', 'Output raw SSE event data for debugging')
  .option('--update-local', 'Update local test file when AI auto-fixes the test')
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
      let sourceFile: string | undefined;

      if (options.id) {
        // Run by cloud ID - no local definition needed
        testDefinitions = undefined;
      } else if (options.all) {
        // Load all test definitions
        console.log('Loading all tests...');
        testDefinitions = await loadAllTests(config.test_directory || './qa-tests');
        console.log(success(`Loaded ${testDefinitions.length} tests\n`));
        // Note: --update-local only works for single test runs
      } else if (test) {
        // Load specific test and its dependencies
        console.log(`Loading test: ${test}...`);
        const testDir = config.test_directory || './qa-tests';
        testDefinitions = await loadTestWithDeps(test, testDir);
        // Track source file for --update-local support
        sourceFile = resolveTestPath(test, testDir);
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

      // Determine ws_url: from --ws-url flag, --tunnel (starts new browser), or none (backend browser)
      let browserSession: BrowserTunnelSession | null = null;
      let wsUrl: string | undefined = options.wsUrl;

      try {
        // Validate flag combinations
        if (options.wsUrl && (options.tunnel || options.headful)) {
          console.log(error('Cannot use --ws-url with --tunnel or --headful'));
          process.exit(1);
        }

        // Check if running in development mode (localhost API)
        const isDevelopment =
          process.env.NODE_ENV === 'development' ||
          config.api_url?.includes('localhost') ||
          config.api_url?.includes('127.0.0.1');

        // Handle --headful without --tunnel
        if (options.headful && !options.tunnel && !isDevelopment) {
          console.log(error('--headful requires --tunnel flag'));
          console.log('  Use: qa-use test run <name> --tunnel --headful');
          console.log('  Or for headless local browser: qa-use test run <name> --tunnel');
          process.exit(1);
        }

        if (options.tunnel) {
          const headless = !options.headful;
          console.log(
            `Starting local browser with tunnel (${headless ? 'headless' : 'visible'})...`
          );
          console.log('⏳ First run may take a moment while the tunnel establishes connection');
          browserSession = await startBrowserWithTunnel(undefined, {
            headless,
            apiKey: config.api_key,
            sessionIndex: 0,
          });
          wsUrl = getEffectiveWsUrl(browserSession);
          console.log(success('Browser ready, running test...'));
        } else if (options.wsUrl) {
          console.log(`Using existing tunneled browser: ${options.wsUrl}`);
        }

        // Clear any previous screenshots and downloads
        clearStepScreenshots();
        clearDownloadedFiles();

        // Run the test with SSE streaming
        const result = await runTest(
          client,
          {
            test_definitions: testDefinitions,
            test_id: options.id,
            persist: options.persist || config.defaults?.persist || false,
            // When using ws_url, headless flag is irrelevant (backend uses our browser)
            // When --headful without tunnel (dev mode), tell backend to run visible browser
            headless: wsUrl ? true : options.headful ? false : (config.defaults?.headless ?? true),
            allow_fix: options.autofix || config.defaults?.allow_fix || false,
            capture_screenshots: options.screenshots || options.download || false,
            ws_url: wsUrl,
            agent_session_id: getAgentSessionId(),
          },
          {
            verbose: options.verbose || false,
            updateLocal: options.updateLocal || false,
            sourceFile,
            download: options.download || false,
            downloadBaseDir: '/tmp/qa-use/downloads',
            testId: testDefinitions?.[0]?.id || undefined,
          }
        );

        // Download assets if --download option is enabled
        if (options.download && result.assets && result.run_id) {
          const downloadedAssets = await downloadAssets(
            result.assets,
            '/tmp/qa-use/downloads',
            testDefinitions?.[0]?.id || undefined,
            result.run_id,
            sourceFile
          );
          // Add downloaded assets to the tracking list
          for (const asset of downloadedAssets) {
            addDownloadedFile(asset.type, asset.path);
          }
        }

        // Print result summary
        printScreenshotsSummary();

        // Print downloaded files summary if any
        if (options.download) {
          printDownloadedFilesSummary();
        }

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
      } finally {
        // Cleanup browser and tunnel
        if (browserSession) {
          console.log('Cleaning up browser and tunnel...');
          await stopBrowserWithTunnel(browserSession);
        }
      }
    } catch (err) {
      const errorMsg = formatError(err);
      console.log(error(`Test execution failed: ${errorMsg}`));

      // Hint to use validate command for validation-like errors
      if (errorMsg.includes('Validation failed') || errorMsg.includes('validation error')) {
        console.log(
          info(
            `\nTip: Run 'qa-use test validate ${test || '<test-name>'}' to see detailed validation errors.`
          )
        );
      }

      process.exit(1);
    }
  });
