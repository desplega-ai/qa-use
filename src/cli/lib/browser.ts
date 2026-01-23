/**
 * Browser and tunnel management for CLI test execution
 *
 * Provides automatic localhost tunneling when tests target localhost URLs,
 * and browser WebSocket connection for remote test execution.
 */

import { TunnelManager } from '../../../lib/tunnel/index.js';
import { BrowserManager } from '../../../lib/browser/index.js';
import { URL } from 'url';
import { error } from './output.js';

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
}

/**
 * Check if a URL points to localhost
 */
export function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1' ||
      parsed.hostname.endsWith('.localhost')
    );
  } catch {
    return false;
  }
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
 * Get the port from a URL
 */
export function getPortFromUrl(url: string): number {
  try {
    const parsed = new URL(url);
    if (parsed.port) {
      return parseInt(parsed.port, 10);
    }
    // Default ports
    return parsed.protocol === 'https:' ? 443 : 80;
  } catch {
    return 80;
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
  const isLocalhost = testUrl ? isLocalhostUrl(testUrl) : false;

  // If testing localhost, set up tunnel for browser WebSocket
  if (isLocalhost || !testUrl) {
    console.error('Localhost URL detected - starting tunnel for browser connection...');

    tunnel = new TunnelManager();

    // Extract port from WebSocket URL
    const wsPort = getPortFromUrl(wsUrl);

    const tunnelSession = await tunnel.startTunnel(wsPort, {
      apiKey: options.apiKey,
      sessionIndex: options.sessionIndex,
    });

    publicWsUrl = tunnel.getWebSocketUrl(wsUrl);
    console.error(`Tunnel established: ${tunnelSession.publicUrl}`);
    console.error(`Public WebSocket URL: ${publicWsUrl}\n`);
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
