/**
 * Configuration file management for .qa-use.json
 */

import * as fs from 'node:fs/promises';
import { homedir } from 'node:os';
import * as path from 'node:path';
import { BrowserApiClient } from '../../../lib/api/browser.js';
import { ApiClient } from '../../../lib/api/index.js';

export interface CliConfig {
  env?: Record<string, string>;
  api_key?: string;
  api_url?: string;
  default_app_config_id?: string;
  test_directory?: string;
  headers?: Record<string, string>;
  defaults?: {
    headless?: boolean;
    persist?: boolean;
    timeout?: number;
  };
}

const CONFIG_FILENAME = '.qa-use.json';
const LEGACY_CONFIG_FILENAME = '.qa-use-tests.json';

const legacyWarningShown = new Set<string>();

/**
 * Try to access a config file, checking the primary name first then the legacy name.
 * Returns the resolved path or null. Logs a deprecation warning (once per dir) for legacy files.
 */
async function resolveConfigInDir(dir: string): Promise<string | null> {
  const primary = path.join(dir, CONFIG_FILENAME);
  try {
    await fs.access(primary);
    return primary;
  } catch {
    // Primary not found, try legacy
  }

  const legacy = path.join(dir, LEGACY_CONFIG_FILENAME);
  try {
    await fs.access(legacy);
    if (!legacyWarningShown.has(dir)) {
      legacyWarningShown.add(dir);
      console.error(
        `Warning: ${legacy} is deprecated. Rename to ${CONFIG_FILENAME} — legacy support will be removed in a future version.`
      );
    }
    return legacy;
  } catch {
    // Neither found
  }

  return null;
}

/**
 * Search for config file in current directory and home directory.
 * Checks .qa-use.json first, falls back to .qa-use-tests.json (deprecated).
 */
export async function findConfigFile(): Promise<string | null> {
  const cwd = process.cwd();

  const localConfig = await resolveConfigInDir(cwd);
  if (localConfig) return localConfig;

  const homeConfig = await resolveConfigInDir(homedir());
  if (homeConfig) return homeConfig;

  return null;
}

/**
 * Load CLI configuration from .qa-use.json
 *
 * Priority order (highest to lowest):
 * 1. Environment variables (QA_USE_API_KEY, QA_USE_API_URL, etc.)
 * 2. Project config file (.qa-use.json in cwd)
 * 3. User config file (~/.qa-use.json in home)
 * 4. Built-in defaults
 */
export async function loadConfig(): Promise<CliConfig> {
  const configPath = await findConfigFile();

  let config: CliConfig = {
    test_directory: './qa-tests',
    defaults: {
      headless: true,
      persist: false,
      timeout: 300,
    },
  };

  if (configPath) {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const fileConfig = JSON.parse(content) as CliConfig;
      config = { ...config, ...fileConfig };
    } catch (error) {
      console.error(`Warning: Failed to parse config file at ${configPath}`);
      console.error(error);
    }
  }

  // Apply env block from config (only if shell env doesn't already set them)
  if (config.env) {
    for (const [key, value] of Object.entries(config.env)) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }

  // Environment variables take precedence over config file values
  if (process.env.QA_USE_API_KEY) {
    config.api_key = process.env.QA_USE_API_KEY;
  }

  if (process.env.QA_USE_API_URL) {
    config.api_url = process.env.QA_USE_API_URL;
  }

  if (process.env.QA_USE_DEFAULT_APP_CONFIG_ID) {
    config.default_app_config_id = process.env.QA_USE_DEFAULT_APP_CONFIG_ID;
  }

  // Resolve custom headers: QA_USE_HEADERS env var seeds defaults, config-file
  // headers override per-key. Headers intentionally use file-wins precedence
  // (unlike api_key / api_url) so a per-session .qa-use.json can override an
  // ambient env value baked in by a multi-tenant host (e.g. a sandbox gateway
  // that sets QA_USE_HEADERS process-wide but writes per-session config files).
  const resolvedHeaders: Record<string, string> = {};

  const envHeaders = process.env.QA_USE_HEADERS;
  if (envHeaders) {
    try {
      const parsed = JSON.parse(envHeaders);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        Object.assign(resolvedHeaders, parsed);
      }
    } catch {
      console.error('Warning: QA_USE_HEADERS is not valid JSON, ignoring');
    }
  }

  if (config.headers) {
    Object.assign(resolvedHeaders, config.headers);
  }

  if (Object.keys(resolvedHeaders).length > 0) {
    config.headers = resolvedHeaders;
  }

  return config;
}

/**
 * Save configuration to .qa-use.json in current directory
 */
export async function saveConfig(config: CliConfig): Promise<void> {
  const configPath = path.join(process.cwd(), CONFIG_FILENAME);
  const content = JSON.stringify(config, null, 2);
  await fs.writeFile(configPath, content, 'utf-8');
}

/**
 * Check if config file exists
 */
export async function configExists(): Promise<boolean> {
  return (await findConfigFile()) !== null;
}

/**
 * Create a BrowserApiClient pre-configured with API key and custom headers from config.
 */
export function createBrowserClient(config: CliConfig): BrowserApiClient {
  const client = new BrowserApiClient(config.api_url);
  if (config.api_key) client.setApiKey(config.api_key);
  if (config.headers) client.setCustomHeaders(config.headers);
  return client;
}

/**
 * Create an ApiClient pre-configured with API key and custom headers from config.
 */
export function createApiClient(config: CliConfig): ApiClient {
  const client = new ApiClient(config.api_url);
  if (config.api_key) client.setApiKey(config.api_key);
  if (config.headers) client.setCustomHeaders(config.headers);
  return client;
}
