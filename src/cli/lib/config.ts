/**
 * Configuration file management for .qa-use-tests.json
 */

import * as fs from 'node:fs/promises';
import { homedir } from 'node:os';
import * as path from 'node:path';

export interface CliConfig {
  env?: Record<string, string>;
  api_key?: string;
  api_url?: string;
  default_app_config_id?: string;
  test_directory?: string;
  defaults?: {
    headless?: boolean;
    persist?: boolean;
    timeout?: number;
    allow_fix?: boolean;
  };
}

const CONFIG_FILENAME = '.qa-use-tests.json';

/**
 * Search for config file in current directory and home directory
 */
async function findConfigFile(): Promise<string | null> {
  // Check current directory
  const cwd = process.cwd();
  const localConfig = path.join(cwd, CONFIG_FILENAME);

  try {
    await fs.access(localConfig);
    return localConfig;
  } catch {
    // Not in current directory
  }

  // Check home directory
  const homeConfig = path.join(homedir(), CONFIG_FILENAME);
  try {
    await fs.access(homeConfig);
    return homeConfig;
  } catch {
    // Not in home directory
  }

  return null;
}

/**
 * Load CLI configuration from .qa-use-tests.json
 *
 * Priority order (highest to lowest):
 * 1. Project config file (.qa-use-tests.json in cwd or home)
 * 2. Environment variables (QA_USE_API_KEY, QA_USE_API_URL, etc.)
 * 3. Built-in defaults
 */
export async function loadConfig(): Promise<CliConfig> {
  const configPath = await findConfigFile();

  let config: CliConfig = {
    test_directory: './qa-tests',
    defaults: {
      headless: true,
      persist: false,
      timeout: 300,
      allow_fix: true,
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

  // Apply env block from config (after file merge, before env fallback)
  if (config.env) {
    for (const [key, value] of Object.entries(config.env)) {
      if (!process.env[key]) {
        // Don't override existing shell env vars
        process.env[key] = value;
      }
    }
  }

  // Environment variables are fallbacks — only used when config file doesn't set the value
  if (!config.api_key && process.env.QA_USE_API_KEY) {
    config.api_key = process.env.QA_USE_API_KEY;
  }

  if (!config.api_url && process.env.QA_USE_API_URL) {
    config.api_url = process.env.QA_USE_API_URL;
  }

  if (!config.default_app_config_id && process.env.QA_USE_DEFAULT_APP_CONFIG_ID) {
    config.default_app_config_id = process.env.QA_USE_DEFAULT_APP_CONFIG_ID;
  }

  return config;
}

/**
 * Save configuration to .qa-use-tests.json in current directory
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
