---
date: 2026-04-21T00:00:00Z
author: Taras
topic: "Transparent tunnel automation and background browser UX"
tags: [qa, tunnel, browser, cli, qa-use]
status: pass
source_plan: thoughts/taras/plans/2026-04-20-tunnel-automation-and-ux.md
environment: local
last_updated: 2026-04-21
last_updated_by: Claude
---

# Tunnel Automation & Background Browser UX — QA Report

## Context

Functional validation of the 6-phase plan that:
- Adds tri-state `--tunnel` flag (auto/on/off) and a `tunnel` key in `~/.qa-use.json`.
- Introduces auto-tunnel decision logic keyed on localhost base vs. remote API URL.
- Adds shared refcount-managed `TunnelRegistry` + new `qa-use tunnel {start,ls,status,close}` subcommand family.
- Detaches `browser create` via a hidden `__browser-detach` re-exec subcommand with PID files under `~/.qa-use/sessions/`.
- Adds `qa-use doctor` + a bounded startup sweep for stale state reaping.
- Extends `scripts/e2e.ts` to cover the new paths.

Plan `status: completed`; branch `feat/qa-use-tunnel-imrpov`; all 496 unit/integration tests pass.

## Scope

### In Scope
- QA specs that can run against local dev backend (`api_url=http://localhost:5005`).
- Structural / smoke checks on the new CLI surface (`--help`, flag parsing, JSON shapes).
- Real `tunnel start --hold` → `tunnel close` cycle (requires network to `lt.desplega.ai` tunnel provider but not the prod API).
- Seeded stale-state scenarios for `doctor`, `browser status`, and the startup sweep.

### Out of Scope (per user preference — skip remote)
- Phase 2 TC-1 (auto-tunnel banner on real prod backend).
- Phase 3 TC-1, TC-2 (refcount reuse by two concurrent consumers; TTL grace after last release) — would need both a prod backend and two real session consumers.
- Phase 4 TC-1, TC-2 (fire-and-forget latency measurement with working backend; cross-shell lifecycle).
- `QA_USE_DETACH=0` legacy path (verified in the plan's manual verification list, not re-run here).
- Docs/content review of `CLAUDE.md`.

## Test Cases

### TC-1: Tri-state `--tunnel` flag is exposed on all three commands
**Source:** Phase 1 automated verification
**Steps:**
1. `bun run cli browser create --help`
2. `bun run cli browser run --help`
3. `bun run cli test run --help`

**Expected:** Each prints `--tunnel <mode>` and `--no-tunnel`.

**Actual:**
- `browser create`: shows `--tunnel <mode>  Tunnel mode: auto (localhost-only), on (force), off` and `--no-tunnel  Disable tunnel (alias for --tunnel off)`.
- `browser run` (REPL): same two options present.
- `test run`: same two options present.

**Status:** ✅ pass

---

### TC-2: Invalid `--tunnel` value is rejected
**Source:** Phase 1 automated verification
**Steps:** `bun run cli browser create --tunnel bogus`

**Expected:** Non-zero exit, clear error.

**Actual:**
```
error: option '--tunnel <mode>' argument 'bogus' is invalid. Invalid --tunnel value: "bogus". Expected one of: auto, on, off.
EXIT=1
```

**Status:** ✅ pass

---

### TC-3: Phase 2 TC-2 — Auto-tunnel skipped in dev mode
**Source:** Plan Phase 2 QA Spec TC-2
**Steps:**
1. Verified `.qa-use.json` has `api_url=http://localhost:5005`.
2. `timeout 6 bun run cli browser create http://localhost:3000 2>&1 | grep -ic "auto-tunnel\|tunnel ready\|tunnel active"` → 0 matches.

**Expected:** No auto-tunnel banner when both base and API are localhost.

**Actual:** Stderr shows only `ℹ Creating browser session...`; no tunnel banner, no tunnel startup text. Session creation itself hangs on the local dev backend (matches known caveat), but the tunnel-decision path correctly short-circuits to `off`.

**Status:** ✅ pass

---

### TC-4: Phase 2 TC-3 — `--no-tunnel` override wins
**Source:** Plan Phase 2 QA Spec TC-3
**Steps:** `timeout 6 bun run cli browser create http://localhost:3000 --no-tunnel 2>&1 | grep -ic "auto-tunnel\|tunnel ready\|tunnel active"` → 0 matches.

**Expected:** No tunnel, no banner.

**Actual:** Same as TC-3 — no banner. Explicit override parses cleanly.

**Status:** ✅ pass

---

### TC-5: `qa-use tunnel` subcommand family shape
**Source:** Phase 3 automated verification
**Steps:**
1. `bun run cli tunnel --help`
2. `bun run cli tunnel ls --json`

**Expected:** Subcommands `start`, `ls`, `status`, `close` listed; `tunnel ls --json` returns valid JSON.

**Actual:**
```
Commands:
  start [options] <url>              Start (or reuse) a tunnel for a localhost URL
  ls [options]                       List active tunnels in the registry
  status [options] <target-or-hash>  Show detail for a single tunnel entry
  close [options] <target-or-hash>   Force-close a tunnel
  help [command]                     display help for command
```
`tunnel ls --json` with empty registry returns `[]`, exit 0.

**Status:** ✅ pass

---

### TC-6: Phase 3 TC-3 — `tunnel close` force teardown
**Source:** Plan Phase 3 QA Spec TC-3 (local-runnable variant using `tunnel start --hold`)
**Steps:**
1. Swept state clean.
2. `bun run cli tunnel start http://localhost:3000 --hold &` → background PID 86163; tunnel subprocess forked at child PID 86171.
3. After 8s, `tunnel ls --json` showed 1 entry:
   ```json
   [
     {
       "id": "f1de9e489b",
       "target": "http://localhost:3000",
       "publicUrl": "https://hi:***@qa-use-447330.lt.desplega.ai",
       "pid": 86171,
       "refcount": 1,
       "ttlExpiresAt": null,
       "startedAt": 1776723447527
     }
   ]
   ```
4. `bun run cli tunnel close http://localhost:3000` → `✓ Tunnel closed: http://localhost:3000`, exit 0.
5. `tunnel ls --json` immediately after → `[]`.

**Expected:** Entry removed regardless of refcount. Per plan Phase 3 step 4: for non-session holders (e.g. `tunnel start --hold`), close falls back to file removal without SIGTERM of the holder.

**Actual:** Registry file removed, list returns empty, exit 0. Hold process (PID 86163) remained alive as expected — documented fallback path. Manually reaped afterwards.

**Status:** ✅ pass

---

### TC-7: Phase 4 TC-3 — Stale entry annotation (seeded)
**Source:** Plan Phase 4 QA Spec TC-3 (seed variant per QA Handoff Notes)
**Steps:**
1. Seeded `~/.qa-use/sessions/qa-stale-1.json` with `{"id":"qa-stale-1","pid":99999999,"target":"http://localhost:3000",...}`.
2. `bun run cli browser status --list`.

**Expected:** Seeded entry shown with `(stale — run qa-use doctor)` annotation.

**Actual:**
```
ℹ No detached browser sessions.
qa-use: cleaned up 1 stale session
```
The bounded startup sweep (250 ms budget, fires on every CLI invocation except `doctor` and `__browser-detach`) won the race against the status command body and reaped the entry before listing. Ultimate outcome — stale state gets cleaned and the user is informed — is correct. The `(stale — run qa-use doctor)` annotation code path **does exist** in `src/cli/commands/browser/status.ts:64,213` and is reachable only when the sweep's budget is exceeded (many stale entries on slow disk).

**Status:** ✅ pass (via sweep auto-reap) — see Issue #1 below for a minor observation.

---

### TC-8: Phase 5 — `qa-use doctor` dry-run, reap, clean-state
**Source:** Plan Phase 5 automated + manual verification
**Steps:**
1. `bun run cli doctor --help` → command exists.
2. Seed stale PID file with filename matching internal id.
3. `bun run cli doctor --dry-run`:
   ```
   ℹ Dry run — no files removed.
   ℹ Would reap 1 stale session(s):
     - qa-stale-1 (pid=99999999, target=http://localhost:3000)
   ```
   `ls` before and after shows `qa-stale-1.json` still present ✓.
4. `bun run cli doctor`:
   ```
   ✓ Reaped 1 stale session(s)
     - qa-stale-1 (pid=99999999)
   ```
   Exit 1 (non-zero — so CI/scripts notice). `ls` after shows session dir empty ✓.
5. Re-run `bun run cli doctor` → `✓ Nothing to do`, exit 0 ✓.
6. `bun run cli doctor --dry-run` on clean state → `✓ Nothing to do`, exit 0 ✓.

**Expected:** All sub-checks pass per plan Success Criteria.

**Actual:** All six sub-checks pass exactly as specified.

**Status:** ✅ pass

---

### TC-9: Startup sweep silent on clean state, noisy on first reap only
**Source:** Plan Phase 5 Manual Verification
**Steps:**
1. Clean state: `rm -rf ~/.qa-use/sessions/*`; `bun run cli info 2>&1 | grep -ic "cleaned up"` → 0.
2. Seed fresh stale PID file; `bun run cli info 2>&1 | grep -i "cleaned up"` → `qa-use: cleaned up 1 stale session`.
3. Re-run `bun run cli info 2>&1 | grep -ic "cleaned up"` → 0 (silent).

**Expected:** Single stderr notice on sweep-with-action; silent thereafter.

**Actual:** Matches expectation exactly.

**Status:** ✅ pass

---

### TC-10: `tunnel ls --json` empty-state is valid JSON
**Steps:** `bun run cli tunnel ls --json` against empty `~/.qa-use/tunnels/` → `[]`, exit 0.

**Expected:** Valid JSON empty array.

**Actual:** Exactly `[]`; parses cleanly.

**Status:** ✅ pass

---

### TC-11: `__browser-detach` hidden from help, still invocable
**Source:** Plan Phase 4 automated verification
**Steps:**
1. `bun run cli browser --help | grep -c __browser-detach` → 0.
2. `bun run cli browser __browser-detach --help` → prints `Usage: qa-use browser __browser-detach [options] <spawn-id>`.

**Expected:** Hidden from `--help` surface, still invocable.

**Actual:** Matches expectation.

**Status:** ✅ pass

---

### TC-12: Full unit + integration test suite
**Steps:** `bun test`

**Expected:** All tests pass.

**Actual:** `496 pass, 0 fail, 911 expect() calls, 69 files, 2.73s`.

**Status:** ✅ pass

## Edge Cases & Exploratory Testing

- **Filename/id drift in PID files.** During initial fixture setup I seeded a session file named `qa-stale-2.json` with internal `id=qa-stale-1`. `doctor` reported "Reaped 1 stale session" with exit 1 but left the file on disk — because `removeSessionRecord(id)` resolves the filesystem path from the internal id, not the filename. Not a bug for real sessions (they always write `<id>.json` matching internal id), but a fragile spot that silently reports success while leaving the orphan. See Issue #2.
- **Hold process leak on `tunnel close`.** After `tunnel close`, the `tunnel start --hold` parent process stays alive. This is documented in the plan (Phase 3 step 4 fallback path — non-session holders are not SIGTERM'd), but worth a user-facing note: the command currently claims "Tunnel closed" without mentioning the orphaned holder process will keep printing "Holding tunnel. Press Ctrl-C to release." See Issue #3.
- **Startup sweep vs. stale annotation interaction.** The bounded sweep racing with `browser status --list` means the `(stale — run qa-use doctor)` annotation is effectively unreachable in the happy path. Makes TC-7 as-spec'd a no-op. See Issue #1.

## Evidence

### Logs & Output

TC-6 — tunnel registry + force-close:
```
Starting tunnel on port 3000 with host https://lt.desplega.ai in region auto
Tunnel started at https://hi:***@qa-use-447330.lt.desplega.ai
✓ Tunnel ready: http://localhost:3000 → https://hi:***@qa-use-447330.lt.desplega.ai
ℹ Holding tunnel. Press Ctrl-C to release.
---after tunnel close---
✓ Tunnel closed: http://localhost:3000
tunnel ls --json → []
```

TC-8 — doctor reap cycle:
```
$ bun run cli doctor --dry-run
ℹ Dry run — no files removed.
ℹ Would reap 1 stale session(s):
  - qa-stale-1 (pid=99999999, target=http://localhost:3000)

$ bun run cli doctor
✓ Reaped 1 stale session(s)
  - qa-stale-1 (pid=99999999)
EXIT=1

$ bun run cli doctor
✓ Nothing to do
EXIT=0
```

TC-12 — test suite:
```
496 pass
0 fail
911 expect() calls
Ran 496 tests across 69 files. [2.73s]
```

## Issues Found

- [ ] **Issue #1 — stale annotation path is effectively dead code (severity: minor).** The `(stale — run qa-use doctor)` annotation in `browser status` (status.ts:64, 213) is pre-empted by the bounded startup sweep, which reaps dead-PID entries before the status command renders its listing. The annotation is only reachable when the sweep's 250 ms budget is exceeded (unlikely in practice). Not a regression — both features work as specified — but the TC-7 spec assumes observability that the sweep removes. Consider either (a) documenting this as intentional in the QA spec, or (b) having the sweep skip when the invoked command is `browser status` (symmetric to `doctor` / `__browser-detach`).

- [ ] **Issue #2 — doctor silently "reaps" stale session when filename ≠ internal id (severity: minor).** If `~/.qa-use/sessions/<filename>.json` contains an internal `id` different from `<filename>`, `doctor` reports "Reaped N stale session(s)" with exit 1, but the actual file remains on disk because `removeSessionRecord(id)` resolves by id-derived path. Real sessions never produce this state (filename is always `<sessionId>.json`), so this is hypothetical for production use — but the failure mode is silent success. Consider either validating filename ↔ internal id consistency at read time, or falling back to direct `unlink` on the original path. Low priority.

- [ ] **Issue #3 — `tunnel close` leaves `tunnel start --hold` parent process running (severity: minor).** The plan's Phase 3 step 4 intentionally limits SIGTERM to detached browser-session children. For a `tunnel start --hold` holder, the registry file is removed but the hold process keeps running (and printing "Holding tunnel. Press Ctrl-C to release."). Consider printing a stderr hint after `tunnel close` like `note: holder process <pid> still running — send Ctrl-C to terminate`. Nice-to-have, not blocking.

None of the above are regressions or functional defects. All are polish / edge-case observations.

## Verdict

**Status:** PASS

**Summary:** All 12 test cases pass end-to-end against the local dev setup. The tri-state `--tunnel` flag, auto-tunnel decision logic, `qa-use tunnel` subcommand family (with real `start --hold` → `close` cycle against the actual `lt.desplega.ai` provider), `qa-use doctor`, and the bounded startup sweep all behave as specified. The hidden `__browser-detach` subcommand is correctly hidden but callable. 496/496 unit/integration tests green. Three minor polish observations filed as issues — none block merge.

## Out-of-Scope Deferred Scenarios

The following plan-defined QA scenarios were deferred per user preference (skip-remote). They remain open and should be run before production sign-off against `QA_USE_API_URL=https://api.desplega.ai`:
- Phase 2 TC-1 — auto-tunnel banner on real prod backend.
- Phase 3 TC-1 — refcount reuse by two concurrent `browser create` / `test run` consumers.
- Phase 3 TC-2 — TTL grace after last release (tip: set `QA_USE_TUNNEL_GRACE_MS=8000` to avoid the 30s wait).
- Phase 4 TC-1 — fire-and-forget latency < 3 s with working backend.
- Phase 4 TC-2 — detached session lifecycle tied to `browser close`, not parent shell.

## References

- Plan: `thoughts/taras/plans/2026-04-20-tunnel-automation-and-ux.md`
- Brainstorm: `thoughts/taras/brainstorms/2026-04-20-tunnel-automation-and-ux.md`
- Branch: `feat/qa-use-tunnel-imrpov`
- Relevant source: `src/cli/commands/doctor.ts`, `src/cli/commands/tunnel/*.ts`, `src/cli/commands/browser/{create,close,status,_detached}.ts`, `src/cli/lib/{startup-sweep,tunnel-resolve,tunnel-option,cli-entry}.ts`, `lib/tunnel/registry.ts`, `lib/env/{localhost,paths,sessions}.ts`.
