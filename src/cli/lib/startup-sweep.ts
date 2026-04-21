/**
 * Bounded startup sweep — runs on every CLI invocation except `doctor`
 * itself and `__browser-detach`. Cheap, silent-on-success cleanup of
 * orphaned PID files whose owning process is no longer alive.
 *
 * Design constraints:
 *   - **Budget**: 250 ms hard cap. We stop iterating early if the budget
 *     is exceeded, even if more stale entries remain. `doctor` picks up
 *     the rest on the next explicit run.
 *   - **Zero net/API calls**. We only remove PID files and force-close
 *     tunnel registry entries (in-process). Backend session-end calls
 *     belong to `doctor`, not to the sweep.
 *   - **Silent on success**. A single-line stderr notice only when we
 *     actually reaped something: `qa-use: cleaned up N stale session(s)`.
 *   - **Safe on empty state**. If `~/.qa-use/sessions/` or
 *     `~/.qa-use/tunnels/` doesn't exist, return immediately.
 */

import fs from 'node:fs';
import path from 'node:path';
import { sessionsDir, tunnelsDir } from '../../../lib/env/paths.js';
import { isPidAlive } from '../../../lib/env/sessions.js';
import { tunnelRegistry } from '../../../lib/tunnel/registry.js';

const BUDGET_MS = 250;

/**
 * Commands that MUST NOT trigger a sweep:
 *   - `doctor` — runs its own fuller reap; double-reap is a no-op but
 *     noisy when it prints "cleaned up N" from the sweep, immediately
 *     followed by doctor's own report of zero.
 *   - `__browser-detach` — the detached child. It is itself a freshly
 *     spawned process whose PID file we may not have written yet; the
 *     sweep must not race with that write.
 */
const SKIP_COMMANDS = new Set(['doctor', '__browser-detach']);

/**
 * Determine whether to run the sweep for this CLI invocation. Looks at
 * `process.argv` positionally — we don't have the parsed Commander tree
 * available at this stage.
 */
export function shouldSweep(argv: string[] = process.argv): boolean {
  // argv[0] = node, argv[1] = cli entry. Command is argv[2] unless it's
  // a flag (e.g. `--version`, `--help` alone). Additionally, many nested
  // commands (e.g. `browser __browser-detach`) have the sentinel in
  // argv[3]; scan the first few entries.
  for (let i = 2; i < Math.min(argv.length, 5); i++) {
    const token = argv[i];
    if (!token || token.startsWith('-')) continue;
    if (SKIP_COMMANDS.has(token)) return false;
    // First non-flag token found; it's the top-level command. Return true
    // if it isn't a skip command (already handled).
    // We still check nested tokens because `browser __browser-detach` has
    // the sentinel in position i+1.
  }
  // Also explicitly scan entire argv for __browser-detach (can be nested).
  if (argv.includes('__browser-detach')) return false;
  // `browser status` (with or without --list / session id) must not sweep:
  // the sweep would race with rendering and silently reap the very
  // stale entries the user asked to see. `browser` followed (somewhere)
  // by `status` is the canonical shape we skip. Other `browser`
  // subcommands (create/close/snapshot/...) still sweep normally.
  const browserIdx = argv.indexOf('browser');
  if (browserIdx !== -1) {
    for (let i = browserIdx + 1; i < argv.length; i++) {
      const token = argv[i];
      if (!token || token.startsWith('-')) continue;
      if (token === 'status') return false;
      break;
    }
  }
  return true;
}

interface SweepResult {
  reapedSessions: number;
  reapedTunnels: number;
  budgetExceeded: boolean;
}

async function sweepSessions(deadline: number): Promise<number> {
  const dir = sessionsDir();
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return 0;
  }
  let reaped = 0;
  for (const name of files) {
    if (Date.now() >= deadline) break;
    if (!name.endsWith('.json') || name.endsWith('.tmp')) continue;
    const file = path.join(dir, name);
    let parsed: { pid?: number; target?: string } | null = null;
    try {
      const raw = fs.readFileSync(file, 'utf8');
      parsed = JSON.parse(raw) as { pid?: number; target?: string };
    } catch {
      // Unreadable file — remove it.
      try {
        fs.unlinkSync(file);
        reaped += 1;
      } catch {
        /* ignore */
      }
      continue;
    }
    if (!parsed || typeof parsed.pid !== 'number') {
      try {
        fs.unlinkSync(file);
        reaped += 1;
      } catch {
        /* ignore */
      }
      continue;
    }
    if (!isPidAlive(parsed.pid)) {
      try {
        fs.unlinkSync(file);
      } catch {
        /* already gone */
      }
      // Best-effort: if the session referenced a tunnel target, ensure
      // any registry handle is released in-process. No net calls.
      if (parsed.target) {
        try {
          await tunnelRegistry.forceClose(parsed.target);
        } catch {
          /* best-effort */
        }
      }
      reaped += 1;
    }
  }
  return reaped;
}

async function sweepTunnels(deadline: number): Promise<number> {
  const dir = tunnelsDir();
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return 0;
  }
  let reaped = 0;
  for (const name of files) {
    if (Date.now() >= deadline) break;
    if (!name.endsWith('.json') || name.endsWith('.tmp')) continue;
    const file = path.join(dir, name);
    let parsed: { pid?: number; target?: string } | null = null;
    try {
      const raw = fs.readFileSync(file, 'utf8');
      parsed = JSON.parse(raw) as { pid?: number; target?: string };
    } catch {
      try {
        fs.unlinkSync(file);
        reaped += 1;
      } catch {
        /* ignore */
      }
      continue;
    }
    if (!parsed || typeof parsed.pid !== 'number' || !isPidAlive(parsed.pid)) {
      if (parsed?.target) {
        try {
          await tunnelRegistry.forceClose(parsed.target);
        } catch {
          /* best-effort; fall through to manual unlink */
        }
      }
      try {
        fs.unlinkSync(file);
      } catch {
        /* already gone */
      }
      reaped += 1;
    }
  }
  return reaped;
}

/**
 * Run the bounded sweep. Returns a summary object; callers may use it for
 * tests. The function never throws — failures are swallowed so startup
 * is never blocked.
 */
export async function runStartupSweep(): Promise<SweepResult> {
  const deadline = Date.now() + BUDGET_MS;
  const result: SweepResult = {
    reapedSessions: 0,
    reapedTunnels: 0,
    budgetExceeded: false,
  };
  try {
    result.reapedSessions = await sweepSessions(deadline);
    if (Date.now() < deadline) {
      result.reapedTunnels = await sweepTunnels(deadline);
    }
  } catch {
    /* never surface sweep failures */
  }
  if (Date.now() >= deadline) {
    result.budgetExceeded = true;
  }
  return result;
}

/**
 * Entry point for `src/cli/index.ts`. Fire-and-forget: we kick off the
 * sweep but don't await it — subsequent CLI work can run in parallel.
 * The sweep's own budget guarantees it won't hold the process open for
 * long.
 *
 * If the sweep reaped anything, we emit a single-line stderr notice.
 */
export function kickoffStartupSweep(argv: string[] = process.argv): void {
  if (!shouldSweep(argv)) return;
  void runStartupSweep()
    .then((result) => {
      const total = result.reapedSessions + result.reapedTunnels;
      if (total > 0) {
        const parts: string[] = [];
        if (result.reapedSessions > 0) {
          parts.push(
            `${result.reapedSessions} stale session${result.reapedSessions === 1 ? '' : 's'}`
          );
        }
        if (result.reapedTunnels > 0) {
          parts.push(
            `${result.reapedTunnels} stale tunnel${result.reapedTunnels === 1 ? '' : 's'}`
          );
        }
        console.error(`qa-use: cleaned up ${parts.join(' + ')}`);
      }
    })
    .catch(() => {
      /* never surface sweep failures */
    });
}
