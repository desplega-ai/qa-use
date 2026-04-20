/**
 * Tests for `browser status` list mode stale-entry handling.
 *
 * We test the underlying session helpers — the command wiring is thin
 * and mostly delegates to `lib/env/sessions.ts`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  isPidAlive,
  listSessionRecords,
  writeSessionRecord,
} from '../../../../lib/env/sessions.js';

let tempHome: string;
let originalHome: string | undefined;

beforeEach(() => {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-use-status-'));
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

describe('browser status list-mode stale detection', () => {
  it('marks entries whose PID is dead as stale', () => {
    writeSessionRecord({
      id: 'live',
      pid: process.pid,
      target: 'http://localhost:3000',
      publicUrl: null,
      startedAt: new Date().toISOString(),
      ttlExpiresAt: Date.now() + 300_000,
    });
    writeSessionRecord({
      id: 'dead',
      pid: 99_999_999,
      target: 'http://localhost:4000',
      publicUrl: null,
      startedAt: new Date().toISOString(),
      ttlExpiresAt: Date.now() + 300_000,
    });

    const records = listSessionRecords();
    const lookup: Record<string, boolean> = {};
    for (const r of records) {
      lookup[r.id] = isPidAlive(r.pid);
    }
    expect(lookup.live).toBe(true);
    expect(lookup.dead).toBe(false);
  });
});
