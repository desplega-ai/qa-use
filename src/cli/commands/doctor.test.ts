/**
 * Tests for `qa-use doctor`.
 *
 * We seed fake PID files with definitely-dead PIDs (process.pid * 100 is
 * almost certainly not a live process) and assert that `runDoctor` reaps
 * them. Dry-run mode leaves files in place. Uses `QA_USE_HOME` override
 * so the test never touches the real home directory.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sessionsDir, tunnelsDir } from '../../../lib/env/paths.js';
import { runDoctor } from './doctor.js';

let tempHome: string;
let originalHome: string | undefined;

function deadPid(): number {
  // process.pid * 100 is almost certainly not a live process.
  // Also falls within the valid pid range (32-bit).
  return Math.min(process.pid * 100 + 12_345, 2_000_000);
}

function seedSessionRecord(pid: number, id = 'session-dead', target = 'http://localhost:9999') {
  const dir = sessionsDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        id,
        pid,
        target,
        publicUrl: null,
        startedAt: new Date().toISOString(),
        ttlExpiresAt: Date.now() + 300_000,
      },
      null,
      2
    )
  );
  return file;
}

function seedTunnelRecord(
  pid: number,
  id = 'abc0123456',
  target = 'http://localhost:9999'
): string {
  const dir = tunnelsDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        id,
        target,
        publicUrl: 'https://fake.example.com',
        pid,
        refcount: 1,
        ttlExpiresAt: null,
        startedAt: Date.now(),
      },
      null,
      2
    )
  );
  return file;
}

beforeEach(() => {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-use-doctor-'));
  originalHome = process.env.QA_USE_HOME;
  process.env.QA_USE_HOME = tempHome;
});

afterEach(() => {
  if (originalHome === undefined) {
    delete process.env.QA_USE_HOME;
  } else {
    process.env.QA_USE_HOME = originalHome;
  }
  try {
    fs.rmSync(tempHome, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe('runDoctor', () => {
  it('returns zero actions when both directories are empty', async () => {
    const result = await runDoctor({});
    expect(result.actionsTaken).toBe(0);
    expect(result.staleSessions).toHaveLength(0);
    expect(result.staleTunnels).toHaveLength(0);
  });

  it('reaps a stale session file (dead pid)', async () => {
    const file = seedSessionRecord(deadPid(), 'dead-session');
    expect(fs.existsSync(file)).toBe(true);

    const result = await runDoctor({});
    expect(result.staleSessions).toHaveLength(1);
    expect(result.staleSessions[0].id).toBe('dead-session');
    expect(result.actionsTaken).toBe(1);
    // File should be gone.
    expect(fs.existsSync(file)).toBe(false);
  });

  it('does not reap a session whose pid is alive', async () => {
    const file = seedSessionRecord(process.pid, 'live-session');
    const result = await runDoctor({});
    expect(result.staleSessions).toHaveLength(0);
    expect(result.actionsTaken).toBe(0);
    expect(fs.existsSync(file)).toBe(true);
  });

  it('reaps a stale tunnel file (dead pid)', async () => {
    const file = seedTunnelRecord(deadPid(), 'tun1234567');
    expect(fs.existsSync(file)).toBe(true);

    const result = await runDoctor({});
    expect(result.staleTunnels).toHaveLength(1);
    expect(result.actionsTaken).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('--dry-run leaves files on disk', async () => {
    const sessFile = seedSessionRecord(deadPid(), 'dead-sess');
    const tunFile = seedTunnelRecord(deadPid(), 'tunabcdef01');

    const result = await runDoctor({ dryRun: true });
    expect(result.staleSessions).toHaveLength(1);
    expect(result.staleTunnels).toHaveLength(1);
    expect(result.actionsTaken).toBe(0);
    expect(fs.existsSync(sessFile)).toBe(true);
    expect(fs.existsSync(tunFile)).toBe(true);
  });

  it('mixes live + stale entries correctly', async () => {
    const liveFile = seedSessionRecord(process.pid, 'alive');
    const deadFile = seedSessionRecord(deadPid(), 'dead');

    const result = await runDoctor({});
    expect(result.staleSessions).toHaveLength(1);
    expect(result.staleSessions[0].id).toBe('dead');
    expect(fs.existsSync(liveFile)).toBe(true);
    expect(fs.existsSync(deadFile)).toBe(false);
  });

  it('tolerates missing directories entirely', async () => {
    // tempHome exists but neither subdir does.
    const result = await runDoctor({});
    expect(result.actionsTaken).toBe(0);
  });
});
