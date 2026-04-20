# QA-Use MCP Server

MCP server for browser automation and QA testing using Playwright, integrating with desplega.ai.

**Landing site:** https://qa-use.dev (deployed from `landing/` directory)

## Quick Reference

**IMPORTANT: Always use `bun`, never `npm` or `yarn`.**

```bash
bun install           # Install dependencies
bun run build         # Build TypeScript
bun run dev           # Development with hot reload
bun test              # Run tests with bun
bun run lint:fix      # Fix linting issues
bun run format        # Format code
bun run typecheck     # Type check
```

## Tech Stack

- **Runtime**: Node.js 20+, TypeScript, bun
- **MCP**: @modelcontextprotocol/sdk (stdio & HTTP/SSE transports)
- **Browser**: Playwright (Chromium)
- **Tunneling**: @desplega.ai/localtunnel
- **Testing**: Bun test runner

## Architecture

```
src/
├── cli/               # Unified CLI (qa-use command)
│   ├── index.ts       # CLI entry point
│   └── commands/      # CLI subcommands
│       ├── api/       # Dynamic OpenAPI-driven API client
│       ├── app-config/   # App configuration CRUD
│       ├── app-context/  # App context CRUD
│       ├── browser/      # Browser automation commands
│       ├── data-asset/   # Data asset management
│       ├── issues/       # Test issue viewer
│       ├── persona/      # Persona management
│       ├── suite/        # Test suite CRUD & runner
│       ├── test/         # Test runner, listing, runs subcommands
│       ├── docs.ts       # Documentation viewer
│       ├── setup.ts      # Initial setup wizard
│       ├── usage.ts      # Usage statistics
│       └── ...           # info, install-deps, mcp, update
├── index.ts           # MCP stdio entry point (direct invocation)
├── server.ts          # Main MCP server, tools & session management
├── http-server.ts     # HTTP/SSE transport implementation
├── tunnel-mode.ts     # Persistent WebSocket tunnel mode
└── types.ts           # Type definitions

lib/
├── api/               # desplega.ai API client
├── browser/           # Playwright browser management
├── env/               # Environment & config loading
└── tunnel/            # Localtunnel wrapper
```

## Key Concepts

- **Three modes**: stdio (default MCP), HTTP/SSE (web), tunnel (backend-initiated)
- **BrowserSession**: Wraps browser + tunnel with TTL (30min default), auto-cleanup
- **Max 10 concurrent sessions** with automatic deadline refresh on interaction
- **25s max per MCP call** for timeout protection

## Environment Variables

```bash
QA_USE_API_KEY=xxx      # Required: desplega.ai API key
QA_USE_REGION=us        # Optional: "us" or "auto" (default)
QA_USE_API_URL=xxx      # Optional: API endpoint override
```

Or use `~/.qa-use.json` config file (env vars take precedence).

## Code Style

- Biome (formatting + linting) + oxlint configured
- Use `.js` extensions in imports (ESM)
- Debug with `console.error()` (stdout reserved for MCP)
- Run `bun run check:fix` before committing

## Mandatory Verification After Code Changes

**IMPORTANT:** After making any code changes, always run:

```bash
bun run check:fix
```

This is especially critical when implementing plans - run this verification step after completing each phase before proceeding to the next one. This ensures consistent code style and catches issues early.

- When changing tunnel, registry, detach, or `browser create/close/status` code paths, also run `bun run scripts/e2e.ts` to exercise the tunnel/detach regression sections (8-13). Gated remote-tunnel sections (9, 10, 12) require `E2E_ALLOW_REMOTE_TUNNEL=1` and a reachable remote backend — they skip safely otherwise.

## Browser CLI & REPL Sync

**IMPORTANT:** When modifying browser commands in `src/cli/commands/browser/*.ts`, also update the REPL in `src/cli/commands/browser/run.ts`, and vice versa. They share the same functionality:

- CLI: `qa-use browser <command>` (individual command files)
- REPL: `qa-use browser run` then `<command>` (commands object in run.ts)

Both must support the same options and behavior.

**Exception:** The `qa-use tunnel` subcommand family (`start`, `ls`, `status`, `close`) and `qa-use doctor` are CLI-only — they operate on the cross-process tunnel registry and session PID files in `~/.qa-use/`, not on an in-process browser. No REPL mirror is needed or intended.

## Tunnel model

qa-use tunnels localhost targets to a public URL so remote desplega.ai backends can reach the browser. The CLI side of this lives entirely in `lib/tunnel/` + `src/cli/commands/tunnel/` + `src/cli/commands/browser/` and is orthogonal to the MCP global-browser path (`src/server.ts:450-603`), which still manages its own single `TunnelManager`.

**Canonical helpers.**
- `isLocalhostUrl(url)` lives at `lib/env/localhost.ts` — the single source of truth for detecting localhost/127.0.0.1/::1/`*.localhost`/0.0.0.0. Always import from `lib/env/localhost.ts`, not from `src/cli/lib/browser.ts`.
- `getPortFromUrl(url)` co-lives in the same module.

**Tri-state `--tunnel` flag.** Added via `addTunnelOption(cmd)` in `src/cli/lib/tunnel-option.ts`. Values:
- `auto` (default) — tunnel iff base URL is localhost AND API URL is NOT localhost (prod mode).
- `on` — force a tunnel even in dev mode.
- `off` — never tunnel. `--no-tunnel` is a sugar alias for `--tunnel off`.

The resolution is implemented in `src/cli/lib/tunnel-resolve.ts` (`resolveTunnelFlag`, `resolveTunnelMode`). Precedence: CLI flag > `~/.qa-use.json` `tunnel` key > default `auto`.

**`~/.qa-use.json` `tunnel` key.** Top-level `"tunnel": "auto" | "on" | "off"`. Invalid values log a stderr warning and fall back to `auto`.

**`TunnelRegistry` primitive.** `lib/tunnel/registry.ts`. Cross-process refcount-managed layer over `TunnelManager`:
- `acquire(target)` / `release(handle)` / `get(target)` / `list()`.
- One `TunnelManager` per target origin. Two consumers pointing at the same localhost share one tunnel (refcount=2).
- Persists to `~/.qa-use/tunnels/<sha256(target)[0..10]>.json` atomically.
- 30s TTL grace on last release (configurable via `QA_USE_TUNNEL_GRACE_MS`). Grace timer runs inside the owner process and is unref'd so it doesn't keep the event loop alive.
- `pid` field records the holder; registry reconciles against `process.kill(pid, 0)` on read.

**Detached `browser create`.** Parent bootstrap in `src/cli/commands/browser/create.ts` spawns a re-exec of the CLI with a hidden `__browser-detach` subcommand (`src/cli/commands/browser/_detached.ts`) using `{ detached: true, stdio: 'ignore' }` + `.unref()`. The child holds the session + tunnel for the session's TTL. Parent returns to the shell in < 3s once the child writes `~/.qa-use/sessions/<id>.json`.

- CLI entry resolution for the re-exec goes through `resolveCliEntry()` in `src/cli/lib/cli-entry.ts`. Handles installed binaries, `bun run cli`, and symlinked shapes deterministically.
- Hidden subcommand: `bun run cli browser __browser-detach --help` still works for debugging, but `--help` listings hide it.

**`QA_USE_DETACH=0` rollback.** Env flag preserves the pre-refactor legacy blocking path for one release. When set, `browser create` runs in-process (no spawn, no PID file) and logs `qa-use: QA_USE_DETACH=0 set — running in legacy blocking mode` to stderr. Tracked for removal in the plan's Follow-ups.

**`qa-use tunnel` subcommands.** `src/cli/commands/tunnel/{index,start,ls,status,close}.ts`.
- `qa-use tunnel start <url>` — acquire a tunnel; release immediately unless `--hold` keeps it up.
- `qa-use tunnel ls` — list entries with target, public URL, refcount, TTL. `--json` supported.
- `qa-use tunnel status <target|hash>` — detail for a single entry.
- `qa-use tunnel close <target|hash>` — force-release. Cross-references `~/.qa-use/sessions/*.json` and SIGTERMs the holder child if the registry entry is owned by a detached browser session.

**`qa-use doctor`.** `src/cli/commands/doctor.ts`. Scans `~/.qa-use/sessions/*.json` + `~/.qa-use/tunnels/*.json` for stale entries (dead PIDs) and reaps them. `--dry-run` prints the plan without acting. A bounded 250ms startup sweep (`src/cli/lib/startup-sweep.ts`) also runs on every CLI invocation except `doctor` itself and `__browser-detach`, reaping stale entries silently (single-line stderr notice on first sweep).

**Structured tunnel errors + triage hints.** `lib/tunnel/errors.ts` + `src/cli/lib/tunnel-error-hint.ts`. Tunnel failures are classified (`TunnelNetworkError` / `TunnelAuthError` / `TunnelQuotaError` / `TunnelUnknownError`) and formatted with a "Next steps:" triage block including the `--no-tunnel` opt-out flag. No silent retries.

## Shared Utilities

### normalizeRef Function

Location: `src/cli/lib/browser-utils.ts`

A shared utility function used across all 12 browser CLI commands and the REPL. Always import from this module instead of defining local copies:

```typescript
import { normalizeRef } from '../../lib/browser-utils.js';
```

**Functionality:**
- Strips surrounding quotes (single and double): `"e31"` → `e31`, `'e31'` → `e31`
- Strips leading @ symbol: `@e31` → `e31`
- Handles combined cases: `"@e31"` → `e31`
- Preserves custom selectors: `"__custom__data-testid=rf__node-1"` → `__custom__data-testid=rf__node-1`

**Used in:**
- CLI commands: click, check, uncheck, hover, select, fill, type, drag, scroll-into-view, upload, mfa-totp
- REPL: run.ts (all 11 commands above)

When adding new browser commands that accept element refs, always import and use this utility.

## E2E Regression Test (`scripts/e2e.ts`)

**IMPORTANT:** After adding or modifying CLI features (browser commands, test runner, etc.), run the e2e regression script to verify nothing is broken:

```bash
bun run scripts/e2e.ts                  # default: uses "bun run cli"
bun run scripts/e2e.ts --cmd qa-use     # use installed qa-use binary
```

**Requirements:**
- `.qa-use.json` must exist in the project root (with valid `api_key` and `api_url`)
- The backend pointed to by `api_url` must be running
- Test site: https://evals.desplega.ai/

**What it tests (7 sections):**
1. **Browser Commands** — create session, snapshot, url, screenshot, click (--text), back, status, close, logs
2. **Table Filtering** — navigate to Table Demo, fill filter input by ref, assert filtered snapshot contains expected data and excludes filtered-out data
3. **Test Runner** — runs `qa-tests/e2e.yaml` via `test run`, asserts it passes
4. **API Subcommands** — api help, ls, info, info --json, examples, openapi, openapi --raw
5. **Suite CRUD** — create a suite, list suites, get info, update it, delete it
6. **Test Runs** — list runs, info on a run (if runs exist), steps
7. **Resource Smoke Tests** — `list --json` on issues, app-config, app-context, persona, data-asset, and usage

**Extending with new features:**
- When adding a new browser command, add a step in Section 1 that exercises it
- When adding a new interaction pattern (e.g., drag, select, check), add a dedicated section or extend Section 2
- The test YAML (`qa-tests/e2e.yaml`) should stay simple — it tests the test runner path, not complex scenarios
- Keep assertions meaningful: check output content, not just exit codes

**Test YAML (`qa-tests/e2e.yaml`):**
- Uses `base_url` variable override to target evals.desplega.ai
- Clicks "Table Demo" and asserts "John Doe" is visible
- This is the only test definition in `qa-tests/` — keep it focused on the evals site

## E2E Testing with Browser API CLI (Manual)

Use this flow to manually test browser API functionality against a local backend.

**Note:** The `.qa-use.json` file is pre-configured with localhost:5005 and a valid API key. No env setup needed - just run commands directly.

```bash
# No env setup required - .qa-use.json handles it

# Create a browser session and navigate to test site (--no-headless to see the browser)
bun run cli browser create --no-headless https://evals.desplega.ai/

# Get page snapshot (shows ARIA tree with element refs)
bun run cli browser snapshot

# Click an element by ref (e.g., e31 for Buttons Demo link)
bun run cli browser click e31

# Or click by text (AI-based semantic selection)
bun run cli browser click --text "Home"

# Take a screenshot
bun run cli browser screenshot /tmp/screenshot.png

# Get session status (shows app_url for web UI)
bun run cli browser status

# Close the session
bun run cli browser close

# After closing, fetch logs
bun run cli browser logs console -s <session-id>
bun run cli browser logs network -s <session-id>
```

**Test site:** https://evals.desplega.ai/ has various UI components (buttons, checkboxes, forms, etc.) for testing browser interactions.

## E2E Testing with API CLI (Dynamic OpenAPI)

Use this flow to validate API behavior through the dynamic `qa-use api` command.

**Note:** `.qa-use.json` is pre-configured with localhost:5005 and API key, so these commands run without extra env setup.

```bash
# Discover available API routes from OpenAPI
bun run cli api ls --refresh

# GET usage with query fields
bun run cli api -X GET /api/v1/tests -f limit=3
bun run cli api -X GET /api/v1/test-runs -f limit=3

# Fetch resource details
bun run cli api -X GET /api/v1/test-runs/<run-id>

# Trigger test execution actions
bun run cli api -X POST /api/v1/tests-actions/run --input /tmp/run-tests-body.json

# Verify cached OpenAPI fallback mode
bun run cli api ls --offline
```

For action endpoints (`tests-actions/*`, `test-suites-actions/*`), always follow the POST with GET status checks to confirm run progression.
