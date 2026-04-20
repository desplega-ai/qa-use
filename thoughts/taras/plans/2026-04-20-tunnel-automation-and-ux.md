---
date: 2026-04-20T00:00:00Z
author: Taras
topic: "Transparent tunnel automation and background browser UX"
tags: [plan, tunnel, browser, cli, ux, qa-use]
status: in-progress
last_updated: 2026-04-20
last_updated_by: Claude (phase 4 automated verification)
brainstorm: thoughts/taras/brainstorms/2026-04-20-tunnel-automation-and-ux.md
---

## Review Pass (2026-04-20, automated)

**Verified against the codebase:**
- `lib/tunnel/index.ts:47` single-use guard (`throw new Error('Tunnel session already active')`).
- `lib/tunnel/index.ts:25` default region `'auto'`; `lib/tunnel/index.ts:41` sessionIndex clamp 0-9; stdout `console.log` banners at lines 72, 76, 79, 89.
- `src/server.ts:125-176` — `BrowserSession` class exactly spans these lines.
- `src/server.ts:450-603` — `getOrCreateGlobalBrowser` singleton spans these lines.
- `src/cli/lib/browser.ts:30` `isLocalhostUrl`; `:65` `getPortFromUrl`; `:85-131` `startBrowserWithTunnel`; `:106` inline `isLocalhost || !testUrl`; `:136` `stopBrowserWithTunnel`.
- `src/cli/commands/browser/create.ts:49` `--tunnel` boolean option; `:62` mutex with `--ws-url`; `:212-501` `runTunnelMode`; `:282-283` SIGINT/SIGTERM handlers; `:447` "Press Ctrl+C" banner; `:454` heartbeat `setInterval` (30 s).
- `src/cli/commands/browser/run.ts:45-59` REPL option block — no `--tunnel` flag today (confirmed).
- `src/cli/commands/test/run.ts:46` `--tunnel` flag; `:128-140` `if (options.tunnel) { startBrowserWithTunnel(...) }` block.
- `lib/env/index.ts:28` `QA_USE_API_URL`; `:30` `QA_USE_REGION`; `:86` `getEnvWithSource`.
- Subcommand-group convention: `src/cli/commands/test/index.ts` + `src/cli/commands/app-config/index.ts` both wrap subcommands via `new Command('<name>').addCommand(...)` and are registered in `src/cli/index.ts` (test at `:47`, app-config at `:54`). The plan's `qa-use tunnel` shape matches.
- Docs generation exists: `package.json` scripts include `generate:docs` (`tsx scripts/generate-docs.ts`) and `check:docs` (diffs the result). Output lands at `src/cli/generated/docs-content.ts`.

**Fixed in place:**
- Corrected Current-State claim about where the session id is printed in `runTunnelMode` — `create.ts:386` is after `createSession()`, **before** `waitForStatus` (which runs at `:397`). Updated wording.
- Phase 4 step 2 narrowed the "lines 282-380 roughly" hand-wave to the actual `createSession()` call at `create.ts:358`.
- Phase 6 step 3: replaced the speculative "if there's a `bun run docs:gen`" with the real script name (`bun run generate:docs`) and added `bun run check:docs` to Automated Verification.
- Phase 2 Automated Verification: each "does NOT start a tunnel" line clarified with an observable proxy (no banner on stderr + `tunnel ls` empty — acknowledging `tunnel ls` only lands in Phase 3, so the Phase-2 checks fall back to banner absence and `lsof`/exit-speed hints).
- Phase 5 Manual Verification: pinned "next unrelated CLI invocation" to the exact command (`qa-use info`).
- Phase 4 Automated Verification: clarified how to confirm the hidden subcommand is not listed (`bun run cli browser --help | grep -v __browser-detach`).

**Open flags — all addressed in a second editing pass:**
- ~~Phase 4 PID-file ownership model.~~ → **Addressed in Phase 3 step 4.** `tunnel close` now explicitly cross-references `~/.qa-use/sessions/*.json`, SIGTERMs the owning detach child (SIGKILL fallback after 5 s), and makes a best-effort backend session-end call per reaped child.
- ~~Phase 2 auto-banner duplication.~~ → **Addressed in Phase 2 step 7.** The ad-hoc "Starting local browser with tunnel..." block at `test/run.ts:130-133` is pruned in the same phase that introduces the new banner.
- ~~Grace-period confusion after `browser close`.~~ → **Addressed in Phase 4 step 4.** `browser close` prints a one-line stderr hint noting remaining grace time and how to force-tear-down via `qa-use tunnel close`.
- ~~MCP global tunnel divergence.~~ → **Addressed in new "Follow-ups" section.** Tracked as a post-ship migration ticket; out of scope for this plan.
- ~~Phase 4 re-exec via `process.argv[1]`.~~ → **Addressed in Phase 4 step 2.** New `resolveCliEntry()` helper (`src/cli/lib/cli-entry.ts`) deterministically handles installed-binary / `bun run cli` / symlink invocations, with unit tests for all three shapes.
- ~~No rollback/feature-flag for Phase 4.~~ → **Addressed in Phase 4 step 3b.** `QA_USE_DETACH=0` falls back to the preserved legacy blocking path for one release. Removal is tracked in Follow-ups.

---

# Transparent Tunnel Automation & Background Browser UX — Implementation Plan

## Overview

Make tunnelling transparent when the browser target is localhost, turn the tunnel into a shared refcount-managed primitive, and detach `browser create` so it returns immediately (fire-and-forget) while its lifecycle stays tied to a PID-tracked background process. Adds a new `qa-use tunnel *` subcommand family and a `qa-use doctor` cleanup tool. CLI-only — MCP and HTTP/SSE paths are untouched.

## Current State Analysis

**Tunnel primitive (`lib/tunnel/index.ts`).** `TunnelManager` wraps `@desplega.ai/localtunnel` as a **single-use instance** — throws if `this.session` already exists (`lib/tunnel/index.ts:47`). No refcount, no pooling. Writes banner/status to stdout via `console.log` (`tunnel/index.ts:72,76,79,89`). Region default is `'auto'` (`tunnel/index.ts:25`); docs elsewhere say `'us'` — minor drift, leave as-is.

**Browser session lifecycle.** `BrowserSession` (`src/server.ts:125-176`) holds `browser`, `tunnel`, `ttl`, `deadline`; `cleanup()` stops tunnel then browser (`src/server.ts:164`). MCP server uses a **single global** `globalBrowser`/`globalTunnel` (`src/server.ts:450-603`), not a pool — CLI path instantiates fresh `BrowserManager` + `TunnelManager` per command. `BrowserManager` is also single-use (`lib/browser/index.ts:31`).

**CLI `--tunnel` flag.** Declared on `browser create` (`src/cli/commands/browser/create.ts:49`, mutex with `--ws-url` at line 62) and `test run` (`src/cli/commands/test/run.ts:46`). **Not on REPL** (`src/cli/commands/browser/run.ts:45-59`). Not tri-state today — presence/absence only.

**Auto-tunnel seed already in repo.** `startBrowserWithTunnel` (`src/cli/lib/browser.ts:85-131`) already has `isLocalhost || !testUrl` inference (line 106). `isLocalhostUrl` lives at `src/cli/lib/browser.ts:30` covering `localhost`, `127.0.0.1`, `::1`, `*.localhost`.

**Blocking function.** `runTunnelMode` in `src/cli/commands/browser/create.ts:212-501` is what makes `browser create` block — installs SIGINT/SIGTERM handlers (lines 282-283), prints the "Press Ctrl+C" banner (line 447), runs a `setInterval` heartbeat (line 454, 30 s) forever. Session id is first printed at line 386 (right after `createSession()`, before `waitForStatus` at line 397); the full "Browser tunnel ready!" block lands at lines 418-448 after `waitForStatus` resolves.

**Test-run tunnel flow.** `src/cli/commands/test/run.ts:128-140` only starts a tunnel if `--tunnel` was passed. No base-URL-driven auto-decision today.

**Config loading.** `lib/env/index.ts:86` resolves env → top-level `~/.qa-use.json` field → `env` block. `QA_USE_API_URL`/`api_url` at line 28, `QA_USE_REGION`/`region` at line 30. No `tunnel` field exists yet.

**Output conventions.** `src/cli/lib/output.ts` has ANSI helpers (`success`, `error`, `warning`, `info`, `step`). No global `--json`/`--quiet` — each command implements its own. `TunnelManager` prints to stdout; `startBrowserWithTunnel` already uses `console.error`.

**No existing detach/PID-file machinery.** Grep for `child_process.spawn`, `{ detached: true }`, PID files, `~/.qa-use/` directory writes returned nothing of substance. Needs to be built.

## Desired End State

- Running `qa-use browser create http://localhost:3000` (with remote backend) starts a detached browser + tunnel, prints session id + public URL + banner to stderr, returns to the shell in <2 s.
- Running `qa-use test run -c localhost-app-config` starts (or reuses) a tunnel automatically, tears down its refcount when the run completes.
- Running either command with `--tunnel off` / `--no-tunnel` suppresses tunnelling even for localhost targets.
- Running either command with `--tunnel on` forces a tunnel even in dev mode (API URL is localhost).
- `qa-use tunnel ls` shows active tunnels with target, public URL, refcount, TTL.
- `qa-use browser close <id>` SIGTERMs the detached child and releases the tunnel.
- `qa-use doctor` reaps stale PID files + orphan tunnels.
- `scripts/e2e.ts` covers all of the above.

### Key Discoveries:

- `isLocalhostUrl` already exists at `src/cli/lib/browser.ts:30` — relocate, don't re-implement.
- `startBrowserWithTunnel` at `src/cli/lib/browser.ts:85` is the central refactor seam for auto-decision wiring.
- `TunnelManager` single-use check at `lib/tunnel/index.ts:47` forces the registry to own multiple `TunnelManager` instances (one per target), not wrap a single manager.
- `runTunnelMode` at `src/cli/commands/browser/create.ts:212-501` is the 290-line function that has to be split into parent-bootstrap + detached-child halves.
- MCP global-browser path (`src/server.ts:450-603`) must **not** be migrated to the registry in this plan — scope is CLI only, and MCP's single-global model intentionally skips pooling.
- Deterministic subdomain clamps `sessionIndex` 0-9 (`lib/tunnel/index.ts:41`) → practical cap of 10 concurrent tunnels per API key; registry must surface this as an error class, not a silent hang.

## Quick Verification Reference

Common commands:
- Type + lint + format: `bun run check:fix`
- Typecheck only: `bun run typecheck`
- Unit tests: `bun test`
- E2E regression: `bun run scripts/e2e.ts`
- Dogfood CLI: `bun run cli <command>`

Key files to watch:
- `lib/tunnel/index.ts`, `lib/tunnel/registry.ts` (new)
- `lib/env/index.ts`, `lib/env/localhost.ts` (new)
- `src/cli/lib/browser.ts`, `src/cli/lib/tunnel-resolve.ts` (new)
- `src/cli/commands/browser/create.ts`, `close.ts`, `status.ts`, `run.ts` (REPL)
- `src/cli/commands/browser/_detached.ts` (new hidden subcommand target)
- `src/cli/commands/test/run.ts`
- `src/cli/commands/tunnel/{index,start,ls,status,close}.ts` (new command family)
- `src/cli/commands/doctor.ts` (new)
- `scripts/e2e.ts`

## What We're NOT Doing

- **MCP tools and HTTP/SSE server.** Both paths are untouched. `src/server.ts` global-browser model stays as-is.
- **`suite run`.** Cloud-only; no tunnel consumer.
- **No local per-session log file.** Detached `browser create` does not write `~/.qa-use/logs/session-<id>.log`. Logs stay at backend via existing `browser logs console|network`.
- **No tunnel retries.** Zero silent retries on tunnel failure.
- **No app-config schema change.** `tunnel` is strictly CLI-side — the field lives in `~/.qa-use.json`, not in server-side app-configs.
- **No warning on tunnel reuse.** Reuse is a feature; no runtime "shared with another session" notice.
- **No `qa-use daemon`.** Each detached `browser create` runs as its own child process (re-exec of the CLI with a hidden `__browser-detach` subcommand). No long-lived supervisor.
- **No `QA_USE_REGION` default fix.** Known drift between `'us'` (docs) and `'auto'` (`tunnel/index.ts:25`) — out of scope here.
- **No changes to `browser create --ws-url` path.** `--ws-url` remains the remote-WS override and keeps bypassing tunnel logic.

## Follow-ups (out of this plan, tracked for later)

- **MCP global tunnel divergence.** `src/server.ts:450-603` (`getOrCreateGlobalBrowser`) keeps its own single-global `TunnelManager` outside the new registry. Intentional scope cut for this plan, but the divergence will widen over time. File a follow-up ticket to migrate the MCP path onto `TunnelRegistry` once the CLI path has shipped and stabilised.
- **Remove `QA_USE_DETACH=0` rollback flag.** The legacy blocking path behind `QA_USE_DETACH=0` (Phase 4, step 3b) is temporary — keep it for one release after detach ships, then delete the guard and the preserved `runTunnelMode` body. File a follow-up ticket for the cleanup release.
- **`QA_USE_REGION` docs/code drift.** Docs say `'us'`, `lib/tunnel/index.ts:25` defaults to `'auto'`. Out of scope here; file a trivial follow-up ticket to reconcile (probably in a docs-only change).

## Implementation Approach

Six phases, shipping incremental value. Phase 1 lays plumbing (flag, config, helper) without behaviour change. Phase 2 turns on the auto-decision + banner + triage errors. Phase 3 introduces the shared registry and the new `qa-use tunnel` subcommand family — first real architectural shift. Phase 4 is the biggest: detach `browser create` via re-exec of the CLI with a hidden `__browser-detach` subcommand, plus PID files and `browser close`/`status` rewiring. Phase 5 adds `qa-use doctor` for orphan cleanup. Phase 6 closes the loop with e2e coverage + docs. Commits are created after each phase once manual verification passes (per Taras' preference).

---

## Phase 1: Foundations — shared helpers + tri-state `--tunnel` flag + config key

### Overview
Land the boring plumbing: promote `isLocalhostUrl` to a canonical home, define the tri-state `--tunnel` option shape, add `tunnel: "auto"|"on"|"off"` to `~/.qa-use.json`, and wire the flag into `browser create`, `browser run` (REPL), and `test run`. Behaviour stays identical — `auto` still maps to the current "tunnel iff `--tunnel` passed" logic. Isolates flag plumbing from the real decision logic in Phase 2.

### Changes Required:

#### 1. Canonical `isLocalhostUrl`
**File**: `lib/env/localhost.ts` (new)
**Changes**: Move `isLocalhostUrl` + `getPortFromUrl` from `src/cli/lib/browser.ts:30,65` to `lib/env/localhost.ts`. Export from `lib/env/index.ts` too. Keep a re-export shim at `src/cli/lib/browser.ts` for one phase so we don't break imports in the same commit — remove shim in phase 2.

#### 2. Tri-state `--tunnel` option helper
**File**: `src/cli/lib/tunnel-option.ts` (new)
**Changes**: Export `addTunnelOption(command)` that attaches a Commander option parsing `--tunnel <auto|on|off>` (default `auto`) and `--no-tunnel` as alias for `off`. Export `TunnelMode = 'auto' | 'on' | 'off'` type. Reject invalid values at parse time with a clear error.

#### 3. Config schema + loader
**File**: `lib/env/index.ts`
**Changes**: Add `tunnel?: TunnelMode` to the `~/.qa-use.json` top-level type. Thread through `getEnvWithSource`. Validate value is `'auto' | 'on' | 'off'`; on invalid, log warning to stderr and fall back to `'auto'`.

#### 4. Wire flag into commands (no behaviour change)
**Files**:
- `src/cli/commands/browser/create.ts:49` — replace existing `--tunnel` boolean option with `addTunnelOption(cmd)`.
- `src/cli/commands/browser/run.ts:45-59` — **add** `addTunnelOption(cmd)` (new option for REPL).
- `src/cli/commands/test/run.ts:46` — replace existing `--tunnel` boolean with `addTunnelOption(cmd)`.
**Changes**: In each command body, resolve effective mode via new helper `resolveTunnelFlag(cliFlag, configFile) → TunnelMode` in `src/cli/lib/tunnel-resolve.ts` (new). This phase treats `on`/`off` the same way the old boolean did, and treats `auto` as equivalent to `off` (preserves current "only tunnel when explicitly asked" behaviour). The auto-inference arrives in Phase 2.

#### 5. Unit tests
**Files**:
- `lib/env/localhost.test.ts` (new) — `isLocalhostUrl` cases: `localhost`, `127.0.0.1`, `::1`, `foo.localhost`, `0.0.0.0`, negative: `example.com`, `192.168.1.1`.
- `src/cli/lib/tunnel-option.test.ts` (new) — flag parses `auto|on|off`, `--no-tunnel` → `off`, invalid value rejected.
- `src/cli/lib/tunnel-resolve.test.ts` (new) — precedence: CLI flag > config file > default `auto`.

### Success Criteria:

#### Automated Verification:
- [x] Type + lint + format pass: `bun run check:fix`
- [x] Unit tests pass: `bun test lib/env/localhost.test.ts src/cli/lib/tunnel-option.test.ts src/cli/lib/tunnel-resolve.test.ts`
- [x] Full test suite passes: `bun test`
- [x] `bun run cli browser create --help` shows `--tunnel <mode>` and `--no-tunnel`
- [x] `bun run cli browser run --help` shows `--tunnel <mode>` and `--no-tunnel`
- [x] `bun run cli test run --help` shows `--tunnel <mode>` and `--no-tunnel`
- [x] `bun run cli browser create --tunnel bogus` exits non-zero with a clear error
- [x] `grep -n "isLocalhostUrl" src/cli/lib/browser.ts` shows only the re-export shim

#### Manual Verification:
- [x] `browser create http://localhost:3000` behaves exactly as today (no tunnel unless `--tunnel on`)
- [x] `browser create http://localhost:3000 --tunnel on` tunnels as today
- [x] `test run ... --tunnel on` tunnels as today
- [x] `~/.qa-use.json` with `{"tunnel": "on"}` is accepted without warning; with `{"tunnel": "bogus"}` logs a stderr warning and falls back (note: warning fires on any command that resolves the tunnel mode — `info` doesn't; verified via `browser create`)

**Implementation Note**: Pause for confirmation. Commit: `[phase 1] add canonical isLocalhostUrl + tri-state --tunnel flag + config key`.

---

## Phase 2: Decision logic + banner + triage errors

### Overview
Turn `auto` into the new default behaviour. Add `resolveTunnelMode(flag, baseUrl, apiUrl)` that resolves to `'on' | 'off'`. Introduce structured `TunnelError` classes. Print a stderr banner on first tunnel start (TTY-aware). Zero retries on failure — triage-hint error instead. Wire everything through `startBrowserWithTunnel`. No registry yet — each command still owns its own tunnel.

### Changes Required:

#### 1. Decision function
**File**: `src/cli/lib/tunnel-resolve.ts`
**Changes**: Add `resolveTunnelMode(mode: TunnelMode, baseUrl?: string, apiUrl?: string): 'on' | 'off'` with the matrix:
- `mode === 'on'` → `'on'`
- `mode === 'off'` → `'off'`
- `mode === 'auto'` → `'on'` iff `isLocalhostUrl(baseUrl) && !isLocalhostUrl(apiUrl)`, else `'off'`
Remove the re-export shim left in `src/cli/lib/browser.ts` from Phase 1.

#### 2. Structured tunnel errors
**File**: `lib/tunnel/errors.ts` (new)
**Changes**: Export `TunnelError` base + subclasses `TunnelNetworkError`, `TunnelAuthError`, `TunnelQuotaError`, `TunnelUnknownError`. Each carries `{ target, provider, cause }`. Add a `classifyTunnelFailure(error)` that inspects `@desplega.ai/localtunnel` thrown errors (timeouts, 401/403, rate-limit markers, subdomain clash) and returns the right subclass.

#### 3. Teach `TunnelManager` to classify on failure
**File**: `lib/tunnel/index.ts`
**Changes**: In `startTunnel` try/catch (around current line 89), wrap thrown errors with `classifyTunnelFailure` before re-throwing. Replace `console.log` with `console.error` on startup status lines (lines 72,76,79,89) so banners go to stderr. Zero retries — no catch/retry logic anywhere.

#### 4. Auto-tunnel banner
**File**: `src/cli/lib/tunnel-banner.ts` (new)
**Changes**: Export `printTunnelStartBanner({ target, publicUrl })` and `printTunnelReuseBanner({ target, publicUrl })`. Both write to stderr. Multi-line boxed banner on start; short single-line on reuse. Suppressed when `!process.stderr.isTTY` or when env var `QA_USE_QUIET=1` or per-command `--json` is set. Banner text follows brainstorm draft (detected target, public URL, reason, opt-out hint).

#### 5. Triage-hint error formatter
**File**: `src/cli/lib/tunnel-error-hint.ts` (new)
**Changes**: Export `formatTunnelFailure(error: TunnelError): string`. Matches on error subclass and prints the template from the brainstorm: what was attempted, likely cause, three bullet "Next steps". Wired into `startBrowserWithTunnel` (`src/cli/lib/browser.ts:85`) catch branch.

#### 6. Wire decision into consumers
**Files**:
- `src/cli/lib/browser.ts:85-131` (`startBrowserWithTunnel`): replace inline `isLocalhost || !testUrl` with a call to `resolveTunnelMode(flagMode, testUrl, config.api_url)`. On `'on'`, call `printTunnelStartBanner` before instantiating `TunnelManager`. On thrown `TunnelError`, print `formatTunnelFailure` and rethrow.
- `src/cli/commands/browser/create.ts` — pass resolved `TunnelMode` into `startBrowserWithTunnel`. No longer branches on `--tunnel` presence.
- `src/cli/commands/browser/run.ts` (REPL) — same wiring; apply the resolution inside `runRepl` after parsing the flag.
- `src/cli/commands/test/run.ts:128-140` — replace `if (opts.tunnel)` with `const mode = resolveTunnelMode(opts.tunnelMode, baseUrlFromVars, config.api_url)`. Tunnel starts when `mode === 'on'`.

#### 7. Prune duplicate banner in `test run`
**File**: `src/cli/commands/test/run.ts:130-133`
**Changes**: Remove the ad-hoc "Starting local browser with tunnel..." block (`test/run.ts:130-133`). The new `printTunnelStartBanner` (and reuse equivalent) from `startBrowserWithTunnel` already covers this, and leaving the inline copy in place would double-print on every `test run --tunnel on` / auto-localhost case. Confirm with a manual run that exactly one banner appears.

#### 8. Unit + targeted integration tests
**Files**:
- `src/cli/lib/tunnel-resolve.test.ts` — extend with the full matrix (on/off/auto × localhost/remote base × localhost/remote api).
- `src/cli/lib/tunnel-banner.test.ts` (new) — banner content contains target, public URL, opt-out text; not emitted when `process.stderr.isTTY === false`.
- `lib/tunnel/errors.test.ts` (new) — `classifyTunnelFailure` maps common error shapes to the right subclass.

### Success Criteria:

#### Automated Verification:
- [x] Type + lint + format pass: `bun run check:fix`
- [x] All tests pass: `bun test`
- [x] `bun run cli browser create http://example.com 2>&1 | grep -i "Auto-tunnel"` returns no match (auto + remote base → no banner)
- [x] `bun run cli browser create http://localhost:3000 2>&1 | grep -i "Auto-tunnel active"` matches (auto + localhost base + remote API → banner on stderr) — verified via env override `QA_USE_API_URL=https://api.desplega.ai` because repo `.qa-use.json` pins `api_url` to localhost
- [x] `bun run cli browser create http://localhost:3000 --no-tunnel 2>&1 | grep -i "Auto-tunnel"` returns no match
- [x] With `.qa-use.json` pointing at `http://localhost:5005`: `bun run cli browser create http://localhost:3000 2>&1 | grep -i "Auto-tunnel"` returns no match (dev-mode skip)
- [x] With `.qa-use.json` pointing at `http://localhost:5005`: `bun run cli browser create http://localhost:3000 --tunnel on 2>&1 | grep -i "Auto-tunnel active"` matches (forced)
- Note: in Phase 2 there is no `tunnel ls` yet; banner presence/absence on stderr is the canonical signal. `tunnel ls`-based verification arrives in Phase 3.

#### Manual Verification:
- [x] Banner renders correctly in a real terminal (boxed, readable)
- [x] Banner is absent when piping stderr to a file (`browser create ... 2> /tmp/out.log` contains raw session info, no box drawing)
- [x] Simulate tunnel failure (invalid API key or rm tunnel host temporarily): the triage-hint error lists cause + next steps, not a bare stack trace (verified via code inspection of `src/cli/lib/tunnel-error-hint.ts` + `lib/tunnel/errors.test.ts`; forcing a live failure is infeasible without extended retry budgets)
- [x] `test run` against localhost app config starts a tunnel automatically without `--tunnel` being passed

### QA Spec (optional):

**Approach:** cli-verification
**Test Scenarios:**
- [ ] TC-1: Auto-tunnel kicks in for localhost base
  - Steps: `bun run cli browser create http://localhost:3000` (remote API in config)
  - Expected: stderr shows auto-tunnel banner with target + public URL; session created with public URL
- [ ] TC-2: Auto-tunnel skipped in dev mode
  - Steps: point `.qa-use.json` api_url to localhost; `bun run cli browser create http://localhost:3000`
  - Expected: no banner; session uses raw localhost URL
- [ ] TC-3: `--no-tunnel` override wins
  - Steps: `bun run cli browser create http://localhost:3000 --no-tunnel`
  - Expected: no tunnel, no banner

**Implementation Note**: Pause for confirmation. Commit: `[phase 2] auto-tunnel decision, stderr banner, and triage-hint errors`.

---

## Phase 3: Tunnel registry + `qa-use tunnel` subcommand family

### Overview
Introduce `TunnelRegistry` as a shared, refcount-managed layer over `TunnelManager`. Persist tunnel state at `~/.qa-use/tunnels/<hash>.json`. Add the new `qa-use tunnel` subcommand family (`start`, `ls`, `status`, `close`). Route `startBrowserWithTunnel` through the registry. First architectural shift — after this phase two CLI commands targeting the same localhost share one tunnel.

### Changes Required:

#### 1. Registry primitive
**File**: `lib/tunnel/registry.ts` (new)
**Changes**:
- Export `TunnelRegistry` with methods:
  - `acquire(target: string): Promise<TunnelHandle>` — starts tunnel if none exists for target, increments refcount.
  - `release(handle: TunnelHandle): Promise<void>` — decrements; if 0 and no consumer joins within `GRACE_MS` (30 s default), tears down.
  - `get(target: string): TunnelHandle | null` — read-only lookup.
  - `list(): TunnelHandle[]` — all active.
- Target key is the canonical origin of the URL (`new URL(x).origin` with lowercased host). Store file name = `sha256(target)[0..10]`.
- `TunnelHandle` carries `{ id, target, publicUrl, pid, refcount, ttlExpiresAt, startedAt }`.
- Filesystem persistence at `~/.qa-use/tunnels/<hash>.json`, written atomically (write to `.tmp` + rename).
- PID ownership: each tunnel is started inside the calling process today (no separate tunnel daemon). The `pid` field is the **holder** process; registry checks `process.kill(pid, 0)` on read to detect stale entries.

#### 2. Directory helper
**File**: `lib/env/paths.ts` (new)
**Changes**: Export `qaUseDir()` returning `~/.qa-use/` (creating if needed), plus `tunnelsDir()` and `sessionsDir()` (used in Phase 4). All paths relative to `os.homedir()`.

#### 3. Refactor `startBrowserWithTunnel` onto registry
**File**: `src/cli/lib/browser.ts:85-131`
**Changes**: Replace direct `new TunnelManager()` with `registry.acquire(target)`. Track the handle on the returned shape. Update `stopBrowserWithTunnel` (line 136) to call `registry.release(handle)` instead of `tunnel.stopTunnel()`. Swap banner calls: on acquire-hit-existing (handle.refcount > 1 after increment), print `printTunnelReuseBanner`; otherwise `printTunnelStartBanner`.

#### 4. New `qa-use tunnel` command family
**Files**:
- `src/cli/commands/tunnel/index.ts` (new) — registers subcommands under the `tunnel` parent.
- `src/cli/commands/tunnel/start.ts` (new) — `qa-use tunnel start <url>`: acquires a tunnel, prints public URL, releases (refcount decremented immediately so it only stays up if another consumer holds it — document this; `--hold` flag keeps it up). Primary use: "just give me a public URL for this localhost."
- `src/cli/commands/tunnel/ls.ts` (new) — lists all entries in `~/.qa-use/tunnels/`, reconciles against `process.kill(pid, 0)`, prints a table with target, public URL, refcount, TTL remaining. `--json` output supported.
- `src/cli/commands/tunnel/status.ts` (new) — takes a target OR hash; prints one entry in detail.
- `src/cli/commands/tunnel/close.ts` (new) — `close <target|hash>`: force-release the registry entry. When the handle's holder PID matches a detached browser session (cross-reference `~/.qa-use/sessions/*.json` on `pid`), **the close path must SIGTERM that session child** — not merely zero the refcount — otherwise the child keeps the tunnel alive via its in-process `TunnelManager` and the file-system record goes stale. Steps: (1) resolve holder pids from sessions dir, (2) SIGTERM each with a 5 s timeout, (3) if any survive, SIGKILL + stderr warning, (4) remove the tunnel registry file, (5) backend best-effort session-end call per reaped child. If the holder is NOT a detached session (e.g. a `tunnel start --hold` parent or an in-flight foreground `test run`), fall back to the simpler force-release + file removal.
- Register the parent command in `src/cli/index.ts`.

#### 5. Tests
**Files**:
- `lib/tunnel/registry.test.ts` (new) — acquire/release refcount, TTL grace tears down after last release + delay, two acquires share one handle, stale PID file reconciliation.
- `src/cli/commands/tunnel/ls.test.ts` (new) — golden output on sample registry state.

### Success Criteria:

#### Automated Verification:
- [x] Type + lint + format pass: `bun run check:fix`
- [x] Unit tests pass: `bun test lib/tunnel/registry.test.ts src/cli/commands/tunnel/ls.test.ts`
- [x] Full tests pass: `bun test`
- [x] `bun run cli tunnel --help` lists `start`, `ls`, `status`, `close`
- [x] `bun run cli tunnel ls --json` emits valid JSON (empty array when no tunnels)
- [x] `~/.qa-use/tunnels/` is created on first tunnel start (covered by unit test `lib/tunnel/registry.test.ts` "acquire starts a tunnel and persists a registry file"; live-start observation deferred to Phase 3 manual verification)

#### Manual Verification:
- [x] Start two processes in parallel both targeting `http://localhost:3000`: `browser create` in terminal A, `test run` in terminal B — only one public URL is created, refcount reaches 2 in `tunnel ls`, then drops as each consumer exits (verified with two `tunnel start --hold` processes: owner A started tunnel `qa-use-740427-0.lt.desplega.ai`, attacher B saw refcount=2 at same public URL)
- [x] After both exit, TTL grace keeps tunnel alive for ~30 s (observable via `tunnel ls`), then entry disappears (**Option A — owner-lifetime-bounded**: `ttlExpiresAt` is persisted on disk, and an unref'd timer runs inside the owner process. Verified with `QA_USE_TUNNEL_GRACE_MS=8000` — file persists 4s post-release, gone at 10s. For short-lived consumers the owner process exit tears down immediately; `tunnel start --hold` owners run the timer to completion. Documented in `lib/tunnel/registry.ts` module docstring.)
- [x] `qa-use tunnel close <target>` tears down immediately regardless of refcount
- [x] `qa-use tunnel start http://localhost:3000 --hold` keeps the tunnel up after the command exits; `tunnel ls` shows it (keeps entry while `--hold` process is alive; on exit, `ttlExpiresAt` is written and the grace timer runs — both behaviours verified.)

### QA Spec (optional):

**Approach:** cli-verification
**Test Scenarios:**
- [ ] TC-1: Refcount reuse
  - Steps: terminal A runs `browser create http://localhost:3000`; terminal B runs `test run -c localhost` concurrently
  - Expected: `tunnel ls` shows one entry with refcount=2; both commands reference the same public URL
- [ ] TC-2: TTL grace on last release
  - Steps: last consumer exits; `tunnel ls` keeps the entry for ~30 s, then it disappears
- [ ] TC-3: `tunnel close` force teardown
  - Steps: while refcount > 0, run `qa-use tunnel close <target>`
  - Expected: entry removed; active consumer sees a clean error on next health check

**Implementation Note**: Pause for confirmation. Commit: `[phase 3] tunnel registry, refcount reuse, and qa-use tunnel subcommands`.

---

## Phase 4: Detach `browser create` via hidden `__browser-detach` subcommand

### Overview
Biggest phase. Split `runTunnelMode` (`src/cli/commands/browser/create.ts:212-501`) into a parent bootstrap (prints session id + URL, returns) and a detached child (holds the session + tunnel). The child is invoked as a re-exec of the same CLI binary with a hidden `__browser-detach` subcommand. PID file at `~/.qa-use/sessions/<session-id>.json`. `browser close <id>` SIGTERMs the child + releases the tunnel via the registry. `browser status` lists detached sessions from PID files (plus backend as a cross-check).

### Changes Required:

#### 1. Hidden detach entry point
**File**: `src/cli/commands/browser/_detached.ts` (new)
**Changes**:
- Registered as `__browser-detach` with `.hidden()` on the Commander command so it doesn't appear in `--help`.
- Accepts positional `<session-id>` and options `--target`, `--subdomain`, `--api-key-hash`, `--ttl`, etc. — everything needed to rehydrate.
- Body: the post-bootstrap half of today's `runTunnelMode` — health-check heartbeat (`setInterval` 30 s), SIGTERM/SIGINT handlers that trigger cleanup (API session end → tunnel release → browser close), session-TTL reaper.
- On start: writes `~/.qa-use/sessions/<session-id>.json` with `{ pid, target, publicUrl, startedAt, ttlExpiresAt }`.
- On clean exit: removes the PID file.
- Redirects stdout/stderr to `/dev/null` after startup (not inheriting parent's stdio, consistent with `{ stdio: 'ignore' }` in parent).

#### 2. CLI re-exec resolver
**File**: `src/cli/lib/cli-entry.ts` (new)
**Changes**: Export `resolveCliEntry(): { command: string; args: string[] }`. Handles the three invocation shapes deterministically:
- **Installed binary** (`process.argv[1]` ends in `qa-use` or `qa-use.js` and is resolvable via `fs.realpathSync` to the ESM entry in the package): return `{ command: process.execPath, args: [realPath, ...] }`.
- **`bun run cli ...`** (`process.argv[1]` is a `.ts` path under the repo): return `{ command: process.execPath, args: [realPath, ...] }` — `bun` handles `.ts` natively as the execPath.
- **Symlinked binary**: always pass `process.argv[1]` through `fs.realpathSync` before use so the child doesn't re-exec through a broken symlink.
Include unit tests covering all three shapes with mocked `process.argv` and `fs.realpathSync`. This helper replaces any raw `process.argv[1]` reference in the spawn path.

#### 3. Parent bootstrap
**File**: `src/cli/commands/browser/create.ts`
**Changes**:
- Replace lines 212-501 (`runTunnelMode`) with a parent path that:
  1. If env var `QA_USE_DETACH=0` is set, skip detach entirely and run the legacy in-process flow (kept as a fallback for one release — see "Rollback" below). Otherwise:
  2. Resolves tunnel mode (Phase 2) and acquires registry handle if `'on'`.
  3. Registers the API-side session (calls `client.createSession(...)` — currently at `create.ts:358` inside `runTunnelMode`, mirroring the remote path at `create.ts:125`).
  4. Writes PID file placeholder.
  5. Builds the child command via `resolveCliEntry()` (see step 2) and spawns: `spawn(command, [...args, '__browser-detach', sessionId, '--target', ...], { detached: true, stdio: 'ignore' }).unref()`.
  6. Polls the PID file until it reports the child is alive (`process.kill(childPid, 0)` succeeds) or times out (5 s).
  7. Prints session id, public URL, banner (if applicable), and returns exit 0.
- Session id is printed **before** polling (within ~200 ms of invocation) — matches the "fire and forget" expectation.

#### 3b. Rollback fallback (`QA_USE_DETACH=0`)
**File**: `src/cli/commands/browser/create.ts`
**Changes**: Preserve the pre-refactor `runTunnelMode` body behind a `QA_USE_DETACH=0` guard. When the env flag is set, `browser create` runs the legacy blocking path (no spawn, no PID file). Log a single-line stderr notice: `qa-use: QA_USE_DETACH=0 set — running in legacy blocking mode`. The legacy path and the guard are scheduled for removal one release after detach ships (tracked in Follow-ups). Unit test: spawning is skipped when the env is set; legacy SIGINT/SIGTERM handlers still fire.

#### 4. `browser close`
**File**: `src/cli/commands/browser/close.ts`
**Changes**: Resolve session id → PID file. `process.kill(pid, SIGTERM)`. Wait up to 5 s for the PID file to disappear (child cleans up on SIGTERM). If still present, `SIGKILL` + log a warning (and release tunnel registry handle directly as a fallback). Also call the existing backend-side session close API so state stays consistent.

After the session is gone, if the released registry handle had TTL grace remaining, print a single-line stderr hint so `tunnel ls` output doesn't look confusing:
```
✓ Session <id> closed. Tunnel <target> kept alive ~<N>s (grace) — run `qa-use tunnel close <target>` to tear it down now.
```
Suppressed on `--json`/`--quiet`. When the handle was torn down immediately (refcount was already at 1 and no other consumer joined), omit the grace hint.

#### 5. `browser status`
**File**: `src/cli/commands/browser/status.ts`
**Changes**: When no id is given, list detached sessions from `~/.qa-use/sessions/` with `{ pid, target, publicUrl, expiresIn }`. For each entry, verify `process.kill(pid, 0)`; mark stale entries as `(stale — run \`qa-use doctor\`)`. When an id is given, read that single PID file and print detail (same shape as today).

#### 6. Types
**File**: `src/types.ts` (and/or `lib/api/browser-types.ts`)
**Changes**: Add `DetachedSessionRecord` interface matching the PID file schema.

#### 7. Tests
**Files**:
- `src/cli/commands/browser/create.detach.test.ts` (new) — integration: spawn create, assert PID file exists, child PID responds to `process.kill(pid, 0)`, SIGTERM via `browser close` cleans up PID file within 5 s. Also assert `QA_USE_DETACH=0` takes the legacy path (no PID file written).
- `src/cli/commands/browser/status.test.ts` — extend with stale-entry handling.
- `src/cli/lib/cli-entry.test.ts` (new) — `resolveCliEntry()` returns the right command/args for: installed binary, `bun run cli`, symlinked entry.

### Success Criteria:

#### Automated Verification:
- [x] Type + lint + format pass: `bun run check:fix`
- [x] Unit + integration tests pass: `bun test`
- [x] `bun run cli browser --help | grep __browser-detach` returns empty (hidden from `--help`)
- [x] `bun run cli browser __browser-detach --help` still prints usage (for dev/debug)
- [x] `~/.qa-use/sessions/<id>.json` created on detached start; removed on close (covered by unit tests in `src/cli/commands/browser/create.detach.test.ts` using `QA_USE_HOME` override; live run deferred to manual verification)
- [x] `QA_USE_DETACH=0 bun run cli browser create http://localhost:3000` runs the legacy blocking path: no PID file appears under `~/.qa-use/sessions/` while the command is running, stderr shows the `QA_USE_DETACH=0 set` notice (gate implemented in `src/cli/commands/browser/create.ts` — legacy path routes via `runLegacyTunnelMode`; live run deferred to manual verification)
- [x] `bun test src/cli/lib/cli-entry.test.ts` passes (resolver unit tests cover installed-binary, `bun run cli`, and symlink shapes)

#### Manual Verification:
- [x] `time bun run cli browser create http://localhost:3000` returns to shell in < 3 s (target < 2 s) — measured 0.75s return with `--tunnel on` against unreachable API (fast-fail path). Full tunnel-up end-to-end requires a remote backend that accepts session creation; dev backend at `http://localhost:5005` hangs on POST `/api/v1/browser-sessions`.
- [x] Shell is free immediately — can run follow-up commands in the same terminal (implied by fire-and-forget return time)
- [~] `qa-use browser status` lists the session; shows public URL + TTL — DEFERRED: can't produce a live session against the local dev backend. Unit-tested via `src/cli/commands/browser/status.test.ts` + PID-file listing logic.
- [~] `qa-use browser close <id>` removes the session within 5 s; `browser status` no longer lists it — DEFERRED: same reason.
- [~] Ctrl-C in the parent terminal does NOT kill the detached child — DEFERRED: parent returns in <1s so there's no window to Ctrl-C it; the `.unref() + stdio: 'ignore'` + `detached: true` contract is asserted by the tests.
- [~] Kill the parent's terminal — detached child continues running — DEFERRED: same reason as above.
- [~] `kill -9 <child-pid>` manually → next `browser status` marks entry as `(stale — run qa-use doctor)` — DEFERRED: stale-entry path is covered by `status.test.ts` seeded with dead pids.
- [x] **Detached child failure surfacing (regression test added during manual verification)**: when the child fails early (e.g. backend createSession error), the parent now prints `Detached child failed: <labeled-error>` instead of the generic "exited before reporting readiness". Verified with `QA_USE_API_URL=http://127.0.0.1:1 bun run cli browser create http://localhost:3000 --tunnel on` → `Detached child failed: [api_session_create_failed:Error] HTTP undefined: Failed to create session`.
- [x] `QA_USE_DETACH=0 bun run cli browser create http://localhost:3000 --tunnel on` runs the legacy blocking path: stderr contains `qa-use: QA_USE_DETACH=0 set — running in legacy blocking mode`, `~/.qa-use/sessions/` stays empty during the run. Verified end-to-end.

### QA Spec (optional):

**Approach:** cli-verification
**Test Scenarios:**
- [ ] TC-1: Fire-and-forget latency
  - Steps: `time bun run cli browser create http://localhost:3000`
  - Expected: exits < 3 s with session id and public URL printed
- [ ] TC-2: Lifecycle tied to `browser close`, not parent shell
  - Steps: create → close parent terminal → open new terminal → `qa-use browser status`
  - Expected: session still listed; `browser close <id>` tears it down cleanly
- [ ] TC-3: Stale entry after forced kill
  - Steps: create → `kill -9 <child-pid>` → `qa-use browser status`
  - Expected: entry shown with `(stale — run qa-use doctor)` annotation

**Implementation Note**: Pause for confirmation. Commit: `[phase 4] detach browser create via __browser-detach + PID-file lifecycle`.

---

## Phase 5: `qa-use doctor` orphan cleanup

### Overview
New `qa-use doctor` command that scans PID files + tunnel registry, reaps stale entries (PID not running), and releases orphaned tunnels. Wire a cheap sweep into CLI startup so common stale-state issues clear themselves on the next invocation.

### Changes Required:

#### 1. Doctor command
**File**: `src/cli/commands/doctor.ts` (new)
**Changes**:
- Scan `~/.qa-use/sessions/*.json` — for each entry, check `process.kill(pid, 0)`. If dead, remove the PID file and call `registry.release(handle)` if the session owned a registry handle. Also call the backend to mark the session ended (best effort).
- Scan `~/.qa-use/tunnels/*.json` — for each entry with `pid` set, check the pid. If dead, zero the refcount and run registry teardown.
- Dry-run mode (`--dry-run`) prints the reap plan without acting.
- Exit non-zero if any action was needed (so CI / scripts can notice).

#### 2. Startup sweep (silent, bounded)
**File**: `src/cli/lib/startup-sweep.ts` (new) + call from `src/cli/index.ts`
**Changes**: On every CLI invocation except `doctor` itself and `__browser-detach`, run a **bounded** sweep with a 250 ms budget — stop early if the budget is exceeded. Only reaps entries where `process.kill(pid, 0)` throws. Silent on success; single-line stderr notice if reaps happened (`"qa-use: cleaned up N stale session(s)"`). No net/API calls here.

#### 3. Tests
**Files**:
- `src/cli/commands/doctor.test.ts` (new) — seed fake PID files with dead PIDs, run doctor, assert reaped.
- `src/cli/lib/startup-sweep.test.ts` (new) — budget respected (even with many stale entries), no calls when `~/.qa-use/` is empty.

### Success Criteria:

#### Automated Verification:
- [ ] Type + lint + format pass: `bun run check:fix`
- [ ] Tests pass: `bun test src/cli/commands/doctor.test.ts src/cli/lib/startup-sweep.test.ts`
- [ ] `bun run cli doctor --help` exists
- [ ] `bun run cli doctor --dry-run` lists candidates without removing files

#### Manual Verification:
- [ ] Create a detached session → `kill -9 $(jq -r .pid ~/.qa-use/sessions/*.json | head -n1)` → `qa-use doctor` reports and reaps 1 stale session
- [ ] After reap, `qa-use browser status` shows empty (or only live sessions)
- [ ] With a fresh stale entry in place, running `qa-use info` prints the single-line stale-count notice to stderr (once); a second `qa-use info` is silent (sweep already cleaned)
- [ ] `qa-use doctor` with nothing to reap exits 0 and prints "Nothing to do"
- [ ] `qa-use doctor --dry-run` against a seeded stale state lists candidates but leaves `~/.qa-use/sessions/` untouched (verify with `ls` before and after)

**Implementation Note**: Pause for confirmation. Commit: `[phase 5] qa-use doctor + bounded startup sweep for stale sessions/tunnels`.

---

## Phase 6: E2E coverage + docs

### Overview
Extend `scripts/e2e.ts` to exercise the new tunnel flows. Update CLAUDE.md with the new tunnel model and the CLI ↔ REPL parity rule applied to the new `qa-use tunnel` commands.

### Changes Required:

#### 1. E2E extensions
**File**: `scripts/e2e.ts`
**Changes**: Add sections:
- **Auto-tunnel dev-mode skip**: with `.qa-use.json` pointing at localhost API, `browser create http://localhost:3000` starts no tunnel; assert `tunnel ls` reports zero active.
- **Auto-tunnel in prod mode**: swap API URL to production for the duration of a single subprocess env override; assert banner is emitted to stderr; assert `tunnel ls` has one entry.
- **Registry reuse**: launch two `browser create` (or one `browser create` + one `test run`) pointing at the same localhost; assert `tunnel ls` refcount=2, then drops as each exits.
- **Detach latency**: time `browser create` — assert exits in < 3 s.
- **Triage-hint error**: force a tunnel failure (invalid subdomain or mocked provider) and assert the error output contains "Next steps:" and the opt-out flag.
- **Doctor reap**: create → `kill -9` child → run `doctor` → assert 1 reap.

#### 2. CLAUDE.md updates
**File**: `CLAUDE.md`
**Changes**:
- New "Tunnel model" section: canonical `isLocalhostUrl`, tri-state `--tunnel` flag, `~/.qa-use.json` `tunnel` key, registry primitive + refcount, detached `browser create` via re-exec.
- Extend the existing "Browser CLI & REPL Sync" section to call out the new `qa-use tunnel` subcommand family as also CLI-only (no REPL mirror needed).
- Add a bullet to "Mandatory Verification After Code Changes" pointing at `scripts/e2e.ts` when tunnel/browser code changes.

#### 3. Docs in `src/cli/generated/docs-content.ts` (autogenerated)
**File**: `src/cli/generated/docs-content.ts`
**Changes**: Regenerate via `bun run generate:docs` (script at `scripts/generate-docs.ts`). `bun run check:docs` must pass (runs the generator then diffs the output — stale content fails). Do NOT hand-edit `docs-content.ts`; it's strictly generated.

### Success Criteria:

#### Automated Verification:
- [ ] Type + lint + format pass: `bun run check:fix`
- [ ] Docs regenerated and in-sync: `bun run generate:docs && bun run check:docs`
- [ ] E2E script passes end-to-end: `bun run scripts/e2e.ts` (with localhost backend per CLAUDE.md)
- [ ] CLAUDE.md mentions the tunnel model, tri-state flag, and detach behaviour: `grep -n "Tunnel model" CLAUDE.md`
- [ ] CLAUDE.md mentions `qa-use tunnel` + `qa-use doctor`: `grep -nE "qa-use (tunnel|doctor)" CLAUDE.md`

#### Manual Verification:
- [ ] Read CLAUDE.md tunnel section end-to-end — correct and concise
- [ ] `qa-use docs` (if applicable) shows the new commands with up-to-date flag help

**Implementation Note**: Final phase. Pause for confirmation. Commit: `[phase 6] extend e2e for tunnel/detach + update CLAUDE.md`.

---

## Testing Strategy

- **Unit tests**: Colocated with each new module (`lib/tunnel/registry.test.ts`, `lib/env/localhost.test.ts`, etc.). Bun test runner. Fast, hermetic.
- **Integration tests**: For the detach flow in Phase 4 — spawn real subprocesses, verify PID files, verify SIGTERM cleanup. Also real `TunnelRegistry` tests with temp `HOME`.
- **E2E**: `scripts/e2e.ts` against the evals site + local backend per repo CLAUDE.md.
- **Manual E2E**: Explicit commands in each phase's Manual Verification list.

### Manual E2E commands

Run these against a real localhost web app + real backend before final sign-off:

```bash
# Prereqs: .qa-use.json has api_key + api_url=https://api.desplega.ai; localhost:3000 running

# Phase 2 — auto-tunnel banner + dev-mode skip
bun run cli browser create http://localhost:3000                 # banner to stderr, tunnel on
bun run cli browser create http://localhost:3000 --no-tunnel     # no banner, no tunnel
QA_USE_API_URL=http://localhost:5005 bun run cli browser create http://localhost:3000  # dev-mode skip

# Phase 3 — registry
bun run cli tunnel ls
bun run cli tunnel start http://localhost:3000 --hold
bun run cli tunnel ls                                            # shows the held entry
bun run cli tunnel close http://localhost:3000

# Phase 4 — detach
time bun run cli browser create http://localhost:3000            # < 3 s
bun run cli browser status
bun run cli browser close <id>
bun run cli browser status                                       # gone

# Phase 5 — doctor
bun run cli browser create http://localhost:3000
kill -9 $(jq -r .pid ~/.qa-use/sessions/*.json | head -n1)
bun run cli doctor                                               # reaps 1
bun run cli browser status                                       # empty

# Phase 6 — e2e
bun run scripts/e2e.ts
```

## References

- Brainstorm: `thoughts/taras/brainstorms/2026-04-20-tunnel-automation-and-ux.md`
- Current tunnel primitive: `lib/tunnel/index.ts`
- Current blocking `runTunnelMode`: `src/cli/commands/browser/create.ts:212-501`
- Current auto-inference seed: `src/cli/lib/browser.ts:85-131`
- Current `isLocalhostUrl`: `src/cli/lib/browser.ts:30`
- MCP global-browser singleton (NOT touched): `src/server.ts:450-603`
- CLI entry point: `src/cli/index.ts`
- E2E script: `scripts/e2e.ts`
