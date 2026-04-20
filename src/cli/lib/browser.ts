/**
 * Browser and tunnel management for CLI test execution
 *
 * Provides automatic localhost tunneling when tests target localhost URLs,
 * and browser WebSocket connection for remote test execution.
 */

import { BrowserManager } from '../../../lib/browser/index.js';
import { classifyTunnelFailure, TunnelError } from '../../../lib/tunnel/errors.js';
import type { TunnelManager } from '../../../lib/tunnel/index.js';
import { type TunnelHandle, tunnelRegistry } from '../../../lib/tunnel/registry.js';
import { error } from './output.js';
import { printTunnelReuseBanner, printTunnelStartBanner } from './tunnel-banner.js';
import { formatTunnelFailure } from './tunnel-error-hint.js';
import { resolveTunnelMode, type TunnelMode } from './tunnel-resolve.js';

/**
 * Mirror of `TunnelManager.getWebSocketUrl` for the cross-process
 * attach case where we don't have a live `TunnelManager` to call.
 * Converts the tunnel's public HTTPS URL + the local browser WS path
 * into a `wss://.../devtools/browser/...` URL.
 */
function deriveCrossProcessWsUrl(publicHttpUrl: string, localWsEndpoint: string): string | null {
  try {
    const wsPath = new URL(localWsEndpoint).pathname;
    return publicHttpUrl.replace('https://', 'wss://').replace('http://', 'ws://') + wsPath;
  } catch {
    return null;
  }
}

export interface BrowserTunnelSession {
  browser: BrowserManager;
  /**
   * Back-compat shim: historical callers check `session.tunnel` for
   * truthiness to decide "is a tunnel active?". Sourced from the
   * registry's in-process cache; callers never construct one directly.
   */
  tunnel: TunnelManager | null;
  /** Registry handle owning this tunnel (null when no tunnel). */
  tunnelHandle: TunnelHandle | null;
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
  let tunnelHandle: TunnelHandle | null = null;
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
    // The tunnel target is the browser WebSocket URL — that's what the
    // remote backend needs to reach. `testUrl` is retained only for the
    // banner copy so users see the localhost *app* URL they typed.
    const bannerTarget = testUrl ?? wsUrl;

    try {
      tunnelHandle = await tunnelRegistry.acquire(wsUrl, {
        apiKey: options.apiKey,
        sessionIndex: options.sessionIndex,
      });

      if (tunnelHandle.isCrossProcessAttach) {
        // Another process owns the TunnelManager. We can't construct a
        // new one (it would race for the same subdomain). Derive the
        // public WS URL from the recorded public HTTP URL + our local
        // ws path — mirrors `TunnelManager.getWebSocketUrl` without
        // needing an in-process manager.
        tunnel = null;
        publicWsUrl = deriveCrossProcessWsUrl(tunnelHandle.publicUrl, wsUrl);
      } else {
        // `tunnel` field is a back-compat shim for existing callers
        // that check `session.tunnel` and reach into
        // `stopTunnel`/`checkHealth`. The registry owns the lifecycle
        // now — release goes through `registry.release(handle)` in
        // `stopBrowserWithTunnel`.
        tunnel = tunnelRegistry.getLiveManager(wsUrl);
        publicWsUrl = tunnel ? tunnel.getWebSocketUrl(wsUrl) : null;
      }

      // Branch banner: reuse banner when this acquire landed on an
      // already-running tunnel (refcount > 1 after increment OR we
      // attached to a sibling process's tunnel), else the fresh-start
      // banner.
      const bannerOpts = {
        target: bannerTarget,
        publicUrl: tunnelHandle.publicUrl,
        quiet: options.quiet,
      };
      if (tunnelHandle.refcount > 1 || tunnelHandle.isCrossProcessAttach) {
        printTunnelReuseBanner(bannerOpts);
      } else {
        printTunnelStartBanner(bannerOpts);
      }
    } catch (err) {
      const classified =
        err instanceof TunnelError ? err : classifyTunnelFailure(err, { target: bannerTarget });
      console.error(formatTunnelFailure(classified));
      throw classified;
    }
  }

  return {
    browser,
    tunnel,
    tunnelHandle,
    wsUrl,
    publicWsUrl,
    isLocalhost,
  };
}

/**
 * Stop browser and tunnel
 */
export async function stopBrowserWithTunnel(session: BrowserTunnelSession): Promise<void> {
  if (session.tunnelHandle) {
    await tunnelRegistry.release(session.tunnelHandle);
    session.tunnelHandle = null;
    session.tunnel = null;
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
