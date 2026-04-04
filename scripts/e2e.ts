#!/usr/bin/env tsx

/**
 * CLI regression test for qa-use browser commands and test runner.
 * Runs against https://evals.desplega.ai/
 *
 * Usage:
 *   bun run scripts/e2e.ts              # uses "bun run cli" as command
 *   bun run scripts/e2e.ts --cmd qa-use # uses "qa-use" as command
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const EVALS_URL = 'https://evals.desplega.ai/';

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

const cmdFlagIdx = process.argv.indexOf('--cmd');
const cmdPrefix =
	cmdFlagIdx !== -1 && process.argv[cmdFlagIdx + 1]
		? process.argv[cmdFlagIdx + 1]
		: 'bun run cli';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let failed = false;

function run(
	args: string[],
	timeout = 60_000,
): { stdout: string; stderr: string; exitCode: number } {
	const parts = cmdPrefix.split(/\s+/).concat(args);
	const cmd = parts[0];
	const spawnArgs = parts.slice(1);
	const result = spawnSync(cmd, spawnArgs, {
		cwd: resolve(import.meta.dirname, '..'),
		encoding: 'utf-8',
		timeout,
	});
	return {
		stdout: result.stdout ?? '',
		stderr: result.stderr ?? '',
		exitCode: result.status ?? 1,
	};
}

function stripAnsi(str: string): string {
	return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function extractRef(snapshot: string, pattern: RegExp): string {
	const clean = stripAnsi(snapshot);
	const match = clean.match(pattern);
	if (!match) throw new Error(`Could not find ref matching ${pattern} in snapshot`);
	return match[1];
}

function runOrThrow(args: string[], timeout = 60_000): string {
	const { stdout, stderr, exitCode } = run(args, timeout);
	if (exitCode !== 0) {
		throw new Error(
			`Command failed (exit ${exitCode}): ${cmdPrefix} ${args.join(' ')}\n${stdout}\n${stderr}`,
		);
	}
	return stdout;
}

function assert(condition: boolean, msg: string) {
	if (condition) {
		console.log(`  PASS: ${msg}`);
	} else {
		console.error(`  FAIL: ${msg}`);
		failed = true;
	}
}

function parseSessionId(output: string): string {
	const match = output.match(/Session ID:\s*([0-9a-f-]{36})/i) ?? output.match(/([0-9a-f-]{36})/);
	if (!match) throw new Error(`Could not parse session ID from output:\n${output}`);
	return match[1];
}

async function section(name: string, fn: () => Promise<void> | void) {
	console.log(`\n== ${name} ==`);
	try {
		await fn();
		console.log(`-- ${name}: OK --`);
	} catch (err) {
		console.error(`-- ${name}: FAILED --`);
		console.error(err);
		failed = true;
	}
}

// ---------------------------------------------------------------------------
// Pre-checks
// ---------------------------------------------------------------------------

let configPath = resolve(import.meta.dirname, '..', '.qa-use.json');
if (!existsSync(configPath)) {
	// Backward compat: try legacy filename
	configPath = resolve(import.meta.dirname, '..', '.qa-use-tests.json');
}
if (!existsSync(configPath)) {
	console.error('ERROR: .qa-use.json not found in project root. Cannot run e2e tests.');
	process.exit(1);
}

console.log(`qa-use CLI e2e regression test`);
console.log(`Command prefix: "${cmdPrefix}"`);
console.log(`Target: ${EVALS_URL}`);

// ---------------------------------------------------------------------------
// Section 1: Browser Commands
// ---------------------------------------------------------------------------

await section('Section 1: Browser Commands', () => {
	let sessionId = '';

	try {
		// 1. Create session
		const createOut = runOrThrow(['browser', 'create', EVALS_URL]);
		sessionId = parseSessionId(createOut);
		assert(!!sessionId, `Session created: ${sessionId}`);

		// 2. Snapshot — should contain home page content
		const snap1 = runOrThrow(['browser', 'snapshot']);
		assert(snap1.includes('Table Demo'), 'Home snapshot contains "Table Demo"');

		// 3. URL
		const urlOut = runOrThrow(['browser', 'url']);
		assert(urlOut.includes('evals.desplega.ai'), 'URL contains evals.desplega.ai');

		// 4. Screenshot
		runOrThrow(['browser', 'screenshot', '/tmp/qa-use-e2e.png']);
		assert(existsSync('/tmp/qa-use-e2e.png'), 'Screenshot file created');

		// 5. Click Buttons Demo
		runOrThrow(['browser', 'click', '--text', 'Buttons Demo']);

		// 6. Snapshot after click — should be on buttons page
		const snap2 = runOrThrow(['browser', 'snapshot']);
		assert(snap2.toLowerCase().includes('button'), 'Buttons page snapshot contains "button"');

		// 7. Back
		runOrThrow(['browser', 'back']);

		// 8. Snapshot after back — should be home again
		const snap3 = runOrThrow(['browser', 'snapshot']);
		assert(snap3.includes('Table Demo'), 'After back, snapshot contains "Table Demo"');

		// 9. Status
		runOrThrow(['browser', 'status']);
		assert(true, 'Status command succeeded');

		// 10. Close
		runOrThrow(['browser', 'close']);
		assert(true, 'Session closed');

		// 11. Logs (after close, using session ID)
		const { exitCode } = run(['browser', 'logs', 'console', '-s', sessionId]);
		assert(exitCode === 0, 'Logs command succeeded');
	} finally {
		if (sessionId) {
			// Best-effort cleanup
			run(['browser', 'close', '-s', sessionId]);
		}
	}
});

// ---------------------------------------------------------------------------
// Section 2: Table Filtering
// ---------------------------------------------------------------------------

await section('Section 2: Table Filtering', () => {
	let sessionId = '';

	try {
		// 1. Create session
		const createOut = runOrThrow(['browser', 'create', EVALS_URL]);
		sessionId = parseSessionId(createOut);

		// 2. Navigate to Table Demo
		runOrThrow(['browser', 'click', '--text', 'Table Demo']);

		// 3. Verify table page and find filter input ref
		const snap1 = runOrThrow(['browser', 'snapshot']);
		assert(snap1.includes('Filter by name'), 'Table page has filter input');
		const filterRef = extractRef(snap1, /textbox.*?ref=(\w+)/);

		// 4. Fill filter with "John" using ref from snapshot
		runOrThrow(['browser', 'fill', filterRef, 'John']);

		// 5. Verify filtered results
		const snap2 = runOrThrow(['browser', 'snapshot']);
		assert(snap2.includes('John Doe'), 'Filtered snapshot contains "John Doe"');
		assert(!snap2.includes('Alice Brown'), 'Filtered snapshot does NOT contain "Alice Brown"');

		// 6. Close
		runOrThrow(['browser', 'close']);
		assert(true, 'Session closed');
	} finally {
		if (sessionId) {
			run(['browser', 'close', '-s', sessionId]);
		}
	}
});

// ---------------------------------------------------------------------------
// Section 3: Test Runner (e2e.yaml)
// ---------------------------------------------------------------------------

await section('Section 3: Test Runner', () => {
	const out = runOrThrow(['test', 'run', 'e2e'], 120_000);
	assert(out.includes('passed'), 'Test run output contains "passed"');
});

// ---------------------------------------------------------------------------
// Section 4: API Subcommands
// ---------------------------------------------------------------------------

await section('Section 4: API Subcommands', () => {
	// 1. Bare `api` shows help (exit 0)
	const helpOut = runOrThrow(['api']);
	assert(helpOut.includes('Call desplega.ai API endpoints'), 'Bare api shows help text');

	// 2. `api ls` lists endpoints
	const lsOut = runOrThrow(['api', 'ls']);
	assert(lsOut.includes('METHOD') && lsOut.includes('PATH'), 'api ls shows endpoint table');

	// 3. `api info` shows route details
	const infoOut = runOrThrow(['api', 'info', '/api/v1/tests']);
	assert(infoOut.includes('GET /api/v1/tests'), 'api info shows route method and path');
	assert(infoOut.includes('Parameters:'), 'api info shows parameters section');
	assert(infoOut.includes('Responses:'), 'api info shows responses section');

	// 4. `api info --json` produces JSON
	const infoJson = runOrThrow(['api', 'info', '/api/v1/tests', '--json']);
	const parsed = JSON.parse(infoJson);
	assert(parsed.method === 'GET', 'api info --json has correct method');
	assert(parsed.path === '/api/v1/tests', 'api info --json has correct path');

	// 5. `api examples` shows examples
	const exOut = runOrThrow(['api', 'examples']);
	assert(exOut.includes('API Command Examples'), 'api examples shows title');

	// 6. `api openapi` shows URL
	const oaOut = runOrThrow(['api', 'openapi']);
	assert(oaOut.includes('/api/v1/openapi.json'), 'api openapi shows spec URL');

	// 7. `api openapi --raw` dumps JSON spec
	const oaRaw = runOrThrow(['api', 'openapi', '--raw']);
	const spec = JSON.parse(oaRaw);
	assert(spec.openapi && spec.paths, 'api openapi --raw returns valid OpenAPI JSON');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n' + (failed ? 'FAILED — some assertions did not pass' : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
