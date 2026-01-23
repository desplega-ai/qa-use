/**
 * qa-use browser tunnel - Start a local browser with tunnel and create API session
 *
 * This command:
 * 1. Starts a local Playwright browser
 * 2. Creates a tunnel to expose the browser WebSocket
 * 3. Creates an API session with the tunneled ws_url
 * 4. Keeps the tunnel alive with heartbeat
 * 5. Cleans up on exit (close session, stop tunnel, stop browser)
 */

import { Command } from 'commander';
import { BrowserManager } from '../../../../lib/browser/index.js';
import { TunnelManager } from '../../../../lib/tunnel/index.js';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import type { ViewportType } from '../../../../lib/api/browser-types.js';
import {
  storeSession,
  createStoredSession,
  removeStoredSession,
} from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { success, error, info, warning } from '../../lib/output.js';

interface TunnelOptions {
  headless?: boolean;
  viewport?: ViewportType;
  timeout?: number;
  subdomain?: string;
}

export const tunnelCommand = new Command('tunnel')
  .description('Start a local browser with tunnel and create API session')
  .option('--headless', 'Run browser in headless mode (default: false for tunnel)', false)
  .option('--no-headless', 'Run browser with visible UI')
  .option('--visible', 'Run browser with visible UI (alias for --no-headless)')
  .option(
    '--viewport <type>',
    'Viewport type: desktop, mobile, or tablet (default: desktop)',
    'desktop'
  )
  .option('--timeout <seconds>', 'Session timeout in seconds (default: 300)', '300')
  .option('-s, --subdomain <name>', 'Custom tunnel subdomain (overrides deterministic)')
  .action(async (options: TunnelOptions) => {
    // Track resources for cleanup
    let browser: BrowserManager | null = null;
    let tunnel: TunnelManager | null = null;
    let sessionId: string | null = null;
    let client: BrowserApiClient | null = null;
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
      // Load configuration
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      // Create client and set API key
      client = new BrowserApiClient(config.api_url);
      client.setApiKey(config.api_key);

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
      if (isNaN(timeout) || timeout < 60 || timeout > 3600) {
        console.log(error('Timeout must be between 60 and 3600 seconds'));
        process.exit(1);
      }

      // Handle --visible as alias for --no-headless
      const headless = options.headless !== false && !(options as { visible?: boolean }).visible;

      console.log('');
      console.log(info('Starting browser tunnel...'));
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
      const browserPort = parseInt(wsUrl.port);

      await tunnel.startTunnel(browserPort, {
        subdomain: options.subdomain,
        apiKey: config.api_key,
        sessionIndex: 0, // Use index 0 for browser tunnel command
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
      console.log(info('Creating API session...'));
      const session = await client.createSession({
        headless,
        viewport,
        timeout,
        ws_url: tunneledWsUrl,
      });

      sessionId = session.id;
      console.log(info(`Session created: ${session.id}`));

      // Wait for session to become active if starting
      if (session.status === 'starting') {
        console.log(info('Waiting for session to become active...'));
        await client.waitForStatus(session.id, 'active', 60000);
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
      console.log('');
      console.log(info('Use this session with other browser commands:'));
      console.log(`  qa-use browser goto ${session.id} https://example.com`);
      console.log(`  qa-use browser screenshot ${session.id}`);
      console.log(`  qa-use browser snapshot ${session.id}`);
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
          const sessionStatus = await client!.getSession(sessionId!);

          if (sessionStatus.status === 'closed') {
            console.log(`[${timestamp}] Session closed externally, shutting down...`);
            await removeStoredSession(sessionId!);
            sessionId = null; // Prevent cleanup from trying to delete already-closed session
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
            sessionId = null; // Prevent cleanup from trying to delete already-closed session
            await cleanup(0);
            return;
          }

          console.log(`[${timestamp}] ${warning(`Heartbeat error: ${errMessage}`)}`);
        }
      }, heartbeatInterval);

      // Keep the process running
      // The interval and signal handlers will keep it alive
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to start tunnel'));
      await cleanup(1);
    }
  });
