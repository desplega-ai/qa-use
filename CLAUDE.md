# CLAUDE.md

QA-Use is an MCP server for browser automation and QA testing using Playwright, integrating with desplega.ai. Landing site at https://qa-use.dev (deployed from `landing/`).

## Project map

```
src/
├── cli/               # Unified `qa-use` CLI
│   ├── index.ts       # CLI entry point
│   └── commands/      # api, app-config, app-context, browser, data-asset,
│                      # issues, persona, suite, test, docs, setup, usage,
│                      # info, install-deps, mcp, update, tunnel, doctor
├── index.ts           # MCP stdio entry (direct invocation)
├── server.ts          # Main MCP server, tools, session management
├── http-server.ts     # HTTP/SSE transport
├── tunnel-mode.ts     # Persistent WebSocket tunnel mode
└── types.ts

lib/
├── api/               # desplega.ai API client
├── browser/           # Playwright browser management
├── env/               # Environment & config loading
└── tunnel/            # Localtunnel wrapper
```

## Tech stack

Node.js 20+ / TypeScript / **bun** runtime. `@modelcontextprotocol/sdk` (stdio + HTTP/SSE), Playwright (Chromium), `@desplega.ai/localtunnel`. Tests run with bun.

<important if="you need to run commands to install, build, test, lint, format, typecheck, or run the CLI">

**Always use `bun`, never `npm` or `yarn`.**

| Command | What it does |
|---|---|
| `bun install` | Install dependencies |
| `bun run build` | Build TypeScript |
| `bun run dev` | Development with hot reload |
| `bun test` | Run tests |
| `bun run lint:fix` | Fix linting issues |
| `bun run format` | Format code |
| `bun run typecheck` | Type check |
| `bun run check:fix` | Lint + format fix (run before committing) |
| `bun run cli <subcommand>` | Run the `qa-use` CLI from source |
| `bun run scripts/e2e.ts` | E2E regression script (see e2e block below) |

</important>

<important if="you have made code changes and are about to finish a phase, hand off, or commit">

After **any** code changes, run:

```bash
bun run check:fix
```

When implementing a multi-phase plan, run this after each phase before proceeding.

</important>

<important if="you are configuring qa-use, setting credentials, or debugging API/region connection issues">

Required: `QA_USE_API_KEY=xxx`. Optional: `QA_USE_REGION=us|auto` (default `auto`), `QA_USE_API_URL=xxx` to override the endpoint.

A `~/.qa-use.json` config file is also supported. **Env vars take precedence over the file.** The file may include a top-level `"tunnel": "auto" | "on" | "off"` (see tunnel block below).

The repo's `.qa-use.json` is pre-configured against `https://api.desplega.ai` with a valid `api_key` — no extra env setup needed. It also carries an underscore-prefixed `_api_url` / `_api_key` pair pointing at `http://localhost:5005`; swap the underscores to flip between prod and local backend without touching env vars.

</important>

<important if="you are working on the MCP server, browser session lifecycle, or per-call timeouts in src/server.ts or src/http-server.ts">

- Three transport modes: **stdio** (default MCP), **HTTP/SSE** (web), **tunnel** (backend-initiated, persistent WebSocket — see `src/tunnel-mode.ts`).
- `BrowserSession` wraps browser + tunnel with a 30 min default TTL and auto-cleanup.
- Hard cap of **10 concurrent sessions**. Deadline is refreshed on every interaction.
- Per-MCP-call wall-clock budget is **25s** for timeout protection — long-running work must be chunked.
- The MCP global-browser path (`src/server.ts:450-603`) manages its own single `TunnelManager` and is **orthogonal** to the CLI tunnel-registry path.

</important>

<important if="you are mutating typed `variables:` on a test (CLI work, not test-author work)">

`qa-use test vars list | set | unset` is the imperative twin of the declarative
YAML editing path. It accepts either a positional `<file>` *or* `--id <uuid>`
(mutually exclusive). The local-file path mutates via yaml's Document API so
comments + key order survive; the `--id` path read-modify-writes via
`exportTest` + `importTestDefinition`. Sensitive-preserve: passing `--sensitive`
without `--value` keeps the stored value on an existing sensitive key — see
`plugins/qa-use/skills/qa-use/SKILL.md` (§ Test Variables).

The `TEST_VARIABLE_TYPES` / `TEST_VARIABLE_LIFETIMES` / `TEST_VARIABLE_CONTEXTS`
runtime arrays in `src/cli/lib/test-vars.ts` mirror the auto-generated unions
in `src/types/test-definition.ts`. A compile-time mutual-extends guard fails
`bun run typecheck` if you regenerate types via `bun run generate:types` and
the unions drift — update the arrays in lockstep.

</important>

<important if="you are adding or modifying TypeScript imports in this project">

Use `.js` extensions on relative imports (this is an ESM project) — e.g. `import { foo } from './bar.js'`, even when `bar.ts` is the source file.

</important>

<important if="you are adding logging or debug output in any code path that runs under MCP stdio">

Use `console.error()`, never `console.log()`. **stdout is reserved for the MCP protocol** — anything written there will corrupt the JSON-RPC stream.

</important>

<important if="you are modifying any browser command in src/cli/commands/browser/*.ts or the REPL in src/cli/commands/browser/run.ts">

CLI and REPL share the same functionality and **must stay in sync**:

- CLI: `qa-use browser <command>` (one file per command in `src/cli/commands/browser/`)
- REPL: `qa-use browser run` then `<command>` (commands object in `run.ts`)

Both must support the same options and behavior. Change one, change the other.

**Exception:** `qa-use tunnel` (`start | ls | status | close`) and `qa-use doctor` are CLI-only — they operate on the cross-process tunnel registry and session PID files in `~/.qa-use/`, not on an in-process browser.

</important>

<important if="you are adding or modifying a browser CLI command that accepts an element ref argument">

Always import the shared `normalizeRef` from `src/cli/lib/browser-utils.ts` — never define a local copy. It strips surrounding quotes, leading `@`, and preserves custom `__custom__...` selectors.

```typescript
import { normalizeRef } from '../../lib/browser-utils.js';
```

</important>

<important if="you are modifying tunnel, registry, detach logic, or the browser create/close/status code paths">

Run the e2e regression script in addition to `check:fix`:

```bash
bun run scripts/e2e.ts
```

This exercises the tunnel/detach regression sections (8-13). Gated remote-tunnel sections (9, 10, 12) require `E2E_ALLOW_REMOTE_TUNNEL=1` and a reachable remote backend — they skip safely otherwise.

**Tunnel model.** qa-use tunnels localhost targets to a public URL so remote backends can reach the browser. CLI side lives entirely in `lib/tunnel/` + `src/cli/commands/tunnel/` + `src/cli/commands/browser/`.

- **`isLocalhostUrl(url)`** and **`getPortFromUrl(url)`** are the single source of truth at `lib/env/localhost.ts`. Always import from there, **never** from `src/cli/lib/browser.ts`.
- **Tri-state `--tunnel` flag** (`addTunnelOption` in `src/cli/lib/tunnel-option.ts`):
  - `auto` (default) — tunnel iff base URL is localhost AND API URL is NOT localhost (prod mode).
  - `on` — force a tunnel even in dev mode.
  - `off` — never tunnel. `--no-tunnel` is sugar for `--tunnel off`.
  - Resolution in `src/cli/lib/tunnel-resolve.ts`. Precedence: CLI flag > `~/.qa-use.json` `tunnel` key > `auto`.
- **`TunnelRegistry`** (`lib/tunnel/registry.ts`) — cross-process refcount layer over `TunnelManager`. One manager per target origin; consumers sharing a target share one tunnel. Persists atomically to `~/.qa-use/tunnels/<sha256(target)[0..10]>.json`. 30s TTL grace on last release (override via `QA_USE_TUNNEL_GRACE_MS`); grace timer is `unref`'d. `pid` field is reconciled against `process.kill(pid, 0)` on read.
- **Detached `browser create`** (`src/cli/commands/browser/create.ts`) re-execs the CLI with the hidden `__browser-detach` subcommand (`_detached.ts`) using `{ detached: true, stdio: 'ignore' }` + `.unref()`. Child holds session + tunnel for the TTL; parent returns in <3s once the child writes `~/.qa-use/sessions/<id>.json`. CLI entry resolution goes through `resolveCliEntry()` in `src/cli/lib/cli-entry.ts`.
- **`QA_USE_DETACH=0`** preserves the legacy blocking path for one release. Tracked for removal.
- **`qa-use tunnel` subcommands** — `start <url>` (releases immediately unless `--hold`), `ls` (`--json` supported), `status <target|hash>`, `close <target|hash>` (cross-references `~/.qa-use/sessions/*.json` and SIGTERMs the holder child if owned by a detached session).
- **`qa-use doctor`** (`src/cli/commands/doctor.ts`) reaps stale entries from `~/.qa-use/sessions/*.json` + `~/.qa-use/tunnels/*.json`. Bounded 250ms startup sweep (`src/cli/lib/startup-sweep.ts`) runs on every CLI invocation except `doctor` and `__browser-detach`.
- **Structured tunnel errors** (`lib/tunnel/errors.ts` + `src/cli/lib/tunnel-error-hint.ts`) classify failures (`TunnelNetworkError | TunnelAuthError | TunnelQuotaError | TunnelUnknownError`) and include a "Next steps:" triage block with the `--no-tunnel` opt-out. **No silent retries.**

</important>

<important if="you have changed CLI features (browser commands, test runner, suite/api/test runs subcommands) and need regression coverage">

Run the e2e regression script — it covers more than tunnel/detach paths:

```bash
bun run scripts/e2e.ts                  # default: uses "bun run cli"
bun run scripts/e2e.ts --cmd qa-use     # use installed qa-use binary
```

Requires `.qa-use.json` in the repo root (valid `api_key` + `api_url`) and the backend at `api_url` running. Test site: https://evals.desplega.ai/.

**Sections** cover, broadly: browser CLI commands, table interaction patterns, the test runner against `qa-tests/e2e.yaml`, API subcommands, suite/test-run CRUD, resource smoke tests (issues, app-config, app-context, persona, data-asset, usage), tunnel/detach regression, the doctor reaper, and SSE-exit timing. Read the section banners at the top of each block in `scripts/e2e.ts` for the live list — the count and ordering shift over time.

**Extending.** When adding a new browser command, add a step in Section 1. New interaction patterns (drag, select, check, etc.) — add a dedicated section or extend Section 2. Keep `qa-tests/e2e.yaml` simple — it tests the runner path, not complex scenarios. Assertions should check output content, not just exit codes.

</important>

<important if="you need to manually exercise browser CLI flows against a local backend (snapshot/click/screenshot/logs)">

Test site is https://evals.desplega.ai/ (buttons, checkboxes, forms, tables for component testing). Repo `.qa-use.json` defaults to `https://api.desplega.ai`; swap the underscore prefix on `api_url` / `api_key` to flip to `http://localhost:5005` for local backend work.

Representative flow:

```bash
bun run cli browser create --no-headless https://evals.desplega.ai/   # session id printed
bun run cli browser snapshot                                          # ARIA tree with refs
bun run cli browser click e31              # by ref
bun run cli browser click --text "Home"    # by AI-based semantic selection
bun run cli browser status                 # shows app_url for web UI
bun run cli browser close
bun run cli browser logs console -s <session-id>   # logs are fetchable post-close
bun run cli browser logs network -s <session-id>
```

All other subcommands and flags are discoverable via `--help`.

</important>

<important if="you need to exercise the OpenAPI-driven `qa-use api` command end-to-end">

`api ls --refresh` re-pulls the OpenAPI spec; `api ls --offline` validates the cached fallback path. Representative calls:

```bash
bun run cli api -X GET /api/v1/tests -f limit=3
bun run cli api -X GET /api/v1/test-runs/<run-id>
bun run cli api -X POST /api/v1/tests-actions/run --input /tmp/run-tests-body.json
```

For action endpoints (`tests-actions/*`, `test-suites-actions/*`), **always follow the POST with GET status checks** to confirm run progression — these endpoints kick off async work.

</important>
