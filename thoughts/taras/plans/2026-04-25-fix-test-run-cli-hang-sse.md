---
title: "Fix qa-use test run CLI hang (SSE doesn't terminate, --timeout silently ignored)"
status: completed
issue: https://linear.app/desplega-labs/issue/DES-275/qa-use-test-run-cli-hangs-80s-after-test-completes-streamsse-doesnt
date: 2026-04-25
author: taras
autonomy: critical
last_updated: 2026-04-26
last_updated_by: claude (phase-running auto, phase 4)
---

# Fix qa-use test run CLI hang (DES-275)

## Overview

`qa-use test run` keeps the SSE connection open and the process alive long after the test has finished. The CLI emits `[complete]`, prints `Test passed in N s`, then sits idle in `epoll` holding an ESTABLISHED TCP socket to the cope-api SSE endpoint until something external kills it (~80s in the field). Additionally, the advertised `--timeout <seconds>` flag (defined at `src/cli/commands/test/run.ts:58`) is silently dropped because nothing forwards it to the SSE consumer.

This plan adds three things, in order of necessity:

1. **AbortController wired through `streamSSE` → `runCliTest` → `fetch`** so the underlying TCP socket can be closed deterministically.
2. **Close immediately on terminal SSE event** (`complete` / `error`) — abort the controller and break out of the for-await loop the moment we capture the result.
3. **Idle timeout** — wire `--timeout <seconds>` end-to-end as an idle watchdog (no events received for N seconds → abort with a clear error).

## Current State

### `lib/api/sse.ts` (`streamSSE`, lines 82–125)

- Pulls bytes from `response.body.getReader()` in an unbounded `while (true)` loop.
- No `AbortSignal` accepted.
- No idle timeout / heartbeat.
- No early-exit branch on terminal SSE event.
- Comment lines (`:` keep-alives) are filtered in `parseSSE` (`lib/api/sse.ts:65`) and produce zero events, so no upstream consumer can use them as a heartbeat without changes.

### `lib/api/index.ts` (`runCliTest`, lines 845–889)

- Calls `fetch(.../vibe-qa/cli/run, …)` with no `signal`.
- `for await (const event of streamSSE(response))` runs until the **stream closes**, i.e. `reader.read()` returns `done: true`. The backend appears to keep the stream open after `complete` (and may emit trailing `test_fixed`/`persisted`), so this loop never returns until the backend or socket gives up.
- Captures `result` on `complete` / `error` (line 873) but does not break out of the loop.

### `src/cli/commands/test/run.ts:58`

- `commander` option `--timeout <seconds>` declared with default `'300'`.
- `options.timeout` is read **nowhere** in the file. It never reaches `runTest()` (`src/cli/lib/runner.ts:32`) or `runCliTest()`.

### `src/cli/lib/runner.ts`

- `runTest()` accepts `RunTestOptions` (verbose, sourceFile, download, …). No `timeout` field. No `signal` field.
- Forwards options to `client.runCliTest(options, callback)` only.

### Field evidence

```
$ time qa-use test run --id <uuid> --timeout 60 --verbose
[complete] {"run_id":"…","status":"passed","duration_seconds":4.527,…}
✓ Test passed in 4.53s
[test_fixed] {…YAML round-trip dump…}
[test_fixed]
                                                                              # ← CLI hangs here
                                                                              # killed manually at 1:25.34
qa-use test run …  0.51s user 0.08s system 0% cpu 1:25.34 total
```

Process state: `S` (sleeping in `ep_poll`), 0% CPU, 1 ESTABLISHED TCP socket to `localhost:5005`, `--timeout 60` not enforced.

## Desired End State

After this plan ships:

1. `qa-use test run … --verbose` against any test exits within ~1s of receiving the `complete` SSE event. The TCP socket to the API closes before the process exits.
2. `--timeout <seconds>` is enforced as an **idle** watchdog: if no SSE events arrive for that long, the CLI aborts the fetch and exits with a non-zero code and a clear `Test run timed out: no SSE events for Ns` error. Default remains `300`.
3. `streamSSE` accepts an `AbortSignal`. The fetch in `runCliTest` is wired to that signal, so external aborts (Ctrl-C handler, timeouts, terminal-event close) close the socket cleanly instead of leaving a half-open TCP connection.
4. `scripts/e2e.ts` exercises this behavior: a fast test invocation must exit within `[complete] + 5s` wall-clock; a forced-idle scenario must respect a low `--timeout`.

### Key Discoveries

- **The hang is on the client side.** `runCliTest`'s `for await` loop only exits when the SSE stream closes (`reader.read()` returns `done: true`). The backend keeps the stream open after `complete`, so the client must initiate teardown — no backend change needed.
- **`fetch` already supports cancellation via `AbortSignal`.** Aborting the controller propagates through the `ReadableStreamDefaultReader`, causing pending `read()` calls to reject with `AbortError`. This gives us deterministic socket teardown without bespoke socket plumbing.
- **`--timeout` was advertised but never wired.** The fix is straightforward plumbing (`run.ts` → `runner.ts` → `runCliTest`), not a redesign. The biggest design question — total vs idle — is answered by the issue itself ("if the SSE stream produces no events for that duration").
- **`consumeSSE` has zero callers in the repo.** We can change `streamSSE`'s signature freely without breaking external consumers.
- **`AbortSignal.any` is available** (Node 20.3+, project requires Node 20+). Lets us merge a caller-provided signal with the internal controller without manual `addEventListener` plumbing.

## What we are NOT changing

- `consumeSSE` (`lib/api/sse.ts:134`) is unused in this repo (verified with `grep`); we leave it alone except to forward the new optional `signal` for symmetry. Not blocking.
- `qa-use suite run` (`src/cli/commands/suite/run.ts`) — uses axios `apiCall`, no SSE. Out of scope.
- Backend SSE behavior (cope-api) — we explicitly do **not** require a backend change. We tear down the socket from the client side on terminal event.
- Trailing events that arrive **after** `complete` (e.g. `test_fixed`, `persisted`): per the chosen close strategy, we **drop these** when they arrive after `complete`. If we ever need them in the CLI, we'll fetch them via the REST endpoints (`/test-runs/<id>`) instead of relying on SSE timing. Documented as a known trade-off.

## Decisions taken (from /create-plan critical-questions)

| Decision | Choice | Rationale |
|---|---|---|
| Close strategy after `complete` | **Close immediately on `complete`** | Simplest, matches the "exit ~1s after complete" goal in the issue. Trailing `test_fixed`/`persisted` are an accepted loss; can be fetched via REST if needed. |
| `--timeout` semantic | **Idle timeout** (no events for N seconds) | Matches the issue's "if the SSE stream produces no events for that duration" wording. Default 300s preserved. Long but healthy runs are not punished. |

## Implementation Phases

### Phase 1 — Plumb `AbortSignal` through `streamSSE` and `runCliTest`

**Files:** `lib/api/sse.ts`, `lib/api/index.ts`

**Changes:**

1. `streamSSE(response, options?)` — add an optional second parameter `{ signal?: AbortSignal }`. When `signal.aborted` becomes true, exit the read loop without throwing (return cleanly so `for await` terminates without an error). The `reader.read()` call will reject with `AbortError` once `fetch`'s underlying socket is aborted; catch that specifically and return.
2. `consumeSSE` — accept the same options and forward to `streamSSE` for symmetry. No behavioral change for current callers.
3. `runCliTest` — construct an `AbortController` at the top of the method, pass `controller.signal` to both `fetch(...)` and `streamSSE(response, { signal: controller.signal })`. In a `finally` block, call `controller.abort()` defensively to guarantee socket teardown on any exit path (success, throw, return). The signature stays the same in this phase — Phase 3 adds the public `runtimeOptions` parameter that lets external callers inject their own signal/timeout.
4. Reuse `DOMException` with `name === 'AbortError'` for abort detection (no custom error class). `fetch` already throws this and consumers can identify it via `err instanceof Error && err.name === 'AbortError'`.
5. **Create `lib/api/sse.test.ts`** (new file) with at least:
   - A test for `parseSSE` round-trip (CRLF and LF) to pin the existing parsing behavior.
   - A test that aborting the controller causes `streamSSE` to return cleanly (no thrown error) within 50ms. Use a `ReadableStream` mock that never closes on its own.

**Notes:**

- Do **not** make `signal` mandatory; default to a fresh controller inside `runCliTest` so callers (current ones) need no change.
- Comment lines (pings) must still pass through the read loop so they reset the idle timer once Phase 3 lands. (`parseSSE` continues to filter them out from the yielded event stream — the reset hook fires at the byte-chunk level inside `streamSSE`, not the event level.)
- Phase 3 will widen `runCliTest`'s public signature to `(options, onEvent?, runtimeOptions?)`; this phase deliberately keeps the signature unchanged so it's a small, easy-to-review diff.

### Success Criteria:

#### Automated Verification:
- [x] Typecheck passes: `bun run typecheck`
- [x] Lint passes: `bun run check:fix`
- [x] Existing API tests still pass: `bun test lib/api/`
- [x] New unit test: aborting the controller mid-stream causes `streamSSE` to return cleanly within 50ms — `bun test lib/api/sse.test.ts`

#### Manual Verification:
- [ ] In a node REPL, call `runCliTest({...})` against `localhost:5005`, then `controller.abort()` after ~500ms. Observe: the awaited promise resolves/rejects within 100ms; capture the REPL's PID via `process.pid` and verify `lsof -p <node-pid>` shows no ESTABLISHED socket to `localhost:5005`.

**Implementation Note:** Pause here for confirmation before Phase 2 — this is the foundation everything else builds on, and the abort semantics need to be right.

### Phase 2 — Close immediately on terminal SSE event

**Files:** `lib/api/index.ts`

**Changes:**

1. Inside the `for await (const event of streamSSE(...))` loop in `runCliTest`, when `event.event === 'complete' || event.event === 'error'`:
   - Capture `result` (already done at line 874).
   - Call `controller.abort()` to close the socket.
   - `break` out of the loop so we stop iterating immediately.
2. After the loop, if we aborted because of a terminal event, return `result` normally (don't surface the abort as a user-facing error).
3. To distinguish "we aborted because of complete" vs "external aborter (timeout, Ctrl-C)" vs "fetch threw a real network error", track a `terminationReason: 'complete' | 'idle-timeout' | 'external' | null` flag in the local scope. Set to `'complete'` before calling `abort()` for the terminal-event branch. The catch block reads it to decide whether to swallow vs re-throw.

**Notes:**

- The `try/finally` from Phase 1 still calls `controller.abort()`, but that's idempotent.
- Do **not** wait for trailing events. Per the decision table, `test_fixed`/`persisted` arriving after `complete` are dropped.
- Error path: if we get `event.event === 'error'`, set `result` and abort the same way; the existing `if (result.status !== 'passed') process.exit(1)` in `run.ts:230` handles non-zero exit.

### Success Criteria:

#### Automated Verification:
- [x] Unit test in `lib/api/sse.test.ts` (or new `lib/api/runCliTest.test.ts`): mock fetch returning a stream that emits `start`, `step_complete`, `complete`, then **never closes**. Assert `runCliTest` resolves within 200ms of the `complete` chunk being delivered.
- [x] Unit test: same but emit `error` instead of `complete`. Assert the returned `RunCliTestResult.status === 'error'` and the loop exits within 200ms.
- [x] Build clean: `bun run build`

#### Manual Verification:
- [ ] `time bun run cli test run --id <fast-uuid> --verbose` exits within `[complete] + 2s` wall-clock against the local cope-api on `localhost:5005`.
- [ ] During the run, `lsof -p $(pgrep -f "test run --id")` shows the SSE TCP socket disappears within ~1s of `[complete]` being printed (capture before/after).
- [ ] With `--verbose`, observe that no `[test_fixed]` line is printed AFTER `[complete]` — confirms the loop exits before the trailing event arrives.

**Implementation Note:** This is the user-visible win. Pause for sign-off before adding the watchdog timeout.

### QA Spec (optional):

- **Repro the original bug**: install pre-fix binary, run `time qa-use test run --id <fast-uuid> --timeout 60 --verbose` → CLI hangs ≥80s. Install post-fix → exits within `[complete] + 2s`. Capture both `time` outputs as evidence.
- **No regression on failing tests**: run a known-failing test → exits within `[complete] + 2s` AND with non-zero status. Capture exit code.

### Phase 3 — Idle-timeout watchdog wired through `--timeout`

**Files:** `src/cli/commands/test/run.ts`, `src/cli/lib/runner.ts`, `lib/api/index.ts`

**Changes:**

1. **CLI parsing** — in `src/cli/commands/test/run.ts`:
   - Replace the string default `'300'` with a parser: `.option('--timeout <seconds>', 'Idle timeout in seconds (0 = no timeout)', (v) => Number.parseInt(v, 10), 300)`.
   - Pass `options.timeout` into `runTest(...)` as `runOptions.idleTimeoutSec`.
2. **Runner** — in `src/cli/lib/runner.ts`:
   - Add `idleTimeoutSec?: number` to `RunTestOptions`.
   - Forward it as `options.idleTimeoutSec` (or as a third arg) to `client.runCliTest`.
3. **API client** — in `lib/api/index.ts`:
   - Extend `runCliTest`'s signature: `runCliTest(options, onEvent?, runtimeOptions?: { idleTimeoutSec?: number; signal?: AbortSignal })`.
   - Inside the for-await loop, on each event received, reset a `setTimeout(idleTimeoutSec * 1000)` that, on fire, sets `terminationReason = 'idle-timeout'` and calls `controller.abort()`.
   - On `controller.abort()` due to idle, the catch block recognizes it and throws a typed `Error` with message `Test run timed out: no SSE events for ${idleTimeoutSec}s`.
   - `idleTimeoutSec === 0` (or undefined) disables the watchdog.
4. **External signal merging** — if the caller passes their own `signal`, merge it: `AbortSignal.any([callerSignal, internalController.signal])` (Node 20.3+) or chain via `addEventListener('abort')`. Since the project requires Node 20+, prefer `AbortSignal.any`.
5. **Help text** — update `--timeout` description in `run.ts:58` to clarify it's an **idle** timeout (no events for N seconds), not total wall-clock. Update README/docs if they describe it.

**Edge cases:**

- The first event may take >`idleTimeoutSec` to arrive (large test, cold backend). The watchdog must start **after the response headers arrive** (i.e. after `await fetch(...)`), not at function entry.
- Reset on **every** SSE event including comments/pings if we surface them. Decision: keep `parseSSE` filtering comments out, but reset the watchdog inside `streamSSE`'s read loop on every successful `reader.read()` chunk so pings keep the connection alive. Implementation: `streamSSE` accepts `{ onChunk?: () => void }`; `runCliTest` resets the timer in `onChunk`.

### Success Criteria:

#### Automated Verification:
- [x] Typecheck passes: `bun run typecheck`
- [x] Lint passes: `bun run check:fix`
- [x] Build clean: `bun run build`
- [x] Unit test: mock SSE that emits `start` then nothing for 1s; with `idleTimeoutSec: 0.5`, assert `runCliTest` rejects with `/timed out/` within 600ms.
- [x] Unit test: mock SSE that emits `start` + `step_log` every 100ms (no `complete`); with `idleTimeoutSec: 1`, assert `runCliTest` does **not** time out — the watchdog resets each event.
- [x] Help-text snapshot: `bun run cli test run --help | grep -i timeout` mentions "Idle timeout".

#### Manual Verification:
- [ ] `bun run cli test run --id <uuid> --timeout 5 --verbose` against a real backend completes normally for a fast test (no spurious timeout).
- [ ] Force an idle scenario by pointing at a stub server that sends `start` then nothing: `bun run cli test run --id <uuid> --timeout 3` exits non-zero within ~3.5s with `Test run timed out: no SSE events for 3s`.
- [ ] `bun run cli test run --id <uuid> --timeout 0` disables the watchdog (no idle abort, but `complete` still closes).

**Implementation Note:** Pause for sign-off — confirm timeout messaging is clear before adding e2e coverage.

### Phase 4 — Regression coverage in `scripts/e2e.ts`

**Files:** `scripts/e2e.ts`, `lib/api/sse.test.ts` (and/or new `lib/api/runCliTest.test.ts`)

**Changes:**

1. Add a new section to `scripts/e2e.ts` that:
   - Runs `bun run cli test run` against the existing `qa-tests/e2e.yaml` fixture.
   - Captures wall-clock between the printed `[complete]` line and process exit. Asserts < 5s.
   - Asserts the process exits without external kill (no SIGTERM needed).
2. Implement the assertion by spawning the child with `child_process.spawn`, attaching a stdout reader that timestamps each line, and computing `exitTs - completeTs`. Fail the section if > 5s.
3. Promote the unit tests written in Phases 1–3 into a stable `lib/api/sse.test.ts` (and `runCliTest.test.ts`). Cover:
   - `streamSSE` parses CRLF and LF correctly (existing behavior; pin it).
   - `streamSSE` exits cleanly on abort.
   - `runCliTest` exits on `complete`.
   - `runCliTest` enforces idle timeout.
   - `runCliTest` propagates external abort.

### Success Criteria:

#### Automated Verification:
- [x] All unit tests pass: `bun test`
- [x] e2e regression passes: `bun run scripts/e2e.ts` (requires running cope-api at `api_url` per existing convention).
- [x] Typecheck + lint clean: `bun run check:fix && bun run typecheck`

#### Manual Verification:
- [ ] Re-run the exact repro from DES-275: `time qa-use test run --id <fast-uuid> --timeout 60 --verbose`. Total wall-clock ≤ `[complete] + 5s`. Compare with pre-fix `1:25.34` to confirm.
- [ ] `lsof -p <pid>` immediately after `[complete]` shows no ESTABLISHED connection to `localhost:5005`.
- [ ] Ctrl-C during a long-running test exits within 1s and leaves no half-open socket.

**Implementation Note:** Pause for sign-off after the e2e regression passes; the version bump in Phase 5 is the final step before merge.

### Phase 5 — Version bump + release commit

**Files:** `package.json`, optional `CHANGELOG.md` (not currently in repo — skip if absent)

**Changes:**

1. Bump `package.json` version `2.15.0` → `2.15.1` (patch). Rationale: this is a bug fix (a documented flag that was silently dropped, plus a hang). No new public API; the `--timeout` semantic is now what its help text already implied. Patch is correct per the project's existing release convention (see `47cac34 [release] bump to 2.15.0`).
2. Commit message follows the existing pattern: `[release] bump to 2.15.1 — fix test-run CLI hang + enforce --timeout (DES-275)`.
3. If a `CHANGELOG.md` is added during the implementation window (it is not currently checked in), append a matching entry. Otherwise, the release commit message is the canonical record.

**Notes:**

- Only bump after Phases 1–4 are merged-ready (typecheck, lint, build, unit tests, and `bun run scripts/e2e.ts` all green).
- Do **not** publish to npm in this plan — that's a separate operator step (existing release flow).

### Success Criteria:

#### Automated Verification:
- [x] `package.json` shows `"version": "2.15.1"`: `grep '"version"' package.json`
- [x] Build clean: `bun run build`
- [x] CLI reports the new version: `bun run cli --version` (should print `2.15.1`)

#### Manual Verification:
- [ ] `git log --oneline | head -5` shows the `[release] bump to 2.15.1 …` commit at HEAD.
- [ ] After publishing (operator step, not in this plan), `npx qa-use@latest --version` reports `2.15.1`.

**Implementation Note:** This phase ships the fix. Confirm Phases 1–4 verification all passed before bumping.

## Manual E2E (post-merge against running cope-api)

Run these against a local cope-api on `localhost:5005` with `.qa-use.json` already configured.

```bash
# 1. Fast test exits ~immediately after complete
FAST_TEST_ID=<uuid-of-an-evals-test>
time bun run cli test run --id "$FAST_TEST_ID" --timeout 60 --verbose
#   ↳ assert: total wall-clock ≤ `complete` + 2s
#   ↳ assert: process exits without manual kill

# 2. --timeout enforces idle abort
time bun run cli test run --id "$FAST_TEST_ID" --timeout 1 --verbose
#   ↳ for a fast test this still passes (events arrive within 1s of each other)
#   ↳ to force an idle abort, point at a stub backend or use a slow test_id

# 3. --timeout 0 disables the watchdog
bun run cli test run --id "$FAST_TEST_ID" --timeout 0 --verbose
#   ↳ assert: passes; no timeout error; process exits on `complete`

# 4. No half-open TCP socket after exit
bun run cli test run --id "$FAST_TEST_ID" --verbose &
PID=$!
sleep 6
lsof -p $PID 2>/dev/null | grep -i 5005 || echo "no socket — good"

# 5. Failing test exits non-zero, also fast
FAILING_TEST_ID=<uuid-of-a-deliberately-failing-test>
time bun run cli test run --id "$FAILING_TEST_ID" --verbose; echo "exit=$?"
#   ↳ assert: exit=1 (or non-zero) within `complete` + 2s

# 6. e2e regression script (full sweep)
bun run scripts/e2e.ts
#   ↳ assert: all sections pass, including the new SSE-exit-time section
```

## Rollout / Risk

**Risk: Lost trailing events.** The chosen close-on-complete strategy drops `test_fixed` / `persisted` if they arrive after `complete`. This is documented in "What we are NOT changing". If a downstream caller (e.g. argus-onboarding) needs `test_fixed`, they should fetch via REST: `GET /api/v1/test-runs/<run_id>` returns the same data.

**Risk: Backwards incompatibility on `runCliTest`.** The signature change adds optional parameters; existing callers (`runner.ts`) are updated in the same patch. No external SDK consumers — `runCliTest` is internal to qa-use.

**Risk: Idle timeout false-positives.** A 300s default with reset-on-every-chunk (including pings) is generous. If users see spurious timeouts, they can set `--timeout 0`.

**Rollback:** Single PR, single revert. The fix is local to `lib/api/sse.ts`, `lib/api/index.ts`, `src/cli/commands/test/run.ts`, `src/cli/lib/runner.ts`, plus tests.

## Quick Verification Reference

Single-shot summary of every command across phases. Run after any phase to spot-check the whole stack.

### Automated

```bash
bun run typecheck                       # Phases 1, 3, 5
bun run check:fix                       # Phases 1, 3
bun run build                           # Phases 2, 3, 5
bun test lib/api/                       # Phases 1, 2 (existing + new sse.test.ts / runCliTest.test.ts)
bun test                                # Phase 4 (full suite)
bun run scripts/e2e.ts                  # Phase 4 (regression incl. SSE-exit-time section)
bun run cli --version                   # Phase 5 — should print 2.15.1
grep '"version"' package.json           # Phase 5 — should show 2.15.1
bun run cli test run --help | grep -i timeout   # Phase 3 — help text says "Idle timeout"
```

### Manual

```bash
# Fast test exits ~immediately after [complete]
time bun run cli test run --id <fast-uuid> --timeout 60 --verbose

# Idle timeout enforced
bun run cli test run --id <uuid> --timeout 3   # against a stub that emits start then nothing

# --timeout 0 disables the watchdog
bun run cli test run --id <fast-uuid> --timeout 0 --verbose

# No half-open TCP socket after exit
bun run cli test run --id <fast-uuid> --verbose &
PID=$!; sleep 6
lsof -p $PID 2>/dev/null | grep -i 5005 || echo "no socket — good"

# Failing test exits non-zero, also fast
time bun run cli test run --id <failing-uuid> --verbose; echo "exit=$?"
```

## Cross-refs

- DES-275 (this issue) — Linear
- F20 in `cope` `thoughts/taras/qa/2026-04-24-argus-onboarding-v2.md` — original diagnosis
- DES-272 (cope) — argus-onboarding v2; F35 wants to use `qa-use test run` once this is fixed.

## Follow-ups (not in scope)

- If we later want trailing events: refetch via `GET /api/v1/test-runs/<run_id>` in `run.ts` after `runCliTest` returns and merge into the result. Ticket TBD.
- Backend-side fix: cope-api could close the SSE stream after sending `complete` + drained trailing events. Coordinate via desplega-api repo if motivated; this client-side fix is independent.
- Replace `update-check.ts`'s ad-hoc `AbortController + setTimeout` with the same helper if we extract one. Pure cleanup, not blocking.

## Review Errata

_Reviewed: 2026-04-26 by claude (auto-apply mode)_

### Applied
- [x] Added `Key Discoveries` subsection to Desired End State — auto-applied
- [x] Added `Quick Verification Reference` section consolidating every command across phases — auto-applied
- [x] Phase 1 Changes: explicitly list creation of `lib/api/sse.test.ts` (new file) — auto-applied
- [x] Phase 1 Changes: clarified that `runCliTest`'s public signature stays unchanged in Phase 1; the `runtimeOptions` parameter is added in Phase 3 — auto-applied
- [x] Phase 1 Manual Verification: replaced `lsof -p $$` (shell PID) with `lsof -p <node-pid>` — auto-applied
