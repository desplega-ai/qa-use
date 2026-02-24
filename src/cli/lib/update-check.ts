/**
 * Auto-update hinting for the qa-use CLI
 *
 * Checks the npm registry for newer versions and shows a hint on startup.
 * Uses ~/.qa-use.json to cache results (24h TTL). The fetch is fire-and-forget
 * so it never blocks CLI startup.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { warning } from './output.js';

// ==========================================
// Constants
// ==========================================

const CONFIG_PATH = join(homedir(), '.qa-use.json');
const REGISTRY_URL = 'https://registry.npmjs.org/@desplega.ai/qa-use/latest';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 3000;

// ==========================================
// Types
// ==========================================

interface UpdateCache {
  latest_version: string;
  checked_at: string;
}

interface QaUseConfig {
  [key: string]: unknown;
  update_cache?: UpdateCache;
}

// ==========================================
// Cache Operations
// ==========================================

function readConfig(): QaUseConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as QaUseConfig;
  } catch {
    return {};
  }
}

function writeConfig(config: QaUseConfig): void {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch {
    // Silently ignore write errors (permissions, disk full, etc.)
  }
}

export function readUpdateCache(): UpdateCache | undefined {
  return readConfig().update_cache;
}

function writeUpdateCache(cache: UpdateCache): void {
  const config = readConfig();
  config.update_cache = cache;
  writeConfig(config);
}

function isCacheStale(cache: UpdateCache): boolean {
  const checkedAt = new Date(cache.checked_at).getTime();
  return Date.now() - checkedAt > CACHE_TTL_MS;
}

// ==========================================
// Version Comparison
// ==========================================

function parseVersion(v: string): number[] {
  return v.replace(/^v/, '').split('.').map(Number);
}

export function isNewerVersion(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lp = l[i] ?? 0;
    const cp = c[i] ?? 0;
    if (lp > cp) return true;
    if (lp < cp) return false;
  }
  return false;
}

// ==========================================
// Registry Fetch
// ==========================================

export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(REGISTRY_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

// ==========================================
// Public API
// ==========================================

/**
 * Fire-and-forget: fetch latest version from npm and update cache.
 * Does not block — errors are silently swallowed.
 */
export function checkForUpdateAsync(): void {
  const cache = readUpdateCache();
  if (cache && !isCacheStale(cache)) return;

  fetchLatestVersion()
    .then((version) => {
      if (version) {
        writeUpdateCache({ latest_version: version, checked_at: new Date().toISOString() });
      }
    })
    .catch(() => {
      // Silently ignore — this is best-effort
    });
}

/**
 * Show an update hint to stderr if the cache indicates a newer version.
 * Synchronous — reads from cache only, no network.
 */
export function showUpdateHintIfAvailable(currentVersion: string): void {
  const cache = readUpdateCache();
  if (!cache) return; // No cache = first run or never checked → stay silent

  if (isNewerVersion(cache.latest_version, currentVersion)) {
    process.stderr.write(
      `${warning(`Update available: ${currentVersion} → ${cache.latest_version}`)}\n` +
        `  Run ${'\x1b[36m'}qa-use update${'\x1b[0m'} to update\n\n`
    );
  }
}

/**
 * Returns the update hint string for help text, or empty string if no update.
 */
export function getUpdateHintForHelp(currentVersion: string): string {
  const cache = readUpdateCache();
  if (!cache || !isNewerVersion(cache.latest_version, currentVersion)) return '';
  return (
    `\n${warning(`Update available: ${currentVersion} → ${cache.latest_version}`)}\n` +
    `  Run ${'qa-use update'} to update`
  );
}

/**
 * Determine if the update check should be skipped.
 */
export function shouldSkipCheck(argv: string[]): boolean {
  // Env var opt-out
  if (process.env.QA_USE_NO_UPDATE_CHECK === '1') return true;

  // CI environment
  if (process.env.CI) return true;

  // Non-interactive (not a TTY)
  if (!process.stderr.isTTY) return true;

  // Skip for browser commands except "browser create"
  // argv: [node, script, ...args]
  const args = argv.slice(2);
  if (args[0] === 'browser' && args[1] !== 'create') return true;

  return false;
}
