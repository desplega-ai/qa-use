/**
 * qa-use doctor - Scan `~/.qa-use/sessions/*.json` and `~/.qa-use/tunnels/*.json`
 * for orphaned entries (owning PID no longer alive), and reap them.
 *
 * Responsibilities:
 *   1. Session files: for each, check `process.kill(pid, 0)`. If dead:
 *      - Remove the PID file.
 *      - Force-release the registry handle if the session referenced a tunnel target.
 *      - Best-effort backend session-end call.
 *   2. Tunnel files: for each entry with `pid`, check pid liveness. If dead,
 *      zero refcount and run registry teardown (via `forceClose`).
 *   3. `--dry-run` mode prints the reap plan without acting.
 *   4. Exits non-zero when any action was needed (so CI/scripts can notice).
 *
 * This is the manual counterpart to the bounded startup sweep in
 * `src/cli/lib/startup-sweep.ts` — `doctor` does more thorough work and is
 * permitted to make network calls.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { sessionsDir, tunnelsDir } from '../../../lib/env/paths.js';
import {
  type DetachedSessionRecord,
  isPidAlive,
  listSessionRecords,
  removeSessionRecord,
} from '../../../lib/env/sessions.js';
import { tunnelRegistry } from '../../../lib/tunnel/registry.js';
import { createBrowserClient, loadConfig } from '../lib/config.js';
import { error, formatError, info, success, warning } from '../lib/output.js';

interface RawTunnelRecord {
  id?: string;
  target?: string;
  pid?: number;
  [key: string]: unknown;
}

interface StaleSession {
  id: string;
  pid: number;
  target: string;
}

interface StaleTunnel {
  id: string;
  target: string;
  pid: number;
}

function listRawTunnelRecords(): RawTunnelRecord[] {
  const dir = tunnelsDir();
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const out: RawTunnelRecord[] = [];
  for (const name of files) {
    if (!name.endsWith('.json') || name.endsWith('.tmp')) continue;
    try {
      const raw = fs.readFileSync(path.join(dir, name), 'utf8');
      const parsed = JSON.parse(raw) as RawTunnelRecord;
      if (typeof parsed.id !== 'string' || typeof parsed.target !== 'string') continue;
      out.push(parsed);
    } catch {
      /* skip unreadable */
    }
  }
  return out;
}

function findStaleSessions(): StaleSession[] {
  const records = listSessionRecords();
  const stale: StaleSession[] = [];
  for (const record of records) {
    if (!isPidAlive(record.pid)) {
      stale.push({ id: record.id, pid: record.pid, target: record.target });
    }
  }
  return stale;
}

function findStaleTunnels(): StaleTunnel[] {
  const records = listRawTunnelRecords();
  const stale: StaleTunnel[] = [];
  for (const record of records) {
    if (typeof record.pid !== 'number' || !isPidAlive(record.pid)) {
      stale.push({
        id: record.id ?? '?',
        target: record.target ?? '?',
        pid: record.pid ?? 0,
      });
    }
  }
  return stale;
}

async function reapSession(
  stale: StaleSession,
  backendClient: ReturnType<typeof createBrowserClient> | null
): Promise<void> {
  // Remove the PID file.
  removeSessionRecord(stale.id);

  // Force-release any tunnel owned by this session's target.
  if (stale.target) {
    try {
      await tunnelRegistry.forceClose(stale.target);
    } catch {
      /* best-effort */
    }
  }

  // Best-effort backend session-end call.
  if (backendClient) {
    try {
      await backendClient.deleteSession(stale.id);
    } catch {
      /* best-effort */
    }
  }
}

async function reapTunnel(stale: StaleTunnel): Promise<void> {
  // Force-close removes the on-disk record (by target-hash) and (if we own
  // it) tears down the manager. For dead foreign PIDs this removes the
  // file we expect. However, if the on-disk `id` was drifted from the
  // canonical hash of `target` (e.g. legacy data, test fixtures), the
  // file-by-id fallback below catches it.
  if (stale.target && stale.target !== '?') {
    try {
      await tunnelRegistry.forceClose(stale.target);
    } catch {
      /* best-effort; fall through to manual unlink by id */
    }
  }
  // Fallback: unlink by raw id. Safe because `forceClose` already removed
  // whatever the canonical-hash file name was.
  if (stale.id && stale.id !== '?') {
    try {
      fs.unlinkSync(path.join(tunnelsDir(), `${stale.id}.json`));
    } catch {
      /* already gone */
    }
  }
}

/**
 * Internal entry point — exported for tests. Returns `{ reaped, plan }` so
 * tests can assert the number of actions without parsing stdout.
 */
export async function runDoctor(options: { dryRun?: boolean; json?: boolean }): Promise<{
  staleSessions: StaleSession[];
  staleTunnels: StaleTunnel[];
  actionsTaken: number;
}> {
  const staleSessions = findStaleSessions();
  const staleTunnels = findStaleTunnels();

  if (options.dryRun) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            dryRun: true,
            staleSessions,
            staleTunnels,
            actionsTaken: 0,
          },
          null,
          2
        )
      );
    } else {
      if (staleSessions.length === 0 && staleTunnels.length === 0) {
        console.log(success('Nothing to do'));
      } else {
        console.log(info('Dry run — no files removed.'));
        if (staleSessions.length > 0) {
          console.log(info(`Would reap ${staleSessions.length} stale session(s):`));
          for (const s of staleSessions) {
            console.log(`  - ${s.id} (pid=${s.pid}, target=${s.target})`);
          }
        }
        if (staleTunnels.length > 0) {
          console.log(info(`Would reap ${staleTunnels.length} stale tunnel(s):`));
          for (const t of staleTunnels) {
            console.log(`  - ${t.id} (pid=${t.pid}, target=${t.target})`);
          }
        }
      }
    }
    return { staleSessions, staleTunnels, actionsTaken: 0 };
  }

  // Non-dry-run: actually reap.
  let backendClient: ReturnType<typeof createBrowserClient> | null = null;
  if (staleSessions.length > 0) {
    try {
      const config = await loadConfig();
      if (config.api_key) {
        backendClient = createBrowserClient(config);
      }
    } catch {
      /* best-effort — proceed without backend calls */
    }
  }

  let actionsTaken = 0;
  for (const s of staleSessions) {
    await reapSession(s, backendClient);
    actionsTaken += 1;
  }
  for (const t of staleTunnels) {
    await reapTunnel(t);
    actionsTaken += 1;
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          dryRun: false,
          staleSessions,
          staleTunnels,
          actionsTaken,
        },
        null,
        2
      )
    );
  } else if (actionsTaken === 0) {
    console.log(success('Nothing to do'));
  } else {
    if (staleSessions.length > 0) {
      console.log(success(`Reaped ${staleSessions.length} stale session(s)`));
      for (const s of staleSessions) {
        console.log(`  - ${s.id} (pid=${s.pid})`);
      }
    }
    if (staleTunnels.length > 0) {
      console.log(success(`Reaped ${staleTunnels.length} stale tunnel(s)`));
      for (const t of staleTunnels) {
        console.log(`  - ${t.id} (pid=${t.pid}, target=${t.target})`);
      }
    }
  }

  return { staleSessions, staleTunnels, actionsTaken };
}

/**
 * Detect orphaned files that could not be reached. A warning — but not a
 * failure — when seen in the wild.
 */
function checkTunnelsDirExists(): boolean {
  try {
    fs.accessSync(tunnelsDir());
    return true;
  } catch {
    return false;
  }
}

function checkSessionsDirExists(): boolean {
  try {
    fs.accessSync(sessionsDir());
    return true;
  } catch {
    return false;
  }
}

export const doctorCommand = new Command('doctor')
  .description('Scan for and reap stale session / tunnel files')
  .option('--dry-run', 'Report what would be reaped without acting')
  .option('--json', 'Output as JSON')
  .action(async (options: { dryRun?: boolean; json?: boolean }) => {
    try {
      // Surface dir-missing state only in JSON mode; in human mode the
      // underlying reapers already handle empty dirs cleanly.
      if (
        options.json &&
        !checkSessionsDirExists() &&
        !checkTunnelsDirExists() &&
        !options.dryRun
      ) {
        console.log(
          JSON.stringify(
            {
              dryRun: false,
              staleSessions: [],
              staleTunnels: [],
              actionsTaken: 0,
            },
            null,
            2
          )
        );
        return;
      }

      const result = await runDoctor(options);

      // Silence "did nothing" cases with exit 0; any actual action exits
      // with a non-zero status so scripts notice.
      if (!options.dryRun && result.actionsTaken > 0) {
        process.exit(1);
      }
    } catch (err) {
      console.log(error(`Doctor failed: ${formatError(err)}`));
      process.exit(2);
    }
  });

// Suppress "unused" warning for helper; exported for potential external
// callers (e.g. startup-sweep may grow to use it).
export type { DetachedSessionRecord };

// Silence lint when `warning` isn't used — keep import for future output paths.
void warning;
