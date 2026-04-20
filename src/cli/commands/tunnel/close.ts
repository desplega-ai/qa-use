/**
 * qa-use tunnel close - Force-tear down a tunnel entry in the registry.
 *
 * Phase 3 scope: accept a target URL or hash, resolve the record, and
 * force-release it (tears down in-process handle if we own it, otherwise
 * removes the stale-looking registry file).
 *
 * Phase 4 extends this with session-PID cross-referencing: when the
 * owning PID belongs to a detached browser session (`~/.qa-use/sessions/
 * <id>.json`), SIGTERM that child with a 5 s timeout, SIGKILL fallback,
 * and best-effort backend session-end. That path is scaffolded here but
 * guarded by the sessions-dir tolerance the plan calls for: if the dir
 * doesn't exist or is empty, we skip the session lookup and fall back
 * to a plain force-release + file removal.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { sessionsDir } from '../../../../lib/env/paths.js';
import { type TunnelRecord, tunnelRegistry } from '../../../../lib/tunnel/registry.js';
import { error, formatError, info, success, warning } from '../../lib/output.js';

const SIGTERM_GRACE_MS = 5_000;

interface SessionRecord {
  id?: string;
  pid?: number;
  target?: string;
  [key: string]: unknown;
}

function resolveRecord(identifier: string): TunnelRecord | null {
  if (/^[a-f0-9]{10}$/i.test(identifier)) {
    return tunnelRegistry.getByHash(identifier.toLowerCase());
  }
  return tunnelRegistry.get(identifier);
}

/**
 * Read sessions that reference this tunnel target, if any. Tolerates a
 * missing / empty directory (common in Phase 3 since sessions don't
 * exist yet).
 */
function findSessionsForTarget(target: string): SessionRecord[] {
  const dir = sessionsDir();
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const out: SessionRecord[] = [];
  for (const name of files) {
    if (!name.endsWith('.json')) continue;
    try {
      const raw = fs.readFileSync(path.join(dir, name), 'utf8');
      const parsed = JSON.parse(raw) as SessionRecord;
      if (parsed.target === target) out.push(parsed);
    } catch {
      /* skip unreadable */
    }
  }
  return out;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EPERM') return true;
    return false;
  }
}

async function sigtermWithGrace(pid: number, graceMs: number): Promise<boolean> {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Already gone.
    return true;
  }
  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
    if (!isPidAlive(pid)) return true;
  }
  return false;
}

export const closeCommand = new Command('close')
  .description('Force-close a tunnel (by target URL or hash ID)')
  .argument('<target-or-hash>', 'Target URL or tunnel hash ID')
  .option('--json', 'Output as JSON')
  .action(async (identifier: string, options: { json?: boolean }) => {
    try {
      const record = resolveRecord(identifier);

      if (!record) {
        if (options.json) {
          console.log(JSON.stringify({ closed: false, reason: 'not_found' }));
        } else {
          console.log(warning(`No active tunnel matching ${identifier}`));
        }
        return;
      }

      // Phase-4 hook: if a detached browser session owns this tunnel,
      // SIGTERM it so the child releases the registry handle cleanly.
      // Phase 3 tolerates an empty sessions dir.
      const sessions = findSessionsForTarget(record.target);
      const reaped: number[] = [];
      for (const session of sessions) {
        if (!session.pid || !isPidAlive(session.pid)) continue;
        const termed = await sigtermWithGrace(session.pid, SIGTERM_GRACE_MS);
        if (!termed) {
          try {
            process.kill(session.pid, 'SIGKILL');
            console.error(
              warning(
                `Session PID ${session.pid} did not exit on SIGTERM within ${SIGTERM_GRACE_MS}ms; sent SIGKILL`
              )
            );
          } catch {
            /* already gone */
          }
        }
        reaped.push(session.pid);
      }

      // Force-release regardless of PID-reap outcome. In Phase 3 this is
      // the primary path.
      await tunnelRegistry.forceClose(record.target);

      // Non-session holders (e.g. `tunnel start --hold`, foreground
      // `test run`) are intentionally NOT SIGTERM'd. But after the
      // registry file is gone, the user has no clue the holder is still
      // around. Emit a one-line hint if (a) the registry record pointed
      // at a pid, (b) that pid is still alive, and (c) no session was
      // matched above (otherwise the "Reaped ..." line covers it).
      const lingeringHolderPid =
        record.pid && reaped.length === 0 && isPidAlive(record.pid) ? record.pid : undefined;

      if (options.json) {
        const payload: {
          closed: boolean;
          target: string;
          reapedPids: number[];
          holderPid?: number;
        } = { closed: true, target: record.target, reapedPids: reaped };
        if (lingeringHolderPid !== undefined) {
          payload.holderPid = lingeringHolderPid;
        }
        console.log(JSON.stringify(payload, null, 2));
      } else {
        console.log(success(`Tunnel closed: ${record.target}`));
        if (reaped.length > 0) {
          console.log(info(`Reaped ${reaped.length} session process(es): ${reaped.join(', ')}`));
        }
        if (lingeringHolderPid !== undefined) {
          console.error(
            info(
              `Note: holder process PID ${lingeringHolderPid} still running — send SIGTERM (kill ${lingeringHolderPid}) to terminate.`
            )
          );
        }
      }
    } catch (err) {
      console.log(error(`Failed to close tunnel: ${formatError(err)}`));
      process.exit(1);
    }
  });
