/**
 * TunnelRegistry — a shared, refcount-managed layer over `TunnelManager`.
 *
 * Goals:
 *   - Two CLI commands targeting the same localhost base URL share one
 *     remote tunnel (one public URL, one provider connection).
 *   - State is visible and editable across sibling processes via
 *     `~/.qa-use/tunnels/<hash>.json`, so a SECOND process targeting the
 *     same localhost picks up the FIRST process's public URL rather than
 *     spinning up its own tunnel.
 *   - Last-releaser (in the OWNER process) keeps the tunnel alive for
 *     `GRACE_MS` (30 s default) so rapid-fire invocations do not thrash
 *     the provider.
 *
 * Cross-process coordination model:
 *   - The process that first acquires a given target becomes the OWNER
 *     and runs the in-process `TunnelManager`. Its PID is recorded in
 *     the registry file.
 *   - Later acquirers in OTHER processes read the file, see an alive
 *     owner PID, increment refcount under a lockfile, and return an
 *     "attach" handle (`isCrossProcessAttach: true`) with the owner's
 *     `publicUrl`. They do NOT construct a `TunnelManager`.
 *   - Read-modify-write of the record is guarded by a lockfile
 *     (`<hash>.lock`, `O_EXCL | O_CREAT`) with bounded retry.
 *
 * TTL grace limitation:
 *   - The grace window is bounded by the OWNER process's lifetime. Since
 *     `TunnelManager` is a per-process localtunnel client, the remote
 *     tunnel dies when the owner exits. For long-lived owners
 *     (`tunnel start --hold`, a running `test run`, a detached
 *     `browser create` from Phase 4) grace works as designed: a new
 *     acquirer within `GRACE_MS` cancels tear-down. For short-lived
 *     commands that release-and-exit immediately, grace collapses to
 *     zero (the owner process is gone, so there is no tunnel to keep
 *     alive anyway).
 *
 * Non-goals (this phase):
 *   - Daemonised tunnel hosts. Phase 4 adds detach so short-lived
 *     commands can leave a long-lived owner behind.
 *   - Retries on provider failure. Zero retries, consistent with Phase 2.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import { getPortFromUrl } from '../env/localhost.js';
import { ensureDir, tunnelsDir } from '../env/paths.js';
import { TunnelQuotaError } from './errors.js';
import { TunnelManager, type TunnelOptions } from './index.js';

/**
 * How long (ms) to keep a tunnel alive after its refcount hits zero.
 * A new `acquire()` within this window reuses the existing tunnel.
 * Overridable via `QA_USE_TUNNEL_GRACE_MS` env var (primarily a
 * test-friendly knob; production callers should stick with the default).
 */
export const GRACE_MS = 30_000;

function resolveGraceMsFromEnv(fallback: number): number {
  const raw = process.env.QA_USE_TUNNEL_GRACE_MS;
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return fallback;
}

/**
 * Max concurrent tunnels per API key. Mirrors the sessionIndex clamp at
 * `lib/tunnel/index.ts:41` so we surface a clear error instead of silently
 * colliding on subdomains.
 */
export const MAX_CONCURRENT_TUNNELS = 10;

/** On-disk schema for a registry entry. */
export interface TunnelRecord {
  id: string;
  target: string;
  publicUrl: string;
  pid: number;
  refcount: number;
  ttlExpiresAt: number | null;
  startedAt: number;
}

/**
 * Handle returned by `acquire()` / kept in memory by consumers.
 *
 * Consumers must call `registry.release(handle)` exactly once per
 * `acquire()` call.
 */
export interface TunnelHandle extends TunnelRecord {
  /**
   * True when this handle was acquired from a foreign process's tunnel
   * (the registry file's `pid` !== `process.pid`). The caller MUST NOT
   * attempt to retrieve a `TunnelManager` via `getLiveManager(target)` —
   * there isn't one in this process. Use `handle.publicUrl` directly.
   */
  isCrossProcessAttach: boolean;
  /**
   * Internal marker used to guard double-release. Not persisted.
   */
  _released?: boolean;
}

/**
 * Canonical target key — used both as the map key and to derive the
 * filename hash. We lowercase the hostname and drop any path/query so
 * `http://Localhost:3000/foo` and `http://localhost:3000/` dedupe.
 */
export function canonicalTarget(target: string): string {
  try {
    const u = new URL(target);
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.port ? `:${u.port}` : ''}`;
  } catch {
    return target.toLowerCase();
  }
}

/** Filename hash for a target. First 10 hex chars of sha256. */
export function targetHash(target: string): string {
  return crypto.createHash('sha256').update(canonicalTarget(target)).digest('hex').slice(0, 10);
}

/**
 * Atomic write: write to `<path>.tmp` then rename. `rename` is atomic on
 * POSIX, so readers never see a half-written file.
 */
function atomicWriteJson(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function readRecord(filePath: string): TunnelRecord | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as TunnelRecord;
    if (typeof parsed.id !== 'string' || typeof parsed.target !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeUnlink(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

function isPidAlive(pid: number): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // ESRCH = no process with that pid. EPERM = exists but we can't
    // signal it (still counts as alive).
    if ((err as NodeJS.ErrnoException).code === 'EPERM') return true;
    return false;
  }
}

/**
 * Acquire a per-target advisory lockfile. Cross-process exclusion for
 * read-modify-write of the `<hash>.json` file. Implemented via
 * `O_EXCL | O_CREAT` with bounded retry; releases via `unlinkSync`.
 *
 * Returns an `unlock` callback. Always invoke it in a `finally` block.
 */
const LOCK_RETRY_INTERVAL_MS = 15;
const LOCK_MAX_WAIT_MS = 2_000;
const LOCK_STALE_THRESHOLD_MS = 5_000;

async function withLock<T>(lockPath: string, fn: () => Promise<T> | T): Promise<T> {
  ensureDir(path.dirname(lockPath));
  const deadline = Date.now() + LOCK_MAX_WAIT_MS;
  let fd: number | null = null;

  while (true) {
    try {
      // O_EXCL | O_CREAT — fails with EEXIST if another holder is live.
      fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR);
      fs.writeSync(fd, String(process.pid));
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      // Check for stale lock (older than threshold) and reap.
      try {
        const stat = fs.statSync(lockPath);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_THRESHOLD_MS) {
          safeUnlink(lockPath);
          continue;
        }
      } catch {
        // Lock file vanished between exist check and stat — loop again.
        continue;
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for tunnel registry lock: ${lockPath}`);
      }
      await new Promise((r) => setTimeout(r, LOCK_RETRY_INTERVAL_MS));
    }
  }

  try {
    return await fn();
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        /* ignore */
      }
    }
    safeUnlink(lockPath);
  }
}

/**
 * In-memory book-keeping for a live tunnel managed by this process.
 * Only the OWNER process (record.pid === process.pid) has one of these.
 */
interface LiveEntry {
  record: TunnelRecord;
  manager: TunnelManager;
  graceTimer?: NodeJS.Timeout;
}

/**
 * Hook used by tests to inject a fake `TunnelManager` without booting a
 * real tunnel. When unset (the default) the registry constructs a real
 * `TunnelManager`.
 */
export type TunnelManagerFactory = () => TunnelManager;

export interface TunnelRegistryOptions {
  /** Override factory (tests). */
  managerFactory?: TunnelManagerFactory;
  /** Override grace window (tests). */
  graceMs?: number;
  /** Override concurrency cap (tests). */
  maxConcurrent?: number;
  /** Options threaded into `TunnelManager.startTunnel(...)`. */
  tunnelOptions?: TunnelOptions;
}

/**
 * Acquire / release / list API for tunnels.
 *
 * A singleton is exported as `tunnelRegistry` below for convenience;
 * callers that need isolation (tests) construct their own instance.
 */
export class TunnelRegistry {
  private readonly live = new Map<string, LiveEntry>();
  private readonly graceMs: number;
  private readonly maxConcurrent: number;
  private readonly managerFactory: TunnelManagerFactory;

  constructor(opts: TunnelRegistryOptions = {}) {
    this.graceMs = resolveGraceMsFromEnv(opts.graceMs ?? GRACE_MS);
    this.maxConcurrent = opts.maxConcurrent ?? MAX_CONCURRENT_TUNNELS;
    this.managerFactory = opts.managerFactory ?? (() => new TunnelManager());
  }

  /**
   * Start a tunnel for `target` (or reuse an existing one — in-process
   * OR in a sibling process), returning a handle. Caller must pair each
   * acquire with exactly one `release(handle)`.
   */
  async acquire(target: string, opts: TunnelOptions = {}): Promise<TunnelHandle> {
    const canon = canonicalTarget(target);
    const hash = targetHash(canon);
    const file = path.join(tunnelsDir(), `${hash}.json`);
    const lock = path.join(tunnelsDir(), `${hash}.lock`);

    // Fast path: we already own a live manager in this process.
    const existing = this.live.get(canon);
    if (existing) {
      if (existing.graceTimer) {
        clearTimeout(existing.graceTimer);
        existing.graceTimer = undefined;
      }
      return withLock(lock, () => {
        existing.record.refcount += 1;
        existing.record.ttlExpiresAt = null;
        this.writeRecord(existing.record);
        return { ...existing.record, isCrossProcessAttach: false, _released: false };
      });
    }

    // Slow path: consult the on-disk registry. Everything from here
    // runs under the per-target lock.
    const result = await withLock(
      lock,
      async (): Promise<{ kind: 'attach'; record: TunnelRecord } | { kind: 'fresh' }> => {
        const existingRecord = readRecord(file);
        if (existingRecord) {
          if (isPidAlive(existingRecord.pid) && existingRecord.pid !== process.pid) {
            // Another process owns this tunnel; attach.
            existingRecord.refcount += 1;
            existingRecord.ttlExpiresAt = null;
            this.writeRecord(existingRecord);
            return { kind: 'attach', record: existingRecord };
          }
          // Either same pid (rare — map miss means first acquire in
          // this process; treat as stale) or dead pid. Reap and fall
          // through.
          safeUnlink(file);
        }
        return { kind: 'fresh' };
      }
    );

    if (result.kind === 'attach') {
      return { ...result.record, isCrossProcessAttach: true, _released: false };
    }

    // Fresh start — cap check + launch + write under a fresh lock
    // acquisition (startTunnel can take seconds; don't hold the lock
    // that whole time, but DO re-validate nothing raced us).
    const activeList = this.list();
    if (activeList.length >= this.maxConcurrent) {
      throw new TunnelQuotaError(
        `Concurrent tunnel cap reached (${this.maxConcurrent}). Close an existing tunnel with \`qa-use tunnel close <target>\` and try again.`,
        { target: canon }
      );
    }

    const port = getPortFromUrl(canon);
    const manager = this.managerFactory();
    const session = await manager.startTunnel(port, opts);

    return withLock(lock, async () => {
      // Race resolution — in-process: a concurrent acquire may have
      // landed in `this.live` while we were booting.
      const existingLocal = this.live.get(canon);
      if (existingLocal) {
        try {
          await manager.stopTunnel();
        } catch {
          /* best-effort */
        }
        if (existingLocal.graceTimer) {
          clearTimeout(existingLocal.graceTimer);
          existingLocal.graceTimer = undefined;
        }
        existingLocal.record.refcount += 1;
        existingLocal.record.ttlExpiresAt = null;
        this.writeRecord(existingLocal.record);
        return {
          ...existingLocal.record,
          isCrossProcessAttach: false,
          _released: false,
        };
      }

      // Race resolution — cross-process: if another process wrote a
      // record while we were booting, prefer theirs and tear our
      // tunnel down.
      const raced = readRecord(file);
      if (raced && isPidAlive(raced.pid) && raced.pid !== process.pid) {
        try {
          await manager.stopTunnel();
        } catch {
          /* best-effort */
        }
        raced.refcount += 1;
        raced.ttlExpiresAt = null;
        this.writeRecord(raced);
        return { ...raced, isCrossProcessAttach: true, _released: false };
      }

      const record: TunnelRecord = {
        id: hash,
        target: canon,
        publicUrl: session.publicUrl,
        pid: process.pid,
        refcount: 1,
        ttlExpiresAt: null,
        startedAt: Date.now(),
      };
      this.live.set(canon, { record, manager });
      this.writeRecord(record);
      return { ...record, isCrossProcessAttach: false, _released: false };
    });
  }

  /**
   * Release a handle. Decrements refcount (under lock). When the
   * refcount hits zero AND we are the owner, schedule a tear-down
   * `graceMs` later. A subsequent `acquire()` within the grace window
   * cancels the tear-down.
   *
   * Grace window is bounded by owner process lifetime — short-lived
   * commands exit before grace expires and will tear down immediately.
   */
  async release(handle: TunnelHandle): Promise<void> {
    if (handle._released) return;
    handle._released = true;

    const canon = canonicalTarget(handle.target);
    const hash = targetHash(canon);
    const file = path.join(tunnelsDir(), `${hash}.json`);
    const lock = path.join(tunnelsDir(), `${hash}.lock`);

    await withLock(lock, async () => {
      const record = readRecord(file);
      if (!record) return; // Already torn down.

      record.refcount = Math.max(0, record.refcount - 1);

      if (record.refcount > 0) {
        record.ttlExpiresAt = null;
        this.writeRecord(record);
        // If we ARE the owner, keep the in-memory bookkeeping in sync.
        const entry = this.live.get(canon);
        if (entry) {
          entry.record.refcount = record.refcount;
          entry.record.ttlExpiresAt = null;
        }
        return;
      }

      // refcount === 0
      record.ttlExpiresAt = Date.now() + this.graceMs;
      this.writeRecord(record);

      const entry = this.live.get(canon);
      if (entry && record.pid === process.pid) {
        // We are the owner and last releaser — schedule tear-down.
        entry.record.refcount = 0;
        entry.record.ttlExpiresAt = record.ttlExpiresAt;
        if (entry.graceTimer) {
          clearTimeout(entry.graceTimer);
        }
        entry.graceTimer = setTimeout(() => {
          void this.maybeTeardown(canon).catch(() => {
            /* best-effort */
          });
        }, this.graceMs);
        if (typeof entry.graceTimer.unref === 'function') {
          entry.graceTimer.unref();
        }
      }
      // If we are NOT the owner (cross-process attach), just leave the
      // zeroed refcount + ttl on disk. The owner's next release or its
      // own exit path will honour the grace timer.
    });
  }

  /**
   * Force teardown of a tunnel regardless of refcount. Used by
   * `qa-use tunnel close`. Safe to call when no such tunnel exists.
   *
   * If the owner is this process, tears down the in-memory manager.
   * Otherwise just removes the registry file (and leaves the orphan
   * remote tunnel to die with its owner).
   */
  async forceClose(target: string): Promise<void> {
    const canon = canonicalTarget(target);
    const hash = targetHash(canon);
    const lock = path.join(tunnelsDir(), `${hash}.lock`);
    await withLock(lock, async () => {
      await this.teardown(canon);
    });
  }

  /**
   * Look up a single entry by canonical target. Scans the on-disk
   * registry; returns `null` if no record exists or the owning pid is
   * dead.
   */
  get(target: string): TunnelRecord | null {
    const canon = canonicalTarget(target);
    const hash = targetHash(canon);
    const file = path.join(tunnelsDir(), `${hash}.json`);
    const record = readRecord(file);
    if (!record) return null;
    if (!isPidAlive(record.pid)) {
      safeUnlink(file);
      return null;
    }
    return record;
  }

  /**
   * List all live entries. Reconciles against owning PID; stale entries
   * are removed as a side-effect.
   */
  list(): TunnelRecord[] {
    const dir = tunnelsDir();
    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch {
      return [];
    }

    const out: TunnelRecord[] = [];
    for (const name of files) {
      if (!name.endsWith('.json') || name.endsWith('.tmp')) continue;
      const file = path.join(dir, name);
      const record = readRecord(file);
      if (!record) {
        safeUnlink(file);
        continue;
      }
      if (!isPidAlive(record.pid)) {
        safeUnlink(file);
        continue;
      }
      out.push(record);
    }
    return out;
  }

  /**
   * Returns the live `TunnelManager` instance for `target` IF this process
   * currently owns it. Used by callers that need health-check / WS-URL
   * helpers on the underlying manager. Returns `null` for targets owned
   * by a different process (file visible via `list()` / `get()` but not
   * live in-memory here).
   */
  getLiveManager(target: string): TunnelManager | null {
    const canon = canonicalTarget(target);
    const entry = this.live.get(canon);
    return entry ? entry.manager : null;
  }

  /**
   * Look up by filename hash (e.g. output of `tunnel ls`).
   */
  getByHash(hash: string): TunnelRecord | null {
    const file = path.join(tunnelsDir(), `${hash}.json`);
    const record = readRecord(file);
    if (!record) return null;
    if (!isPidAlive(record.pid)) {
      safeUnlink(file);
      return null;
    }
    return record;
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  private writeRecord(record: TunnelRecord): void {
    const file = path.join(tunnelsDir(), `${record.id}.json`);
    atomicWriteJson(file, record);
  }

  /**
   * Timer callback: re-check under lock whether we should tear down. A
   * concurrent acquire may have bumped refcount back above zero.
   */
  private async maybeTeardown(canon: string): Promise<void> {
    const hash = targetHash(canon);
    const file = path.join(tunnelsDir(), `${hash}.json`);
    const lock = path.join(tunnelsDir(), `${hash}.lock`);

    await withLock(lock, async () => {
      const record = readRecord(file);
      if (!record) {
        // Someone else cleaned up already — drop our in-memory entry.
        const stale = this.live.get(canon);
        if (stale) {
          this.live.delete(canon);
          try {
            await stale.manager.stopTunnel();
          } catch {
            /* best-effort */
          }
        }
        return;
      }
      // If another consumer joined, refcount is back above zero.
      if (record.refcount > 0) {
        // Clear our grace timer bookkeeping; caller will rearm on next
        // release.
        const entry = this.live.get(canon);
        if (entry) {
          entry.record.refcount = record.refcount;
          entry.record.ttlExpiresAt = null;
          if (entry.graceTimer) {
            clearTimeout(entry.graceTimer);
            entry.graceTimer = undefined;
          }
        }
        return;
      }
      // ttlExpiresAt guard: may have been bumped by another release,
      // e.g. a cross-process release wrote a fresh grace window.
      if (record.ttlExpiresAt && record.ttlExpiresAt > Date.now()) {
        // Reschedule.
        const entry = this.live.get(canon);
        if (entry) {
          if (entry.graceTimer) clearTimeout(entry.graceTimer);
          const delay = Math.max(0, record.ttlExpiresAt - Date.now());
          entry.graceTimer = setTimeout(() => {
            void this.maybeTeardown(canon).catch(() => {
              /* best-effort */
            });
          }, delay);
          if (typeof entry.graceTimer.unref === 'function') {
            entry.graceTimer.unref();
          }
        }
        return;
      }
      await this.teardown(canon);
    });
  }

  /**
   * Unconditional tear-down. Callers must hold the per-target lock.
   */
  private async teardown(canon: string): Promise<void> {
    const entry = this.live.get(canon);
    const hash = targetHash(canon);
    const file = path.join(tunnelsDir(), `${hash}.json`);

    if (entry) {
      if (entry.graceTimer) {
        clearTimeout(entry.graceTimer);
        entry.graceTimer = undefined;
      }
      this.live.delete(canon);
      try {
        await entry.manager.stopTunnel();
      } catch {
        /* best-effort */
      }
    }

    safeUnlink(file);
  }
}

/** Module-level singleton for CLI use. */
export const tunnelRegistry = new TunnelRegistry();
