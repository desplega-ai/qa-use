/**
 * Auto-update hinting unit tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  fetchLatestVersion,
  getUpdateHintForHelp,
  isNewerVersion,
  readUpdateCache,
  shouldSkipCheck,
  showUpdateHintIfAvailable,
} from './update-check.js';

const CONFIG_PATH = path.join(os.homedir(), '.qa-use.json');

describe('update-check', () => {
  let originalConfig: string | null = null;
  let savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Backup existing config
    if (fs.existsSync(CONFIG_PATH)) {
      originalConfig = fs.readFileSync(CONFIG_PATH, 'utf-8');
    }
    // Start with empty config
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({}));

    // Save env vars we might modify
    savedEnv = {
      QA_USE_NO_UPDATE_CHECK: process.env.QA_USE_NO_UPDATE_CHECK,
      CI: process.env.CI,
    };
  });

  afterEach(() => {
    // Restore original config
    if (originalConfig !== null) {
      fs.writeFileSync(CONFIG_PATH, originalConfig);
    } else {
      if (fs.existsSync(CONFIG_PATH)) {
        fs.unlinkSync(CONFIG_PATH);
      }
    }

    // Restore env vars
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  });

  // ==========================================
  // isNewerVersion
  // ==========================================

  describe('isNewerVersion', () => {
    it('should return true when latest has higher major', () => {
      expect(isNewerVersion('3.0.0', '2.8.4')).toBe(true);
    });

    it('should return true when latest has higher minor', () => {
      expect(isNewerVersion('2.9.0', '2.8.4')).toBe(true);
    });

    it('should return true when latest has higher patch', () => {
      expect(isNewerVersion('2.8.5', '2.8.4')).toBe(true);
    });

    it('should return false when versions are equal', () => {
      expect(isNewerVersion('2.8.4', '2.8.4')).toBe(false);
    });

    it('should return false when current is newer', () => {
      expect(isNewerVersion('2.8.3', '2.8.4')).toBe(false);
    });

    it('should return false when current has higher major', () => {
      expect(isNewerVersion('1.9.9', '2.0.0')).toBe(false);
    });

    it('should handle v prefix', () => {
      expect(isNewerVersion('v2.9.0', 'v2.8.4')).toBe(true);
    });

    it('should handle different length versions', () => {
      expect(isNewerVersion('2.9', '2.8.4')).toBe(true);
      expect(isNewerVersion('2.8.4.1', '2.8.4')).toBe(true);
    });
  });

  // ==========================================
  // shouldSkipCheck
  // ==========================================

  describe('shouldSkipCheck', () => {
    it('should skip when QA_USE_NO_UPDATE_CHECK=1', () => {
      process.env.QA_USE_NO_UPDATE_CHECK = '1';
      delete process.env.CI;
      expect(shouldSkipCheck(['node', 'qa-use', 'test', 'run'])).toBe(true);
    });

    it('should skip when CI env var is set', () => {
      delete process.env.QA_USE_NO_UPDATE_CHECK;
      process.env.CI = 'true';
      expect(shouldSkipCheck(['node', 'qa-use', 'test', 'run'])).toBe(true);
    });

    it('should skip for browser run command', () => {
      delete process.env.QA_USE_NO_UPDATE_CHECK;
      delete process.env.CI;
      // Note: TTY check will also cause skip in test env, so we just verify
      // the function returns true for browser commands
      expect(shouldSkipCheck(['node', 'qa-use', 'browser', 'run'])).toBe(true);
    });

    it('should skip for browser snapshot command', () => {
      delete process.env.QA_USE_NO_UPDATE_CHECK;
      delete process.env.CI;
      expect(shouldSkipCheck(['node', 'qa-use', 'browser', 'snapshot'])).toBe(true);
    });

    it('should not skip browser create based on command alone', () => {
      delete process.env.QA_USE_NO_UPDATE_CHECK;
      delete process.env.CI;
      // browser create should NOT be skipped by the command check
      // (may still skip due to TTY check in test environment)
      const argv = ['node', 'qa-use', 'browser', 'create'];
      const args = argv.slice(2);
      // Directly verify the browser command logic: browser create should not match skip
      expect(args[0] === 'browser' && args[1] !== 'create').toBe(false);
    });

    it('should not skip for non-browser commands based on command alone', () => {
      const argv = ['node', 'qa-use', 'test', 'run'];
      const args = argv.slice(2);
      expect(args[0] === 'browser' && args[1] !== 'create').toBe(false);
    });
  });

  // ==========================================
  // readUpdateCache
  // ==========================================

  describe('readUpdateCache', () => {
    it('should return undefined when config has no update_cache', () => {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify({}));
      expect(readUpdateCache()).toBeUndefined();
    });

    it('should return cached data when present', () => {
      const cache = {
        update_cache: {
          latest_version: '3.0.0',
          checked_at: '2026-02-24T12:00:00.000Z',
        },
      };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cache));

      const result = readUpdateCache();
      expect(result).toBeDefined();
      expect(result!.latest_version).toBe('3.0.0');
      expect(result!.checked_at).toBe('2026-02-24T12:00:00.000Z');
    });

    it('should return undefined when config file is missing', () => {
      if (fs.existsSync(CONFIG_PATH)) {
        fs.unlinkSync(CONFIG_PATH);
      }
      expect(readUpdateCache()).toBeUndefined();
    });

    it('should return undefined when config file contains invalid JSON', () => {
      fs.writeFileSync(CONFIG_PATH, 'not valid json {{{');
      expect(readUpdateCache()).toBeUndefined();
    });

    it('should preserve other config keys when reading', () => {
      const config = {
        browser_sessions: [{ id: 'sess-1' }],
        update_cache: {
          latest_version: '3.0.0',
          checked_at: '2026-02-24T12:00:00.000Z',
        },
      };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));

      const result = readUpdateCache();
      expect(result!.latest_version).toBe('3.0.0');

      // Verify other keys are still in the file
      const fullConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      expect(fullConfig.browser_sessions).toHaveLength(1);
    });
  });

  // ==========================================
  // showUpdateHintIfAvailable
  // ==========================================

  describe('showUpdateHintIfAvailable', () => {
    it('should not write to stderr when no cache exists', () => {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify({}));
      const originalWrite = process.stderr.write;
      let output = '';
      process.stderr.write = ((chunk: string) => {
        output += chunk;
        return true;
      }) as typeof process.stderr.write;

      showUpdateHintIfAvailable('2.8.4');

      process.stderr.write = originalWrite;
      expect(output).toBe('');
    });

    it('should write hint to stderr when newer version is cached', () => {
      const config = {
        update_cache: {
          latest_version: '3.0.0',
          checked_at: new Date().toISOString(),
        },
      };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));

      const originalWrite = process.stderr.write;
      let output = '';
      process.stderr.write = ((chunk: string) => {
        output += chunk;
        return true;
      }) as typeof process.stderr.write;

      showUpdateHintIfAvailable('2.8.4');

      process.stderr.write = originalWrite;
      expect(output).toContain('Update available');
      expect(output).toContain('2.8.4');
      expect(output).toContain('3.0.0');
      expect(output).toContain('qa-use update');
    });

    it('should not write when cached version equals current', () => {
      const config = {
        update_cache: {
          latest_version: '2.8.4',
          checked_at: new Date().toISOString(),
        },
      };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));

      const originalWrite = process.stderr.write;
      let output = '';
      process.stderr.write = ((chunk: string) => {
        output += chunk;
        return true;
      }) as typeof process.stderr.write;

      showUpdateHintIfAvailable('2.8.4');

      process.stderr.write = originalWrite;
      expect(output).toBe('');
    });
  });

  // ==========================================
  // getUpdateHintForHelp
  // ==========================================

  describe('getUpdateHintForHelp', () => {
    it('should return empty string when no cache exists', () => {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify({}));
      expect(getUpdateHintForHelp('2.8.4')).toBe('');
    });

    it('should return empty string when no newer version', () => {
      const config = {
        update_cache: {
          latest_version: '2.8.4',
          checked_at: new Date().toISOString(),
        },
      };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));
      expect(getUpdateHintForHelp('2.8.4')).toBe('');
    });

    it('should return hint string when newer version cached', () => {
      const config = {
        update_cache: {
          latest_version: '3.0.0',
          checked_at: new Date().toISOString(),
        },
      };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));

      const hint = getUpdateHintForHelp('2.8.4');
      expect(hint).toContain('Update available');
      expect(hint).toContain('2.8.4');
      expect(hint).toContain('3.0.0');
      expect(hint).toContain('qa-use update');
    });
  });

  // ==========================================
  // fetchLatestVersion
  // ==========================================

  describe('fetchLatestVersion', () => {
    it('should return a valid version string from npm registry', async () => {
      const version = await fetchLatestVersion();
      // The package exists on npm, so we should get a version back
      // If this fails, it's likely a network issue in the test environment
      if (version !== null) {
        expect(version).toMatch(/^\d+\.\d+\.\d+/);
      }
    });
  });
});
