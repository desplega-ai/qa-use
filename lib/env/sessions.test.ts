import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  type DetachedSessionRecord,
  listSessionRecords,
  removeSessionRecord,
  sessionFilePath,
  writeSessionRecord,
} from './sessions.js';

// Redirect QA_USE_HOME so `paths.ts` resolves to a throwaway dir per test.
let originalQaUseHome: string | undefined;
let tmpHome: string;

function makeRecord(overrides: Partial<DetachedSessionRecord> = {}): DetachedSessionRecord {
  return {
    id: 'qa-test-1',
    pid: 99999999,
    target: 'http://localhost:3000',
    publicUrl: 'https://example.tunnel',
    startedAt: '2026-04-21T00:00:00.000Z',
    ttlExpiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

describe('sessions.ts', () => {
  beforeEach(() => {
    originalQaUseHome = process.env.QA_USE_HOME;
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-use-sessions-'));
    process.env.QA_USE_HOME = tmpHome;
  });

  afterEach(() => {
    if (originalQaUseHome !== undefined) {
      process.env.QA_USE_HOME = originalQaUseHome;
    } else {
      delete process.env.QA_USE_HOME;
    }
    try {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  });

  describe('removeSessionRecord', () => {
    test('fast path: removes <id>.json when filename matches id', () => {
      const record = makeRecord({ id: 'qa-fast-1' });
      writeSessionRecord(record);
      const p = sessionFilePath('qa-fast-1');
      expect(fs.existsSync(p)).toBe(true);

      removeSessionRecord('qa-fast-1');
      expect(fs.existsSync(p)).toBe(false);
    });

    test('fallback: removes file when filename drifts from internal id', () => {
      // Simulate corrupted/drifted state: filename qa-stale-2.json, internal id qa-stale-1.
      const dir = path.join(tmpHome, 'sessions');
      fs.mkdirSync(dir, { recursive: true });
      const driftedPath = path.join(dir, 'qa-stale-2.json');
      const content = JSON.stringify(makeRecord({ id: 'qa-stale-1' }));
      fs.writeFileSync(driftedPath, content);

      // No file at sessionFilePath('qa-stale-1'), but a file with id=qa-stale-1 exists as qa-stale-2.json
      expect(fs.existsSync(sessionFilePath('qa-stale-1'))).toBe(false);
      expect(fs.existsSync(driftedPath)).toBe(true);

      removeSessionRecord('qa-stale-1');

      expect(fs.existsSync(driftedPath)).toBe(false);
    });

    test('no-op when no matching record exists', () => {
      // Create an unrelated record — scan should not touch it.
      const dir = path.join(tmpHome, 'sessions');
      fs.mkdirSync(dir, { recursive: true });
      const unrelatedPath = path.join(dir, 'other.json');
      fs.writeFileSync(unrelatedPath, JSON.stringify(makeRecord({ id: 'other' })));

      removeSessionRecord('not-present');

      expect(fs.existsSync(unrelatedPath)).toBe(true);
    });

    test('no-op when sessions dir is missing', () => {
      // Should not throw even when the dir doesn't exist.
      expect(() => removeSessionRecord('missing')).not.toThrow();
    });
  });

  describe('listSessionRecords', () => {
    test('returns parsed records regardless of filename drift', () => {
      const dir = path.join(tmpHome, 'sessions');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'drifted.json'),
        JSON.stringify(makeRecord({ id: 'actual-id' }))
      );

      const records = listSessionRecords();
      expect(records).toHaveLength(1);
      expect(records[0]!.id).toBe('actual-id');
    });
  });
});
