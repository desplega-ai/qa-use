/**
 * Browser session persistence utilities
 *
 * Stores active browser sessions in ~/.qa-use.json under "browser_sessions" key.
 * Provides session resolution logic for commands that need a session ID.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { BrowserApiClient } from '../../../lib/api/browser.js';

// ==========================================
// Types
// ==========================================

export interface StoredSession {
  id: string;
  created_at: string;
  last_updated: string;
}

interface QaUseConfig {
  env?: Record<string, string>;
  browser_sessions?: StoredSession[];
}

// ==========================================
// Configuration
// ==========================================

const CONFIG_PATH = join(homedir(), '.qa-use.json');
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

// ==========================================
// Config File Operations
// ==========================================

/**
 * Load the config file from ~/.qa-use.json
 */
function loadConfig(): QaUseConfig {
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }

  try {
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(content) as QaUseConfig;
  } catch {
    return {};
  }
}

/**
 * Save the config file to ~/.qa-use.json
 */
function saveConfig(config: QaUseConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ==========================================
// Session Storage Operations
// ==========================================

/**
 * Load all stored sessions from config file
 */
export async function loadStoredSessions(): Promise<StoredSession[]> {
  const config = loadConfig();
  return config.browser_sessions || [];
}

/**
 * Store a new session or update an existing one
 */
export async function storeSession(session: StoredSession): Promise<void> {
  const config = loadConfig();
  const sessions = config.browser_sessions || [];

  // Find existing session with same ID
  const existingIndex = sessions.findIndex((s) => s.id === session.id);

  if (existingIndex >= 0) {
    // Update existing session
    sessions[existingIndex] = session;
  } else {
    // Add new session
    sessions.push(session);
  }

  config.browser_sessions = sessions;
  saveConfig(config);
}

/**
 * Remove a session from storage by ID
 */
export async function removeStoredSession(id: string): Promise<void> {
  const config = loadConfig();
  const sessions = config.browser_sessions || [];

  config.browser_sessions = sessions.filter((s) => s.id !== id);
  saveConfig(config);
}

/**
 * Update the last_updated timestamp for a session
 */
export async function touchSession(id: string): Promise<void> {
  const config = loadConfig();
  const sessions = config.browser_sessions || [];

  const session = sessions.find((s) => s.id === id);
  if (session) {
    session.last_updated = new Date().toISOString();
    saveConfig(config);
  }
}

/**
 * Check if a session is stale (last_updated > 1 hour ago)
 */
export function isSessionStale(session: StoredSession): boolean {
  const lastUpdated = new Date(session.last_updated).getTime();
  const now = Date.now();
  return now - lastUpdated > STALE_THRESHOLD_MS;
}

/**
 * Clean up stale sessions from storage
 * Note: This only removes from local storage, does not close sessions on API
 */
export async function cleanStaleSessions(): Promise<StoredSession[]> {
  const config = loadConfig();
  const sessions = config.browser_sessions || [];

  const stale = sessions.filter(isSessionStale);
  const active = sessions.filter((s) => !isSessionStale(s));

  config.browser_sessions = active;
  saveConfig(config);

  return stale;
}

/**
 * Get non-stale sessions
 */
export async function getActiveSessions(): Promise<StoredSession[]> {
  const sessions = await loadStoredSessions();
  return sessions.filter((s) => !isSessionStale(s));
}

// ==========================================
// Session Resolution
// ==========================================

export interface SessionResolutionOptions {
  /** Explicit session ID from -s/--session-id flag */
  explicitId?: string;
  /** The BrowserApiClient to use for verification */
  client: BrowserApiClient;
  /** Whether to verify the session exists on the API (default: true) */
  verify?: boolean;
}

export interface ResolvedSession {
  id: string;
  source: 'explicit' | 'stored';
}

/**
 * Resolve which session ID to use based on provided flags and stored sessions.
 *
 * Resolution rules:
 * 1. If explicitId is provided, use that session
 * 2. Otherwise, check stored sessions:
 *    - Filter out stale sessions
 *    - If exactly one active session, use it
 *    - If multiple active sessions, throw error listing them
 *    - If no active sessions, throw error with create suggestion
 *
 * @throws Error if no session can be resolved or verification fails
 */
export async function resolveSessionId(options: SessionResolutionOptions): Promise<ResolvedSession> {
  const { explicitId, client, verify = true } = options;

  let sessionId: string;
  let source: 'explicit' | 'stored';

  if (explicitId) {
    // Use explicit session ID
    sessionId = explicitId;
    source = 'explicit';
  } else {
    // Get non-stale stored sessions
    const activeSessions = await getActiveSessions();

    if (activeSessions.length === 0) {
      throw new Error(
        'No active session found. Run `qa-use browser create` to create a new session.'
      );
    }

    if (activeSessions.length > 1) {
      const sessionList = activeSessions.map((s) => `  - ${s.id}`).join('\n');
      throw new Error(
        `Multiple active sessions found. Please specify one with -s/--session-id:\n${sessionList}`
      );
    }

    // Exactly one active session
    sessionId = activeSessions[0].id;
    source = 'stored';
  }

  // Verify session exists on API if requested
  if (verify) {
    try {
      await client.getSession(sessionId);
    } catch (error) {
      // If session not found on API, remove from local storage
      await removeStoredSession(sessionId);

      if (source === 'stored') {
        throw new Error(
          `Stored session ${sessionId} is no longer active. Run \`qa-use browser create\` to create a new session.`
        );
      } else {
        throw new Error(`Session ${sessionId} not found.`);
      }
    }

    // Update last_updated timestamp since we just verified it
    await touchSession(sessionId);
  }

  return { id: sessionId, source };
}

/**
 * Create a new stored session entry
 */
export function createStoredSession(id: string): StoredSession {
  const now = new Date().toISOString();
  return {
    id,
    created_at: now,
    last_updated: now,
  };
}
