---
date: 2026-03-04T13:15:00Z
topic: "qa-use `api` subcommand design — raw HTTP proxy for desplega API"
author: claude
status: complete
autonomy: autopilot
tags: [api-subcommand, cli-design, desplega-backend]
---

# Research: qa-use `api` Subcommand Design

**Date**: 2026-03-04
**Repositories analyzed**: `desplega-ai/qa-use`, `desplega-ai/desplega.ai`

## Research Question

How should the `qa-use api` subcommand be designed to let users call desplega's external API directly from the terminal, similar to `gh api` and `vercel api`?

## Summary

The qa-use CLI (v2.8.6) is built on **Commander.js v14** with a clean command-factory pattern — each command is a standalone `new Command()` exported from its own file. It already has two API clients (`ApiClient` for `/vibe-qa/` routes, `BrowserApiClient` for `/browsers/v1/`) using Axios + native fetch, and a two-tier config system (per-project `.qa-use-tests.json` + per-user `~/.qa-use.json`) with `Bearer` API key auth.

The desplega backend is **FastAPI** with **three external API surfaces**: `/api/v1/` (14 endpoints for tests, configs, suites), `/browsers/v1/` (16 endpoints for browser automation), and `/pw-reporter/` (6 endpoints for Playwright reporting). All use `Bearer` API key auth with scope checks (`admin`, `api`, `pw_reporter`). FastAPI auto-generates an OpenAPI spec at `/openapi.json` but **only in development** — it's disabled in production.

The recommended approach is **Pattern C (hybrid)**: implement `qa-use api` as a raw HTTP proxy (like `gh api`) that auto-injects auth and targets desplega's API, while the existing hardcoded commands continue to serve common workflows. This can be implemented **purely client-side** with zero backend changes needed. Enabling the OpenAPI spec in production would be a valuable follow-up for discoverability (`qa-use api ls`).

---

## Part 1: qa-use CLI Structure

### Overview

| Aspect | Details |
|--------|---------|
| **Package** | `@desplega.ai/qa-use` v2.8.6 |
| **CLI Framework** | Commander.js v14 |
| **HTTP Client** | Axios + native `fetch` (for SSE) |
| **Runtime** | Node.js 20+, Bun as package manager |
| **Build** | TypeScript compiled via `tsc` |
| **Module** | ESM (`"type": "module"`) |
| **Binary** | `qa-use` -> `./bin/qa-use.js` |

### Command Architecture

Entry point: `src/cli/index.ts` — creates root `Commander` program and registers top-level commands:

```
qa-use
├── setup          # Interactive API key + config wizard
├── info           # Show configuration and status
├── test           # Test management (10 subcommands)
│   ├── run        # Execute test definitions
│   ├── list       # List tests (local or cloud)
│   ├── info       # Show test details
│   ├── runs       # List test run history
│   ├── validate   # Validate without running
│   ├── init       # Create example test directory
│   ├── export     # Export cloud test to local (deprecated)
│   ├── sync       # Sync local/cloud (push + pull)
│   ├── diff       # Compare local vs cloud
│   └── schema     # View test definition JSON schema
├── browser        # Browser automation (35 subcommands)
│   ├── create     # Create browser session
│   ├── list       # List sessions
│   ├── status     # Session status
│   ├── close      # Close session
│   ├── goto       # Navigate to URL
│   ├── click      # Click element
│   ├── fill       # Fill input
│   ├── snapshot   # Get accessibility tree
│   ├── screenshot # Capture screenshot
│   └── ... (25+ more action commands)
├── mcp            # MCP server modes (stdio, HTTP, tunnel)
├── install-deps   # Install Playwright browsers
└── update         # Self-update (dev or global)
```

### Command Pattern

Each command follows a consistent factory pattern (`src/cli/commands/<name>.ts`):

```typescript
// Each file exports a standalone Command instance
import { Command } from 'commander';
export const myCommand = new Command('name')
  .description('...')
  .option('-f, --flag <value>', '...')
  .action(async (options) => { /* handler */ });

// Composed via addCommand() in parent index.ts
program.addCommand(myCommand);
```

### Auth / Config System

**Two-tier config** with environment variable fallbacks:

| Layer | File | Purpose |
|-------|------|---------|
| Per-user | `~/.qa-use.json` | API key, API URL, region, browser session storage, update cache |
| Per-project | `.qa-use-tests.json` (cwd) | API key override, test directory, app config ID, defaults |
| Env vars | `QA_USE_API_KEY`, `QA_USE_API_URL`, etc. | Highest priority overrides |

**Config resolution** (`lib/env/index.ts`):
1. `process.env[name]` first
2. `~/.qa-use.json` -> `env` -> `[name]` second
3. `undefined` if not found

**API key usage**: Both API clients set `Authorization: Bearer <apiKey>` header.

### Existing API Clients

**`ApiClient`** (`lib/api/index.ts`) — Main client for test/session management:
- Base URL: `QA_USE_API_URL` || `https://api.desplega.ai`
- Endpoints: `/vibe-qa/*` (check, sessions, tests, run-tests, app-configs)
- Also: `/vibe-qa/cli/*` (run, export, validate, import, schema)
- Also: `/api/v1/test-runs` (list test runs)
- SSE streaming via native `fetch` for `runCliTest()`

**`BrowserApiClient`** (`lib/api/browser.ts`) — Browser automation client:
- Base URL: `{apiUrl}/browsers/v1`
- Endpoints: `/sessions/*` (CRUD, actions, snapshots, screenshots, logs)
- WebSocket support for real-time streaming

---

## Part 2: Desplega External API

### External API Surfaces

#### A. External API v1 — `/api/v1/` (14 endpoints)

**File:** `be/api/external_v1.py`
**Auth:** Bearer API key, scope `admin` or `api`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/app-configs` | List app configurations |
| GET | `/api/v1/app-configs/{config_id}` | Get app config detail |
| PATCH | `/api/v1/app-configs/{config_id}` | Update app config |
| GET | `/api/v1/tests` | List tests (with query/status filters) |
| GET | `/api/v1/tests/{test_id}` | Get test detail |
| GET | `/api/v1/test-runs` | List test runs |
| GET | `/api/v1/test-runs/{run_id}` | Get test run detail |
| GET | `/api/v1/test-suites` | List test suites |
| GET | `/api/v1/test-suites/{suite_id}` | Get test suite detail |
| GET | `/api/v1/test-suite-runs` | List test suite runs |
| GET | `/api/v1/test-suite-runs/{suite_run_id}` | Get test suite run detail |
| POST | `/api/v1/tests-actions/run` | Batch-run tests by ID |
| POST | `/api/v1/test-suites-actions/run` | Run a test suite |
| POST | `/api/v1/tests-actions/promote` | Promote tests to different app config |

#### B. Browser Protocol API v1 — `/browsers/v1/` (16 endpoints)

**File:** `be/api/browser_v1.py`
**Auth:** Bearer API key, scope `admin` or `api`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/browsers/v1/docs.md` | Markdown API documentation (public) |
| POST | `/browsers/v1/sessions` | Create browser session |
| GET | `/browsers/v1/sessions` | List sessions |
| GET | `/browsers/v1/sessions/{id}` | Get session detail |
| DELETE | `/browsers/v1/sessions/{id}` | Close/delete session |
| POST | `/browsers/v1/sessions/{id}/action` | Execute browser action |
| GET | `/browsers/v1/sessions/{id}/snapshot` | Get accessibility tree |
| GET | `/browsers/v1/sessions/{id}/screenshot` | Capture screenshot |
| GET | `/browsers/v1/sessions/{id}/url` | Get current URL |
| GET | `/browsers/v1/sessions/{id}/blocks` | Get recorded blocks |
| POST | `/browsers/v1/sessions/{id}/generate-test` | Generate test from blocks |
| GET | `/browsers/v1/sessions/{id}/logs/console` | Console logs |
| GET | `/browsers/v1/sessions/{id}/logs/network` | Network logs (HAR) |
| GET | `/browsers/v1/sessions/{id}/downloads` | Downloaded files |
| GET | `/browsers/v1/sessions/{id}/uploads` | Uploaded files |
| WS | `/browsers/v1/sessions/{id}/stream` | Real-time event stream |

#### C. Playwright Reporter API — `/pw-reporter/` (6 endpoints)

**File:** `be/api/pw_reporter.py`
**Auth:** Bearer API key, scope `admin` or `pw_reporter`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/pw-reporter/health` | Health check (public) |
| POST | `/pw-reporter/batch` | Receive test result batch |
| WS | `/pw-reporter/ws` | Real-time test result streaming |
| POST | `/pw-reporter/upload` | Upload test artifact |
| POST | `/pw-reporter/upload/chunk` | Chunked upload for large artifacts |
| POST | `/pw-reporter/reconstruct-har/{test_run_id}` | Reconstruct HAR from chunks |

### Authentication

All external APIs use **Bearer API key** auth:

```
Authorization: Bearer <api_key>
```

**API Key scopes**: `admin`, `recordings`, `webhooks`, `api`, `mcp`, `pw_reporter`

### OpenAPI Spec Status

| Aspect | Status |
|--------|--------|
| Auto-generated by FastAPI | Yes |
| Available in development | Yes (`/openapi.json`, `/docs`, `/redoc`) |
| Available in production | **No** (all disabled) |
| Static spec file | **None** exists |

**Key finding** in `be/main.py:460-469`:
```python
docs_url = "/docs" if config.ENV == "development" else None
redoc_url = "/redoc" if config.ENV == "development" else None
openapi_url = "/openapi.json" if config.ENV == "development" else None
```

---

## Part 3: Industry Patterns — How Other CLIs Do It

### `gh api` (GitHub CLI) — Raw HTTP Proxy

```bash
gh api /repos/{owner}/{repo}
gh api --method POST repos/{owner}/{repo}/issues -f title="Bug" -f body="Details"
gh api graphql -f query='{ viewer { login } }'
```

**Key design decisions**:
- Raw HTTP method + path as primary interface
- Auto-injects auth token transparently
- Default GET, auto-switches to POST when `-f`/`-F` fields present
- `--jq` for filtering JSON output (extremely useful for scripting)
- `--paginate` + `--slurp` for pagination
- `{owner}`, `{repo}` template variables from git context
- `--verbose` for debugging (shows full request/response)

### `vercel api` (Vercel CLI) — API Proxy + Discoverability

```bash
vercel api ls                    # List all available endpoints
vercel api                       # Interactive mode
vercel api [endpoint] [options]  # Direct request
```

**Notable innovations**:
- `api ls` to list available endpoints (discoverability!)
- Interactive mode for building requests
- Explicitly targets **AI agent** use cases
- Auto-auth from existing `vercel login` session

### Pattern Comparison

| Pattern | Example | Pros | Cons |
|---------|---------|------|------|
| **A: Hardcoded only** | flyctl, Railway | Discoverable, validated, polished UX | CLI lags behind API, high maintenance |
| **B: Raw API proxy only** | (hypothetical) | Full coverage day one, simple to build | Low discoverability, no validation |
| **C: Hybrid** | **gh, vercel** | Best of both worlds | More code surface |
| **D: OpenAPI-generated** | Stripe | Auto-coverage, always in sync | Requires excellent spec, generic UX |

---

## Part 4: Design Recommendation

### Recommended Approach: Pattern C (Hybrid) — Raw `api` proxy + existing hardcoded commands

**Why**: qa-use already has excellent hardcoded commands for common workflows (`test run`, `browser create`, etc.). The `api` subcommand serves as an **escape hatch** for power users, AI agents, and endpoints not yet wrapped in dedicated commands.

### Proposed `qa-use api` Command Design

#### Core UX (Modeled on `gh api`)

```bash
# GET request (default)
qa-use api /api/v1/tests

# POST with fields
qa-use api --method POST /api/v1/tests-actions/run -f test_ids='["uuid1","uuid2"]'

# Explicit HTTP method
qa-use api -X PATCH /api/v1/app-configs/uuid -f name="New Name"

# With jq filtering
qa-use api /api/v1/test-runs --jq '.[].status'

# Show response headers
qa-use api --include /api/v1/tests

# Verbose mode (full request/response)
qa-use api --verbose /api/v1/tests

# Browser API routes work too
qa-use api /browsers/v1/sessions
qa-use api -X POST /browsers/v1/sessions/{id}/action -f type=click -f ref=s1e5

# Read body from file
qa-use api -X POST /api/v1/tests-actions/run --input body.json
```

#### Discoverability (Inspired by `vercel api ls`)

```bash
# List all available API routes (grouped by surface)
qa-use api ls

# Filter by surface
qa-use api ls --filter browsers
qa-use api ls --filter tests
```

#### Command Specification

```
qa-use api [flags] <endpoint> [flags]

Arguments:
  endpoint              API endpoint path (e.g., /api/v1/tests)

Flags:
  -X, --method <method> HTTP method (default: GET, or POST if fields present)
  -f, --field <k=v>     Add a string field to request body (repeatable)
  -F, --json-field <k=v> Add a typed field (booleans, numbers, @file)
  -H, --header <h>      Add custom header (repeatable)
  --input <file>         Read request body from file (- for stdin)
  --jq <expr>            Filter JSON output with jq expression
  --include              Show response headers
  --silent               Suppress response body
  --verbose              Show full request and response
  --paginate             Auto-follow pagination (if applicable)
  --raw                  Output raw response (no formatting)
  --api-url <url>        Override API base URL

Subcommands:
  api ls                 List available API endpoints
```

#### Implementation Plan

**File structure** (follows existing qa-use patterns):

```
src/cli/commands/
  api/
    index.ts              # Parent command: new Command('api')
    request.ts            # Core: qa-use api <endpoint> [flags]
    ls.ts                 # Subcommand: qa-use api ls
    lib/
      http.ts             # Raw HTTP request builder (uses existing Axios)
      output.ts           # Response formatting (JSON pretty-print, jq, headers)
      routes.ts           # Known route definitions for `api ls`
```

**Registration** in `src/cli/index.ts`:
```typescript
import { apiCommand } from './commands/api/index.js';
program.addCommand(apiCommand);
```

**Phase 1 — Core `api` command** (can ship immediately, no backend changes):
1. Create `api/index.ts` with Commander command
2. Create `api/request.ts` — parse endpoint, method, fields, headers
3. Use existing `loadConfig()` for API key resolution
4. Use Axios for HTTP requests (already a dependency)
5. Pretty-print JSON responses with optional `--jq` filtering
6. Support `--include`, `--verbose`, `--silent` output modes

**Phase 2 — `api ls` discoverability** (no backend changes):
1. Create `api/ls.ts` — static route table from known endpoints
2. Display routes grouped by surface (`External v1`, `Browser v1`, `Reporter`)
3. Show method, path, and brief description

**Phase 3 — OpenAPI-powered `api ls`** (requires backend change):
1. Backend: Enable `/openapi.json` in production (1-line change in `be/main.py`)
2. CLI: Fetch and cache OpenAPI spec
3. Generate route list dynamically from spec
4. Optional: Auto-generate `--help` for each endpoint from spec descriptions

> **Dependency note (Phase 3):** Enabling the OpenAPI spec in production requires a small change to `be/main.py:460-462` in the `desplega-ai/desplega.ai` repository. This is NOT a blocker for Phase 1-2 which are purely client-side. A separate PR will be needed when Phase 3 is ready to be implemented.

### Dependencies

| Question | Answer |
|----------|--------|
| Can Phase 1 be implemented purely client-side? | **Yes** — uses existing config, auth, and Axios |
| Does desplega need changes for Phase 1? | **No** |
| Does desplega need changes for Phase 2? | **No** (static route table in CLI) |
| Does desplega need changes for Phase 3? | **Yes** — enable OpenAPI in production |
| What's the backend change for Phase 3? | Change `be/main.py:460-462` to expose `/openapi.json` in all environments |
| New npm dependencies needed? | Potentially `jq-wasm` or similar for `--jq` (or shell out to `jq` if available) |

### Key Design Decisions

1. **Use Axios (not native fetch)** for the raw requests — it's already a dependency and handles error responses more ergonomically. Exception: SSE endpoints would still use native fetch.

2. **Auto-prefix base URL** — if the endpoint starts with `/`, prepend the configured API URL. This mirrors `gh api` where you don't need to type `https://api.github.com`.

3. **Auto-inject auth** — use the same `Bearer <api_key>` from existing config resolution. Users shouldn't need to think about auth.

4. **JSON-first output** — pretty-print JSON by default (colored when TTY). `--raw` for unformatted. `--jq` for filtering.

5. **No GraphQL support needed** — desplega's API is REST-only, so we skip the GraphQL complexity that plagues `gh api`.

6. **Route table for `ls`** — in Phase 2, hardcode the route table from the analysis above (it changes infrequently). In Phase 3, fetch dynamically from OpenAPI spec.

---

## Code References

| File | Line | Description |
|------|------|-------------|
| `src/cli/index.ts` | 27-38 | Root Commander program + command registration |
| `src/cli/lib/config.ts` | 60-108 | Config loading (loadConfig) |
| `lib/env/index.ts` | 68-82 | Environment variable resolution (getEnvWithSource) |
| `lib/api/index.ts` | 345-987 | ApiClient class (endpoints, auth) |
| `lib/api/browser.ts` | 28-401 | BrowserApiClient class |
| `lib/api/sse.ts` | 39-125 | SSE stream parsing |

## Open Questions

1. **`jq` implementation**: Should `--jq` use a WASM-compiled jq, shell out to system `jq`, or use a JS-native jq implementation (e.g., `jq-web`, `jmespath`)?
2. **Pagination**: Desplega's APIs don't seem to use Link headers — confirm pagination pattern before implementing `--paginate`
3. **SSE/WebSocket endpoints**: Should `qa-use api` handle SSE streaming endpoints (like `/vibe-qa/cli/run`)? Or leave those to dedicated commands?
4. **OpenAPI in production**: Is there a security concern with exposing the full OpenAPI spec publicly? Consider a scoped spec that only exposes external routes.
5. **Rate limiting**: Does the desplega API have rate limits that the `api` command should surface or handle?
