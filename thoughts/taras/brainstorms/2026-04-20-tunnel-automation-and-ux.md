---
date: 2026-04-20T00:00:00Z
author: Taras
topic: "Transparent tunnel automation and background browser/test UX"
tags: [brainstorm, tunnel, browser, cli, ux, qa-use]
status: complete
exploration_type: workflow
last_updated: 2026-04-20
last_updated_by: Taras
---

# Transparent tunnel automation and background browser/test UX — Brainstorm

## Context

Taras wants to improve the QA test run and browser experience in qa-use, especially around tunneling. Current pain points:

1. **Tunnel is explicit and manual.** Users must pass flags like `--tunnel auto` or opt-in somehow. Taras wants this to be transparent and automatic — if the target is localhost (via app config or a localhost base URL), tunneling should be implied.
2. **Processes block the terminal.** Commands like `browser create` (and possibly `test run` against localhost) appear to run a blocking command that just waits for the session/tunnel to finish. Taras wants them to run in the background, "close to the browser" (co-located with the browser session lifecycle).
3. **Help / status messages don't signal localhost context.** When running against a localhost app config while the API URL is not localhost (i.e. not in dev mode), the user should get a clear signal that tunnel mode is implicit / necessary.

Relevant surface area (from repo CLAUDE.md):
- CLI entry points: `qa-use browser <cmd>`, `qa-use test run`, plus REPL (`qa-use browser run`). (`qa-use suite …` is cloud-only — not relevant for tunnel work.)
- Modes: stdio (MCP), HTTP/SSE, tunnel (persistent WebSocket).
- BrowserSession: browser + tunnel wrapper, 30min TTL, max 10 concurrent.
- Shared lib: `lib/tunnel/` (localtunnel wrapper), `lib/browser/` (Playwright).
- Config: `~/.qa-use.json` or env vars (`QA_USE_API_KEY`, `QA_USE_API_URL`, `QA_USE_REGION`).

## Exploration

### Q: What counts as 'localhost' for auto-tunnel detection — which signals should trigger it?
`base_url` is localhost (localhost, 127.0.0.1, 0.0.0.0, *.localhost) — scoped narrowly for now; skip LAN / .local / dev-tunnel hostnames.

**Insights:**
- Keep detection tight: only obvious loopback addresses. Avoids false positives on LAN machines that are already publicly reachable via VPN / mesh.
- Implication: a helper like `isLocalhostUrl(url)` belongs in `lib/env/` or `lib/tunnel/` and is the single source of truth used by both `browser create` and `test run`.
- Open question downstream: how this interacts with app-config `base_url` vs CLI-provided `--base-url` override (next question).

### Q: When base_url is localhost AND the API URL is also localhost (dev mode), what should auto-tunnel do?
Skip tunnel. In the dev case, only use tunnel if the user explicitly opts in via a flag.

**Insights:**
- Clean rule: tunnel auto-on = `isLocalhost(base_url) && !isLocalhost(api_url)`. Dev mode is the explicit exception.
- "Opt-in manually" means a flag like `--tunnel` (force on) still works even in dev mode — the automatic logic is a default, not a ceiling.
- Matrix:
  - `base_url=localhost` + `api_url=remote` → auto-tunnel ON (the main case Taras wants to fix)
  - `base_url=localhost` + `api_url=localhost` (dev) → tunnel OFF unless `--tunnel` explicit
  - `base_url=remote` → tunnel OFF always (no need)
- Implies three flag states: `auto` (default, inferred), `on` (force), `off` (force off).

### Q: What exactly does 'run in background, close to the browser' mean for commands like `browser create`?
Detach + return immediately. Spawn Playwright + tunnel as a detached subprocess, print session id/URL, return control to the shell. User manages lifecycle via `browser close`.

**Insights:**
- Significant architectural shift: `browser create` today blocks the terminal; new behavior = "fire and forget."
- Need a supervisor/daemon layer — either (a) per-session detached Node process using `child_process.spawn({ detached: true, stdio: 'ignore' })` with a PID file, or (b) a single background "qa-use daemon" that owns all sessions.
- Cleanup concerns: orphaned tunnels on crash, stale PID files, zombie Chromium processes. Need a heartbeat / session TTL (already exists: 30min default) + `browser close` that actually SIGTERMs the detached pid.
- Implication for logs: detached process can't stream to stdout. Need a log file path (e.g. `~/.qa-use/logs/session-<id>.log`) that `browser logs` can tail.
- Implication for `browser status`: must list running detached sessions by scanning PID files or querying the backend (source of truth?).
- Open: does the MCP/HTTP server path need the same treatment, or is this CLI-only?

### Q: How should `qa-use test run` handle the tunnel lifecycle when base_url is localhost?
(Note: `suite run` is purely cloud — not relevant here. Taras corrected mid-session.)

Reuse existing session tunnel when available, else ephemeral — and importantly, **the tunnel concept itself should be reusable**, treated as a first-class shared resource.

**Insights:**
- Tunnel becomes a first-class primitive, not a per-command hack. Likely belongs in `lib/tunnel/` as a registry/refcount layer.
- Keyed by target (host:port or full URL). Multiple consumers (browser session, test run, suite run, REPL) request a tunnel for the same target → all get the same handle.
- Refcount-based lifecycle: when last consumer releases, start a TTL (e.g. 30s grace) before teardown so a follow-up run can reuse it.
- CLI surface likely needs a `qa-use tunnel` subcommand family: `tunnel start <url>`, `tunnel ls`, `tunnel close <id|url>`. Pairs nicely with the detached-session model (both are background resources).
- Registry needs persistence across CLI invocations (filesystem: `~/.qa-use/tunnels/<hash>.json` with url, pid, public URL, refcount, TTL). Matches the PID-file pattern for detached sessions.
- Implication: `browser create --base http://localhost:3000` and `test run -c app-config-with-localhost` both call `tunnelRegistry.acquire('http://localhost:3000')` and get the same public URL. Simple mental model.

### Q: What should the user see on stdout when auto-tunnel kicks in (localhost base_url + remote API)?
Banner with context — multi-line notice explaining detected localhost, starting tunnel, why, and how to disable.

**Insights:**
- First-run clarity matters more than quiet-on-success here because the behavior is implicit; users need to know why their localhost URL suddenly became a public one.
- Banner content needs: detected target, public URL, reason (backend can't reach your machine), opt-out flag, link to docs maybe.
- Once shown, banner could be suppressed on reuse (e.g. if tunnel already exists, just say "Reusing tunnel https://abc123..."). Two flavors: "Starting" vs "Reusing".
- Banner should NOT appear in JSON/quiet modes (`--json`, `--quiet`, piped output). stderr is probably the right channel so stdout stays machine-parseable.
- Example draft:
  ```
  ╭─ Auto-tunnel active ──────────────────────────────
  │ Detected localhost base URL: http://localhost:3000
  │ Remote backend (api.desplega.ai) cannot reach your
  │ machine directly, so qa-use is exposing it via:
  │
  │   https://abc123.qa-use.dev
  │
  │ Disable with --no-tunnel (or use a public URL).
  ╰───────────────────────────────────────────────────
  ```

### Q: If auto-tunnel is selected but the tunnel fails to start, what should happen?
Fail with triage hint — abort, but include what was attempted, likely causes (quota/network/auth), and next steps (retry, --no-tunnel, check `tunnel status`).

**Insights:**
- No silent fallback: a silent fallback to raw localhost would cause the remote backend to fail cryptically on every test step. Worse UX than a clean abort.
- Error message template:
  ```
  × Auto-tunnel failed for http://localhost:3000
    Attempted: start tunnel via <provider>
    Likely cause: <network timeout | auth expired | quota exceeded>
    Next steps:
      • Retry: the failure may be transient
      • Skip tunnel: rerun with --no-tunnel (will only work if backend can reach localhost)
      • Check tunnel status: `qa-use tunnel status`
  ```
- Implies structured errors from `lib/tunnel/` — each failure classified (network/auth/quota/unknown) so the CLI can pick the right hint. Not just `throw new Error('tunnel failed')`.
- Open: should we surface a single retry automatically before failing, or require the user to retry? Leaning toward 1 silent retry for transient network blips, then the triage-hint abort.

### Q: Should auto-tunnel + detach-in-background apply beyond the CLI — to MCP tools and the HTTP/SSE server path?
CLI only. MCP and HTTP/SSE paths stay as-is.

**Insights:**
- Scope is narrowed to `qa-use browser *`, `qa-use test run`, `qa-use suite run`, and the REPL (`qa-use browser run`). MCP + HTTP server unchanged.
- Rationale: MCP tools are invoked by an orchestrator (Claude/agent) that already manages lifecycle via explicit tool calls; auto-inference could fight that model. HTTP server is a hosted path where localhost doesn't make sense anyway.
- Good boundary: keeps the blast radius small and makes the first iteration shippable.
- Risk: divergence between CLI UX and MCP UX — a future task might want to re-align, but not now.

### Q: The current CLI has an explicit `--tunnel` flag. How should it behave alongside the new auto-inference?
Tri-state: `--tunnel auto|on|off` (with `--no-tunnel` as alias for `off`). Explicit always wins over inference.

**Insights:**
- `auto` is the new default. Today's `--tunnel auto` users keep working identically. Users who currently pass nothing will see the new auto behavior — this is the intended shift.
- `--tunnel on` forces a tunnel even in dev mode (API=localhost) — the explicit opt-in path Taras mentioned for dev.
- `--tunnel off` / `--no-tunnel` suppresses auto-tunnel even when base_url is localhost and API is remote — for users who've set up their own ngrok/cloudflared externally.
- Backward compat: any existing scripts passing `--tunnel auto|on|off` explicitly keep their exact semantics.
- Config-level default: consider allowing `~/.qa-use.json` to set `tunnel: "auto"|"on"|"off"` too, for users who want to globally disable (precedence: CLI flag > config > built-in default of auto).

## Review Pass (2026-04-20)

Taras reviewed in file-review and resolved every open question:
- **`test run` stays foreground.** Blocks until result; participates in the shared tunnel registry but does not detach.
- **Orphan cleanup via PID files + `qa-use doctor` sweep** — accepted as proposed.
- **No local session log file.** Skip `~/.qa-use/logs/session-*.log` entirely. Backend-side `browser logs console/network` is the only logs surface.
- **Zero retries on tunnel failure.** Fail immediately with the triage-hint error. No silent retry.
- **Tunnel stays CLI-side only.** No `tunnel` field on the app-config schema.
- **Tunnel reuse is a feature, not a risk.** No warning on second-acquire. Document the behavior once and move on.
- **Tunnel quota / rate-limit concerns** — explicitly not a concern for this iteration.

## Synthesis

### Key Decisions
- **Auto-tunnel default.** `--tunnel` defaults to `auto`. `auto` evaluates to on when `isLocalhost(base_url) && !isLocalhost(api_url)`; otherwise off.
- **Localhost detection stays narrow.** Only loopback (`localhost`, `127.0.0.1`, `0.0.0.0`, `*.localhost`). No LAN / `.local` / dev-tunnel hostnames.
- **Dev mode skips tunnel.** If API URL is localhost, tunnel stays off unless user explicitly passes `--tunnel on`.
- **Tri-state `--tunnel` flag.** `auto` (default) | `on` (force) | `off` / `--no-tunnel`. Explicit always wins. Config-level default allowed in `~/.qa-use.json`.
- **Tunnel is a reusable first-class primitive.** Registry keyed by target (host:port). Refcount-based lifecycle with short TTL grace period. Shared between `browser create`, `test run`, and the REPL. (Suite is cloud-only, not a consumer.)
- **`browser create` detaches.** Spawns browser + tunnel as a detached subprocess, returns session id/URL immediately. Lifecycle managed by `browser close` or TTL.
- **Banner on first tunnel start.** Multi-line stderr banner explains target, public URL, reason (remote backend can't reach localhost), and opt-out. Shorter "Reusing tunnel …" line on reuse. Suppressed in JSON/quiet output.
- **Fail with triage hint on tunnel failure.** No silent fallback. One transient-retry before aborting. Structured error classes (network / auth / quota / unknown) drive the hint text.
- **Scope: CLI only.** MCP tools and HTTP/SSE server unchanged in this iteration. `suite run` is cloud-only and out of scope for tunnel work.
- **`test run` stays foreground.** Only `browser create` detaches. Test run prints progress and blocks until result; it just participates in the shared tunnel registry.
- **No local session log file.** Detached `browser create` does not write `~/.qa-use/logs/session-<id>.log`. Backend `browser logs console/network` remains the single logs surface. Orphan / crash visibility is covered by `qa-use doctor` + PID-file sweeps.
- **Zero retries on tunnel failure.** Fail immediately with the triage-hint error; user decides whether to retry.
- **Tunnel reuse is a feature.** No warning when a second consumer joins an existing tunnel. Documented once in the reference; no runtime notice.
- **Tunnel is strictly a CLI-side concept.** No `tunnel` field on the app-config schema; keep it a client-side concern resolved by the CLI.
- **New CLI surface.** `qa-use tunnel start|ls|status|close` subcommand family to observe/manage the shared tunnel registry. Mirrors the detached-session story.

<!-- review-line-start(001bdd6c) -->
### Open Questions
All brainstorm-level open questions were resolved during the file-review pass (see "Review Pass" section above). Anything remaining is implementation-level — exact file layouts, CLI help strings, PID-file schema — and belongs in `/desplega:create-plan`.

### Constraints Identified
- `@desplega.ai/localtunnel` is the current tunnel provider — the registry/refcount layer must wrap it cleanly.
- 30-minute session TTL and 10-session concurrency cap already exist — new detach model must respect them and surface them via `browser status` / `tunnel ls`.
- Stdout is sacred for MCP and for JSON output — all new banners/notices go to stderr.
- Biome + oxlint + `.js` import extensions + ESM — style constraints from CLAUDE.md.
- `bun run check:fix` required after any code change; `scripts/e2e.ts` must keep passing.
- CLI + REPL parity rule in CLAUDE.md: any browser CLI command change must be mirrored in `src/cli/commands/browser/run.ts`.

### Core Requirements
1. `isLocalhostUrl(url)` helper in a single module, used by every auto-tunnel decision site.
2. `TunnelRegistry` in `lib/tunnel/`: `acquire(target) → TunnelHandle`, `release(handle)`, `list()`, `get(target)`. Refcounted, persistent across CLI invocations via `~/.qa-use/tunnels/*.json`.
3. Tri-state `--tunnel` flag (`auto`/`on`/`off`) wired into `browser create`, `browser run` (REPL), and `test run`. Default = `auto`. (Suite is cloud-only — no flag there.)
4. Auto-tunnel decision: resolve flag → evaluate `auto` against `isLocalhost(base_url)` + `isLocalhost(api_url)` → produce on/off.
5. `browser create` detaches: `child_process.spawn({ detached: true, stdio: 'ignore' })` + PID file; returns immediately with session id/URL. No local log file is written — logs surface via the existing backend `browser logs console/network` only.
6. `browser close <id>` SIGTERMs the detached process, releases the tunnel via registry, cleans the PID file.
7. `qa-use doctor` (or equivalent startup sweep) reaps stale PID files and orphaned tunnels after crashes/reboots.
8. Banner printed to stderr on first tunnel start; short "Reusing …" line on reuse; suppressed in `--json` / `--quiet` / non-TTY.
9. Structured tunnel errors (network/auth/quota/unknown) with **zero retries** — fail immediately with the triage-hint message.
10. New `qa-use tunnel` subcommand family: `start <url>`, `ls`, `status [<id>]`, `close <id|url>`. Mirrors browser-session CLI ergonomics.
11. `~/.qa-use.json` gains optional `tunnel: "auto"|"on"|"off"` key (precedence: CLI flag > config > built-in auto default). **No change to the app-config schema** — tunnel stays strictly client/CLI-side.
12. `scripts/e2e.ts` extended with: detach flow, tunnel registry reuse, dev-mode skip, banner presence/absence, failure triage output.
13. CLAUDE.md updated with the new tunnel model and the CLI↔REPL parity reminder applied to new commands.

## Next Steps

- Offer `/review` on this brainstorm to catch unexplored areas.
- Likely handoff: `/desplega:create-plan` using this brainstorm as input context — the design is concrete enough to turn directly into a phased plan. Research pass probably not needed unless the tunnel-provider internals or existing detach patterns in the repo need deeper digging first.
