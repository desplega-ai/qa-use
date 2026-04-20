/**
 * Browser and tunnel management for CLI test execution
 *
 * Provides automatic localhost tunneling when tests target localhost URLs,
 * and browser WebSocket connection for remote test execution.
 */

import { BrowserManager } from '../../../lib/browser/index.js';
import { getPortFromUrl } from '../../../lib/env/localhost.js';
import { classifyTunnelFailure, TunnelError } from '../../../lib/tunnel/errors.js';
import { TunnelManager } from '../../../lib/tunnel/index.js';
import { error } from './output.js';
import { printTunnelStartBanner } from './tunnel-banner.js';
import { formatTunnelFailure } from './tunnel-error-hint.js';
import { resolveTunnelMode, type TunnelMode } from './tunnel-resolve.js';

export interface BrowserTunnelSession {
  browser: BrowserManager;
  tunnel: TunnelManager | null;
  wsUrl: string;
  publicWsUrl: string | null;
  isLocalhost: boolean;
}

export interface BrowserTunnelOptions {
  headless?: boolean;
  apiKey?: string;
  sessionIndex?: number;
  /**
   * Effective tri-state tunnel mode after CLI/config resolution.
   * Defaults to `'auto'` so callers that don't care about the flag
   * still pick up the Phase-2 auto-inference.
   */
  tunnelMode?: TunnelMode;
  /**
   * API URL used to detect dev mode. When the API URL is itself
   * localhost, `'auto'` skips the tunnel.
   */
  apiUrl?: string;
  /**
   * Suppress the stderr auto-tunnel banner (e.g. for `--json` callers).
   */
  quiet?: boolean;
}

/**
 * Check if Playwright browsers are installed and exit with helpful message if not.
 * This is a guard function to call before expensive tunnel/browser operations.
 */
export function ensureBrowsersInstalled(): void {
  const browser = new BrowserManager();
  const status = browser.checkBrowsersInstalled();

  if (!status.installed) {
    console.log(error('Playwright Chromium browser is not installed'));
    console.log('');
    console.log('  To install, run:');
    console.log('    qa-use install-deps');
    console.log('');
    process.exit(1);
  }
}

/**
 * Start browser and tunnel (if needed for localhost testing)
 *
 * @param testUrl - The URL being tested (to detect localhost)
 * @param options - Browser and tunnel options
 * @returns BrowserTunnelSession with connection details
 */
export async function startBrowserWithTunnel(
  testUrl: string | undefined,
  options: BrowserTunnelOptions = {}
): Promise<BrowserTunnelSession> {
  // Check that browsers are installed before expensive operations
  ensureBrowsersInstalled();

  const browser = new BrowserManager();
  let tunnel: TunnelManager | null = null;
  let publicWsUrl: string | null = null;

  // Start browser
  console.error('Starting browser...');
  const browserSession = await browser.startBrowser({
    headless: options.headless ?? true,
  });

  const wsUrl = browserSession.wsEndpoint;

  // Resolve the on/off decision. Default mode is 'auto' — that way
  // callers that don't pass `tunnelMode` still get Phase-2 behaviour.
  const mode: TunnelMode = options.tunnelMode ?? 'auto';
  const decision = resolveTunnelMode(mode, testUrl, options.apiUrl);
  const isLocalhost = decision === 'on';

  if (decision === 'on') {
    const target = testUrl ?? wsUrl;

    tunnel = new TunnelManager();

    // Extract port from WebSocket URL
    const wsPort = getPortFromUrl(wsUrl);

    try {
      const tunnelSession = await tunnel.startTunnel(wsPort, {
        apiKey: options.apiKey,
        sessionIndex: options.sessionIndex,
      });

      publicWsUrl = tunnel.getWebSocketUrl(wsUrl);

      // Print the auto-tunnel banner on successful start. Banner prints
      // to stderr and self-suppresses on non-TTY / quiet contexts.
      printTunnelStartBanner({
        target,
        publicUrl: tunnelSession.publicUrl,
        quiet: options.quiet,
      });
    } catch (err) {
      const classified = err instanceof TunnelError ? err : classifyTunnelFailure(err, { target });
      console.error(formatTunnelFailure(classified));
      throw classified;
    }
  }

  return {
    browser,
    tunnel,
    wsUrl,
    publicWsUrl,
    isLocalhost,
  };
}

/**
 * Stop browser and tunnel
 */
export async function stopBrowserWithTunnel(session: BrowserTunnelSession): Promise<void> {
  if (session.tunnel) {
    await session.tunnel.stopTunnel();
  }
  await session.browser.stopBrowser();
}

/**
 * Get the appropriate WebSocket URL for API calls
 * Returns public URL if tunnel is active, otherwise local URL
 */
export function getEffectiveWsUrl(session: BrowserTunnelSession): string {
  return session.publicWsUrl || session.wsUrl;
}

/**
 * Check if browser and tunnel are healthy
 */
export async function checkSessionHealth(session: BrowserTunnelSession): Promise<boolean> {
  const browserHealthy = await session.browser.checkHealth();

  if (!browserHealthy) {
    return false;
  }

  if (session.tunnel) {
    const tunnelHealthy = await session.tunnel.checkHealth();
    return tunnelHealthy;
  }

  return true;
}
