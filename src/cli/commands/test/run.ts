/**
 * qa-use test run - Run test definitions
 */

import { Command } from 'commander';
import { getAgentSessionId, getTunnelModeFromConfig } from '../../../../lib/env/index.js';
import {
  type BrowserTunnelSession,
  getEffectiveWsUrl,
  startBrowserWithTunnel,
  stopBrowserWithTunnel,
} from '../../lib/browser.js';
import { createApiClient, loadConfig } from '../../lib/config.js';
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
  printPersistenceNote,
  printScreenshotsSummary,
  success,
} from '../../lib/output.js';
import { runTest } from '../../lib/runner.js';
import { addTunnelOption } from '../../lib/tunnel-option.js';
import { resolveTunnelFlag, resolveTunnelMode } from '../../lib/tunnel-resolve.js';

function collectVars(value: string, previous: Record<string, string>) {
  const [key, val] = value.split('=');
  return { ...previous, [key]: val };
}

export const runCommand = addTunnelOption(
  new Command('run')
    .description('Run a test definition')
    .argument('[test]', 'Test name or path (e.g., auth/login)')
    .option('--id <uuid>', 'Run cloud test by ID instead of local file')
    .option('--all', 'Run all tests in test directory')
    .option('--persist', 'Save test to cloud after run')
    .option('--headful', 'Show browser window (use with --tunnel on)')
    .option('--ws-url <url>', 'Use existing tunneled browser (from `browser create --tunnel on`)')
    .option('--screenshots', 'Capture screenshots at each step')
    .option(
      '--download',
      'Download all assets (screenshots, recordings, HAR) to /tmp/qa-use/downloads/'
    )
    .option('--var <key=value...>', 'Variable overrides', collectVars, {})
    .option('--app-config-id <uuid>', 'App config ID to use')
    .option('--run-matrix', 'When using --id, run all matrix variants')
    .option(
      '--matrix-id <id...>',
      'Run specific matrix option(s) by id (implies --run-matrix). Repeatable.',
      (value: string, previous: string[]) => [...(previous ?? []), value],
      [] as string[]
    )
    .option(
      '--timeout <seconds>',
      'Idle timeout in seconds — abort if no SSE events for this long (0 disables)',
      (v) => Number.parseInt(v, 10),
      300
    )
    .option('--verbose', 'Output raw SSE event data for debugging')
).action(async (test, options) => {
  try {
    const config = await loadConfig();

    // Check API key
    if (!config.api_key) {
      console.log(error('API key not configured'));
      console.log('  Run `qa-use setup` to configure');
      process.exit(1);
    }

    // Initialize API client
    const client = createApiClient(config);

    // Matrix flags require --id (cloud test). Inline test_definitions have no
    // persisted Test.matrix on the server; allowing matrix flags here would
    // silently no-op. --matrix-id implies --run-matrix.
    const matrixIds: string[] = Array.isArray(options.matrixId) ? options.matrixId : [];
    const runMatrix = Boolean(options.runMatrix) || matrixIds.length > 0;
    if (runMatrix && !options.id) {
      console.log(
        error(
          '--run-matrix and --matrix-id require --id <uuid> (cloud test). Inline tests have no persisted matrix.'
        )
      );
      process.exit(1);
    }

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
    } else if (test) {
      // Load specific test and its dependencies
      console.log(`Loading test: ${test}...`);
      const testDir = config.test_directory || './qa-tests';
      testDefinitions = await loadTestWithDeps(test, testDir);
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
      // Resolve tri-state tunnel flag: CLI > config > default 'auto'.
      const resolvedTunnelMode = resolveTunnelFlag(options.tunnel, getTunnelModeFromConfig());

      // Figure out the effective base URL for the Phase-2 auto decision:
      // explicit --var base_url wins; otherwise the first test definition's
      // `variables.base_url` (if any). Undefined disables auto.
      // Variables now carry a flexible union (`string | number | VariableEntry`);
      // unwrap to a plain string for the resolver / tunnel start.
      const rawVarBaseUrl =
        (options.var as Record<string, string> | undefined)?.base_url ??
        testDefinitions?.[0]?.variables?.base_url;
      let varBaseUrl: string | undefined;
      if (typeof rawVarBaseUrl === 'string') {
        varBaseUrl = rawVarBaseUrl;
      } else if (typeof rawVarBaseUrl === 'number') {
        varBaseUrl = String(rawVarBaseUrl);
      } else if (rawVarBaseUrl && typeof rawVarBaseUrl === 'object') {
        const entry = rawVarBaseUrl as { value?: string | number };
        varBaseUrl = entry.value !== undefined ? String(entry.value) : undefined;
      }

      const tunnelDecision = resolveTunnelMode(resolvedTunnelMode, varBaseUrl, config.api_url);
      const tunnelOn = tunnelDecision === 'on';

      // Validate flag combinations
      if (options.wsUrl && (tunnelOn || options.headful)) {
        console.log(error('Cannot use --ws-url with --tunnel on or --headful'));
        process.exit(1);
      }

      // Check if running in development mode (localhost API)
      const isDevelopment =
        process.env.NODE_ENV === 'development' ||
        config.api_url?.includes('localhost') ||
        config.api_url?.includes('127.0.0.1');

      // Handle --headful without --tunnel on
      if (options.headful && !tunnelOn && !isDevelopment) {
        console.log(error('--headful requires --tunnel on'));
        console.log('  Use: qa-use test run <name> --tunnel on --headful');
        console.log('  Or for headless local browser: qa-use test run <name> --tunnel on');
        process.exit(1);
      }

      if (tunnelOn) {
        const headless = !options.headful;
        // Banner + triage-hint come from startBrowserWithTunnel itself;
        // don't double-print an ad-hoc "Starting local browser..." line.
        browserSession = await startBrowserWithTunnel(varBaseUrl, {
          headless,
          apiKey: config.api_key,
          sessionIndex: 0,
          tunnelMode: 'on', // decision already made above
          apiUrl: config.api_url,
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
      const varOverrides = Object.keys(options.var).length > 0 ? options.var : undefined;
      const resolvedPersist = options.persist || config.defaults?.persist || false;

      const result = await runTest(
        client,
        {
          test_definitions: testDefinitions,
          test_id: options.id,
          persist: resolvedPersist,
          // When using ws_url, headless flag is irrelevant (backend uses our browser)
          // When --headful without tunnel (dev mode), tell backend to run visible browser
          headless: wsUrl ? true : options.headful ? false : (config.defaults?.headless ?? true),
          capture_screenshots: options.screenshots || options.download || false,
          ws_url: wsUrl,
          vars: varOverrides,
          agent_session_id: getAgentSessionId(),
          run_matrix: runMatrix || undefined,
          matrix_ids: matrixIds.length > 0 ? matrixIds : undefined,
        },
        {
          verbose: options.verbose || false,
          sourceFile,
          download: options.download || false,
          downloadBaseDir: '/tmp/qa-use/downloads',
          testId: testDefinitions?.[0]?.id || undefined,
          idleTimeoutSec:
            typeof options.timeout === 'number' && Number.isFinite(options.timeout)
              ? options.timeout
              : undefined,
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

      // Tip/warning about persist vs sync state (skipped for --id runs,
      // which have no local definitions to classify).
      printPersistenceNote(testDefinitions, resolvedPersist);

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
