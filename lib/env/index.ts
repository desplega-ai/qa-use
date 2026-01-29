/**
 * Environment variable utility with config file fallback
 *
 * Priority order:
 * 1. Environment variables (process.env)
 * 2. Config file (~/.qa-use.json) with structure: { "env": { "VAR_NAME": "value" } }
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

interface QaUseConfig {
  env?: Record<string, string>;
}

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
 * along with the source of the value
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

  // Fallback to config file
  const config = loadConfig();
  if (config?.env?.[name]) {
    return { value: config.env[name], source: 'config' };
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
