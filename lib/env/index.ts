/**
 * Environment variable utility with config file fallback
 *
 * Priority order:
 * 1. Environment variables (process.env)
 * 2. Config file (~/.qa-use.json) top-level fields (api_key, api_url, etc.)
 * 3. Config file (~/.qa-use.json) env block ({ "env": { "VAR_NAME": "value" } })
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export { getPortFromUrl, isLocalhostUrl } from './localhost.js';

/**
 * Tunnel mode stored in ~/.qa-use.json.
 * Kept as a string literal here (instead of importing `TunnelMode` from
 * `src/cli/lib/tunnel-option.ts`) to avoid pulling CLI code into the
 * shared env loader.
 */
export type QaUseTunnelMode = 'auto' | 'on' | 'off';

const VALID_TUNNEL_MODES: readonly QaUseTunnelMode[] = ['auto', 'on', 'off'] as const;

interface QaUseConfig {
  api_key?: string;
  api_url?: string;
  app_url?: string;
  region?: string;
  tunnel?: QaUseTunnelMode;
  env?: Record<string, string>;
}

/**
 * Mapping from env var names to top-level config field names.
 * Allows getEnvWithSource to check direct fields before the env block.
 */
const ENV_TO_FIELD: Record<string, keyof QaUseConfig> = {
  QA_USE_API_KEY: 'api_key',
  QA_USE_API_URL: 'api_url',
  QA_USE_APP_URL: 'app_url',
  QA_USE_REGION: 'region',
};

let cachedConfig: QaUseConfig | null = null;
let configLoadAttempted = false;

/**
 * Get the path to the config file
 */
function getConfigPath(): string {
  return join(homedir(), '.qa-use.json');
}

/**
 * Load the config file from ~/.qa-use.json
 * Returns null if file doesn't exist or is invalid
 */
function loadConfig(): QaUseConfig | null {
  if (configLoadAttempted) {
    return cachedConfig;
  }

  configLoadAttempted = true;

  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    cachedConfig = JSON.parse(content) as QaUseConfig;
    return cachedConfig;
  } catch {
    // Invalid JSON or read error - silently ignore
    return null;
  }
}

export type EnvSource = 'env' | 'config' | 'none';

export interface EnvResult {
  value: string | undefined;
  source: EnvSource;
}

/**
 * Get an environment variable value with fallback to config file,
 * along with the source of the value.
 *
 * Priority: process.env → config top-level field → config env block
 *
 * @param name - The environment variable name (e.g., 'QA_USE_API_KEY')
 * @returns Object containing the value and its source
 */
export function getEnvWithSource(name: string): EnvResult {
  // First check environment variable
  const envValue = process.env[name];
  if (envValue !== undefined && envValue !== '') {
    return { value: envValue, source: 'env' };
  }

  // Fallback to config file — check top-level field first, then env block
  const config = loadConfig();
  if (config) {
    const fieldName = ENV_TO_FIELD[name];
    if (fieldName) {
      const fieldValue = config[fieldName];
      if (typeof fieldValue === 'string' && fieldValue) {
        return { value: fieldValue, source: 'config' };
      }
    }

    if (config.env?.[name]) {
      return { value: config.env[name], source: 'config' };
    }
  }

  return { value: undefined, source: 'none' };
}

/**
 * Get an environment variable value with fallback to config file
 *
 * @param name - The environment variable name (e.g., 'QA_USE_API_KEY')
 * @returns The value from env or config file, or undefined if not found
 */
export function getEnv(name: string): string | undefined {
  return getEnvWithSource(name).value;
}

/**
 * Clear the cached config (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  configLoadAttempted = false;
}

/**
 * Check if config file exists
 */
export function configFileExists(): boolean {
  return existsSync(getConfigPath());
}

/**
 * Get human-readable source description
 */
function getSourceDescription(source: EnvSource): string {
  switch (source) {
    case 'env':
      return 'environment variable';
    case 'config':
      return `config file (~/.qa-use.json)`;
    case 'none':
      return 'not set';
  }
}

/**
 * Log the source of key configuration values
 * Call this at startup to inform users where their credentials are coming from
 */
export function logConfigSources(): void {
  const apiKey = getEnvWithSource('QA_USE_API_KEY');
  const apiUrl = getEnvWithSource('QA_USE_API_URL');
  const appUrl = getEnvWithSource('QA_USE_APP_URL');
  const region = getEnvWithSource('QA_USE_REGION');

  const sources: string[] = [];

  if (apiKey.value) {
    const maskedKey = `${apiKey.value.slice(0, 8)}...${apiKey.value.slice(-4)}`;
    sources.push(`  API Key: ${maskedKey} (from ${getSourceDescription(apiKey.source)})`);
  }

  if (apiUrl.value) {
    sources.push(`  API URL: ${apiUrl.value} (from ${getSourceDescription(apiUrl.source)})`);
  }

  if (appUrl.value) {
    sources.push(`  App URL: ${appUrl.value} (from ${getSourceDescription(appUrl.source)})`);
  }

  if (region.value) {
    sources.push(`  Region: ${region.value} (from ${getSourceDescription(region.source)})`);
  }

  if (sources.length > 0) {
    console.error('Configuration loaded:');
    sources.forEach((s) => console.error(s));
  }
}

/**
 * Get custom headers from config file and QA_USE_HEADERS env var.
 * Used by API clients that don't go through CLI's loadConfig().
 *
 * Priority: config file headers, then QA_USE_HEADERS env var overrides.
 */
export function getCustomHeaders(): Record<string, string> | null {
  const headers: Record<string, string> = {};

  const config = loadConfig();
  if (config) {
    const configHeaders = (config as Record<string, unknown>).headers;
    if (configHeaders && typeof configHeaders === 'object' && !Array.isArray(configHeaders)) {
      Object.assign(headers, configHeaders);
    }
  }

  const envHeaders = process.env.QA_USE_HEADERS;
  if (envHeaders) {
    try {
      const parsed = JSON.parse(envHeaders);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        Object.assign(headers, parsed);
      }
    } catch {
      // Silently ignore invalid JSON
    }
  }

  return Object.keys(headers).length > 0 ? headers : null;
}

/**
 * Read the `tunnel` key from `~/.qa-use.json`.
 *
 * Returns one of `'auto' | 'on' | 'off'`, or `undefined` if unset.
 * On an invalid value, logs a one-line stderr warning and returns `undefined`
 * (caller will fall back to the default, typically `'auto'`).
 *
 * Phase 1: config-only (no env-var override layer for tunnel mode).
 */
let tunnelWarningLogged = false;
export function getTunnelModeFromConfig(): QaUseTunnelMode | undefined {
  const config = loadConfig();
  if (!config) return undefined;

  const raw = config.tunnel;
  if (raw === undefined || raw === null) return undefined;

  if (typeof raw === 'string' && VALID_TUNNEL_MODES.includes(raw as QaUseTunnelMode)) {
    return raw as QaUseTunnelMode;
  }

  if (!tunnelWarningLogged) {
    console.error(
      `qa-use: invalid "tunnel" value in ~/.qa-use.json: ${JSON.stringify(raw)}. ` +
        `Expected one of: ${VALID_TUNNEL_MODES.join(', ')}. Falling back to "auto".`
    );
    tunnelWarningLogged = true;
  }
  return undefined;
}

/**
 * Reset the tunnel-warning latch (for tests).
 */
export function clearTunnelWarningLatch(): void {
  tunnelWarningLogged = false;
}

/**
 * Get agent session ID from environment if available.
 * Used for auto-linking browser sessions and test runs to agent sessions.
 *
 * Unlike other env vars, this does NOT fall back to config file - it's purely
 * a runtime value set by the test-agent container.
 */
export function getAgentSessionId(): string | undefined {
  return process.env.QA_USE_AGENT_SESSION_ID || undefined;
}
