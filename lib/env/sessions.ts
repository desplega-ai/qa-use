/**
 * Detached browser-session PID files.
 *
 * Each detached `browser create` writes a JSON file under
 * `~/.qa-use/sessions/<session-id>.json` describing the running child
 * process. The file schema is documented in `DetachedSessionRecord`.
 *
 * Readers (tunnel close, browser status, doctor) cross-reference the
 * `pid` field via `process.kill(pid, 0)` to detect stale entries.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, sessionsDir } from './paths.js';

/**
 * On-disk schema for a detached browser session.
 *
 * The file is created by the detached child (`__browser-detach`) shortly
 * after it starts, and removed on clean exit. Partial writes are
 * avoided by atomic rename (write `.tmp` + `rename`).
 */
export interface DetachedSessionRecord {
  /** Backend session id (also the filename base). */
  id: string;
  /** PID of the detached child process. */
  pid: number;
  /** Tunnel target (canonical origin of the browser WS URL). */
  target: string;
  /** Public URL for the tunnel (from registry handle). `null` when no tunnel. */
  publicUrl: string | null;
  /** ISO timestamp of child startup. */
  startedAt: string;
  /** Epoch ms at which the backend session TTL expires. */
  ttlExpiresAt: number;
  /**
   * True when the registry handle was an attach (another process owns
   * the in-process `TunnelManager`). Informational — `browser close`
   * prints this in diagnostics.
   */
  crossProcessTunnel?: boolean;
  /** Optional: subdomain used for the tunnel. */
  subdomain?: string;
  /** Optional: viewport for display/debug. */
  viewport?: string;
  /** Optional: headless flag for display/debug. */
  headless?: boolean;
}

export function sessionFilePath(sessionId: string): string {
  return path.join(sessionsDir(), `${sessionId}.json`);
}

export function writeSessionRecord(record: DetachedSessionRecord): void {
  const dir = sessionsDir();
  ensureDir(dir);
  const finalPath = sessionFilePath(record.id);
  const tmp = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2));
  fs.renameSync(tmp, finalPath);
}

export function readSessionRecord(sessionId: string): DetachedSessionRecord | null {
  try {
    const raw = fs.readFileSync(sessionFilePath(sessionId), 'utf8');
    const parsed = JSON.parse(raw) as DetachedSessionRecord;
    if (typeof parsed.id !== 'string' || typeof parsed.pid !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function removeSessionRecord(sessionId: string): void {
  try {
    fs.unlinkSync(sessionFilePath(sessionId));
    return;
  } catch (err) {
    // Fast path missed — fall through to dir-scan fallback only on ENOENT.
    // Any other error (EPERM, EACCES, EBUSY, etc.) is propagated by
    // simply returning: callers treat removal as best-effort and surfacing
    // an error here would change the public contract.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      return;
    }
  }

  // Fallback: filename may have drifted from the internal `id` (corrupted
  // state, manual edits, legacy data). Scan the dir and unlink the file
  // whose parsed content has a matching `id`.
  const dir = sessionsDir();
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of files) {
    if (!name.endsWith('.json') || name.endsWith('.tmp')) continue;
    const fullPath = path.join(dir, name);
    try {
      const raw = fs.readFileSync(fullPath, 'utf8');
      const parsed = JSON.parse(raw) as DetachedSessionRecord;
      if (parsed.id === sessionId) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          /* already gone */
        }
        return;
      }
    } catch {
      /* skip unreadable */
    }
  }
}

/**
 * List all persisted detached-session records. Does NOT reconcile
 * against PIDs — callers decide how to handle stale entries.
 */
export function listSessionRecords(): DetachedSessionRecord[] {
  const dir = sessionsDir();
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const out: DetachedSessionRecord[] = [];
  for (const name of files) {
    if (!name.endsWith('.json') || name.endsWith('.tmp')) continue;
    try {
      const raw = fs.readFileSync(path.join(dir, name), 'utf8');
      const parsed = JSON.parse(raw) as DetachedSessionRecord;
      if (typeof parsed.id !== 'string' || typeof parsed.pid !== 'number') continue;
      out.push(parsed);
    } catch {
      /* skip unreadable */
    }
  }
  return out;
}

/** Cheap liveness check — `kill(pid, 0)` returns true if the pid exists. */
export function isPidAlive(pid: number): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EPERM') return true;
    return false;
  }
}
