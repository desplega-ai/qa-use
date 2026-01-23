/**
 * Browser Session Persistence Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  loadStoredSessions,
  storeSession,
  removeStoredSession,
  touchSession,
  isSessionStale,
  cleanStaleSessions,
  getActiveSessions,
  createStoredSession,
  type StoredSession,
} from './browser-sessions.js';

const TEST_CONFIG_PATH = path.join(os.homedir(), '.qa-use.json');

describe('browser-sessions', () => {
  let originalConfig: string | null = null;

  beforeEach(() => {
    // Backup existing config if present
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      originalConfig = fs.readFileSync(TEST_CONFIG_PATH, 'utf-8');
    }
    // Start with empty config
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({}));
  });

  afterEach(() => {
    // Restore original config
    if (originalConfig !== null) {
      fs.writeFileSync(TEST_CONFIG_PATH, originalConfig);
    } else {
      // Remove test config if it didn't exist before
      if (fs.existsSync(TEST_CONFIG_PATH)) {
        fs.unlinkSync(TEST_CONFIG_PATH);
      }
    }
  });

  describe('loadStoredSessions', () => {
    it('should return empty array when no sessions stored', async () => {
      const sessions = await loadStoredSessions();
      expect(sessions).toEqual([]);
    });

    it('should load stored sessions', async () => {
      const config = {
        browser_sessions: [
          {
            id: 'session-1',
            created_at: '2026-01-23T10:00:00Z',
            last_updated: '2026-01-23T10:00:00Z',
          },
          {
            id: 'session-2',
            created_at: '2026-01-23T11:00:00Z',
            last_updated: '2026-01-23T11:00:00Z',
          },
        ],
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      const sessions = await loadStoredSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('session-1');
      expect(sessions[1].id).toBe('session-2');
    });
  });

  describe('storeSession', () => {
    it('should store a new session', async () => {
      const session: StoredSession = {
        id: 'session-123',
        created_at: '2026-01-23T10:00:00Z',
        last_updated: '2026-01-23T10:00:00Z',
      };

      await storeSession(session);

      const sessions = await loadStoredSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('session-123');
    });

    it('should update existing session', async () => {
      const session1: StoredSession = {
        id: 'session-123',
        created_at: '2026-01-23T10:00:00Z',
        last_updated: '2026-01-23T10:00:00Z',
      };
      await storeSession(session1);

      const session2: StoredSession = {
        id: 'session-123',
        created_at: '2026-01-23T10:00:00Z',
        last_updated: '2026-01-23T11:00:00Z',
      };
      await storeSession(session2);

      const sessions = await loadStoredSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].last_updated).toBe('2026-01-23T11:00:00Z');
    });

    it('should preserve other sessions', async () => {
      const session1: StoredSession = {
        id: 'session-1',
        created_at: '2026-01-23T10:00:00Z',
        last_updated: '2026-01-23T10:00:00Z',
      };
      const session2: StoredSession = {
        id: 'session-2',
        created_at: '2026-01-23T11:00:00Z',
        last_updated: '2026-01-23T11:00:00Z',
      };

      await storeSession(session1);
      await storeSession(session2);

      const sessions = await loadStoredSessions();
      expect(sessions).toHaveLength(2);
    });
  });

  describe('removeStoredSession', () => {
    it('should remove a session by ID', async () => {
      const config = {
        browser_sessions: [
          {
            id: 'session-1',
            created_at: '2026-01-23T10:00:00Z',
            last_updated: '2026-01-23T10:00:00Z',
          },
          {
            id: 'session-2',
            created_at: '2026-01-23T11:00:00Z',
            last_updated: '2026-01-23T11:00:00Z',
          },
        ],
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      await removeStoredSession('session-1');

      const sessions = await loadStoredSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('session-2');
    });

    it('should do nothing if session not found', async () => {
      const config = {
        browser_sessions: [
          {
            id: 'session-1',
            created_at: '2026-01-23T10:00:00Z',
            last_updated: '2026-01-23T10:00:00Z',
          },
        ],
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      await removeStoredSession('session-999');

      const sessions = await loadStoredSessions();
      expect(sessions).toHaveLength(1);
    });
  });

  describe('touchSession', () => {
    it('should update last_updated timestamp', async () => {
      const config = {
        browser_sessions: [
          {
            id: 'session-1',
            created_at: '2026-01-23T10:00:00Z',
            last_updated: '2026-01-23T10:00:00Z',
          },
        ],
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      const beforeTouch = new Date().toISOString();
      await touchSession('session-1');
      const afterTouch = new Date().toISOString();

      const sessions = await loadStoredSessions();
      expect(sessions[0].last_updated >= beforeTouch).toBe(true);
      expect(sessions[0].last_updated <= afterTouch).toBe(true);
    });

    it('should do nothing if session not found', async () => {
      const config = {
        browser_sessions: [
          {
            id: 'session-1',
            created_at: '2026-01-23T10:00:00Z',
            last_updated: '2026-01-23T10:00:00Z',
          },
        ],
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      await touchSession('session-999');

      const sessions = await loadStoredSessions();
      expect(sessions[0].last_updated).toBe('2026-01-23T10:00:00Z');
    });
  });

  describe('isSessionStale', () => {
    it('should return true for sessions older than 1 hour', () => {
      const oldSession: StoredSession = {
        id: 'old-session',
        created_at: '2026-01-23T08:00:00Z',
        last_updated: new Date(Date.now() - 61 * 60 * 1000).toISOString(), // 61 minutes ago
      };

      expect(isSessionStale(oldSession)).toBe(true);
    });

    it('should return false for recent sessions', () => {
      const recentSession: StoredSession = {
        id: 'recent-session',
        created_at: '2026-01-23T10:00:00Z',
        last_updated: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      };

      expect(isSessionStale(recentSession)).toBe(false);
    });
  });

  describe('cleanStaleSessions', () => {
    it('should remove stale sessions and return them', async () => {
      const config = {
        browser_sessions: [
          {
            id: 'fresh-session',
            created_at: '2026-01-23T10:00:00Z',
            last_updated: new Date().toISOString(),
          },
          {
            id: 'stale-session',
            created_at: '2026-01-23T08:00:00Z',
            last_updated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          },
        ],
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      const staleSessions = await cleanStaleSessions();

      expect(staleSessions).toHaveLength(1);
      expect(staleSessions[0].id).toBe('stale-session');

      const remainingSessions = await loadStoredSessions();
      expect(remainingSessions).toHaveLength(1);
      expect(remainingSessions[0].id).toBe('fresh-session');
    });
  });

  describe('getActiveSessions', () => {
    it('should return only non-stale sessions', async () => {
      const config = {
        browser_sessions: [
          {
            id: 'fresh-session',
            created_at: '2026-01-23T10:00:00Z',
            last_updated: new Date().toISOString(),
          },
          {
            id: 'stale-session',
            created_at: '2026-01-23T08:00:00Z',
            last_updated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          },
        ],
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      const activeSessions = await getActiveSessions();

      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe('fresh-session');
    });
  });

  describe('createStoredSession', () => {
    it('should create session with current timestamps', () => {
      const beforeCreate = new Date().toISOString();
      const session = createStoredSession('new-session');
      const afterCreate = new Date().toISOString();

      expect(session.id).toBe('new-session');
      expect(session.created_at >= beforeCreate).toBe(true);
      expect(session.created_at <= afterCreate).toBe(true);
      expect(session.last_updated).toBe(session.created_at);
    });
  });
});
