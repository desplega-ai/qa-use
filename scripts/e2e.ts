#!/usr/bin/env tsx

/**
 * CLI regression test for qa-use browser commands and test runner.
 * Runs against https://evals.desplega.ai/
 *
 * Usage:
 *   bun run scripts/e2e.ts              # uses "bun run cli" as command
 *   bun run scripts/e2e.ts --cmd qa-use # uses "qa-use" as command
 */

import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
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
	env?: Record<string, string>,
): { stdout: string; stderr: string; exitCode: number } {
	const parts = cmdPrefix.split(/\s+/).concat(args);
	const cmd = parts[0];
	const spawnArgs = parts.slice(1);
	const result = spawnSync(cmd, spawnArgs, {
		cwd: resolve(import.meta.dirname, '..'),
		encoding: 'utf-8',
		timeout,
		env: env ? { ...process.env, ...env } : process.env,
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

	// Loads /table directly. The home → click("Table Demo") path triggers a
	// React reconciliation crash under a qa-use tunneled session — see
	// DES-356. The page itself is healthy; only client-side <Link> navigation
	// from home crashes. Direct loads work fine and exercise the same filter
	// regression coverage Section 2 was originally written for.
	const TABLE_URL = `${EVALS_URL.replace(/\/?$/, '')}/table`;

	try {
		// 1. Create session directly on /table
		const createOut = runOrThrow(['browser', 'create', TABLE_URL]);
		sessionId = parseSessionId(createOut);

		// 2. Verify table page and find filter input ref
		const snap1 = runOrThrow(['browser', 'snapshot']);
		assert(snap1.includes('Filter by name'), 'Table page has filter input');
		const filterRef = extractRef(snap1, /textbox.*?ref=(\w+)/);

		// 3. Fill filter with "John" using ref from snapshot
		runOrThrow(['browser', 'fill', filterRef, 'John']);

		// 4. Verify filtered results
		const snap2 = runOrThrow(['browser', 'snapshot']);
		assert(snap2.includes('John Doe'), 'Filtered snapshot contains "John Doe"');
		assert(!snap2.includes('Alice Brown'), 'Filtered snapshot does NOT contain "Alice Brown"');

		// 5. Close
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
// Section 5: Suite CRUD
// ---------------------------------------------------------------------------

await section('Section 5: Suite CRUD', () => {
	let suiteId = '';

	try {
		// 1. Create a suite
		const createOut = runOrThrow([
			'suite',
			'create',
			'-F',
			'name=E2E Regression Suite',
		]);
		// Parse suite ID from create output (JSON or text)
		const createIdMatch =
			createOut.match(/"id"\s*:\s*"([0-9a-f-]{36})"/) ??
			createOut.match(/([0-9a-f-]{36})/);
		assert(!!createIdMatch, 'Suite create returned an ID');
		suiteId = createIdMatch ? createIdMatch[1] : '';

		// 2. List suites — should include the one we just created
		const listOut = runOrThrow(['suite', 'list', '--json']);
		const suites = JSON.parse(listOut);
		assert(Array.isArray(suites), 'Suite list returns an array');
		const found = suites.some(
			(s: { id?: string }) => s.id === suiteId,
		);
		assert(found, 'Created suite appears in list');

		// 3. Info on the suite
		const infoOut = runOrThrow(['suite', 'info', suiteId, '--json']);
		const suiteInfo = JSON.parse(infoOut);
		assert(suiteInfo.id === suiteId, 'Suite info returns correct ID');
		assert(
			suiteInfo.name === 'E2E Regression Suite',
			'Suite info returns correct name',
		);

		// 4. Update the suite
		runOrThrow([
			'suite',
			'update',
			suiteId,
			'-F',
			'name=E2E Regression Suite Updated',
		]);
		const infoOut2 = runOrThrow(['suite', 'info', suiteId, '--json']);
		const suiteInfo2 = JSON.parse(infoOut2);
		assert(
			suiteInfo2.name === 'E2E Regression Suite Updated',
			'Suite name updated successfully',
		);

		// 5. Delete the suite
		runOrThrow(['suite', 'delete', suiteId, '--force']);
		assert(true, 'Suite deleted successfully');
		suiteId = ''; // cleared so finally block doesn't double-delete
	} finally {
		// Best-effort cleanup
		if (suiteId) {
			run(['suite', 'delete', suiteId, '--force']);
		}
	}
});

// ---------------------------------------------------------------------------
// Section 6: Test Runs Subcommands
// ---------------------------------------------------------------------------

await section('Section 6: Test Runs Subcommands', () => {
	// 1. List runs (may be empty, but command should succeed with valid JSON)
	const listOut = runOrThrow(['test', 'runs', 'list', '--json', '--limit', '3']);
	const runs = JSON.parse(listOut);
	assert(Array.isArray(runs), 'Test runs list returns an array');

	// 2. If there are runs, exercise info and steps on the first one
	if (runs.length > 0) {
		const runId = runs[0].id;
		assert(typeof runId === 'string', 'Run has an id field');

		// Info
		const infoOut = runOrThrow(['test', 'runs', 'info', runId, '--json']);
		const runInfo = JSON.parse(infoOut);
		assert(runInfo.id === runId, 'Run info returns correct ID');
		assert(typeof runInfo.status === 'string', 'Run info has status field');

		// Steps
		const stepsOut = runOrThrow(['test', 'runs', 'steps', runId, '--json']);
		const steps = JSON.parse(stepsOut);
		assert(Array.isArray(steps), 'Run steps returns an array');
	} else {
		console.log('  SKIP: No test runs found, skipping info/steps assertions');
	}
});

// ---------------------------------------------------------------------------
// Section 7: Resource Commands Smoke Test
// ---------------------------------------------------------------------------

await section('Section 7: Resource Commands Smoke Test', () => {
	// Each resource command should return valid JSON with --json flag

	// Issues
	const issuesOut = runOrThrow(['issues', 'list', '--json', '--limit', '1']);
	const issues = JSON.parse(issuesOut);
	assert(Array.isArray(issues), 'issues list --json returns an array');

	// App Config
	const configOut = runOrThrow(['app-config', 'list', '--json', '--limit', '1']);
	const configs = JSON.parse(configOut);
	assert(Array.isArray(configs), 'app-config list --json returns an array');

	// App Context
	const contextOut = runOrThrow(['app-context', 'list', '--json', '--limit', '1']);
	const contexts = JSON.parse(contextOut);
	assert(Array.isArray(contexts), 'app-context list --json returns an array');

	// Persona
	const personaOut = runOrThrow(['persona', 'list', '--json', '--limit', '1']);
	const personas = JSON.parse(personaOut);
	assert(Array.isArray(personas), 'persona list --json returns an array');

	// Data Asset
	const assetOut = runOrThrow(['data-asset', 'list', '--json', '--limit', '1']);
	const assets = JSON.parse(assetOut);
	assert(Array.isArray(assets), 'data-asset list --json returns an array');

	// Usage
	const usageOut = runOrThrow(['usage', '--json']);
	const usage = JSON.parse(usageOut);
	assert(
		typeof usage === 'object' && usage !== null,
		'usage --json returns a valid object',
	);
});

// ---------------------------------------------------------------------------
// Section 8: Tunnel — auto-skip in dev mode
// ---------------------------------------------------------------------------
//
// `.qa-use.json` in this repo points api_url at localhost:5005, so auto-mode
// `browser create` against another localhost target MUST skip the tunnel. We
// assert:
//   - `tunnel ls --json` returns an empty array both before and after the
//     create attempt
//   - stderr does NOT contain the "Auto-tunnel active" banner
//
// We target an unroutable localhost port (`http://localhost:1`) so the create
// call exits fast without needing a real local dev server. The create call may
// itself fail once it tries to reach the backend or open a page — we only care
// about the tunnel decision, which is made before any network traffic.

await section('Section 8: Tunnel — auto-skip in dev mode', () => {
	// Baseline: ensure registry is clean
	const lsBefore = runOrThrow(['tunnel', 'ls', '--json']);
	const parsedBefore = JSON.parse(lsBefore);
	assert(Array.isArray(parsedBefore), 'tunnel ls --json returns an array (baseline)');

	// Attempt create against a localhost URL. `QA_USE_DETACH=0` forces the
	// legacy blocking path so that if the command does start up, we can
	// time-bound it via the spawn timeout rather than leaving an orphan
	// detached child. We also set an aggressive timeout.
	const { stderr } = run(
		['browser', 'create', 'http://localhost:1', '--timeout', '1'],
		15_000,
		{ QA_USE_DETACH: '0' },
	);
	assert(
		!/Auto-tunnel active/i.test(stderr),
		'No "Auto-tunnel active" banner when both base and api are localhost',
	);

	// Registry should still be empty (or at minimum, no entry matching our URL)
	const lsAfter = runOrThrow(['tunnel', 'ls', '--json']);
	const parsedAfter = JSON.parse(lsAfter);
	const hasOurTunnel =
		Array.isArray(parsedAfter) &&
		parsedAfter.some((t: { target?: string }) =>
			(t.target ?? '').includes('localhost:1'),
		);
	assert(!hasOurTunnel, 'No tunnel entry created for localhost target in dev mode');
});

// ---------------------------------------------------------------------------
// Section 9: Tunnel — prod-mode auto-banner (gated)
// ---------------------------------------------------------------------------
//
// Forcing an auto-tunnel requires a reachable remote backend. Skip unless
// `E2E_ALLOW_REMOTE_TUNNEL=1` is set, since CI and the default dev loop both
// point at localhost:5005 and can't actually open a tunnel.

await section('Section 9: Tunnel — prod-mode auto-banner (gated)', () => {
	if (process.env.E2E_ALLOW_REMOTE_TUNNEL !== '1') {
		console.log(
			'  SKIP: E2E_ALLOW_REMOTE_TUNNEL=1 not set (requires reachable remote backend)',
		);
		return;
	}

	const remoteApi = process.env.E2E_REMOTE_API_URL ?? 'https://api.desplega.ai';
	const { stderr } = run(
		['browser', 'create', 'http://localhost:1', '--timeout', '60'],
		30_000,
		{ QA_USE_API_URL: remoteApi, QA_USE_DETACH: '0' },
	);
	assert(
		/Auto-tunnel active|Auto-tunnel/i.test(stderr),
		'Auto-tunnel banner emitted on stderr when api_url is remote',
	);

	const lsOut = runOrThrow(['tunnel', 'ls', '--json']);
	const entries = JSON.parse(lsOut);
	assert(
		Array.isArray(entries) && entries.length >= 1,
		'tunnel ls shows at least one active entry after prod-mode auto-tunnel',
	);
});

// ---------------------------------------------------------------------------
// Section 10: Tunnel — registry reuse (refcount) (gated)
// ---------------------------------------------------------------------------
//
// Refcount reuse can only be demonstrated when a tunnel is actually acquired,
// which (per Section 9) needs a remote backend. Gate behind the same env flag.

await section('Section 10: Tunnel — registry reuse refcount (gated)', async () => {
	if (process.env.E2E_ALLOW_REMOTE_TUNNEL !== '1') {
		console.log('  SKIP: E2E_ALLOW_REMOTE_TUNNEL=1 not set');
		return;
	}

	const target = 'http://localhost:3000';
	const remoteApi = process.env.E2E_REMOTE_API_URL ?? 'https://api.desplega.ai';

	// Spawn `tunnel start --hold` in the background and wait for it to register.
	// We can't use `tunnel start` without `--hold` here because (pending a fix
	// tracked as a plan follow-up) it hangs for the full registry grace window
	// waiting for the underlying localtunnel TCP connection to close.
	const holder = spawn('bun', ['run', 'cli', 'tunnel', 'start', target, '--hold'], {
		cwd: resolve(import.meta.dirname, '..'),
		env: { ...process.env, QA_USE_API_URL: remoteApi },
		detached: true,
		stdio: 'ignore',
	});
	holder.unref();

	try {
		// Poll `tunnel ls --json` for up to ~15s until the entry shows up.
		let match: { target?: string; refcount?: number } | undefined;
		const deadline = Date.now() + 15_000;
		while (Date.now() < deadline) {
			try {
				const lsOut = runOrThrow(['tunnel', 'ls', '--json']);
				const entries = JSON.parse(lsOut);
				match = entries.find(
					(e: { target?: string }) => (e.target ?? '').startsWith(target),
				);
				if (match) break;
			} catch {
				// keep polling
			}
			await new Promise((r) => setTimeout(r, 500));
		}
		assert(!!match, 'Tunnel entry exists for target');
		assert(
			typeof match?.refcount === 'number' && match.refcount >= 1,
			'Entry has refcount >= 1',
		);
	} finally {
		// Cleanup: force-close the tunnel; the detached holder child will exit on
		// its own once the registry handle is gone, but SIGTERM its pid as
		// insurance.
		run(['tunnel', 'close', target], 10_000);
		if (holder.pid) {
			try {
				process.kill(holder.pid, 'SIGTERM');
			} catch {
				// already gone
			}
		}
	}
});

// ---------------------------------------------------------------------------
// Section 11: Detach latency
// ---------------------------------------------------------------------------
//
// `browser create` should return to the shell in < 3 s when detach is on. We
// don't need a real browser — pointing at an unreachable API url makes the
// bootstrap fail fast, and we only care about the parent-side return time.
// A successful detach against a reachable backend is exercised in the manual
// E2E list.

await section('Section 11: Detach latency', () => {
	const start = Date.now();
	// Unreachable API via env override so createSession fails fast in the
	// detached child; parent should still return quickly because it doesn't
	// block on child readiness for the full 5s poll if the child exits early.
	run(
		['browser', 'create', 'http://localhost:1', '--tunnel', 'off', '--timeout', '1'],
		10_000,
		{ QA_USE_API_URL: 'http://127.0.0.1:1' },
	);
	const elapsed = Date.now() - start;
	assert(
		elapsed < 10_000,
		`browser create returned in ${elapsed}ms (< 10s upper bound; target < 3s with reachable backend)`,
	);
});

// ---------------------------------------------------------------------------
// Section 12: Triage-hint error on tunnel failure (gated)
// ---------------------------------------------------------------------------
//
// Forcing a real tunnel failure requires hitting a remote backend that will
// reject the tunnel request. Gate behind the same remote flag.

await section('Section 12: Triage-hint error on tunnel failure (gated)', () => {
	if (process.env.E2E_ALLOW_REMOTE_TUNNEL !== '1') {
		console.log('  SKIP: E2E_ALLOW_REMOTE_TUNNEL=1 not set');
		return;
	}

	// Use an invalid API key to force an auth failure from the tunnel provider.
	const { stderr, exitCode } = run(
		['browser', 'create', 'http://localhost:3000', '--tunnel', 'on', '--timeout', '60'],
		20_000,
		{
			QA_USE_API_KEY: 'sk_qfm_invalid_for_e2e_triage_hint_test',
			QA_USE_API_URL:
				process.env.E2E_REMOTE_API_URL ?? 'https://api.desplega.ai',
			QA_USE_DETACH: '0',
		},
	);
	assert(exitCode !== 0, 'Forced-failure command exits non-zero');
	assert(
		/Next steps:/i.test(stderr),
		'Triage-hint error output contains "Next steps:"',
	);
	assert(
		/--no-tunnel|--tunnel off/i.test(stderr),
		'Triage-hint error mentions the opt-out flag',
	);
});

// ---------------------------------------------------------------------------
// Section 13: Doctor reap of stale sessions
// ---------------------------------------------------------------------------
//
// Seed a fake stale PID file under ~/.qa-use/sessions/<id>.json with a bogus
// pid, then run `doctor` and assert it reaps at least one entry. This exercises
// the cleanup path without needing a real detached child.

await section('Section 13: Doctor reap of stale sessions', () => {
	const sessionsDir = resolve(homedir(), '.qa-use', 'sessions');
	const fakeSessionId = `e2e-stale-${Date.now()}`;
	const fakeSessionPath = resolve(sessionsDir, `${fakeSessionId}.json`);

	// Best-effort: ensure dir exists by running any command that would create it.
	// If it doesn't exist we skip, since we can't safely mkdir without pulling
	// node:fs/promises. We use sync readdir + existsSync guard.
	try {
		// Trigger directory creation via `tunnel ls` (no-op if already exists)
		run(['tunnel', 'ls']);
	} catch {
		// Ignore
	}

	if (!existsSync(sessionsDir)) {
		console.log(
			`  SKIP: ${sessionsDir} does not exist and could not be seeded`,
		);
		return;
	}

	// Write a stale entry with a bogus PID (2^31 - 1 is unlikely to exist).
	// Schema must match `DetachedSessionRecord` in `lib/env/sessions.ts`:
	// `id` (string), `pid` (number), `ttlExpiresAt` (epoch ms number).
	const stalePid = 2147483646;
	const stalePayload = {
		id: fakeSessionId,
		pid: stalePid,
		target: 'http://localhost:3000',
		publicUrl: null,
		startedAt: new Date().toISOString(),
		ttlExpiresAt: Date.now() + 300_000,
	};
	try {
		writeFileSync(fakeSessionPath, JSON.stringify(stalePayload, null, 2));
	} catch (err) {
		console.log(`  SKIP: could not seed stale session file: ${err}`);
		return;
	}

	// Sanity: file exists
	assert(existsSync(fakeSessionPath), 'Seeded stale session file');

	// Run doctor (non-dry-run)
	const { stdout, stderr, exitCode } = run(['doctor']);
	const output = `${stdout}\n${stderr}`;

	// Doctor exits non-zero when it reaped, exits 0 when nothing to do.
	// Either way, we assert our seeded file is gone.
	const stillExists = existsSync(fakeSessionPath);
	assert(!stillExists, 'Doctor reaped the stale session file');
	assert(
		exitCode !== 0 || /Nothing to do/i.test(output),
		`Doctor exited sensibly (${exitCode}) given a seeded stale entry`,
	);

	// Best-effort cleanup in case the assertion above failed
	if (stillExists) {
		try {
			unlinkSync(fakeSessionPath);
		} catch {
			// Ignore
		}
	}
});

// ---------------------------------------------------------------------------
// Section 14: SSE-exit-time — `test run` exits within 5s of [complete]
// ---------------------------------------------------------------------------
//
// Regression coverage for DES-275: the CLI used to hang ~80s after the SSE
// `complete` event because `runCliTest` waited for the backend to close the
// stream. Phases 1-3 wired `AbortSignal` through `streamSSE` + `runCliTest`
// and made the loop break+abort on the terminal event. This section spawns
// `test run --verbose`, timestamps each stdout line, finds the `[complete]`
// line emitted by `printSSEProgress`, and asserts the child exits within 5s
// without an external kill.
//
// Skips cleanly if the backend is unreachable (test run will exit non-zero
// quickly without ever printing `[complete]`).

await section('Section 14: SSE-exit-time', async () => {
	const parts = cmdPrefix.split(/\s+/).concat(['test', 'run', 'e2e', '--verbose']);
	const cmd = parts[0];
	const spawnArgs = parts.slice(1);

	const child = spawn(cmd, spawnArgs, {
		cwd: resolve(import.meta.dirname, '..'),
		env: process.env,
		stdio: ['ignore', 'pipe', 'pipe'],
	});

	let completeTs: number | null = null;
	let exitTs: number | null = null;
	let killedExternally = false;
	let stdoutBuf = '';
	let stderrBuf = '';

	child.stdout.setEncoding('utf-8');
	child.stderr.setEncoding('utf-8');

	child.stdout.on('data', (chunk: string) => {
		stdoutBuf += chunk;
		// Process complete lines only; partial trailing line stays in buffer.
		let nl = stdoutBuf.indexOf('\n');
		while (nl !== -1) {
			const line = stripAnsi(stdoutBuf.slice(0, nl));
			stdoutBuf = stdoutBuf.slice(nl + 1);
			if (completeTs === null && /^\[complete\]/.test(line.trim())) {
				completeTs = Date.now();
			}
			nl = stdoutBuf.indexOf('\n');
		}
	});

	child.stderr.on('data', (chunk: string) => {
		stderrBuf += chunk;
	});

	// Hard safety net: if the child hangs longer than 120s, kill it and fail
	// the section. The pre-fix bug hung ~80s, so 120s is enough headroom to
	// catch a regression while not letting the script wedge forever.
	const hardKillTimer = setTimeout(() => {
		killedExternally = true;
		try {
			child.kill('SIGTERM');
		} catch {
			// already gone
		}
	}, 120_000);

	const exitCode: number | null = await new Promise((resolveExit) => {
		child.on('exit', (code) => {
			exitTs = Date.now();
			clearTimeout(hardKillTimer);
			resolveExit(code);
		});
	});

	// If the child exited non-zero AND we never saw [complete], the backend is
	// likely unreachable. Skip cleanly per the existing convention.
	if (completeTs === null) {
		const reason =
			exitCode === 0
				? 'no [complete] line observed (test passed without verbose marker?)'
				: `child exited ${exitCode} before [complete] (backend likely unreachable)`;
		console.log(`  SKIP: ${reason}`);
		if (stderrBuf) {
			console.log(`  (stderr tail: ${stderrBuf.split('\n').slice(-3).join(' | ')})`);
		}
		return;
	}

	assert(!killedExternally, 'Child exited on its own (no SIGTERM needed)');

	if (exitTs !== null && completeTs !== null) {
		const delta = exitTs - completeTs;
		assert(
			delta < 5_000,
			`Exited ${delta}ms after [complete] (must be < 5000ms — pre-fix hung ~80s)`,
		);
	}
});

// ---------------------------------------------------------------------------
// Section 15: Test Sync / Validate / Schema / Create
// ---------------------------------------------------------------------------
//
// Covers the agentic-use feedback bundle:
//   - schema --summary emits a flat field list (no $defs/$ref, much smaller)
//   - test create exists and accepts a single file
//   - sync push --dry-run actually hits the API (not local-only enumeration)
//   - validation errors render as "path: message" (never "undefined: undefined")

await section('Section 15: Test Sync / Validate / Schema / Create', async () => {
	// 1. schema --summary: flat list, no $defs/$ref, smaller than full
	const summary = stripAnsi(runOrThrow(['test', 'schema', '--summary']));
	const fullSchema = stripAnsi(runOrThrow(['test', 'schema']));
	assert(/^name:\s/m.test(summary), 'schema --summary lists "name" field');
	assert(/^steps:\s/m.test(summary), 'schema --summary lists "steps" field');
	assert(!summary.includes('$defs'), 'schema --summary has no $defs');
	assert(!summary.includes('$ref'), 'schema --summary has no $ref');
	assert(!summary.includes('{'), 'schema --summary contains no JSON braces');
	assert(
		summary.length < fullSchema.length / 5,
		`schema --summary is ≥5× smaller than full (summary=${summary.length}B, full=${fullSchema.length}B)`,
	);

	// 2. test create is registered with expected shape
	const testHelp = stripAnsi(runOrThrow(['test', '--help']));
	assert(/\bcreate\b/.test(testHelp), 'test --help lists `create` subcommand');

	const createHelp = stripAnsi(runOrThrow(['test', 'create', '--help']));
	assert(createHelp.includes('<file>'), 'test create --help shows <file> argument');
	assert(createHelp.includes('--dry-run'), 'test create --help has --dry-run');
	assert(createHelp.includes('--force'), 'test create --help has --force');

	// 3. sync push --dry-run goes through the API (no longer local-only enumeration).
	//    Either succeeds with "Would <action>:" lines, or fails with formatted errors.
	//    Critical assertion: never "undefined: undefined".
	const dryPushRes = run(['test', 'sync', 'push', '--all', '--dry-run']);
	const dryPushOut = stripAnsi(`${dryPushRes.stdout}\n${dryPushRes.stderr}`);
	assert(
		!dryPushOut.includes('undefined: undefined'),
		'sync push --dry-run output never contains "undefined: undefined"',
	);
	if (dryPushRes.exitCode === 0) {
		assert(
			/Would (create|update|leave unchanged|conflict on|skip):/.test(dryPushOut),
			'sync push --dry-run rendered "Would <verb>: ..." (API path was used)',
		);
	} else {
		// API rejected the local fixture — fine; just verify we surfaced a real error
		assert(
			/failed/i.test(dryPushOut),
			'sync push --dry-run failure surfaces "failed" with formatted errors',
		);
	}

	// 4. test create on a definitively-broken YAML: API rejects, error is formatted (not undefined)
	const brokenPath = '/tmp/qa-use-e2e-broken.yaml';
	// Missing required `name` and `steps` → /cli/import will reject with ValidationError objects
	writeFileSync(brokenPath, 'description: e2e broken fixture\n');
	try {
		const createRes = run(['test', 'create', brokenPath, '--dry-run']);
		const createOut = stripAnsi(`${createRes.stdout}\n${createRes.stderr}`);
		assert(createRes.exitCode !== 0, 'test create on broken YAML exits non-zero');
		assert(
			!createOut.includes('undefined: undefined'),
			'broken YAML error never shows "undefined: undefined" (Item 1 fix)',
		);
		assert(/failed/i.test(createOut), 'broken YAML output contains "failed"');
	} finally {
		if (existsSync(brokenPath)) unlinkSync(brokenPath);
	}

	// 5. test validate on the same broken YAML: same formatted-error guarantee
	const brokenValidatePath = '/tmp/qa-use-e2e-broken-validate.yaml';
	writeFileSync(brokenValidatePath, 'description: e2e broken validate fixture\n');
	try {
		const validateRes = run(['test', 'validate', brokenValidatePath]);
		const validateOut = stripAnsi(`${validateRes.stdout}\n${validateRes.stderr}`);
		assert(validateRes.exitCode !== 0, 'test validate on broken YAML exits non-zero');
		assert(
			!validateOut.includes('undefined: undefined'),
			'validate output never shows "undefined: undefined"',
		);
	} finally {
		if (existsSync(brokenValidatePath)) unlinkSync(brokenValidatePath);
	}
});

// ---------------------------------------------------------------------------
// Section 16: Test Vars (imperative CLI)
// ---------------------------------------------------------------------------
//
// Covers the DES-163 `qa-use test vars list | set | unset` surface:
//   - local-file CRUD (simple → full form upgrade, sensitive-preserve, unset
//     of last key removes the variables: block, comment preservation)
//   - --json shape: sensitive entries omit the value key entirely
//   - mutual-exclusion between <file> and --id
//   - validation: bogus --type, --sensitive without --value on a new key,
//     partial UUID via --id

await section('Section 16: Test Vars (imperative CLI)', () => {
	const fixture = '/tmp/qa-use-e2e-vars.yaml';
	writeFileSync(
		fixture,
		[
			'name: e2e-vars',
			'steps: []',
			'variables:',
			'  # comment that must survive',
			'  foo: bar',
			'  pwd:',
			'    value: hunter2',
			'    type: password',
			'    is_sensitive: true',
			'',
		].join('\n'),
	);
	try {
		// 1. list — table contains expected keys, sensitive masked
		const listOut = stripAnsi(runOrThrow(['test', 'vars', 'list', fixture]));
		assert(/\bfoo\b/.test(listOut), 'list shows the foo key');
		assert(/\bpwd\b/.test(listOut), 'list shows the pwd key');
		assert(listOut.includes('****'), 'list masks the sensitive pwd value');
		assert(!listOut.includes('hunter2'), 'list never leaks the sensitive value');

		// 2. list --json — sensitive entries omit `value`
		const jsonOut = runOrThrow(['test', 'vars', 'list', fixture, '--json']);
		const parsed = JSON.parse(jsonOut) as Array<Record<string, unknown>>;
		const pwd = parsed.find((r) => r.key === 'pwd');
		const foo = parsed.find((r) => r.key === 'foo');
		assert(pwd !== undefined && pwd.is_sensitive === true, 'json: pwd is_sensitive=true');
		assert(pwd !== undefined && !('value' in pwd), 'json: sensitive entry omits value');
		assert(foo !== undefined && foo.value === 'bar', 'json: non-sensitive entry carries value');

		// 3. set simple form
		runOrThrow(['test', 'vars', 'set', fixture, '--key', 'simple', '--value', 'ok']);
		assert(
			readFileSync(fixture, 'utf-8').match(/^\s+simple: ok$/m) !== null,
			'set simple form writes `simple: ok`',
		);

		// 4. set full form via --type, comments survive
		runOrThrow([
			'test',
			'vars',
			'set',
			fixture,
			'--key',
			'site',
			'--value',
			'https://x',
			'--type',
			'url',
		]);
		const afterFull = readFileSync(fixture, 'utf-8');
		assert(/site:\s*\n\s+value: https:\/\/x/.test(afterFull), 'set full form writes site.value');
		assert(/type: url/.test(afterFull), 'set full form writes site.type');
		assert(afterFull.includes('# comment that must survive'), 'comments survive set');

		// 5. sensitive-preserve: re-bumping pwd with --sensitive (no --value) keeps the stored value
		runOrThrow(['test', 'vars', 'set', fixture, '--key', 'pwd', '--sensitive']);
		assert(
			readFileSync(fixture, 'utf-8').includes('value: hunter2'),
			'sensitive-preserve keeps stored value',
		);

		// 6. validation: bogus --type
		const badType = run([
			'test',
			'vars',
			'set',
			fixture,
			'--key',
			'x',
			'--type',
			'bogus',
			'--value',
			'y',
		]);
		assert(badType.exitCode !== 0, 'set --type bogus exits non-zero');
		assert(
			stripAnsi(`${badType.stdout}${badType.stderr}`).includes('--type'),
			'bogus --type names the offending flag',
		);

		// 7. mutual exclusion: file + --id
		const both = run([
			'test',
			'vars',
			'set',
			fixture,
			'--id',
			'12345678-1234-1234-1234-123456789abc',
			'--key',
			'x',
			'--value',
			'y',
		]);
		assert(both.exitCode !== 0, 'file + --id exits non-zero');
		assert(
			/both/i.test(stripAnsi(`${both.stdout}${both.stderr}`)),
			'mutual-exclusion error mentions "both"',
		);

		// 8. neither file nor --id
		const neither = run(['test', 'vars', 'set', '--key', 'x', '--value', 'y']);
		assert(neither.exitCode !== 0, 'neither file nor --id exits non-zero');

		// 9. partial UUID rejected
		const partial = run([
			'test',
			'vars',
			'set',
			'--id',
			'deadbeef',
			'--key',
			'x',
			'--value',
			'y',
		]);
		assert(partial.exitCode !== 0, 'partial UUID exits non-zero');
		assert(
			/UUID/i.test(stripAnsi(`${partial.stdout}${partial.stderr}`)),
			'partial UUID error mentions UUID',
		);

		// 10. --sensitive without --value on a NEW key fails
		const sensNew = run([
			'test',
			'vars',
			'set',
			fixture,
			'--key',
			'brand-new',
			'--sensitive',
		]);
		assert(sensNew.exitCode !== 0, 'sensitive-without-value on new key exits non-zero');

		// 11. unset removes the key; absent key is a no-op
		runOrThrow(['test', 'vars', 'unset', fixture, '--key', 'simple']);
		assert(
			!/^\s+simple:/m.test(readFileSync(fixture, 'utf-8')),
			'unset removes the key',
		);
		const absent = run(['test', 'vars', 'unset', fixture, '--key', 'gone']);
		assert(absent.exitCode === 0, 'unset on absent key exits 0');
	} finally {
		if (existsSync(fixture)) unlinkSync(fixture);
	}
});

// ---------------------------------------------------------------------------
// Section 17: Test sync name-collision regression
// ---------------------------------------------------------------------------
//
// Regression coverage for the duplicate-name pull/push fix:
//   - `pull` writes one file per cloud row, suffixed with `-${shortId8}.yaml`,
//     even when two cloud tests share the same `name`.
//   - A legacy un-suffixed `${safeName}.yaml` left in place from older qa-use
//     versions surfaces a one-line `Legacy file:` warning on next pull.
//   - `push --id <colliding-name>` exits 1 with an `Ambiguous: ...` banner that
//     names both local files and the `Use --id <uuid>` opt-out.
//   - `push --id <uuid>` resolves to exactly one test (BC for unique-name --id).
//
// **Cleanup.** The public API does not expose `DELETE /api/v1/tests/{id}` — see
// `qa-use api ls` (only POST/GET on /tests endpoints). Cleanup attempts the
// DELETE for forward-compat and logs a warning on 405; the cloud rows are
// named with a unique `e2e-dup-${nonce}` prefix so they're easy to reap
// manually if they accumulate. The temp directory is always removed.

await section('Section 17: Test sync name-collision regression', () => {
	// Quick reachability probe — if we can't list tests, skip the whole section.
	const probe = run(['api', '-X', 'GET', '/api/v1/tests', '-f', 'limit=1'], 15_000);
	if (probe.exitCode !== 0) {
		console.log(
			`  SKIP: backend unreachable for /api/v1/tests probe (exit=${probe.exitCode}); cannot exercise pull/push round-trip`,
		);
		return;
	}

	// Section-local helper: spawn the CLI with a custom cwd so commands resolve
	// `.qa-use.json` and `test_directory` against our temp scratch dir, not the
	// repo root.
	//
	// `cmdPrefix` defaults to `bun run cli`, which resolves the `cli` script
	// against package.json in the spawn cwd. Since the temp dir has no
	// package.json, we translate `bun run cli` → `bun <repoRoot>/src/cli/index.ts`
	// for this section so the CLI entry resolves regardless of cwd. For
	// `--cmd qa-use` (or any arbitrary binary on PATH), we use cmdPrefix as-is.
	const repoRoot = resolve(import.meta.dirname, '..');
	function runIn(
		cwd: string,
		args: string[],
		timeout = 60_000,
	): { stdout: string; stderr: string; exitCode: number } {
		let parts: string[];
		if (cmdPrefix.trim() === 'bun run cli') {
			parts = ['bun', resolve(repoRoot, 'src/cli/index.ts'), ...args];
		} else {
			parts = cmdPrefix.split(/\s+/).concat(args);
		}
		const cmd = parts[0];
		const spawnArgs = parts.slice(1);
		const r = spawnSync(cmd, spawnArgs, {
			cwd,
			encoding: 'utf-8',
			timeout,
			env: process.env,
		});
		return {
			stdout: r.stdout ?? '',
			stderr: r.stderr ?? '',
			exitCode: r.status ?? 1,
		};
	}

	// Resolve api_key + api_url from the repo's `.qa-use.json` so the temp dir
	// inherits credentials without us re-implementing the lookup chain.
	let repoApiKey: string | undefined;
	let repoApiUrl: string | undefined;
	try {
		const repoCfg = JSON.parse(readFileSync(configPath, 'utf-8')) as {
			api_key?: string;
			api_url?: string;
		};
		repoApiKey = repoCfg.api_key;
		repoApiUrl = repoCfg.api_url;
	} catch (err) {
		console.log(`  SKIP: could not parse repo .qa-use.json: ${err}`);
		return;
	}
	if (!repoApiKey) {
		console.log('  SKIP: repo .qa-use.json has no api_key');
		return;
	}

	// Use a unique nonce so the cloud rows we create are recognizable if cleanup
	// fails (no DELETE endpoint — best-effort only).
	const nonce = `${Date.now().toString(36)}-${randomUUID().slice(0, 4)}`;
	const collidingName = `e2e dup ${nonce}`;
	const uuidA = randomUUID();
	const uuidB = randomUUID();
	const shortA = uuidA.replace(/-/g, '').slice(0, 8);
	const shortB = uuidB.replace(/-/g, '').slice(0, 8);

	const tmpRoot = mkdtempSync(resolve(tmpdir(), 'qa-use-e2e-collision-'));
	const tmpQaTests = resolve(tmpRoot, 'qa-tests');
	mkdirSync(tmpQaTests, { recursive: true });

	// Plant a per-tmp `.qa-use.json` so the CLI uses our temp test_directory.
	const tmpConfig = {
		test_directory: './qa-tests',
		api_key: repoApiKey,
		api_url: repoApiUrl,
		defaults: { headless: true, persist: false, timeout: 60 },
	};
	writeFileSync(
		resolve(tmpRoot, '.qa-use.json'),
		JSON.stringify(tmpConfig, null, 2),
		'utf-8',
	);

	// Two YAML test files with the same `name` and pre-assigned, distinct UUIDs.
	// Pre-assigning the UUIDs lets us deterministically assert the `-${shortId8}`
	// filename suffix on pull without round-tripping through stdout.
	const fileA = resolve(tmpQaTests, 'a.yaml');
	const fileB = resolve(tmpQaTests, 'b.yaml');
	writeFileSync(
		fileA,
		[
			`id: ${uuidA}`,
			`name: ${collidingName}`,
			'steps:',
			'  - action: goto',
			'    url: https://example.com',
			'',
		].join('\n'),
	);
	writeFileSync(
		fileB,
		[
			`id: ${uuidB}`,
			`name: ${collidingName}`,
			'steps:',
			'  - action: goto',
			'    url: https://example.com',
			'',
		].join('\n'),
	);

	let pushedA = false;
	let pushedB = false;

	try {
		// 1. SETUP — push both YAMLs (real, not dry-run) to create two cloud rows
		// with the same name and pre-assigned UUIDs.
		const setupPush = runIn(tmpRoot, ['test', 'sync', 'push', '--all'], 60_000);
		if (setupPush.exitCode !== 0) {
			console.log(
				`  SKIP: setup push failed (exit=${setupPush.exitCode}); cannot exercise round-trip`,
			);
			console.log(`    stdout: ${stripAnsi(setupPush.stdout).split('\n').slice(-5).join(' | ')}`);
			console.log(`    stderr: ${stripAnsi(setupPush.stderr).split('\n').slice(-3).join(' | ')}`);
			return;
		}
		const setupOut = stripAnsi(setupPush.stdout);
		// Sanity: both UUIDs appear in push output (action lines reference them).
		pushedA = setupOut.includes(uuidA);
		pushedB = setupOut.includes(uuidB);
		assert(pushedA && pushedB, 'Setup push created both rows with pre-assigned UUIDs');

		// 2. PULL-COLLISION — clear local files, then pull. Expect two suffixed
		// files containing the right ids.
		unlinkSync(fileA);
		unlinkSync(fileB);
		const pullRes = runIn(tmpRoot, ['test', 'sync', 'pull'], 60_000);
		assert(pullRes.exitCode === 0, 'pull (no --id) exits 0 against a populated cloud');

		// Filter to only files matching our nonce-named tests so we don't
		// trip on unrelated org tests pulled at the same time.
		const yamlFiles = readdirSync(tmpQaTests).filter((f) => f.endsWith('.yaml'));
		const expectedA = `${toSafeFilenameLocal(collidingName)}-${shortA}.yaml`;
		const expectedB = `${toSafeFilenameLocal(collidingName)}-${shortB}.yaml`;
		const hasA = yamlFiles.includes(expectedA);
		const hasB = yamlFiles.includes(expectedB);
		assert(hasA, `pull wrote suffixed file for uuid A: ${expectedA}`);
		assert(hasB, `pull wrote suffixed file for uuid B: ${expectedB}`);

		if (hasA) {
			const aContent = readFileSync(resolve(tmpQaTests, expectedA), 'utf-8');
			assert(aContent.includes(uuidA), `Pulled file A contains its UUID (${uuidA})`);
		}
		if (hasB) {
			const bContent = readFileSync(resolve(tmpQaTests, expectedB), 'utf-8');
			assert(bContent.includes(uuidB), `Pulled file B contains its UUID (${uuidB})`);
		}

		// 3. LEGACY-ORPHAN WARNING — plant the un-suffixed legacy file and pull
		// again; expect the `Legacy file:` warning per `warnLegacyOrphan` in
		// sync.ts.
		const legacyName = `${toSafeFilenameLocal(collidingName)}.yaml`;
		const legacyPath = resolve(tmpQaTests, legacyName);
		// Plant a legacy file with one of the UUIDs so the warning's "ownership"
		// branch ("same id — safe to remove") fires for one of the two pulled rows.
		writeFileSync(
			legacyPath,
			[
				`id: ${uuidA}`,
				`name: ${collidingName}`,
				'steps:',
				"  - type: go_to",
				'    url: https://example.com',
				'',
			].join('\n'),
		);
		const pullAgain = runIn(tmpRoot, ['test', 'sync', 'pull', '--force'], 60_000);
		assert(pullAgain.exitCode === 0, 'pull --force re-run exits 0 with legacy file present');
		const pullAgainOut = stripAnsi(`${pullAgain.stdout}\n${pullAgain.stderr}`);
		assert(
			pullAgainOut.includes(`Legacy file: ${legacyName}`),
			`pull surfaces "Legacy file: ${legacyName}" warning`,
		);
		// And the file itself is preserved — qa-use never auto-deletes legacy files.
		assert(existsSync(legacyPath), 'Legacy un-suffixed file is preserved (not auto-deleted)');

		// 4. PUSH-AMBIGUITY — `push --id "<colliding-name>"` against a directory
		// containing both YAMLs must exit 1 with the disambiguation banner.
		// First, remove the legacy file so it doesn't trip the load (its id
		// matches uuidA, which would still get filtered, but cleaner without it).
		unlinkSync(legacyPath);
		const ambig = runIn(
			tmpRoot,
			['test', 'sync', 'push', '--id', collidingName, '--dry-run'],
			60_000,
		);
		assert(ambig.exitCode === 1, 'push --id <colliding-name> exits 1');
		const ambigOut = stripAnsi(`${ambig.stdout}\n${ambig.stderr}`);
		assert(/Ambiguous/.test(ambigOut), 'push --id <colliding-name> output contains "Ambiguous"');
		assert(
			ambigOut.includes(uuidA) && ambigOut.includes(uuidB),
			'Ambiguous banner lists both colliding UUIDs',
		);
		assert(
			/Use --id <uuid>/.test(ambigOut),
			'Ambiguous banner mentions "Use --id <uuid>" opt-out',
		);

		// 5. PUSH-BY-UUID — disambiguates to exactly one test.
		const single = runIn(
			tmpRoot,
			['test', 'sync', 'push', '--id', uuidA, '--dry-run'],
			60_000,
		);
		assert(single.exitCode === 0, 'push --id <uuid> exits 0');
		const singleOut = stripAnsi(`${single.stdout}\n${single.stderr}`);
		assert(
			/Found 1 matching/.test(singleOut),
			'push --id <uuid> reports "Found 1 matching" test',
		);
	} finally {
		// Best-effort cleanup. No public DELETE endpoint exists for tests today;
		// this attempt is forward-compat — if it 405s, the cloud rows leak under
		// recognizable names (`e2e dup <nonce>`) but the test passes.
		for (const id of [uuidA, uuidB]) {
			const del = run(['api', '-X', 'DELETE', `/api/v1/tests/${id}`], 15_000);
			if (del.exitCode !== 0) {
				const tail = stripAnsi(`${del.stdout}\n${del.stderr}`).split('\n').slice(-2).join(' | ');
				console.log(
					`  WARN: cleanup DELETE /api/v1/tests/${id} failed (exit=${del.exitCode}) — likely no DELETE endpoint; row leaks. ${tail}`,
				);
			}
		}
		try {
			rmSync(tmpRoot, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	}
});

// ---------------------------------------------------------------------------
// Section 18: QA_USE_FORCE_HEADLESS policy switch
// ---------------------------------------------------------------------------
//
// With `QA_USE_FORCE_HEADLESS=1`, every explicit headful request must fail
// fast with a clear error mentioning the env var. Tests three entry points:
//   1. `browser create --no-headless`
//   2. `browser run --no-headless`
//   3. `test run ... --headful`
// All three should exit non-zero before any backend call is made (so this
// section runs without needing a reachable backend).
await section('Section 18: QA_USE_FORCE_HEADLESS policy switch', () => {
	const env = { QA_USE_FORCE_HEADLESS: '1' };

	// 1. `browser create --no-headless` — must fail at CLI fast-fail.
	const create = run(
		['browser', 'create', '--no-headless', EVALS_URL],
		10_000,
		env,
	);
	const createOut = stripAnsi(`${create.stdout}\n${create.stderr}`);
	assert(
		create.exitCode !== 0,
		`browser create --no-headless exits non-zero with QA_USE_FORCE_HEADLESS=1 (exit=${create.exitCode})`,
	);
	assert(
		/QA_USE_FORCE_HEADLESS/.test(createOut),
		'browser create error message mentions QA_USE_FORCE_HEADLESS',
	);
	assert(
		/--no-headless flag/.test(createOut),
		'browser create error message mentions --no-headless flag as the trigger',
	);

	// 2. `browser run --no-headless` — REPL parity.
	// Pipe an immediate `exit` so the REPL would close cleanly if it ever started.
	const replProc = spawnSync(
		cmdPrefix.split(/\s+/)[0],
		[...cmdPrefix.split(/\s+/).slice(1), 'browser', 'run', '--no-headless'],
		{
			cwd: resolve(import.meta.dirname, '..'),
			encoding: 'utf-8',
			timeout: 10_000,
			input: 'exit\n',
			env: { ...process.env, ...env },
		},
	);
	const replOut = stripAnsi(`${replProc.stdout ?? ''}\n${replProc.stderr ?? ''}`);
	assert(
		(replProc.status ?? 1) !== 0,
		`browser run --no-headless exits non-zero (exit=${replProc.status})`,
	);
	assert(
		/QA_USE_FORCE_HEADLESS/.test(replOut),
		'browser run error message mentions QA_USE_FORCE_HEADLESS',
	);

	// 3. `test run --headful` — must error before tunnel-mode validation.
	// Use a non-existent test name; force-headless check should fire first.
	const testRun = run(
		['test', 'run', 'this-test-does-not-exist', '--tunnel', 'on', '--headful'],
		10_000,
		env,
	);
	const testOut = stripAnsi(`${testRun.stdout}\n${testRun.stderr}`);
	assert(
		testRun.exitCode !== 0,
		`test run --headful exits non-zero with QA_USE_FORCE_HEADLESS=1 (exit=${testRun.exitCode})`,
	);
	assert(
		/QA_USE_FORCE_HEADLESS/.test(testOut),
		'test run error message mentions QA_USE_FORCE_HEADLESS',
	);
	assert(
		/--headful flag/.test(testOut),
		'test run error message mentions --headful flag as the trigger',
	);
});

// Local copy of `toSafeFilename` from src/utils/strings.ts. Inlined here to
// avoid a TypeScript path import — scripts/e2e.ts is a top-level executable.
function toSafeFilenameLocal(name: string, fallback = 'unnamed-test'): string {
	return (name || fallback)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n' + (failed ? 'FAILED — some assertions did not pass' : 'ALL PASSED'));
process.exit(failed ? 1 : 0);
