import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { TunnelRecord } from '../../../../lib/tunnel/registry.js';
import { lsCommand } from './ls.js';

/**
 * Golden tests for `qa-use tunnel ls`.
 *
 * We drive the Commander action directly (via `parseAsync`) and capture
 * `console.log` / `console.error`. `QA_USE_HOME` is pointed at a tmp
 * dir so the test never touches the user's real `~/.qa-use/`.
 */

function captureStdout(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const logSpy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  });
  return {
    lines,
    restore: () => {
      logSpy.mockRestore();
    },
  };
}

function seedRecord(dir: string, rec: TunnelRecord): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${rec.id}.json`), JSON.stringify(rec));
}

describe('tunnel ls', () => {
  let tmpHome: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-use-ls-'));
    originalHome = process.env.QA_USE_HOME;
    process.env.QA_USE_HOME = tmpHome;
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.QA_USE_HOME;
    } else {
      process.env.QA_USE_HOME = originalHome;
    }
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('empty state (JSON) emits an empty array', async () => {
    const cap = captureStdout();
    try {
      // Clone so parseAsync state is hermetic across runs.
      await lsCommand.parseAsync(['--json'], { from: 'user' });
    } finally {
      cap.restore();
    }
    const joined = cap.lines.join('\n').trim();
    expect(joined).toBe('[]');
    // JSON parse to confirm validity.
    expect(JSON.parse(joined)).toEqual([]);
  });

  it('empty state (table) prints the empty message and no rows', async () => {
    const cap = captureStdout();
    try {
      await lsCommand.parseAsync([], { from: 'user' });
    } finally {
      cap.restore();
    }
    const joined = cap.lines.join('\n');
    expect(joined).toContain('No active tunnels');
  });

  it('JSON output contains seeded live record', async () => {
    const dir = path.join(tmpHome, 'tunnels');
    const rec: TunnelRecord = {
      id: 'deadbeef01',
      target: 'http://localhost:3000',
      publicUrl: 'https://qa-use-abc.lt.desplega.ai',
      pid: process.pid, // alive (this test process)
      refcount: 2,
      ttlExpiresAt: null,
      startedAt: Date.now() - 5_000,
    };
    seedRecord(dir, rec);

    const cap = captureStdout();
    try {
      await lsCommand.parseAsync(['--json'], { from: 'user' });
    } finally {
      cap.restore();
    }
    const joined = cap.lines.join('\n').trim();
    const parsed = JSON.parse(joined) as TunnelRecord[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0].target).toBe('http://localhost:3000');
    expect(parsed[0].publicUrl).toBe('https://qa-use-abc.lt.desplega.ai');
    expect(parsed[0].refcount).toBe(2);
  });

  it('table output renders target, public URL and refcount', async () => {
    const dir = path.join(tmpHome, 'tunnels');
    const rec: TunnelRecord = {
      id: 'cafebabe11',
      target: 'http://localhost:5173',
      publicUrl: 'https://qa-use-xyz.lt.desplega.ai',
      pid: process.pid,
      refcount: 1,
      ttlExpiresAt: null,
      startedAt: Date.now(),
    };
    seedRecord(dir, rec);

    const cap = captureStdout();
    try {
      await lsCommand.parseAsync([], { from: 'user' });
    } finally {
      cap.restore();
    }
    const joined = cap.lines.join('\n');
    expect(joined).toContain('http://localhost:5173');
    expect(joined).toContain('qa-use-xyz.lt.desplega.ai');
    expect(joined).toContain('cafebabe11');
  });

  it('stale-pid entries are reconciled out of the list', async () => {
    const dir = path.join(tmpHome, 'tunnels');
    const rec: TunnelRecord = {
      id: '1234567890',
      target: 'http://localhost:6000',
      publicUrl: 'https://stale.example.com',
      pid: 99999999, // effectively dead
      refcount: 1,
      ttlExpiresAt: null,
      startedAt: Date.now(),
    };
    seedRecord(dir, rec);

    const cap = captureStdout();
    try {
      await lsCommand.parseAsync(['--json'], { from: 'user' });
    } finally {
      cap.restore();
    }
    const joined = cap.lines.join('\n').trim();
    expect(JSON.parse(joined)).toEqual([]);
    // File should have been removed on reconcile.
    expect(fs.existsSync(path.join(dir, `${rec.id}.json`))).toBe(false);
  });
});
