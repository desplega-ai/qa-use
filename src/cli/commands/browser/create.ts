/**
 * qa-use browser create - Create a new browser session
 *
 * Phase 4: when tunnel mode is 'on', the lifecycle is handed off to a
 * detached child process (re-exec of the CLI with the hidden
 * `__browser-detach` subcommand). The parent returns in < 2 s after
 * printing the session id + public URL. For `QA_USE_DETACH=0` we
 * preserve the legacy blocking flow for one release as a rollback
 * escape hatch.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { Command } from 'commander';
import type { BrowserApiClient } from '../../../../lib/api/browser.js';
import type { ViewportType } from '../../../../lib/api/browser-types.js';
import { BrowserManager } from '../../../../lib/browser/index.js';
import { getAgentSessionId, getTunnelModeFromConfig } from '../../../../lib/env/index.js';
import {
  isPidAlive,
  listSessionRecords,
  readSessionRecord,
  removeSessionRecord,
} from '../../../../lib/env/sessions.js';
import { classifyTunnelFailure, TunnelError } from '../../../../lib/tunnel/errors.js';
import { TunnelManager } from '../../../../lib/tunnel/index.js';
import { ensureBrowsersInstalled } from '../../lib/browser.js';
import {
  createStoredSession,
  removeStoredSession,
  storeSession,
} from '../../lib/browser-sessions.js';
import { resolveCliEntry } from '../../lib/cli-entry.js';
import { createBrowserClient, loadConfig } from '../../lib/config.js';
import { error, info, success, warning } from '../../lib/output.js';
import { printTunnelStartBanner } from '../../lib/tunnel-banner.js';
import { formatTunnelFailure } from '../../lib/tunnel-error-hint.js';
import { addTunnelOption, type TunnelMode } from '../../lib/tunnel-option.js';
import { resolveTunnelFlag, resolveTunnelMode } from '../../lib/tunnel-resolve.js';

interface CreateOptions {
  headless?: boolean;
  viewport?: ViewportType;
  timeout?: number;
  wsUrl?: string;
  tunnel?: TunnelMode;
  subdomain?: string;
  afterTestId?: string;
  var?: Record<string, string>;
  startUrl?: string;
}

function collectVars(value: string, previous: Record<string, string>) {
  const [key, val] = value.split('=');
  return { ...previous, [key]: val };
}

export const createCommand = addTunnelOption(
  new Command('create')
    .description('Create a new browser session')
    .argument('[url]', 'URL to navigate to after session is ready')
    .option(
      '--headless',
      'Run browser in headless mode (default: true for remote, false for tunnel)'
    )
    .option('--no-headless', 'Run browser with visible UI')
    .option(
      '--viewport <type>',
      'Viewport type: desktop, mobile, or tablet (default: desktop)',
      'desktop'
    )
    .option('--timeout <seconds>', 'Session timeout in seconds (default: 300)', '300')
    .option('--ws-url <url>', 'WebSocket URL for remote/tunneled browser')
    .option('-s, --subdomain <name>', 'Custom tunnel subdomain (only with --tunnel on)')
    .option('--after-test-id <uuid>', 'Run a test before session becomes interactive')
    .option(
      '--var <key=value...>',
      'Variable overrides: base_url, login_url, login_username, login_password',
      collectVars,
      {}
    )
).action(async (startUrl: string | undefined, options: CreateOptions) => {
  options.startUrl = startUrl;

  // Resolve tri-state tunnel flag: CLI > config > default 'auto'.
  const resolvedTunnelMode = resolveTunnelFlag(options.tunnel, getTunnelModeFromConfig());

  // Load configuration (needed to resolve `auto` against the API URL).
  const config = await loadConfig();
  if (!config.api_key) {
    console.log(error('API key not configured. Run `qa-use setup` first.'));
    process.exit(1);
  }

  // Phase 2: resolve `auto` against the target + API URL. Auto-tunnel
  // kicks in when the start URL is localhost and the API URL isn't.
  const tunnelDecision = resolveTunnelMode(resolvedTunnelMode, startUrl, config.api_url);
  const tunnelOn = tunnelDecision === 'on';

  // Validate mutually exclusive options
  if (tunnelOn && options.wsUrl) {
    console.log(error('Cannot use both --tunnel on and --ws-url'));
    process.exit(1);
  }

  if (options.subdomain && !tunnelOn) {
    console.log(error('--subdomain can only be used with --tunnel on'));
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
  const client = createBrowserClient(config);

  if (tunnelOn) {
    // Phase 4: detach by default. Legacy blocking path preserved behind
    // QA_USE_DETACH=0 for one release.
    if (process.env.QA_USE_DETACH === '0') {
      console.error('qa-use: QA_USE_DETACH=0 set — running in legacy blocking mode');
      await runLegacyTunnelMode(client, config.api_key, options, viewport, timeout);
    } else {
      await runDetachedTunnelMode(options, viewport, timeout);
    }
  } else {
    // Normal mode: create remote session and exit
    await createRemoteSession(client, options, viewport, timeout);
  }
});

/**
 * Phase 4: spawn a detached child that owns the browser + tunnel +
 * backend session. Parent polls the PID file for readiness, prints
 * the session id + public URL, and exits.
 */
async function runDetachedTunnelMode(
  options: CreateOptions,
  viewport: ViewportType,
  timeout: number
): Promise<void> {
  ensureBrowsersInstalled();

  // Generate a spawn token so we can find the PID file regardless of
  // whether the backend session id is known yet.
  const spawnId = crypto.randomBytes(8).toString('hex');

  const detachArgs = [
    'browser',
    '__browser-detach',
    spawnId,
    '--tunnel-mode',
    'on',
    '--viewport',
    viewport,
    '--timeout',
    String(timeout),
  ];
  if (options.headless === true) {
    detachArgs.push('--headless');
  }
  if (options.startUrl) {
    detachArgs.push('--target', options.startUrl, '--start-url', options.startUrl);
  }
  if (options.subdomain) {
    detachArgs.push('--subdomain', options.subdomain);
  }
  if (options.afterTestId) {
    detachArgs.push('--after-test-id', options.afterTestId);
  }
  if (options.var && Object.keys(options.var).length > 0) {
    detachArgs.push('--var-json', JSON.stringify(options.var));
  }

  const entry = resolveCliEntry(detachArgs);

  let child: ChildProcess;
  try {
    child = spawn(entry.command, entry.args, {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    });
  } catch (err) {
    console.log(
      error(`Failed to spawn detached process: ${err instanceof Error ? err.message : String(err)}`)
    );
    process.exit(1);
  }

  const childPid = child.pid;
  // Unref so the parent can exit independently.
  child.unref();

  if (!childPid) {
    console.log(error('Detached process failed to start (no PID assigned)'));
    process.exit(1);
  }

  // Poll the sessions dir for the spawn-id record to appear and progress
  // through the readiness phases. 5 s budget total.
  const deadline = Date.now() + 5_000;
  let lastRecord: ReturnType<typeof readSessionRecord> = null;
  let actualSessionId: string | null = null;

  while (Date.now() < deadline) {
    // Check child is still alive — spawn might have succeeded syntactically
    // but exited immediately (e.g. API key missing, tunnel-create failed,
    // backend createSession errored). Prefer a structured failure record
    // over the generic "exited before readiness" message.
    if (!isPidAlive(childPid)) {
      const failed = readSessionRecord(spawnId);
      const failureMsg = extractFailureMessage(failed);
      if (failureMsg) {
        console.error(error(`Detached child failed: ${failureMsg}`));
        removeSessionRecord(spawnId);
      } else {
        console.error(error('Detached child exited before reporting readiness'));
      }
      process.exit(1);
    }

    lastRecord = readSessionRecord(spawnId);
    if (lastRecord) {
      const phase = (lastRecord as { phase?: string }).phase;
      if (phase === 'failed') {
        const failureMsg = extractFailureMessage(lastRecord) ?? 'unknown';
        console.error(error(`Detached child failed: ${failureMsg}`));
        removeSessionRecord(spawnId);
        process.exit(1);
      }
      if (lastRecord.publicUrl && phase === 'tunnel_ready') {
        // Tunnel is up; look for the real session record to appear.
        const byId = listSessionRecords().find(
          (r) => r.pid === childPid && r.id !== spawnId && !('phase' in r)
        );
        if (byId) {
          actualSessionId = byId.id;
          lastRecord = byId;
          break;
        }
      }
    }
    await sleep(150);
  }

  if (!actualSessionId || !lastRecord) {
    console.log(
      warning(
        'Detached child did not finish initialising within 5s. It may still be starting — run `qa-use browser status` shortly.'
      )
    );
    if (lastRecord?.publicUrl) {
      console.log(info(`Public URL (partial): ${lastRecord.publicUrl}`));
    }
    process.exit(0);
  }

  // Banner — use the same copy as the legacy flow.
  if (lastRecord.publicUrl) {
    printTunnelStartBanner({
      target: options.startUrl ?? lastRecord.target,
      publicUrl: lastRecord.publicUrl,
    });
  }

  console.log('');
  console.log(success('Browser session detached'));
  console.log(`Session ID:     ${actualSessionId}`);
  if (lastRecord.publicUrl) {
    console.log(`Public URL:     ${lastRecord.publicUrl}`);
  }
  console.log(`PID:            ${childPid}`);
  console.log(`Viewport:       ${viewport}`);
  console.log(`Timeout:        ${timeout}s`);
  if (options.startUrl) {
    console.log(`Start URL:      ${options.startUrl}`);
  }
  console.log('');
  console.log(info(`Close with: qa-use browser close ${actualSessionId}`));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Pull a human-readable failure message out of a spawn-id session record
 * written by the detached child. Handles both the structured error object
 * shape `{ message, name, stack? }` and any legacy string payload.
 *
 * Returns `null` when the record has no recognisable failure payload (for
 * example, a plain `starting` record) so callers can distinguish between
 * "child reported a failure" and "child exited with nothing on disk".
 */
function extractFailureMessage(record: unknown): string | null {
  if (!record || typeof record !== 'object') return null;
  const rec = record as {
    phase?: string;
    error?: unknown;
  };
  // We only treat records as "failed" when either the phase says so or a
  // structured error is present — avoids false positives on in-flight
  // records that happen to have extra fields.
  const isFailed = rec.phase === 'failed' || rec.error !== undefined;
  if (!isFailed) return null;
  const err = rec.error;
  if (err && typeof err === 'object') {
    const structured = err as { message?: unknown; name?: unknown };
    const name = typeof structured.name === 'string' ? structured.name : '';
    const message =
      typeof structured.message === 'string' && structured.message.length > 0
        ? structured.message
        : 'unknown error';
    return name ? `[${name}] ${message}` : message;
  }
  if (typeof err === 'string' && err.length > 0) return err;
  return null;
}

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
      start_url: options.startUrl,
    });

    console.log(info(`Session created: ${session.id}`));
    console.log(info(`Status: ${session.status}`));

    // Wait for session to become active if starting
    if (session.status === 'starting') {
      console.log(info('Waiting for session to become active...'));
      const activeSession = await client.waitForStatus(session.id, 'active', 60000);

      if (activeSession.status === 'failed' || activeSession.status === 'closed') {
        const errorMsg = activeSession.error_message || 'Unknown reason';
        console.log(error(`Session ${activeSession.status}: ${errorMsg}`));
        process.exit(1);
      }

      console.log(success(`Session ${activeSession.id} is now active`));
    } else if (session.status === 'failed' || session.status === 'closed') {
      const errorMsg = session.error_message || 'Unknown reason';
      console.log(error(`Session ${session.status}: ${errorMsg}`));
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

    // Re-fetch session to get cdp_url (available after active)
    const activeSession = await client.getSession(session.id);
    if (activeSession.cdp_url) {
      console.log(`CDP URL: ${activeSession.cdp_url}`);
    }
    if (options.startUrl) {
      console.log(`Start URL: ${options.startUrl}`);
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
 * Legacy blocking tunnel mode — preserved behind `QA_USE_DETACH=0` for
 * one release. Will be removed in a follow-up once the detach flow has
 * stabilised in production.
 */
async function runLegacyTunnelMode(
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

    let tunnelSession: Awaited<ReturnType<TunnelManager['startTunnel']>>;
    try {
      tunnelSession = await tunnel.startTunnel(browserPort, {
        subdomain: options.subdomain,
        apiKey: apiKey,
        sessionIndex: 0,
      });
    } catch (err) {
      const classified =
        err instanceof TunnelError
          ? err
          : classifyTunnelFailure(err, { target: options.startUrl ?? wsEndpoint });
      console.error(formatTunnelFailure(classified));
      await cleanup(1);
      return;
    }
    console.log(success('Tunnel created'));

    // Auto-tunnel banner (stderr, TTY-aware).
    printTunnelStartBanner({
      target: options.startUrl ?? wsEndpoint,
      publicUrl: tunnelSession.publicUrl,
    });

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

    // Step 3.5: Verify tunnel is healthy before creating API session (with warmup retries)
    console.log(info('Verifying tunnel is ready...'));
    let tunnelReady = false;
    for (let attempt = 0; attempt < 15; attempt++) {
      if (await tunnel.checkHealth()) {
        tunnelReady = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!tunnelReady) {
      console.log(error('Tunnel health check failed — tunnel is not proxying connections'));
      await cleanup(1);
      return;
    }
    console.log(success('Tunnel is ready'));

    // Step 4: Create API session with tunneled ws_url
    if (options.afterTestId) {
      console.log(info(`Creating API session with after-test: ${options.afterTestId}...`));
    } else {
      console.log(info('Creating API session...'));
    }

    let session;
    try {
      session = await client.createSession({
        viewport,
        timeout,
        ws_url: tunneledWsUrl,
        after_test_id: options.afterTestId,
        vars: options.var,
        agent_session_id: getAgentSessionId(),
        start_url: options.startUrl,
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

      if (activeSession.status === 'failed' || activeSession.status === 'closed') {
        const errorMsg = activeSession.error_message || 'Unknown reason';
        console.log(error(`Session ${activeSession.status}: ${errorMsg}`));
        await cleanup(1);
        return;
      }
    } else if (session.status === 'failed' || session.status === 'closed') {
      const errorMsg = session.error_message || 'Unknown reason';
      console.log(error(`Session ${session.status}: ${errorMsg}`));
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
    if (options.startUrl) {
      console.log(`Start URL:      ${options.startUrl}`);
    }
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
