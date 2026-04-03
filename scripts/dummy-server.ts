#!/usr/bin/env tsx

/**
 * Dummy backend stub for qa-use CLI testing.
 *
 * Captures all incoming requests (method, path, headers, body) and exposes
 * them via GET /__captured for assertions. Returns minimal valid responses
 * so CLI commands don't error out.
 *
 * Usage:
 *   bun run scripts/dummy-server.ts              # default port 19876
 *   PORT=3456 bun run scripts/dummy-server.ts     # custom port
 *
 * Endpoints:
 *   GET  /__captured       → JSON array of captured requests
 *   POST /__reset          → Clear captured requests
 *   GET  /__health         → { ok: true }
 *   *    /browsers/v1/*    → Minimal browser API stubs
 *   *    /vibe-qa/*        → Minimal main API stubs
 *   *    /api/v1/*         → Minimal REST API stubs
 */

import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';

const PORT = Number(process.env.PORT) || 19876;

interface CapturedRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

let captured: CapturedRequest[] = [];

function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

// Minimal stub responses for various API endpoints
const STUB_SESSION = {
  id: '00000000-0000-0000-0000-000000000001',
  status: 'active',
  created_at: new Date().toISOString(),
  app_url: 'http://localhost:19876',
};

const STUB_SNAPSHOT = {
  snapshot: '- document [ref=e1]\n  - heading "Hello World" [ref=e2]\n  - button "Click me" [ref=e3]',
  url: 'http://localhost:19876',
};

function route(method: string, path: string, _body: unknown): { status: number; data: unknown } {
  // Browser API stubs
  if (path === '/browsers/v1/sessions' && method === 'POST') {
    return { status: 200, data: STUB_SESSION };
  }
  if (path === '/browsers/v1/sessions' && method === 'GET') {
    return { status: 200, data: [STUB_SESSION] };
  }
  if (path.match(/^\/browsers\/v1\/sessions\/[^/]+$/) && method === 'GET') {
    return { status: 200, data: STUB_SESSION };
  }
  if (path.match(/^\/browsers\/v1\/sessions\/[^/]+$/) && method === 'DELETE') {
    return { status: 200, data: { ok: true } };
  }
  if (path.match(/^\/browsers\/v1\/sessions\/[^/]+\/snapshot/) && method === 'GET') {
    return { status: 200, data: STUB_SNAPSHOT };
  }
  if (path.match(/^\/browsers\/v1\/sessions\/[^/]+\/url/) && method === 'GET') {
    return { status: 200, data: { url: 'http://localhost:19876' } };
  }
  if (path.match(/^\/browsers\/v1\/sessions\/[^/]+\/action/) && method === 'POST') {
    return { status: 200, data: { success: true } };
  }
  if (path.match(/^\/browsers\/v1\/sessions\/[^/]+\/screenshot/) && method === 'GET') {
    return { status: 200, data: { url: 'http://localhost:19876/stub.png' } };
  }
  if (path.match(/^\/browsers\/v1\/sessions\/[^/]+\/logs\//) && method === 'GET') {
    return { status: 200, data: { entries: [], total: 0 } };
  }
  if (path.match(/^\/browsers\/v1\/sessions\/[^/]+\/blocks/) && method === 'GET') {
    return { status: 200, data: { blocks: [] } };
  }
  if (path.match(/^\/browsers\/v1\/sessions\/[^/]+\/downloads/) && method === 'GET') {
    return { status: 200, data: { downloads: [], total: 0 } };
  }

  // Main API stubs
  if (path === '/vibe-qa/check' && method === 'GET') {
    return { status: 200, data: { success: true, data: { app_config: null } } };
  }
  if (path.startsWith('/vibe-qa/tests') && method === 'GET') {
    return { status: 200, data: { tests: [], total: 0 } };
  }
  if (path.startsWith('/api/v1/test-runs') && method === 'GET') {
    return { status: 200, data: { test_runs: [], total: 0 } };
  }
  if (path === '/api/v1/openapi.json' && method === 'GET') {
    return {
      status: 200,
      data: { openapi: '3.0.0', info: { title: 'Stub', version: '1.0.0' }, paths: {} },
    };
  }

  // Fallback
  return { status: 200, data: { ok: true } };
}

const server = createServer(async (req, res) => {
  const method = req.method || 'GET';
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  // Internal endpoints (not captured)
  if (path === '/__captured') {
    return json(res, captured);
  }
  if (path === '/__reset' && method === 'POST') {
    captured = [];
    return json(res, { ok: true });
  }
  if (path === '/__health') {
    return json(res, { ok: true });
  }

  // Capture the request
  const bodyStr = await readBody(req);
  let body: unknown;
  try {
    body = bodyStr ? JSON.parse(bodyStr) : undefined;
  } catch {
    body = bodyStr || undefined;
  }

  captured.push({
    method,
    path,
    headers: { ...req.headers },
    body,
  });

  // Route to stub
  const result = route(method, path, body);
  json(res, result.data, result.status);
});

server.listen(PORT, () => {
  console.log(`Dummy server listening on http://localhost:${PORT}`);
  console.log('Endpoints: GET /__captured, POST /__reset, GET /__health');
});
