import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readOpenApiCache, writeOpenApiCache } from './openapi-cache.js';

const CONFIG_PATH = join(homedir(), '.qa-use.json');

describe('openapi-cache', () => {
  let originalConfig: string | null = null;

  beforeEach(() => {
    if (existsSync(CONFIG_PATH)) {
      originalConfig = readFileSync(CONFIG_PATH, 'utf-8');
    }
    writeFileSync(CONFIG_PATH, JSON.stringify({}));
  });

  afterEach(() => {
    if (originalConfig !== null) {
      writeFileSync(CONFIG_PATH, originalConfig);
    } else if (existsSync(CONFIG_PATH)) {
      unlinkSync(CONFIG_PATH);
    }
    originalConfig = null;
  });

  it('writes and reads cache entries by api url', () => {
    writeOpenApiCache({
      apiUrl: 'https://api.desplega.ai',
      fetchedAt: '2026-03-05T16:00:00.000Z',
      etag: 'W/"etag-1"',
      specHash: 'abc123',
      spec: { openapi: '3.1.0', paths: {} },
    });

    const entry = readOpenApiCache('https://api.desplega.ai');
    expect(entry).toBeDefined();
    expect(entry?.apiUrl).toBe('https://api.desplega.ai');
    expect(entry?.etag).toBe('W/"etag-1"');
    expect(entry?.specHash).toBe('abc123');
  });

  it('normalizes trailing slash in api url key', () => {
    writeOpenApiCache({
      apiUrl: 'https://api.desplega.ai/',
      fetchedAt: '2026-03-05T16:00:00.000Z',
      specHash: 'abc123',
      spec: { openapi: '3.1.0', paths: {} },
    });

    const entry = readOpenApiCache('https://api.desplega.ai');
    expect(entry).toBeDefined();
    expect(entry?.apiUrl).toBe('https://api.desplega.ai');
  });
});
