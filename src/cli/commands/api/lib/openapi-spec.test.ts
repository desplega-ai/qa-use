import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadOpenApiSpec } from './openapi-spec.js';

const CONFIG_PATH = join(homedir(), '.qa-use.json');

const VALID_SPEC = {
  openapi: '3.1.0',
  paths: {
    '/api/v1/tests': {
      get: {
        summary: 'List tests',
        operationId: 'list_tests',
      },
    },
    '/api/v1/tests-actions/run': {
      post: {
        summary: 'Run tests',
        requestBody: { required: true },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
  },
};

describe('openapi-spec', () => {
  let originalConfig: string | null = null;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    if (existsSync(CONFIG_PATH)) {
      originalConfig = readFileSync(CONFIG_PATH, 'utf-8');
    }
    writeFileSync(CONFIG_PATH, JSON.stringify({}));
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;

    if (originalConfig !== null) {
      writeFileSync(CONFIG_PATH, originalConfig);
    } else if (existsSync(CONFIG_PATH)) {
      unlinkSync(CONFIG_PATH);
    }
    originalConfig = null;
  });

  it('loads live spec, validates, normalizes operations, and caches', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(VALID_SPEC), {
        status: 200,
        headers: { etag: 'W/"spec-v1"' },
      });

    const loaded = await loadOpenApiSpec({
      apiUrl: 'https://api.desplega.ai',
      apiKey: 'secret',
    });

    expect(loaded.source).toBe('live');
    expect(loaded.stale).toBe(false);
    expect(loaded.etag).toBe('W/"spec-v1"');
    expect(loaded.index.operations['GET /api/v1/tests']).toBeDefined();
    expect(loaded.index.operations['POST /api/v1/tests-actions/run']?.requestBodyRequired).toBe(
      true
    );
  });

  it('loads from cache in offline mode', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(VALID_SPEC), {
        status: 200,
      });

    await loadOpenApiSpec({ apiUrl: 'https://api.desplega.ai' });

    const loaded = await loadOpenApiSpec({
      apiUrl: 'https://api.desplega.ai',
      refreshMode: 'offline',
    });

    expect(loaded.source).toBe('cache');
    expect(loaded.stale).toBe(false);
    expect(loaded.index.operations['GET /api/v1/tests']).toBeDefined();
  });

  it('falls back to stale cache on transient fetch failure', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(VALID_SPEC), {
        status: 200,
      });

    await loadOpenApiSpec({ apiUrl: 'https://api.desplega.ai' });

    globalThis.fetch = async () => {
      throw new Error('network down');
    };

    const loaded = await loadOpenApiSpec({ apiUrl: 'https://api.desplega.ai' });

    expect(loaded.source).toBe('cache');
    expect(loaded.stale).toBe(true);
    expect(loaded.warnings[0]).toContain('using stale cached OpenAPI spec');
  });

  it('uses cached spec when server responds 304', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(VALID_SPEC), {
        status: 200,
        headers: { etag: 'W/"spec-v1"' },
      });

    await loadOpenApiSpec({ apiUrl: 'https://api.desplega.ai' });

    globalThis.fetch = async () =>
      new Response(null, {
        status: 304,
      });

    const loaded = await loadOpenApiSpec({ apiUrl: 'https://api.desplega.ai' });
    expect(loaded.source).toBe('cache');
    expect(loaded.stale).toBe(false);
  });

  it('throws on invalid live spec payload', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ openapi: '3.1.0' }), {
        status: 200,
      });

    await expect(loadOpenApiSpec({ apiUrl: 'https://api.desplega.ai' })).rejects.toThrow(
      'OpenAPI spec is invalid'
    );
  });

  it('throws when offline mode is requested without cache', async () => {
    await expect(
      loadOpenApiSpec({
        apiUrl: 'https://api.desplega.ai',
        refreshMode: 'offline',
      })
    ).rejects.toThrow('Offline mode requested');
  });

  it('throws missing spec error when fetch fails and cache is empty', async () => {
    globalThis.fetch = async () => new Response(null, { status: 503 });

    await expect(loadOpenApiSpec({ apiUrl: 'https://api.desplega.ai' })).rejects.toThrow(
      'Unable to load OpenAPI spec'
    );
  });
});
