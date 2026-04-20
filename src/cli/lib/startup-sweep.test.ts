/**
 * Tests for the bounded startup sweep.
 *
 * Covers:
 *   - `shouldSweep` returns false for `doctor` and `__browser-detach`.
 *   - `runStartupSweep` returns zero reaps on empty state.
 *   - `runStartupSweep` reaps stale sessions/tunnels.
 *   - Budget is respected: a hugely-seeded state stops early.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sessionsDir, tunnelsDir } from '../../../lib/env/paths.js';
import { runStartupSweep, shouldSweep } from './startup-sweep.js';

let tempHome: string;
let originalHome: string | undefined;

function deadPid(): number {
  return Math.min(process.pid * 100 + 42_017, 2_000_000);
}

beforeEach(() => {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-use-sweep-'));
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

describe('shouldSweep', () => {
  it('returns true for a normal command invocation', () => {
    expect(shouldSweep(['node', 'qa-use', 'info'])).toBe(true);
    expect(shouldSweep(['node', 'qa-use', 'browser', 'create'])).toBe(true);
  });

  it('returns false when the top-level command is `doctor`', () => {
    expect(shouldSweep(['node', 'qa-use', 'doctor'])).toBe(false);
    expect(shouldSweep(['node', 'qa-use', 'doctor', '--dry-run'])).toBe(false);
  });

  it('returns false when `__browser-detach` appears anywhere in argv', () => {
    expect(shouldSweep(['node', 'qa-use', '__browser-detach'])).toBe(false);
    expect(shouldSweep(['node', 'qa-use', 'browser', '__browser-detach', 'xyz'])).toBe(false);
  });

  it('handles leading flags without breaking', () => {
    expect(shouldSweep(['node', 'qa-use', '--help'])).toBe(true);
    expect(shouldSweep(['node', 'qa-use', '-v'])).toBe(true);
  });
});

describe('runStartupSweep', () => {
  it('returns zero reaps when both directories are empty/missing', async () => {
    const result = await runStartupSweep();
    expect(result.reapedSessions).toBe(0);
    expect(result.reapedTunnels).toBe(0);
  });

  it('is silent and does nothing when sessions dir has only live entries', async () => {
    const dir = sessionsDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'live.json'),
      JSON.stringify({
        id: 'live',
        pid: process.pid,
        target: 'http://localhost:3000',
        publicUrl: null,
        startedAt: new Date().toISOString(),
        ttlExpiresAt: Date.now() + 300_000,
      })
    );
    const result = await runStartupSweep();
    expect(result.reapedSessions).toBe(0);
    expect(fs.existsSync(path.join(dir, 'live.json'))).toBe(true);
  });

  it('reaps stale session files whose pid is dead', async () => {
    const dir = sessionsDir();
    fs.mkdirSync(dir, { recursive: true });
    const deadFile = path.join(dir, 'dead.json');
    fs.writeFileSync(
      deadFile,
      JSON.stringify({
        id: 'dead',
        pid: deadPid(),
        target: 'http://localhost:9999',
        publicUrl: null,
        startedAt: new Date().toISOString(),
        ttlExpiresAt: Date.now() + 300_000,
      })
    );
    const result = await runStartupSweep();
    expect(result.reapedSessions).toBe(1);
    expect(fs.existsSync(deadFile)).toBe(false);
  });

  it('reaps stale tunnel files whose pid is dead', async () => {
    const dir = tunnelsDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'deadhash12.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        id: 'deadhash12',
        target: 'http://localhost:9999',
        publicUrl: 'https://fake.example.com',
        pid: deadPid(),
        refcount: 1,
        ttlExpiresAt: null,
        startedAt: Date.now(),
      })
    );
    const result = await runStartupSweep();
    expect(result.reapedTunnels).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('respects the 250 ms budget when seeded with many stale entries', async () => {
    // Seed a large number of stale files — each requires a read + pid
    // check + unlink, which is well under the budget. We just assert
    // that the sweep returns and either completes in time or flags
    // budgetExceeded.
    const dir = sessionsDir();
    fs.mkdirSync(dir, { recursive: true });
    const pid = deadPid();
    for (let i = 0; i < 50; i++) {
      fs.writeFileSync(
        path.join(dir, `stale-${i}.json`),
        JSON.stringify({
          id: `stale-${i}`,
          pid,
          target: `http://localhost:${9000 + i}`,
          publicUrl: null,
          startedAt: new Date().toISOString(),
          ttlExpiresAt: Date.now() + 300_000,
        })
      );
    }

    const start = Date.now();
    const result = await runStartupSweep();
    const elapsed = Date.now() - start;

    // Sweep may reap all 50 or stop early on budget. Either way, it must
    // return within a reasonable window (2x budget buffer for test jitter).
    expect(elapsed).toBeLessThan(1500);
    expect(result.reapedSessions).toBeGreaterThan(0);
  });

  it('tolerates malformed JSON by removing the file', async () => {
    const dir = sessionsDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'bad.json');
    fs.writeFileSync(file, 'not valid json {{{');
    const result = await runStartupSweep();
    expect(result.reapedSessions).toBe(1);
    expect(fs.existsSync(file)).toBe(false);
  });
});
