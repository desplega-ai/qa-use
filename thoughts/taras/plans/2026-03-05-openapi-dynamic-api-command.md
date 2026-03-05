---
date: 2026-03-05T16:10:00Z
topic: "Dynamic OpenAPI-powered qa-use api command"
author: Claude
source: thoughts/shared/research/2026-03-04-api-subcommand-design.md
autonomy: critical
---

# Dynamic OpenAPI-powered `qa-use api` Command Implementation Plan

## Overview
Implement a new `qa-use api` command that discovers `/api/v1/*` operations dynamically from `https://api.desplega.ai/api/v1/openapi.json`, so newly added backend endpoints work in the CLI without requiring a CLI release.

## Current State Analysis
- The CLI currently has no `api` command registered in `src/cli/index.ts:31`.
- Existing clients are hardcoded endpoint wrappers (`lib/api/index.ts:345`, `lib/api/browser.ts:28`) and do not consume OpenAPI.
- Prior research already identified a hybrid direction, but it assumed static route tables before OpenAPI production availability (`thoughts/shared/research/2026-03-04-api-subcommand-design.md:342`).
- OpenAPI is now available at `/api/v1/openapi.json` (validated against the live endpoint).

## Desired End State
- `qa-use api <path>` supports arbitrary `/api/v1/*` calls with no hardcoded endpoint list.
- `qa-use api ls` is generated from live OpenAPI (with deterministic local cache + refresh), not from a manually maintained route table.
- If backend adds a new `/api/v1/*` endpoint tomorrow, it appears in `api ls` and can be called immediately.
- The command remains resilient when OpenAPI fetch fails (uses last known good cached spec with explicit stale warning).

### Key Discoveries:
- Command registration point: `src/cli/index.ts:31`
- Current API client base URL/auth plumbing: `lib/api/index.ts:352`, `lib/api/index.ts:371`
- Existing config loader used by CLI commands: `src/cli/lib/config.ts`
- Research phase that can now be replaced by dynamic OpenAPI: `thoughts/shared/research/2026-03-04-api-subcommand-design.md:347`

## Quick Verification Reference

Common commands to verify implementation:
- `bun run check:fix`
- `bun test`
- `bun run cli --help`
- `bun run cli api --help`

Key files to check:
- `src/cli/index.ts`
- `src/cli/commands/api/index.ts`
- `src/cli/commands/api/request.ts`
- `src/cli/commands/api/ls.ts`
- `src/cli/commands/api/lib/openapi-spec.ts`
- `src/cli/commands/api/lib/http.ts`
- `src/cli/commands/api/*.test.ts`

## What We're NOT Doing
- No backend API changes in this plan.
- No OpenAPI generation for `/browsers/v1/*` or `/pw-reporter/*` in this first scope.
- No automatic TypeScript SDK generation from the spec.
- No interactive TUI request builder in this iteration.

## Implementation Approach
Build an OpenAPI-aware API command layer that always prefers live spec data for `/api/v1/*`, with deterministic cache behavior:
1. Fetch and validate OpenAPI spec from `${apiUrl}/api/v1/openapi.json`.
2. Cache by base URL and ETag/hash in local CLI cache directory.
3. Resolve operations dynamically (method/path/params/body metadata) from spec at runtime.
4. Execute raw requests through a shared HTTP helper with existing auth resolution.
5. Render `api ls` from spec-derived operations only (no static table).

---

## Phase 1: OpenAPI Spec Layer and Deterministic Cache

### Overview
Create the foundational OpenAPI loader, validator, and cache so all downstream command behavior can be dynamic and stable.

### Changes Required:

#### 1. OpenAPI loading and normalization
**File**: `src/cli/commands/api/lib/openapi-spec.ts` (new)
**Changes**:
- Add `loadOpenApiSpec({ apiUrl, apiKey, refreshMode })` that:
  - Fetches `${apiUrl}/api/v1/openapi.json`.
  - Validates minimum structure (`openapi`, `paths`, `components?.securitySchemes`).
  - Normalizes operations into an internal index keyed by `METHOD /path`.

#### 2. Deterministic cache implementation
**File**: `src/cli/commands/api/lib/openapi-cache.ts` (new)
**Changes**:
- Store cache in CLI local data directory (same style as existing local CLI state handling).
- Cache metadata: `fetchedAt`, `etag` (if present), `specHash`, `apiUrl`.
- Deterministic behavior:
  - Default mode: try conditional refresh first; fallback to cache on transient errors.
  - `--refresh`: force re-fetch.
  - `--offline`: use cache only; fail with actionable error if cache missing.

#### 3. Shared error/warning surfaces
**File**: `src/cli/commands/api/lib/openapi-errors.ts` (new)
**Changes**:
- Explicit user-facing messages for:
  - missing spec,
  - invalid spec,
  - stale cache fallback,
  - offline cache miss.

### Success Criteria:

#### Automated Verification:
- [x] Code style/type checks pass: `bun run check:fix`
- [x] OpenAPI spec layer tests pass: `bun test src/cli/commands/api/lib/openapi-*.test.ts`
- [x] Full test suite still passes: `bun test`

#### Manual Verification:
- [x] First fetch from a clean state creates cache successfully.
- [x] Forcing offline mode with existing cache loads spec without network.
- [x] Simulated fetch failure still loads last known spec and emits stale warning.

**Implementation Note**: After completing this phase, pause for manual confirmation before moving on.

---

## Phase 2: Dynamic `qa-use api` Request Command

### Overview
Implement `qa-use api <endpoint>` as a generic request command that uses OpenAPI metadata dynamically for parameter/body guidance and behavior.

### Changes Required:

#### 1. API command registration
**File**: `src/cli/index.ts`
**Changes**:
- Register new top-level `api` command.

#### 2. Request command implementation
**File**: `src/cli/commands/api/request.ts` (new)
**Changes**:
- Implement flags:
  - `-X, --method`
  - `-f, --field`
  - `-H, --header`
  - `--input`
  - `--include`
  - `--raw`
  - `--refresh`
  - `--offline`
- Resolve operation dynamically from OpenAPI for `/api/v1/*`.
- Validate path/query/body at a practical level (presence/type basics) using schema hints.
- Preserve escape hatch behavior: still allow unknown endpoints if user explicitly passes path and method.

#### 3. HTTP execution helper
**File**: `src/cli/commands/api/lib/http.ts` (new)
**Changes**:
- Centralize request execution via Axios using existing auth/config conventions.
- Implement consistent error rendering from response status/body.

### Success Criteria:

#### Automated Verification:
- [x] Command wiring and request tests pass: `bun test src/cli/commands/api/request.test.ts`
- [x] CLI help renders correctly: `bun run cli api --help`
- [x] Project checks pass: `bun run check:fix`

#### Manual Verification:
- [x] `qa-use api /api/v1/tests` succeeds without hardcoded route logic.
- [x] `qa-use api -X POST /api/v1/tests-actions/run ...` accepts body fields and executes.
- [ ] Newly discoverable path in live spec can be called without code change.

**Implementation Note**: After completing this phase, pause for manual confirmation before moving on.

---

## Phase 3: Dynamic `qa-use api ls` from OpenAPI

### Overview
Replace static route listing with a fully dynamic OpenAPI-backed endpoint index.

### Changes Required:

#### 1. `api ls` command
**File**: `src/cli/commands/api/ls.ts` (new)
**Changes**:
- Render method + path + summary from live/cached OpenAPI.
- Optional filters: method, text query, tag.
- Display source indicator (`live` vs `cache` + stale flag).

#### 2. Shared formatters
**File**: `src/cli/commands/api/lib/output.ts` (new)
**Changes**:
- Table-like text output for human readability.
- JSON mode for automation (`--json`).

#### 3. Parent command composition
**File**: `src/cli/commands/api/index.ts` (new)
**Changes**:
- Compose `api` root + `ls` subcommand + direct request behavior.

### Success Criteria:

#### Automated Verification:
- [x] `api ls` tests pass: `bun test src/cli/commands/api/ls.test.ts`
- [x] End-to-end command registration test passes: `bun test src/cli/commands/api/index.test.ts`
- [x] Lint/type/format checks pass: `bun run check:fix`

#### Manual Verification:
- [x] `qa-use api ls` lists routes directly from current OpenAPI spec.
- [ ] After OpenAPI content changes, `qa-use api ls --refresh` reflects changes immediately.
- [x] `qa-use api ls --offline` shows cached results deterministically.

**Implementation Note**: After completing this phase, pause for manual confirmation before moving on.

---

## Phase 4: Docs, Guardrails, and Regression Coverage

### Overview
Finalize documentation and guardrails so dynamic behavior stays maintainable and predictable.

### Changes Required:

#### 1. CLI docs/help updates
**File**: `README.md` and relevant CLI docs
**Changes**:
- Document dynamic OpenAPI behavior and cache semantics.
- Add examples for refresh/offline modes.

#### 2. Regression and failure-mode tests
**File**: `src/cli/commands/api/*.test.ts`
**Changes**:
- Add cases for:
  - missing/invalid spec,
  - stale cache fallback,
  - unknown route handling,
  - auth failures.

### Success Criteria:

#### Automated Verification:
- [x] Full verification passes: `bun run check:fix`
- [x] Full test suite passes: `bun test`
- [x] CLI docs examples remain valid via smoke checks: `bun run cli api --help`

#### Manual Verification:
- [ ] New endpoint added to OpenAPI appears in `qa-use api ls` without CLI code edits.
- [ ] Same new endpoint is callable via `qa-use api <new-path>` without CLI update.
- [x] Offline cache path is understandable and works as documented.

**Implementation Note**: After completing this phase, pause for manual confirmation before moving on.

---

## Testing Strategy
- Unit tests for parser/cache/formatters.
- Command-level tests for argument parsing and behavior.
- Integration-style tests with mocked OpenAPI responses and live-manual verification against `api.desplega.ai`.
- Failure-path tests are mandatory (spec unavailable, invalid JSON, auth error).

## Manual E2E (Real Backend)

Run these commands against the real API after implementation:

```bash
bun run cli api ls --refresh
bun run cli api /api/v1/tests
bun run cli api /api/v1/app-configs
bun run cli api -X GET /api/v1/test-runs -f limit=5
bun run cli api -X POST /api/v1/tests-actions/run --input /tmp/run-tests-body.json
bun run cli api ls --offline
bun run cli api /api/v1/tests --offline
```

Create request body file for run endpoint before the POST call (example):

```json
{
  "test_ids": ["<test-id-1>", "<test-id-2>"]
}
```

## References
- Related research: `thoughts/shared/research/2026-03-04-api-subcommand-design.md`
- CLI entrypoint: `src/cli/index.ts`
- Existing API client/auth baseline: `lib/api/index.ts`
