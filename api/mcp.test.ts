import { describe, it, expect, beforeAll, mock } from 'bun:test';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from './mcp.js';

/**
 * Vercel API Function Integration Tests
 *
 * Tests that Bearer auth properly propagates API key to MCP tools
 * in the Vercel serverless function.
 * Requires QA_USE_API_KEY environment variable to be set.
 */
describe('Vercel MCP API Handler', () => {
  const apiKey = process.env.QA_USE_API_KEY;

  // Helper to create mock request
  function createMockRequest(options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }): VercelRequest {
    return {
      method: options.method || 'POST',
      url: options.url || '/mcp',
      headers: options.headers || {},
      body: options.body,
    } as unknown as VercelRequest;
  }

  // Helper to create mock response
  function createMockResponse(): VercelResponse & {
    _status: number;
    _json: unknown;
    _headers: Record<string, string>;
    _ended: boolean;
  } {
    const res = {
      _status: 200,
      _json: null,
      _headers: {} as Record<string, string>,
      _ended: false,
      headersSent: false,
      setHeader(name: string, value: string) {
        this._headers[name] = value;
        return this;
      },
      status(code: number) {
        this._status = code;
        return this;
      },
      json(data: unknown) {
        this._json = data;
        this.headersSent = true;
        return this;
      },
      end() {
        this._ended = true;
        return this;
      },
    };
    return res as unknown as VercelResponse & typeof res;
  }

  it('should return health check without auth', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: '/health',
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json).toHaveProperty('status', 'ok');
    expect(res._json).toHaveProperty('mode', 'vercel-serverless');
  });

  it('should reject requests without Bearer auth', async () => {
    const req = createMockRequest({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      },
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(401);
    expect(res._json).toHaveProperty('error', 'Unauthorized');
    expect((res._json as { message: string }).message).toContain('Bearer');
  });

  it('should reject requests with invalid Bearer token', async () => {
    const req = createMockRequest({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer invalid-api-key-12345',
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      },
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(401);
    expect(res._json).toHaveProperty('error', 'Unauthorized');
  });

  it('should handle CORS preflight', async () => {
    const req = createMockRequest({
      method: 'OPTIONS',
      url: '/mcp',
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res._headers['Access-Control-Allow-Headers']).toContain('Authorization');
  });

  it('should accept valid Bearer token and propagate API key to tools', async () => {
    if (!apiKey) {
      console.warn('Skipping test: QA_USE_API_KEY not set');
      return;
    }

    // This test verifies that the API key from Bearer token is available to tools
    // We test by calling initialize which should succeed if auth works
    const req = createMockRequest({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${apiKey}`,
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      },
    });

    // For SSE responses, we need a more complex mock
    let responseData = '';
    const res = {
      _status: 200,
      _headers: {} as Record<string, string>,
      headersSent: false,
      setHeader(name: string, value: string) {
        this._headers[name] = value;
        return this;
      },
      status(code: number) {
        this._status = code;
        return this;
      },
      json(data: unknown) {
        responseData = JSON.stringify(data);
        this.headersSent = true;
        return this;
      },
      write(chunk: string) {
        responseData += chunk;
        return true;
      },
      end(chunk?: string) {
        if (chunk) responseData += chunk;
        this.headersSent = true;
        return this;
      },
      on: () => {},
      once: () => {},
      emit: () => false,
      flushHeaders: () => {},
    } as unknown as VercelResponse;

    await handler(req, res);

    // Should not return 401 (auth should pass)
    expect(res._status).not.toBe(401);

    // Response should not contain "API key not configured" error
    expect(responseData).not.toContain('API key not configured');
  });

  it('should return 404 for unknown routes', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: '/unknown',
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(404);
    expect(res._json).toHaveProperty('error', 'Not Found');
  });
});
