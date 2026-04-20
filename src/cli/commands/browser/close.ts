/**
 * qa-use browser close - Close a browser session
 *
 * Phase 4: when a PID file exists under `~/.qa-use/sessions/<id>.json`,
 * the session is a detached child. SIGTERM the child, wait up to 5s for
 * the PID file to disappear (child cleans up on signal), then SIGKILL
 * as a fallback. Also calls the backend session delete for
 * consistency and prints a one-line grace hint when a tunnel handle
 * kept the tunnel alive post-close.
 */

import fs from 'node:fs';
import { Command } from 'commander';
import {
  isPidAlive,
  readSessionRecord,
  removeSessionRecord,
  sessionFilePath,
} from '../../../../lib/env/sessions.js';
import { canonicalTarget, tunnelRegistry } from '../../../../lib/tunnel/registry.js';
import { removeStoredSession, resolveSessionId } from '../../lib/browser-sessions.js';
import { createBrowserClient, loadConfig } from '../../lib/config.js';
import { error, info, success, warning } from '../../lib/output.js';

interface CloseOptions {
  sessionId?: string;
  json?: boolean;
  quiet?: boolean;
}

const SIGTERM_GRACE_MS = 5_000;

function fileExists(path: string): boolean {
  try {
    return fs.existsSync(path);
  } catch {
    return false;
  }
}

async function waitForFileGone(path: string, graceMs: number): Promise<boolean> {
  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline) {
    if (!fileExists(path)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return !fileExists(path);
}

export const closeCommand = new Command('close')
  .description('Close a browser session')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress non-essential stderr output')
  .action(async (options: CloseOptions) => {
    try {
      // Load configuration
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      // Create client and set API key
      const client = createBrowserClient(config);

      // Resolve session ID (verify=false — the detached child might have
      // already cleaned the backend session; we still want to reap the
      // PID file regardless)
      const resolved = await resolveSessionId({
        explicitId: options.sessionId,
        client,
        verify: false,
      });

      if (!options.json) {
        console.log(info(`Closing session ${resolved.id}...`));
      }

      // Detached-child path: check for a PID file.
      const record = readSessionRecord(resolved.id);
      let sigkilled = false;
      let pidFileCleared = false;

      if (record?.pid && isPidAlive(record.pid)) {
        try {
          process.kill(record.pid, 'SIGTERM');
        } catch {
          /* already gone */
        }
        pidFileCleared = await waitForFileGone(sessionFilePath(resolved.id), SIGTERM_GRACE_MS);
        if (!pidFileCleared) {
          // Child didn't clean up — SIGKILL fallback.
          try {
            process.kill(record.pid, 'SIGKILL');
            sigkilled = true;
            if (!options.quiet && !options.json) {
              console.log(
                warning(
                  `Session PID ${record.pid} did not exit on SIGTERM within ${SIGTERM_GRACE_MS}ms; sent SIGKILL`
                )
              );
            }
          } catch {
            /* already gone */
          }
          // Remove stale PID file ourselves.
          removeSessionRecord(resolved.id);
        }
      } else if (record) {
        // PID file exists but owner is gone — just remove it.
        removeSessionRecord(resolved.id);
      }

      // Close session on backend (best-effort — the child may have done it).
      try {
        await client.deleteSession(resolved.id);
      } catch {
        /* best-effort — backend may already report closed */
      }

      // Remove from local storage
      await removeStoredSession(resolved.id);

      // Grace-period hint: when the session released a tunnel handle but
      // the registry entry lingers (refcount 0 + grace window), let the
      // user know how to force tear-down.
      if (record?.target) {
        const canon = canonicalTarget(record.target);
        const lingering = tunnelRegistry.get(canon);
        if (
          lingering?.ttlExpiresAt &&
          lingering.refcount === 0 &&
          !options.json &&
          !options.quiet
        ) {
          const remainMs = Math.max(0, lingering.ttlExpiresAt - Date.now());
          const remainSeconds = Math.ceil(remainMs / 1000);
          console.error(
            `✓ Session ${resolved.id} closed. Tunnel ${canon} kept alive ~${remainSeconds}s (grace) — run \`qa-use tunnel close ${canon}\` to tear it down now.`
          );
        }
      }

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              closed: true,
              id: resolved.id,
              sigkilled,
              pid: record?.pid ?? null,
            },
            null,
            2
          )
        );
        return;
      }

      console.log(success(`Session ${resolved.id} closed successfully`));

      // Show source if auto-resolved
      if (resolved.source === 'stored') {
        console.log(info('(Session was auto-resolved from local storage)'));
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to close session'));
      process.exit(1);
    }
  });
