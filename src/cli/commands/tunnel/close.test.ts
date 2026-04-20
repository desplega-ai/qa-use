import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type TunnelRecord, targetHash } from '../../../../lib/tunnel/registry.js';
import { closeCommand } from './close.js';

/**
 * Tests for the non-session-holder hint added to `qa-use tunnel close`.
 *
 * The Phase 3 design says `tunnel close` only SIGTERMs detached browser
 * sessions; other holders (e.g. `tunnel start --hold`, foreground
 * `test run`) are left alone. But the user deserves to know the holder
 * is still running. These tests cover that hint (stderr + JSON).
 */

interface Captured {
  stdout: string[];
  stderr: string[];
  restore: () => void;
}

function captureOutput(): Captured {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logSpy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  });
  const errSpy = spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stderr.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  });
  return {
    stdout,
    stderr,
    restore: () => {
      logSpy.mockRestore();
      errSpy.mockRestore();
    },
  };
}

function seedRecord(dir: string, rec: TunnelRecord): void {
  fs.mkdirSync(dir, { recursive: true });
  // Filename must match the target hash so `registry.get(target)` finds
  // it. Using `rec.id` as the filename works for `list()` (dir scan)
  // but not for lookup-by-target — close.ts goes through `get()`.
  const hash = targetHash(rec.target);
  fs.writeFileSync(path.join(dir, `${hash}.json`), JSON.stringify(rec));
}

describe('tunnel close', () => {
  let tmpHome: string;
  let originalHome: string | undefined;
  // Long-lived child we can reliably kill per-test for the "alive holder"
  // cases. Using process.pid would work but can confuse test frameworks if
  // the command ever decides to send it a signal.
  let holderChildPid: number | undefined;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-use-close-'));
    originalHome = process.env.QA_USE_HOME;
    process.env.QA_USE_HOME = tmpHome;
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.QA_USE_HOME;
    } else {
      process.env.QA_USE_HOME = originalHome;
    }
    if (holderChildPid !== undefined) {
      try {
        process.kill(holderChildPid, 'SIGKILL');
      } catch {
        /* already gone */
      }
      holderChildPid = undefined;
    }
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  /**
   * Spawn a tiny detached sleep that we control. Returns the pid. The
   * child is owned by this test process so SIGKILL in afterEach is safe.
   */
  function spawnHolder(): number {
    // 60s sleep is plenty — afterEach will reap it.
    const child = spawn('sleep', ['60'], { detached: true, stdio: 'ignore' });
    child.unref();
    if (!child.pid) throw new Error('failed to spawn holder child');
    holderChildPid = child.pid;
    return child.pid;
  }

  it('prints a stderr hint when record.pid is alive and no session matched', async () => {
    const dir = path.join(tmpHome, 'tunnels');
    const pid = spawnHolder();
    const rec: TunnelRecord = {
      id: 'aaaaaaaaaa',
      target: 'http://localhost:4000',
      publicUrl: 'https://qa-use-hold.lt.desplega.ai',
      pid,
      refcount: 1,
      ttlExpiresAt: null,
      startedAt: Date.now(),
    };
    seedRecord(dir, rec);

    const cap = captureOutput();
    try {
      await closeCommand.parseAsync(['http://localhost:4000'], { from: 'user' });
    } finally {
      cap.restore();
    }

    const stdoutJoined = cap.stdout.join('\n');
    const stderrJoined = cap.stderr.join('\n');
    expect(stdoutJoined).toContain('Tunnel closed: http://localhost:4000');
    expect(stderrJoined).toContain(`holder process PID ${pid} still running`);
    expect(stderrJoined).toContain(`kill ${pid}`);
  });

  it('does NOT print the hint when record.pid is dead', async () => {
    const dir = path.join(tmpHome, 'tunnels');
    const rec: TunnelRecord = {
      id: 'bbbbbbbbbb',
      target: 'http://localhost:4001',
      publicUrl: 'https://qa-use-dead.lt.desplega.ai',
      pid: 99999999, // effectively dead
      refcount: 1,
      ttlExpiresAt: null,
      startedAt: Date.now(),
    };
    seedRecord(dir, rec);

    const cap = captureOutput();
    try {
      await closeCommand.parseAsync(['http://localhost:4001'], { from: 'user' });
    } finally {
      cap.restore();
    }

    const stderrJoined = cap.stderr.join('\n');
    // `list()` / `get()` will reconcile the stale pid out, so the target
    // may not be found at all — either way, no hint.
    expect(stderrJoined).not.toContain('still running');
  });

  it('does NOT print the hint when a session process was reaped (redundant)', async () => {
    const dir = path.join(tmpHome, 'tunnels');
    const sessionsDir = path.join(tmpHome, 'sessions');
    const pid = spawnHolder();

    // Both the tunnel record AND a session record point at the same pid,
    // so the reap loop handles it and our new hint must stay silent.
    const rec: TunnelRecord = {
      id: 'cccccccccc',
      target: 'http://localhost:4002',
      publicUrl: 'https://qa-use-sess.lt.desplega.ai',
      pid,
      refcount: 1,
      ttlExpiresAt: null,
      startedAt: Date.now(),
    };
    seedRecord(dir, rec);

    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.writeFileSync(
      path.join(sessionsDir, 'session-1.json'),
      JSON.stringify({
        id: 'session-1',
        pid,
        target: 'http://localhost:4002',
      })
    );

    const cap = captureOutput();
    try {
      await closeCommand.parseAsync(['http://localhost:4002'], { from: 'user' });
    } finally {
      cap.restore();
    }

    const stdoutJoined = cap.stdout.join('\n');
    const stderrJoined = cap.stderr.join('\n');
    // The reap loop should have mentioned the pid; the lingering-holder
    // hint should NOT fire (redundant with "Reaped ...").
    expect(stdoutJoined).toContain('Tunnel closed: http://localhost:4002');
    expect(stderrJoined).not.toContain('still running');
    // Reaped message is printed to stdout in the non-JSON path.
    expect(stdoutJoined).toContain(`Reaped 1 session process(es): ${pid}`);
  });

  it('JSON mode includes holderPid and suppresses the stderr hint', async () => {
    const dir = path.join(tmpHome, 'tunnels');
    const pid = spawnHolder();
    const rec: TunnelRecord = {
      id: 'dddddddddd',
      target: 'http://localhost:4003',
      publicUrl: 'https://qa-use-json.lt.desplega.ai',
      pid,
      refcount: 1,
      ttlExpiresAt: null,
      startedAt: Date.now(),
    };
    seedRecord(dir, rec);

    const cap = captureOutput();
    try {
      await closeCommand.parseAsync(['http://localhost:4003', '--json'], { from: 'user' });
    } finally {
      cap.restore();
    }

    const stdoutJoined = cap.stdout.join('\n').trim();
    const stderrJoined = cap.stderr.join('\n');
    const parsed = JSON.parse(stdoutJoined) as {
      closed: boolean;
      target: string;
      reapedPids: number[];
      holderPid?: number;
    };
    expect(parsed.closed).toBe(true);
    expect(parsed.target).toBe('http://localhost:4003');
    expect(parsed.reapedPids).toEqual([]);
    expect(parsed.holderPid).toBe(pid);
    // No stderr hint in JSON mode.
    expect(stderrJoined).not.toContain('still running');
  });

  it('JSON mode omits holderPid when pid is dead', async () => {
    const dir = path.join(tmpHome, 'tunnels');
    const rec: TunnelRecord = {
      id: 'eeeeeeeeee',
      target: 'http://localhost:4004',
      publicUrl: 'https://qa-use-nopid.lt.desplega.ai',
      pid: 99999999,
      refcount: 1,
      ttlExpiresAt: null,
      startedAt: Date.now(),
    };
    seedRecord(dir, rec);

    const cap = captureOutput();
    try {
      await closeCommand.parseAsync(['http://localhost:4004', '--json'], { from: 'user' });
    } finally {
      cap.restore();
    }

    const stdoutJoined = cap.stdout.join('\n').trim();
    // `get()` reconciles the dead pid, so the command reports not_found
    // JSON. Either way, `holderPid` must not appear.
    expect(stdoutJoined).not.toContain('holderPid');
  });
});
