import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_PATH = join(homedir(), '.qa-use.json');

export interface CachedOpenApiSpec {
  apiUrl: string;
  fetchedAt: string;
  etag?: string;
  specHash: string;
  spec: unknown;
}

interface QaUseConfig {
  [key: string]: unknown;
  openapi_cache?: Record<string, CachedOpenApiSpec>;
}

function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.replace(/\/$/, '');
}

function readConfig(): QaUseConfig {
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }

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
    // Ignore cache write failures (permissions, disk full, etc.)
  }
}

export function readOpenApiCache(apiUrl: string): CachedOpenApiSpec | undefined {
  const key = normalizeApiUrl(apiUrl);
  return readConfig().openapi_cache?.[key];
}

export function writeOpenApiCache(entry: CachedOpenApiSpec): void {
  const key = normalizeApiUrl(entry.apiUrl);
  const config = readConfig();
  config.openapi_cache = config.openapi_cache || {};
  config.openapi_cache[key] = {
    ...entry,
    apiUrl: key,
  };
  writeConfig(config);
}
