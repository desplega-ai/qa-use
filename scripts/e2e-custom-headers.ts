#!/usr/bin/env tsx

/**
 * E2E test for custom headers feature (QA_USE_HEADERS env var + config file headers).
 *
 * Spins up the dummy server, runs CLI commands with QA_USE_HEADERS set,
 * then checks /__captured to verify headers arrived on all requests.
 *
 * Usage:
 *   bun run scripts/e2e-custom-headers.ts
 */

import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const PORT = 19876;
const DUMMY_URL = `http://localhost:${PORT}`;
const PROJECT_ROOT = resolve(import.meta.dirname, '..');

const CUSTOM_HEADERS = {
  'X-Trace-Id': 'test-trace-123',
  'X-Source': 'qa-use-e2e',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let failed = false;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
  } else {
    console.error(`  FAIL: ${msg}`);
    failed = true;
  }
}

function cli(
  args: string[],
  extraEnv: Record<string, string> = {},
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('bun', ['run', 'cli', ...args], {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
    timeout: 30_000,
    env: {
      ...process.env,
      QA_USE_API_URL: DUMMY_URL,
      QA_USE_API_KEY: 'test-key-000',
      QA_USE_HEADERS: JSON.stringify(CUSTOM_HEADERS),
      ...extraEnv,
    },
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

async function fetchCaptured(): Promise<
  Array<{
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: unknown;
  }>
> {
  const res = await fetch(`${DUMMY_URL}/__captured`);
  return res.json();
}

async function resetCaptured(): Promise<void> {
  await fetch(`${DUMMY_URL}/__reset`, { method: 'POST' });
}

async function waitForServer(maxMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${DUMMY_URL}/__health`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Dummy server did not start in time');
}

function hasCustomHeaders(
  headers: Record<string, string>,
  expected: Record<string, string>,
): boolean {
  for (const [key, value] of Object.entries(expected)) {
    const lower = key.toLowerCase();
    if (headers[lower] !== value) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Starting dummy server...');
  const server: ChildProcess = spawn('bun', ['run', 'scripts/dummy-server.ts'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Collect server output for debugging
  let serverOutput = '';
  server.stdout?.on('data', (d: Buffer) => {
    serverOutput += d.toString();
  });
  server.stderr?.on('data', (d: Buffer) => {
    serverOutput += d.toString();
  });

  try {
    await waitForServer();
    console.log('Dummy server ready.\n');

    // -----------------------------------------------------------------------
    // Test 1: qa-use info shows custom headers
    // -----------------------------------------------------------------------
    console.log('== Test 1: info command shows custom headers ==');
    const infoResult = cli(['info']);
    assert(infoResult.exitCode === 0, 'info exits 0');
    assert(infoResult.stdout.includes('X-Trace-Id'), 'info shows X-Trace-Id header');
    assert(infoResult.stdout.includes('X-Source'), 'info shows X-Source header');
    assert(infoResult.stdout.includes('2 custom header(s)'), 'info shows header count');

    // -----------------------------------------------------------------------
    // Test 2: browser create sends custom headers
    // -----------------------------------------------------------------------
    console.log('\n== Test 2: browser create sends custom headers ==');
    await resetCaptured();
    const createResult = cli(['browser', 'create', 'http://example.com', '--timeout', '60']);
    assert(createResult.exitCode === 0, `browser create exits 0 (got ${createResult.exitCode})`);

    let reqs = await fetchCaptured();
    const createReq = reqs.find(
      (r) => r.path === '/browsers/v1/sessions' && r.method === 'POST',
    );
    assert(!!createReq, 'captured POST /browsers/v1/sessions');
    if (createReq) {
      assert(
        hasCustomHeaders(createReq.headers, CUSTOM_HEADERS),
        'browser create request has custom headers',
      );
      assert(
        createReq.headers.authorization === 'Bearer test-key-000',
        'Authorization header preserved',
      );
    }

    // -----------------------------------------------------------------------
    // Test 3: browser snapshot sends custom headers
    // -----------------------------------------------------------------------
    console.log('\n== Test 3: browser snapshot sends custom headers ==');
    await resetCaptured();
    const snapResult = cli([
      'browser',
      'snapshot',
      '-s',
      '00000000-0000-0000-0000-000000000001',
    ]);
    assert(snapResult.exitCode === 0, `browser snapshot exits 0 (got ${snapResult.exitCode})`);

    reqs = await fetchCaptured();
    const snapReq = reqs.find((r) => r.path.includes('/snapshot'));
    assert(!!snapReq, 'captured GET /snapshot');
    if (snapReq) {
      assert(
        hasCustomHeaders(snapReq.headers, CUSTOM_HEADERS),
        'snapshot request has custom headers',
      );
    }

    // -----------------------------------------------------------------------
    // Test 4: browser close sends custom headers
    // -----------------------------------------------------------------------
    console.log('\n== Test 4: browser close sends custom headers ==');
    await resetCaptured();
    cli(['browser', 'close', '-s', '00000000-0000-0000-0000-000000000001']);

    reqs = await fetchCaptured();
    const closeReq = reqs.find(
      (r) => r.path.includes('/sessions/') && r.method === 'DELETE',
    );
    assert(!!closeReq, 'captured DELETE session');
    if (closeReq) {
      assert(
        hasCustomHeaders(closeReq.headers, CUSTOM_HEADERS),
        'close request has custom headers',
      );
    }

    // -----------------------------------------------------------------------
    // Test 5: api ls sends custom headers (OpenAPI fetch)
    // -----------------------------------------------------------------------
    console.log('\n== Test 5: api ls sends custom headers ==');
    await resetCaptured();
    cli(['api', 'ls', '--refresh']);

    reqs = await fetchCaptured();
    const openApiReq = reqs.find((r) => r.path.includes('openapi.json'));
    assert(!!openApiReq, 'captured GET /openapi.json');
    if (openApiReq) {
      assert(
        hasCustomHeaders(openApiReq.headers, CUSTOM_HEADERS),
        'openapi fetch has custom headers',
      );
    }

    // -----------------------------------------------------------------------
    // Test 6: protected headers cannot be overridden
    // -----------------------------------------------------------------------
    console.log('\n== Test 6: protected headers cannot be overridden ==');
    await resetCaptured();
    const badHeaders = {
      ...CUSTOM_HEADERS,
      Authorization: 'Bearer EVIL',
      'Content-Type': 'text/plain',
    };
    const protResult = cli(
      ['browser', 'snapshot', '-s', '00000000-0000-0000-0000-000000000001'],
      { QA_USE_HEADERS: JSON.stringify(badHeaders) },
    );
    assert(protResult.exitCode === 0, 'command succeeds despite bad headers');

    reqs = await fetchCaptured();
    const protReq = reqs.find((r) => r.path.includes('/snapshot'));
    if (protReq) {
      assert(
        protReq.headers.authorization === 'Bearer test-key-000',
        'Authorization NOT overridden by QA_USE_HEADERS',
      );
      assert(
        protReq.headers['content-type'] === 'application/json',
        'Content-Type NOT overridden by QA_USE_HEADERS',
      );
      assert(
        hasCustomHeaders(protReq.headers, CUSTOM_HEADERS),
        'legitimate custom headers still present',
      );
    }

    // -----------------------------------------------------------------------
    // Test 7: invalid JSON in QA_USE_HEADERS warns but doesn't crash
    // -----------------------------------------------------------------------
    console.log('\n== Test 7: invalid JSON in QA_USE_HEADERS ==');
    const badJsonResult = cli(['info'], { QA_USE_HEADERS: '{not json' });
    assert(badJsonResult.exitCode === 0, 'info exits 0 with bad JSON');
    const combined = badJsonResult.stdout + badJsonResult.stderr;
    assert(combined.includes('not valid JSON'), 'warning about invalid JSON shown');

    // -----------------------------------------------------------------------
    // Test 8: no headers when QA_USE_HEADERS is not set
    // -----------------------------------------------------------------------
    console.log('\n== Test 8: no custom headers when env not set ==');
    await resetCaptured();
    const noHdrEnv: Record<string, string> = {};
    // Explicitly unset QA_USE_HEADERS
    for (const [k, v] of Object.entries(process.env)) {
      if (k !== 'QA_USE_HEADERS' && v !== undefined) noHdrEnv[k] = v;
    }
    noHdrEnv.QA_USE_API_URL = DUMMY_URL;
    noHdrEnv.QA_USE_API_KEY = 'test-key-000';
    const noHdrResult = spawnSync(
      'bun',
      ['run', 'cli', 'browser', 'snapshot', '-s', '00000000-0000-0000-0000-000000000001'],
      { cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 30_000, env: noHdrEnv },
    );
    assert(noHdrResult.status === 0, 'snapshot without QA_USE_HEADERS exits 0');

    reqs = await fetchCaptured();
    const noHdrReq = reqs.find((r) => r.path.includes('/snapshot'));
    if (noHdrReq) {
      assert(!noHdrReq.headers['x-trace-id'], 'no X-Trace-Id when env not set');
      assert(!noHdrReq.headers['x-source'], 'no X-Source when env not set');
    }

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------
    console.log('\n' + '='.repeat(50));
    if (failed) {
      console.error('SOME TESTS FAILED');
      process.exit(1);
    } else {
      console.log('ALL TESTS PASSED');
    }
  } finally {
    server.kill();
    // Give it a moment to clean up
    await new Promise((r) => setTimeout(r, 200));
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
