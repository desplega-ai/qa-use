/**
 * qa-use browser create - Create a new browser session
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import type { ViewportType } from '../../../../lib/api/browser-types.js';
import { BrowserManager } from '../../../../lib/browser/index.js';
import { getAgentSessionId } from '../../../../lib/env/index.js';
import { TunnelManager } from '../../../../lib/tunnel/index.js';
import { ensureBrowsersInstalled } from '../../lib/browser.js';
import {
  createStoredSession,
  removeStoredSession,
  storeSession,
} from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error, info, success, warning } from '../../lib/output.js';

interface CreateOptions {
  headless?: boolean;
  viewport?: ViewportType;
  timeout?: number;
  wsUrl?: string;
  tunnel?: boolean;
  subdomain?: string;
  afterTestId?: string;
  var?: Record<string, string>;
}

function collectVars(value: string, previous: Record<string, string>) {
  const [key, val] = value.split('=');
  return { ...previous, [key]: val };
}

export const createCommand = new Command('create')
  .description('Create a new browser session')
  .option('--headless', 'Run browser in headless mode (default: true for remote, false for tunnel)')
  .option('--no-headless', 'Run browser with visible UI')
  .option(
    '--viewport <type>',
    'Viewport type: desktop, mobile, or tablet (default: desktop)',
    'desktop'
  )
  .option('--timeout <seconds>', 'Session timeout in seconds (default: 300)', '300')
  .option('--ws-url <url>', 'WebSocket URL for remote/tunneled browser')
  .option('--tunnel', 'Start local browser with tunnel (keeps process running)')
  .option('-s, --subdomain <name>', 'Custom tunnel subdomain (only with --tunnel)')
  .option('--after-test-id <uuid>', 'Run a test before session becomes interactive')
  .option(
    '--var <key=value...>',
    'Variable overrides: base_url, login_url, login_username, login_password',
    collectVars,
    {}
  )
  .action(async (options: CreateOptions) => {
    // Validate mutually exclusive options
    if (options.tunnel && options.wsUrl) {
      console.log(error('Cannot use both --tunnel and --ws-url'));
      process.exit(1);
    }

    if (options.subdomain && !options.tunnel) {
      console.log(error('--subdomain can only be used with --tunnel'));
      process.exit(1);
    }

    // Load configuration
    const config = await loadConfig();
    if (!config.api_key) {
      console.log(error('API key not configured. Run `qa-use setup` first.'));
      process.exit(1);
    }

    // Validate viewport type
    const validViewports: ViewportType[] = ['desktop', 'mobile', 'tablet'];
    const viewport = (options.viewport || 'desktop') as ViewportType;
    if (!validViewports.includes(viewport)) {
      console.log(
        error(`Invalid viewport: ${viewport}. Must be one of: ${validViewports.join(', ')}`)
      );
      process.exit(1);
    }

    // Parse timeout
    const timeout = parseInt(String(options.timeout), 10);
    if (Number.isNaN(timeout) || timeout < 60 || timeout > 3600) {
      console.log(error('Timeout must be between 60 and 3600 seconds'));
      process.exit(1);
    }

    // Create client and set API key
    const client = new BrowserApiClient(config.api_url);
    client.setApiKey(config.api_key);

    if (options.tunnel) {
      // Tunnel mode: start local browser + tunnel, then create session
      await runTunnelMode(client, config.api_key, options, viewport, timeout);
    } else {
      // Normal mode: create remote session and exit
      await createRemoteSession(client, options, viewport, timeout);
    }
  });

/**
 * Create a remote browser session (normal mode)
 */
async function createRemoteSession(
  client: BrowserApiClient,
  options: CreateOptions,
  viewport: ViewportType,
  timeout: number
): Promise<void> {
  try {
    if (options.afterTestId) {
      console.log(info(`Creating browser session with after-test: ${options.afterTestId}...`));
    } else {
      console.log(info('Creating browser session...'));
    }

    // Create session
    const session = await client.createSession({
      headless: options.headless !== false,
      viewport,
      timeout,
      ws_url: options.wsUrl,
      after_test_id: options.afterTestId,
      vars: options.var,
      agent_session_id: getAgentSessionId(),
    });

    console.log(info(`Session created: ${session.id}`));
    console.log(info(`Status: ${session.status}`));

    // Wait for session to become active if starting
    if (session.status === 'starting') {
      console.log(info('Waiting for session to become active...'));
      const activeSession = await client.waitForStatus(session.id, 'active', 60000);
      console.log(success(`Session ${activeSession.id} is now active`));
    } else if (session.status === 'failed') {
      // Test execution failed - display error and exit
      const errorMsg = session.error_message || 'Test execution failed';
      console.log(error(`Session failed: ${errorMsg}`));
      process.exit(1);
    } else if (session.status === 'active') {
      console.log(success(`Session ${session.id} is active`));
    }

    // Store session locally
    const storedSession = createStoredSession(session.id);
    await storeSession(storedSession);

    // Print session info
    console.log('');
    console.log(`Session ID: ${session.id}`);
    console.log(`Viewport: ${viewport}`);
    console.log(`Headless: ${options.headless !== false}`);
    console.log(`Timeout: ${timeout}s`);
    if (options.wsUrl) {
      console.log(`WebSocket URL: ${options.wsUrl}`);
    }
    if (options.afterTestId) {
      console.log(`After Test ID: ${options.afterTestId}`);
    }
    if (options.var && Object.keys(options.var).length > 0) {
      console.log(
        `Variables: ${Object.entries(options.var)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}`
      );
    }
  } catch (err) {
    // Handle specific error cases for after_test_id
    if (options.afterTestId && err instanceof Error) {
      const message = err.message.toLowerCase();
      if (message.includes('not found') || message.includes('404')) {
        console.log(error('Test not found'));
        process.exit(1);
      }
      if (message.includes('forbidden') || message.includes('403')) {
        console.log(error('Test belongs to different organization'));
        process.exit(1);
      }
    }
    console.log(error(err instanceof Error ? err.message : 'Failed to create session'));
    process.exit(1);
  }
}

/**
 * Tunnel mode: start local browser + tunnel + API session, then keep running
 */
async function runTunnelMode(
  client: BrowserApiClient,
  apiKey: string,
  options: CreateOptions,
  viewport: ViewportType,
  timeout: number
): Promise<void> {
  // Check that browsers are installed before expensive operations
  ensureBrowsersInstalled();

  // Track resources for cleanup
  let browser: BrowserManager | null = null;
  let tunnel: TunnelManager | null = null;
  let sessionId: string | null = null;
  let heartbeatIntervalId: NodeJS.Timeout | null = null;

  // Cleanup function
  const cleanup = async (exitCode: number = 0) => {
    console.log('');
    console.log(info('Shutting down...'));

    // Stop heartbeat
    if (heartbeatIntervalId) {
      clearInterval(heartbeatIntervalId);
      console.log(success('Heartbeat stopped'));
    }

    // Close API session and remove from local storage
    if (sessionId && client) {
      try {
        await client.deleteSession(sessionId);
        await removeStoredSession(sessionId);
        console.log(success('API session closed'));
      } catch (err) {
        console.log(
          warning(`Session cleanup: ${err instanceof Error ? err.message : 'Unknown error'}`)
        );
      }
    }

    // Stop tunnel
    if (tunnel) {
      try {
        await tunnel.stopTunnel();
        console.log(success('Tunnel closed'));
      } catch (err) {
        console.log(
          warning(`Tunnel cleanup: ${err instanceof Error ? err.message : 'Unknown error'}`)
        );
      }
    }

    // Stop browser
    if (browser) {
      try {
        await browser.stopBrowser();
        console.log(success('Browser closed'));
      } catch (err) {
        console.log(
          warning(`Browser cleanup: ${err instanceof Error ? err.message : 'Unknown error'}`)
        );
      }
    }

    console.log('');
    console.log(info('Tunnel mode stopped'));
    process.exit(exitCode);
  };

  // Handle signals for graceful shutdown
  process.on('SIGINT', () => cleanup(0));
  process.on('SIGTERM', () => cleanup(0));

  try {
    // Default to visible browser for tunnel mode (unless --headless explicitly set)
    const headless = options.headless === true;

    console.log('');
    console.log(info('Starting browser with tunnel...'));
    console.log(`Mode: ${headless ? 'Headless' : 'Visible Browser'}`);
    console.log('');

    // Step 1: Start local browser
    console.log(info('Starting browser...'));
    browser = new BrowserManager();
    const browserResult = await browser.startBrowser({ headless });
    const wsEndpoint = browserResult.wsEndpoint;
    console.log(success('Browser started'));

    // Step 2: Start tunnel with deterministic subdomain
    console.log(info('Creating tunnel...'));
    tunnel = new TunnelManager();
    const wsUrl = new URL(wsEndpoint);
    const browserPort = parseInt(wsUrl.port, 10);

    await tunnel.startTunnel(browserPort, {
      subdomain: options.subdomain,
      apiKey: apiKey,
      sessionIndex: 0,
    });
    console.log(success('Tunnel created'));

    // Step 3: Get tunneled WebSocket URL
    const localWsUrl = browser.getWebSocketEndpoint();
    if (!localWsUrl) {
      console.log(error('Failed to get browser WebSocket endpoint'));
      await cleanup(1);
      return;
    }

    const tunneledWsUrl = tunnel.getWebSocketUrl(localWsUrl);
    if (!tunneledWsUrl) {
      console.log(error('Failed to create tunneled WebSocket URL'));
      await cleanup(1);
      return;
    }

    console.log(info(`Tunneled WebSocket: ${tunneledWsUrl}`));
    console.log('');

    // Step 4: Create API session with tunneled ws_url
    if (options.afterTestId) {
      console.log(info(`Creating API session with after-test: ${options.afterTestId}...`));
    } else {
      console.log(info('Creating API session...'));
    }

    let session;
    try {
      session = await client.createSession({
        headless,
        viewport,
        timeout,
        ws_url: tunneledWsUrl,
        after_test_id: options.afterTestId,
        vars: options.var,
        agent_session_id: getAgentSessionId(),
      });
    } catch (err) {
      // Handle specific error cases for after_test_id
      if (options.afterTestId && err instanceof Error) {
        const message = err.message.toLowerCase();
        if (message.includes('not found') || message.includes('404')) {
          console.log(error('Test not found'));
          await cleanup(1);
          return;
        }
        if (message.includes('forbidden') || message.includes('403')) {
          console.log(error('Test belongs to different organization'));
          await cleanup(1);
          return;
        }
      }
      throw err;
    }

    sessionId = session.id;
    console.log(info(`Session created: ${session.id}`));

    // Wait for session to become active if starting
    if (session.status === 'starting') {
      if (options.afterTestId) {
        console.log(info('Waiting for test to complete...'));
      } else {
        console.log(info('Waiting for session to become active...'));
      }
      // Use longer timeout for after-test scenarios (180s) vs normal (60s)
      const waitTimeout = options.afterTestId ? 180000 : 60000;
      const activeSession = await client.waitForStatus(session.id, 'active', waitTimeout);

      if (activeSession.status === 'failed') {
        const errorMsg = activeSession.error_message || 'Test execution failed';
        console.log(error(`Session failed: ${errorMsg}`));
        await cleanup(1);
        return;
      }
    } else if (session.status === 'failed') {
      const errorMsg = session.error_message || 'Test execution failed';
      console.log(error(`Session failed: ${errorMsg}`));
      await cleanup(1);
      return;
    }
    console.log(success('Session is active'));

    // Store session locally
    const storedSession = createStoredSession(session.id);
    await storeSession(storedSession);

    // Print session info
    console.log('');
    console.log('='.repeat(50));
    console.log(success('Browser tunnel ready!'));
    console.log('='.repeat(50));
    console.log('');
    console.log(`Session ID:     ${session.id}`);
    console.log(`Viewport:       ${viewport}`);
    console.log(`Headless:       ${headless}`);
    console.log(`Timeout:        ${timeout}s`);
    console.log(`WebSocket URL:  ${tunneledWsUrl}`);
    if (options.afterTestId) {
      console.log(`After Test ID:  ${options.afterTestId}`);
    }
    if (options.var && Object.keys(options.var).length > 0) {
      console.log(
        `Variables:      ${Object.entries(options.var)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}`
      );
    }
    console.log('');
    console.log(info('Use this session with other browser commands:'));
    console.log(`  qa-use browser goto https://example.com`);
    console.log(`  qa-use browser screenshot`);
    console.log(`  qa-use browser snapshot`);
    console.log('');
    console.log(info('Press Ctrl+C to stop'));
    console.log('');

    // Step 5: Set up heartbeat to check session and tunnel health
    let heartbeatCount = 0;
    const heartbeatInterval = 30000; // 30 seconds

    heartbeatIntervalId = setInterval(async () => {
      heartbeatCount++;
      const timestamp = new Date().toLocaleTimeString();

      try {
        // Check if API session still exists
        const sessionStatus = await client.getSession(sessionId!);

        if (sessionStatus.status === 'closed') {
          console.log(`[${timestamp}] Session closed externally, shutting down...`);
          await removeStoredSession(sessionId!);
          sessionId = null;
          await cleanup(0);
          return;
        }

        // Check tunnel health
        const tunnelHealthy = await tunnel!.checkHealth();

        if (tunnelHealthy) {
          console.log(`[${timestamp}] Heartbeat #${heartbeatCount} - healthy`);
        } else {
          console.log(
            `[${timestamp}] ${warning(`Heartbeat #${heartbeatCount} - tunnel unhealthy`)}`
          );
        }
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : 'Unknown error';

        // If session not found, it was closed externally
        if (errMessage.includes('not found') || errMessage.includes('404')) {
          console.log(`[${timestamp}] Session closed externally, shutting down...`);
          await removeStoredSession(sessionId!);
          sessionId = null;
          await cleanup(0);
          return;
        }

        console.log(`[${timestamp}] ${warning(`Heartbeat error: ${errMessage}`)}`);
      }
    }, heartbeatInterval);

    // Keep the process running
  } catch (err) {
    console.log(error(err instanceof Error ? err.message : 'Failed to start tunnel'));
    await cleanup(1);
  }
}
