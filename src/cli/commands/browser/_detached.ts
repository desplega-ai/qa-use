/**
 * Hidden `__browser-detach` subcommand — runs inside the detached child
 * spawned by the parent `browser create` command.
 *
 * Responsibilities:
 *   1. Start the local browser (Playwright).
 *   2. If tunnel mode is 'on', acquire a tunnel via `TunnelRegistry`.
 *   3. Register a backend session via the API.
 *   4. Write a PID file at `~/.qa-use/sessions/<spawn-id>.json` for the
 *      parent to poll. Updated in place as milestones complete.
 *   5. Install SIGTERM/SIGINT handlers that tear down cleanly:
 *      API session end → tunnel release → browser close → remove PID file.
 *   6. Run a 30s heartbeat that verifies API session + tunnel health; on
 *      external close, self-terminate.
 *
 * This subcommand is `.hidden()` on the Commander definition so it does
 * not appear in `qa-use browser --help`. It is ONLY invoked by the
 * parent `browser create` bootstrap via `child_process.spawn`.
 */

import { Command } from 'commander';
import type { ViewportType } from '../../../../lib/api/browser-types.js';
import { BrowserManager } from '../../../../lib/browser/index.js';
import { resolveForcedHeadless } from '../../../../lib/env/force-headless.js';
import { getAgentSessionId } from '../../../../lib/env/index.js';
import {
  type DetachedSessionRecord,
  removeSessionRecord,
  sessionFilePath,
  writeSessionRecord,
} from '../../../../lib/env/sessions.js';
import { classifyTunnelFailure, TunnelError } from '../../../../lib/tunnel/errors.js';
import {
  canonicalTarget,
  type TunnelHandle,
  tunnelRegistry,
} from '../../../../lib/tunnel/registry.js';
import {
  createStoredSession,
  removeStoredSession,
  storeSession,
} from '../../lib/browser-sessions.js';
import { createBrowserClient, loadConfig } from '../../lib/config.js';

interface DetachOptions {
  target?: string;
  tunnelMode?: 'on' | 'off';
  subdomain?: string;
  viewport?: ViewportType;
  timeout?: string;
  headless?: boolean;
  afterTestId?: string;
  startUrl?: string;
  varJson?: string;
  sessionIndex?: string;
}

/**
 * Silence stdout/stderr after startup. The parent spawns us with
 * `{ stdio: 'ignore' }` so these fds are already pointed at /dev/null —
 * we additionally muzzle `console.log`/`console.error` so any stray log
 * statements don't accidentally write to a reused fd.
 */
function muzzleConsole(): void {
  const noop = () => {
    /* intentional no-op */
  };
  console.log = noop;
  console.error = noop;
  console.warn = noop;
  console.info = noop;
}

async function runDetached(spawnId: string, options: DetachOptions): Promise<void> {
  // Resource bookkeeping for cleanup. Declared up-front so the outer
  // try/catch (around the whole startup sequence) can reference them.
  let browser: BrowserManager | null = null;
  let tunnelHandle: TunnelHandle | null = null;
  let backendSessionId: string | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let shuttingDown = false;
  // Set to true when we've written a `phase: 'failed'` record that the
  // parent still needs to read. Prevents `cleanup()` from deleting it.
  let preserveSpawnRecord = false;
  // Deferred client reference — populated once config is loaded. Before
  // that point `cleanup()` treats the backend session as absent.
  let client: ReturnType<typeof createBrowserClient> | null = null;

  const cleanup = async (exitCode: number): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    // Close API session.
    if (backendSessionId && client) {
      try {
        await client.deleteSession(backendSessionId);
      } catch {
        /* best-effort */
      }
      try {
        await removeStoredSession(backendSessionId);
      } catch {
        /* best-effort */
      }
    }

    // Release tunnel handle.
    if (tunnelHandle) {
      try {
        await tunnelRegistry.release(tunnelHandle);
      } catch {
        /* best-effort */
      }
      tunnelHandle = null;
    }

    // Close local browser.
    if (browser) {
      try {
        await browser.stopBrowser();
      } catch {
        /* best-effort */
      }
      browser = null;
    }

    // Remove PID file.
    if (backendSessionId) {
      removeSessionRecord(backendSessionId);
    }
    // Only remove the spawn-id record when we didn't write a failure
    // payload the parent still needs to read.
    if (!preserveSpawnRecord) {
      removeSessionRecord(spawnId);
    }

    process.exit(exitCode);
  };

  // Helper: write a structured failure record and mark it for preservation
  // so the parent poll loop can read it before cleanup wipes the file.
  const reportFailure = (err: unknown, labelPrefix?: string): void => {
    preserveSpawnRecord = true;
    writePhase({
      spawnId,
      phase: 'failed',
      errorObject: serializeError(err, labelPrefix),
    });
  };

  process.on('SIGTERM', () => {
    void cleanup(0);
  });
  process.on('SIGINT', () => {
    void cleanup(0);
  });

  try {
    // Phase 1: write initial PID file under spawnId so the parent can see
    // that the child is alive. This happens BEFORE any expensive work.
    writePhase({
      spawnId,
      phase: 'starting',
      target: options.target ?? '',
    });

    // Config + option parsing — moved inside the try/catch so any error
    // here (missing API key, malformed --var-json, etc.) is surfaced to
    // the parent as a structured failure record.
    const config = await loadConfig();
    if (!config.api_key) {
      reportFailure(new Error('API key not configured'), 'ConfigError');
      await cleanup(1);
      return;
    }
    client = createBrowserClient(config);

    const viewport = (options.viewport ?? 'desktop') as ViewportType;
    const timeout = options.timeout ? parseInt(options.timeout, 10) : 300;
    // resolveForcedHeadless throws on explicit --headless=false when
    // QA_USE_FORCE_HEADLESS is set; otherwise passthrough. We coerce
    // the commander default (`false`) to a boolean so the assertion
    // can distinguish "headful requested" from "no flag passed".
    const requested = options.headless === true;
    const resolved = resolveForcedHeadless(requested, '__browser-detach --headless=false');
    const headless = resolved === true;
    const tunnelOn = options.tunnelMode === 'on';
    const vars = options.varJson
      ? (JSON.parse(options.varJson) as Record<string, string>)
      : undefined;
    const sessionIndex = options.sessionIndex ? parseInt(options.sessionIndex, 10) : 0;

    // Phase 2: start local browser.
    browser = new BrowserManager();
    const browserResult = await browser.startBrowser({ headless });
    const wsEndpoint = browserResult.wsEndpoint;

    let wsUrlToUse = wsEndpoint;
    let publicUrlForRecord: string | null = null;

    // Phase 3: acquire tunnel if needed.
    if (tunnelOn) {
      try {
        tunnelHandle = await tunnelRegistry.acquire(wsEndpoint, {
          apiKey: config.api_key,
          sessionIndex,
          subdomain: options.subdomain,
        });
      } catch (err) {
        const classified =
          err instanceof TunnelError ? err : classifyTunnelFailure(err, { target: wsEndpoint });
        reportFailure(classified, 'tunnel_start_failed');
        await cleanup(1);
        return;
      }

      publicUrlForRecord = tunnelHandle.publicUrl;

      // Resolve tunneled WS URL for the backend.
      if (tunnelHandle.isCrossProcessAttach) {
        try {
          const wsPath = new URL(wsEndpoint).pathname;
          wsUrlToUse =
            tunnelHandle.publicUrl.replace('https://', 'wss://').replace('http://', 'ws://') +
            wsPath;
        } catch (err) {
          reportFailure(err, 'tunnel_ws_url_resolution_failed');
          await cleanup(1);
          return;
        }
      } else {
        const liveManager = tunnelRegistry.getLiveManager(wsEndpoint);
        const tunneled = liveManager?.getWebSocketUrl(wsEndpoint);
        if (!tunneled) {
          reportFailure(
            new Error('Failed to resolve tunneled WebSocket URL'),
            'tunnel_ws_url_resolution_failed'
          );
          await cleanup(1);
          return;
        }
        wsUrlToUse = tunneled;

        // Health-check with warmup retries (mirrors legacy logic).
        let ready = false;
        for (let attempt = 0; attempt < 15; attempt++) {
          if (await liveManager!.checkHealth()) {
            ready = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 500));
        }
        if (!ready) {
          reportFailure(
            new Error('Tunnel health check failed — tunnel is not proxying connections'),
            'tunnel_health_check_failed'
          );
          await cleanup(1);
          return;
        }
      }

      writePhase({
        spawnId,
        phase: 'tunnel_ready',
        target: canonicalTarget(wsEndpoint),
        publicUrl: publicUrlForRecord,
      });
    } else {
      writePhase({
        spawnId,
        phase: 'browser_ready',
        target: canonicalTarget(wsEndpoint),
      });
    }

    // Phase 4: create backend session with resolved ws_url.
    let session;
    try {
      session = await client.createSession({
        viewport,
        timeout,
        ws_url: tunnelOn ? wsUrlToUse : undefined,
        after_test_id: options.afterTestId,
        vars,
        agent_session_id: getAgentSessionId(),
        start_url: options.startUrl,
      });
    } catch (err) {
      reportFailure(err, 'api_session_create_failed');
      await cleanup(1);
      return;
    }

    backendSessionId = session.id;

    // Write the real session record — now keyed by backend session id.
    const record: DetachedSessionRecord = {
      id: session.id,
      pid: process.pid,
      target: canonicalTarget(options.target ?? wsEndpoint),
      publicUrl: publicUrlForRecord,
      startedAt: new Date().toISOString(),
      ttlExpiresAt: Date.now() + timeout * 1000,
      crossProcessTunnel: tunnelHandle?.isCrossProcessAttach === true,
      subdomain: options.subdomain,
      viewport,
      headless,
    };
    writeSessionRecord(record);

    // Remove the pending spawnId file now that we have the real session.
    if (spawnId !== session.id) {
      removeSessionRecord(spawnId);
    }

    await storeSession(createStoredSession(session.id));

    // Wait for session active (if starting). We don't surface this to
    // the parent — the parent has already returned.
    if (session.status === 'starting') {
      try {
        const waitTimeout = options.afterTestId ? 180_000 : 60_000;
        await client.waitForStatus(session.id, 'active', waitTimeout);
      } catch {
        // Session creation failed post-handoff. Let the heartbeat below
        // detect the closed state and tear down.
      }
    }

    // Phase 5: heartbeat — verify backend session + tunnel health.
    // Capture client in a non-nullable local so the closure doesn't need
    // repeated null checks (it's guaranteed non-null at this point).
    const heartbeatClient = client;
    heartbeatTimer = setInterval(async () => {
      if (shuttingDown) return;
      try {
        const status = await heartbeatClient.getSession(session.id);
        if (status.status === 'closed' || status.status === 'failed') {
          await cleanup(0);
          return;
        }
        // Tunnel health — only meaningful when we own the live manager.
        if (tunnelHandle && !tunnelHandle.isCrossProcessAttach) {
          const manager = tunnelRegistry.getLiveManager(wsEndpoint);
          if (manager) {
            await manager.checkHealth();
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('not found') || msg.includes('404')) {
          await cleanup(0);
        }
      }
    }, 30_000);
    if (typeof heartbeatTimer.unref === 'function') {
      heartbeatTimer.unref();
    }

    // After startup, muzzle all console output. The parent gave us
    // `{ stdio: 'ignore' }` anyway, but this belt-and-braces ensures
    // that even libraries that try to log don't spam unknown fds.
    muzzleConsole();

    // Keep the event loop alive indefinitely — heartbeat timer isn't
    // enough because of `.unref()`. Use a long interval with ref().
    const aliveTimer = setInterval(() => {
      /* keep alive */
    }, 60_000);
    // Hold a reference so the process doesn't exit prematurely.
    void aliveTimer;
  } catch (err) {
    reportFailure(err);
    await cleanup(1);
  }
}

interface StructuredError {
  message: string;
  name: string;
  stack?: string;
}

interface PhaseRecord {
  spawnId: string;
  phase: 'starting' | 'browser_ready' | 'tunnel_ready' | 'failed';
  target?: string;
  publicUrl?: string | null;
  errorObject?: StructuredError;
}

/**
 * Serialize an unknown error value into a structured payload the parent
 * can surface cleanly. Guards against circular refs, truncates stacks to
 * the first 5 lines, and prefixes `name` with an optional label for
 * failure-site context (e.g. `tunnel_start_failed`).
 */
function serializeError(err: unknown, labelPrefix?: string): StructuredError {
  let message: string;
  let name: string;
  let stack: string | undefined;

  if (err instanceof Error) {
    message = err.message || 'Unknown error';
    name = err.name || 'Error';
    if (typeof err.stack === 'string') {
      stack = err.stack.split('\n').slice(0, 5).join('\n');
    }
  } else {
    name = 'NonError';
    try {
      message = typeof err === 'string' ? err : JSON.stringify(err);
    } catch {
      message = String(err);
    }
  }

  if (labelPrefix) {
    name = `${labelPrefix}:${name}`;
  }
  return stack ? { message, name, stack } : { message, name };
}

/**
 * Write a "pending" record under the spawn id so the parent can poll
 * progress. This is a minimal variant of `DetachedSessionRecord` that
 * carries just enough state for the parent. Once the backend session id
 * is known, we switch to writing a full record keyed by session id.
 */
function writePhase(phase: PhaseRecord): void {
  const record: DetachedSessionRecord & {
    phase?: string;
    error?: StructuredError;
    spawnId?: string;
    failedAt?: number;
  } = {
    id: phase.spawnId,
    pid: process.pid,
    target: phase.target ?? '',
    publicUrl: phase.publicUrl ?? null,
    startedAt: new Date().toISOString(),
    ttlExpiresAt: Date.now() + 60_000,
    phase: phase.phase,
    error: phase.errorObject,
    spawnId: phase.spawnId,
    failedAt: phase.phase === 'failed' ? Date.now() : undefined,
  };
  try {
    writeSessionRecord(record);
  } catch {
    /* best-effort */
  }
}

export const detachedCommand = new Command('__browser-detach')
  .description('(internal) Detached browser-session lifecycle holder')
  .argument('<spawn-id>', 'Spawn token generated by the parent')
  .option('--target <url>', 'Tunnel target URL (browser WS endpoint source)')
  .option('--tunnel-mode <mode>', 'on | off')
  .option('-s, --subdomain <name>', 'Deterministic tunnel subdomain')
  .option('--viewport <type>', 'Viewport type', 'desktop')
  .option('--timeout <seconds>', 'Session timeout', '300')
  .option('--headless', 'Headless browser', false)
  .option('--after-test-id <id>', 'After-test to run')
  .option('--start-url <url>', 'Start URL')
  .option('--var-json <json>', 'Variables as JSON string')
  .option('--session-index <idx>', 'Tunnel session index', '0')
  .action(async (spawnId: string, options: DetachOptions) => {
    try {
      await runDetached(spawnId, options);
    } catch (err) {
      // Belt-and-braces: if `runDetached` somehow throws out of its own
      // try/catch (should not happen), still persist a failure record so
      // the parent doesn't time out with the generic readiness message.
      try {
        writePhase({
          spawnId,
          phase: 'failed',
          errorObject: serializeError(err, 'fatal'),
        });
      } catch {
        /* best-effort */
      }
      process.exit(1);
    }
  });

// Hide from `qa-use browser --help` — this subcommand is only meant to
// be invoked by the parent CLI as part of the detach flow. Its help is
// still accessible via `qa-use browser __browser-detach --help` for dev.
// Commander reads `._hidden` on the Command instance to suppress help listing.
type HiddenCommand = { _hidden?: boolean };
(detachedCommand as unknown as HiddenCommand)._hidden = true;

/**
 * Convenience export for the lookup table used by PID-file consumers.
 * Kept in sync with `DetachedSessionRecord` shape.
 */
export const __detachedPhaseFileName = (spawnId: string): string => sessionFilePath(spawnId);
