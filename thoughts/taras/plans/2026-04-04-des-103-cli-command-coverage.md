---
date: 2026-04-04T12:00:00Z
topic: "DES-103: qa-use CLI Command Coverage for /api/v1 Endpoints"
status: in-progress
linear_issue: DES-103
---

# DES-103: Add `qa-use` CLI Command Coverage for New `/api/v1` Endpoints

## Overview

Add first-class CLI commands to `qa-use` that map to the expanded public `/api/v1` surface. This covers ~40 new commands across 9 resource groups (suites, test runs, issues, app configs, app contexts, personas, data assets, usage) plus enhancements to existing `test` commands.

The existing `qa-use api` command already provides dynamic access to any `/api/v1/` endpoint. These first-class commands provide better discoverability, human-readable output, built-in help, and input validation.

**Linear Issue:** DES-103
**Parent Issue:** DES-101

## Current State Analysis

### Existing CLI Structure
- **Entry point:** `src/cli/index.ts` — Commander.js program with 9 top-level commands
- **Command groups:** `test/` (10 subcommands), `browser/` (34 subcommands), `api/` (4 subcommands + request action)
- **API clients:** `ApiClient` (lib/api/index.ts) for `/vibe-qa/` routes, `BrowserApiClient` for `/browsers/v1/`
- **Dynamic API:** `executeApiRequest()` in `src/cli/commands/api/lib/http.ts` — stateless HTTP wrapper used by `api` command

### What Exists Already
| Command | Status | Notes |
|---------|--------|-------|
| `test list` | Exists | Missing `--json`, cloud mode doesn't show test ID as separate column |
| `test info` | Exists | Requires `--id <uuid>` for cloud; should accept positional `<id>` |
| `test runs` | Exists (leaf) | Lists runs only; no info/logs/steps/cancel subcommands |
| `test run` | Exists | Execution command (different from `test runs` history) |
| `api` command | Exists | Can call any `/api/v1/` endpoint dynamically — but raw JSON output |

### Available `/api/v1/` Endpoints (confirmed via OpenAPI)
44 endpoints across: tests, test-runs, test-suites, test-suite-runs, issues, app-configs, app-contexts, personas, data-assets, usage.

### Key Discoveries:
- No shared table formatter exists — each command does manual ANSI padding (`src/cli/commands/test/runs.ts:145-154`)
- No shared "require API key + create request" helper — every command repeats the same 8 lines of boilerplate
- `executeApiRequest()` (`src/cli/commands/api/lib/http.ts:39`) is the cleanest HTTP layer for `/api/v1/` calls
- Command pattern: every leaf command exports a `Command`, registers in group's `index.ts`, group registers in `src/cli/index.ts`
- All commands use `loadConfig()` from `src/cli/lib/config.ts:86` and factory functions `createApiClient()`/`createBrowserClient()`

## Desired End State

After implementation:
1. `qa-use --help` shows all new command groups alongside existing ones
2. Each resource has discoverable CLI commands with `--help`, `--json`, pagination
3. All commands use a consistent pattern: table output for lists, detailed view for info, confirmation for destructive actions
4. `test list` shows richer columns with `--json` support
5. `test runs` is a command group with `list`, `info`, `logs`, `steps`, `cancel`
6. E2E regression test covers new command groups

### Verification:
```bash
bun run check:fix                    # Linting + formatting
bun run typecheck                    # Type checking
bun test                             # Unit tests
bun run scripts/e2e.ts               # E2E regression
qa-use suite list --help             # New command help
qa-use usage                         # New usage command
```

## Quick Verification Reference

Common commands to verify the implementation:
- `bun run check:fix` — linting + formatting
- `bun run typecheck` — TypeScript type checking
- `bun test` — unit tests
- `bun run scripts/e2e.ts` — E2E regression

Key files to check:
- `src/cli/lib/api-helpers.ts` — shared API request helper + input parsing
- `src/cli/lib/table.ts` — shared table formatter
- `src/cli/index.ts` — command registration (all new groups)
- `src/cli/commands/test/runs/index.ts` — restructured runs group

## What We're NOT Doing

- **No backend changes** — that's DES-102
- **No new `ApiClient` methods** — using `executeApiRequest()` for all `/api/v1/` calls instead of bloating the client class
- **No SSE/streaming for new commands** — action endpoints (suite run, cancel) are simple POST, poll for status
- **No test-suite-runs commands** — not in the issue scope (but endpoints exist for future work)
- **No tests-actions/promote command** — not in the issue scope

## Implementation Approach

**HTTP Layer:** All new commands use `executeApiRequest()` from `src/cli/commands/api/lib/http.ts`. This avoids adding 30+ methods to `ApiClient` and is already battle-tested by the `api` command.

**Shared Helpers:** Create two new utility modules:
1. `src/cli/lib/api-helpers.ts` — config-aware wrapper: loads config, checks API key, makes request, handles errors
2. `src/cli/lib/table.ts` — reusable table formatter with column definitions, auto-width, JSON mode, pagination hints

**File Structure:** Each resource group gets its own directory under `src/cli/commands/` with an `index.ts` and individual command files, matching the existing `browser/` and `test/` patterns.

**Naming:** Kebab-case for multi-word commands (`app-config`, `app-context`, `data-asset`), matching the issue specification.

---

## Phase 1: Shared Infrastructure

### Overview
Create reusable helper modules that all subsequent phases depend on. This eliminates repeated boilerplate across ~40 new commands and establishes consistent patterns.

### Changes Required:

#### 1. API Request Helper
**File**: `src/cli/lib/api-helpers.ts` (new)
**Changes**: Create a config-aware wrapper around `executeApiRequest` that handles:
- API key validation with standard error message
- Auth header injection from config
- Custom header merging from config
- HTTP error formatting and throwing
- Pagination query param construction

Key exports:
```typescript
// Validates API key is present, exits with helpful message if not
function requireApiKey(config: CliConfig): asserts config is CliConfig & { api_key: string }

// Makes an authenticated API request, throws on HTTP errors
async function apiCall(config: CliConfig, method: string, path: string, options?: {
  query?: Record<string, string>;
  body?: unknown;
}): Promise<unknown>

// Builds pagination query params from common CLI options
function paginationQuery(options: { limit?: string; offset?: string }): Record<string, string>
```

#### 2. Table Formatter
**File**: `src/cli/lib/table.ts` (new)
**Changes**: Create a reusable table formatter that supports:
- Column definitions with key, header, width (auto or fixed), optional format/color functions
- JSON mode (`--json` flag outputs raw data instead of table)
- Empty state with customizable message
- Pagination hint when results hit the limit
- Title/header line

Key exports:
```typescript
interface Column {
  key: string;
  header: string;
  width?: number;  // auto-calculated from data if omitted
  format?: (value: unknown, row: Record<string, unknown>) => string;
}

function printTable(columns: Column[], rows: Record<string, unknown>[], options?: {
  json?: boolean;
  title?: string;
  emptyMessage?: string;
  limit?: number;
  offset?: number;
}): void

// Pre-built formatters for common patterns
function formatStatus(status: string): string
function formatTimestamp(iso: string): string
function formatDuration(seconds: number | undefined): string
function truncate(str: string, maxLen: number): string
```

#### 3. Resource Input Parsing
**File**: `src/cli/lib/api-helpers.ts` (same file as above)
**Changes**: Shared helper for create/update commands that need body input. Supports three input methods (in priority order):
1. **Stdin pipe**: `echo '{"name":"foo"}' | qa-use suite create`
2. **`--input <file>`**: Read JSON from a file
3. **`-F/--field <key=value>`**: Flat top-level field overrides (merged on top of stdin/file input)

For nested objects, users should use `--input` or stdin with a JSON payload. `-F` is intentionally flat (top-level keys only) to keep it simple. Values that parse as valid JSON are treated as JSON (e.g., `-F test_ids='["id1","id2"]'`).

```typescript
// Reads body from stdin (if piped), --input file, and -F fields. Merges all three.
async function parseResourceInput(options: {
  input?: string;
  field?: string[];
}): Promise<Record<string, unknown>>

// Collector for repeatable -F/--field option (reuses api command pattern)
function collectFields(value: string, previous: string[]): string[]
```

#### 4. Confirmation Prompt Utility
**File**: `src/cli/lib/api-helpers.ts` (same file as above)
**Changes**: Add a confirmation prompt for destructive operations (delete):
```typescript
async function confirmAction(message: string): Promise<boolean>
```
Uses `readline` from Node.js stdlib for interactive Y/n prompt.

#### 5. Unit Tests
**File**: `src/cli/lib/api-helpers.test.ts` (new)
**File**: `src/cli/lib/table.test.ts` (new)
**Changes**: Tests for:
- `requireApiKey` exits when key missing
- `apiCall` constructs correct request with auth/headers
- `apiCall` throws formatted error on HTTP 4xx/5xx
- `paginationQuery` handles defaults and explicit values
- `parseResourceInput` reads from file, merges fields, handles JSON values in fields
- `collectFields` accumulates repeatable values
- `printTable` renders columns, handles JSON mode, empty state, pagination hint
- `formatStatus`, `formatTimestamp`, `formatDuration` formatting

### Success Criteria:

#### Automated Verification:
- [x] Type check passes: `bun run typecheck`
- [x] Lint/format passes: `bun run check:fix`
- [x] Unit tests pass: `bun test src/cli/lib/api-helpers.test.ts src/cli/lib/table.test.ts`
- [x] New files exist: `ls src/cli/lib/api-helpers.ts src/cli/lib/table.ts`

#### Manual Verification:
- [ ] Import and use `apiCall` from a scratch script to verify it makes real API calls
- [ ] Import `printTable` and verify it renders a sample table correctly to stdout

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 2: Enhance Existing Test Commands

### Overview
Improve `test list` and `test info` per the issue requirements: add `--json` to list, show test IDs as columns, improve cloud/local messaging.

### Changes Required:

#### 1. Enhance `test list`
**File**: `src/cli/commands/test/list.ts`
**Changes**:
- Add `--json` option flag
- **Cloud mode**: Use `printTable()` with columns: ID (truncated UUID), NAME, STATUS, TAGS, UPDATED
  - Fetch from `/api/v1/tests` (via `apiCall`) instead of `client.listTests()` to get richer data (the `/api/v1/tests` endpoint returns more fields than the internal `/vibe-qa/tests`)
  - Fall back to existing `client.listTests()` if `/api/v1/` call fails
- **Local mode**: Use `printTable()` with columns: NAME, STEPS, DEPS, TAGS
- **JSON mode**: Output raw array for both cloud and local modes
- Add `--offset <n>` option for cloud pagination

#### 2. Enhance `test info`
**File**: `src/cli/commands/test/info.ts`
**Changes**:
- Accept positional `<id-or-name>` that auto-detects UUID format
  - If argument looks like a UUID -> fetch from cloud via `apiCall('GET', '/api/v1/tests/{id}')`
  - If argument is a name -> resolve locally (existing behavior)
  - Keep `--id` option as explicit override (backward compat)
- Add `--json` option for machine-readable output
- **Cloud mode**: Show richer detail from `/api/v1/tests/{id}` (status, created_at, updated_at, last_run info)
- **Local mode**: Show file path prominently: `Source: ./qa-tests/auth/login.yaml (local file)`
- Improve help text to explain local vs cloud dichotomy:
  ```
  Show test definition details.

  For local tests, provide the test name (relative to test directory):
    qa-use test info auth/login

  For cloud tests, provide the UUID:
    qa-use test info 550e8400-e29b-41d4-a716-446655440000
  ```

### Success Criteria:

#### Automated Verification:
- [x] Type check passes: `bun run typecheck`
- [x] Lint/format passes: `bun run check:fix`
- [x] Tests pass: `bun test`

#### Manual Verification:
- [ ] `bun run cli test list --cloud` shows table with ID column
- [ ] `bun run cli test list --cloud --json` outputs valid JSON array
- [ ] `bun run cli test list` (local) shows table with step counts
- [ ] `bun run cli test list --json` (local) outputs valid JSON
- [ ] `bun run cli test info <uuid>` fetches from cloud (no `--id` needed)
- [ ] `bun run cli test info example` shows local file path
- [ ] `bun run cli test info --help` shows improved usage text

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 3: Test Runs Restructure

### Overview
Convert `test runs` from a leaf command into a command group with `list`, `info`, `logs`, `steps`, and `cancel` subcommands.

### Changes Required:

#### 1. Create Runs Command Group Directory
**Directory**: `src/cli/commands/test/runs/` (new)

#### 2. Migrate Existing `test runs` to `test runs list`
**File**: `src/cli/commands/test/runs/list.ts` (new)
**Changes**: Move current `runs.ts` logic into `list.ts` with these improvements:
- Use `printTable()` from shared table module instead of manual formatting
- Use `apiCall()` instead of `client.listTestRuns()` to call `/api/v1/test-runs`
- Keep existing options: `[test-name]`, `--id`, `--status`, `--limit`, `--offset`, `--json`
- Show `test_id` column; if the API response includes `test_name`, show that too (no extra API calls — only use what the response gives us)

#### 3. Test Run Info
**File**: `src/cli/commands/test/runs/info.ts` (new)
**Changes**: Show detailed test run information
- Argument: `<run-id>` (required UUID)
- Options: `--json`
- API: `GET /api/v1/test-runs/{run_id}`
- Display: status, duration, test name/ID, created_at, started_at, completed_at, error info, app_url, config details

#### 4. Test Run Logs
**File**: `src/cli/commands/test/runs/logs.ts` (new)
**Changes**: Fetch console/network logs for a completed run
- Argument: `<run-id>` (required UUID)
- Options: `--json`, `--type <console|network>` (default: console)
- API: `GET /api/v1/test-runs/{run_id}/logs`
- Display: timestamped log lines, filterable by type

#### 5. Test Run Steps
**File**: `src/cli/commands/test/runs/steps.ts` (new)
**Changes**: Show step-by-step execution details
- Argument: `<run-id>` (required UUID)
- Options: `--json`, `--verbose` (show full step details including screenshots)
- API: `GET /api/v1/test-runs/{run_id}/steps`
- Display: table with STEP#, ACTION, STATUS, DURATION, optional error message

#### 6. Cancel Test Run
**File**: `src/cli/commands/test/runs/cancel.ts` (new)
**Changes**: Cancel a running test
- Argument: `<run-id>` (required UUID)
- Confirmation prompt before canceling (skip with `--force`)
- API: `POST /api/v1/test-runs/{run_id}/cancel`
- Display: success/failure message

#### 7. Group Index
**File**: `src/cli/commands/test/runs/index.ts` (new)
**Changes**: Register all runs subcommands as a Commander group:
```typescript
export const runsCommand = new Command('runs')
  .description('View and manage test run history');
runsCommand.addCommand(listCommand);
runsCommand.addCommand(infoCommand);
runsCommand.addCommand(logsCommand);
runsCommand.addCommand(stepsCommand);
runsCommand.addCommand(cancelCommand);
```

#### 8. Update Test Command Group
**File**: `src/cli/commands/test/index.ts`
**Changes**:
- Replace `import { runsCommand } from './runs.js'` with `import { runsCommand } from './runs/index.js'`
- Delete old `src/cli/commands/test/runs.ts`

### Success Criteria:

#### Automated Verification:
- [x] Type check passes: `bun run typecheck`
- [x] Lint/format passes: `bun run check:fix`
- [x] Tests pass: `bun test`
- [x] Old file removed: `! test -f src/cli/commands/test/runs.ts`
- [x] New directory exists: `ls src/cli/commands/test/runs/`

#### Manual Verification:
- [ ] `bun run cli test runs list` shows same output as old `test runs`
- [ ] `bun run cli test runs list --json` outputs valid JSON
- [ ] `bun run cli test runs info <run-id>` shows detailed run info
- [ ] `bun run cli test runs logs <run-id>` shows log output
- [ ] `bun run cli test runs steps <run-id>` shows step table
- [ ] `bun run cli test runs cancel <run-id>` prompts and cancels (test with a running run)
- [ ] `bun run cli test runs --help` lists all subcommands

**Implementation Note**: This is a **breaking change** — bare `qa-use test runs` will now show help instead of listing runs (users must use `qa-use test runs list`). This is acceptable per review decision. Ensure all skills, docs, and CLAUDE.md references to `test runs` are updated to `test runs list`. Version bump required. Pause for manual confirmation after completing this phase.

---

## Phase 4: Suite Commands

### Overview
Create a new `suite` command group for test suite CRUD and execution.

### Changes Required:

#### 1. Suite Command Group
**Directory**: `src/cli/commands/suite/` (new)

**Files:**
| File | Command | API Endpoint | Method |
|------|---------|-------------|--------|
| `index.ts` | Group registration | -- | -- |
| `list.ts` | `suite list` | `/api/v1/test-suites` | GET |
| `info.ts` | `suite info <id>` | `/api/v1/test-suites/{suite_id}` | GET |
| `create.ts` | `suite create` | `/api/v1/test-suites` | POST |
| `update.ts` | `suite update <id>` | `/api/v1/test-suites/{suite_id}` | PUT |
| `delete.ts` | `suite delete <id>` | `/api/v1/test-suites/{suite_id}` | DELETE |
| `run.ts` | `suite run <id>` | `/api/v1/test-suites-actions/run` | POST |

**Command details:**

- **`suite list`**: Options `--limit`, `--offset`, `--json`. Table columns: ID, NAME, TEST_COUNT, UPDATED.
- **`suite info <id>`**: Options `--json`. Display: name, description, test IDs/names, schedule, created/updated timestamps.
- **`suite create`**: Input via stdin pipe, `--input <file>`, or `-F/--field <key=value>` (repeatable, flat keys only; use `--input`/stdin for nested JSON). Fields: name (required), description, test_ids. Prints created suite ID on success.
- **`suite update <id>`**: Same input options as create. PUT semantics — sends full resource.
- **`suite delete <id>`**: Confirmation prompt (skip with `--force`). Prints success/failure.
- **`suite run <id>`**: Options `--json`. Posts `{ suite_id: id }` to action endpoint. Prints suite run ID and status on success. Suggests `qa-use api /api/v1/test-suite-runs/{suite_run_id}` to check progress (dedicated suite-run commands are out of scope for this issue).

#### 2. Register in CLI Entry Point
**File**: `src/cli/index.ts`
**Changes**: Add `import { suiteCommand } from './commands/suite/index.js'` and `program.addCommand(suiteCommand)`.

### Success Criteria:

#### Automated Verification:
- [x] Type check passes: `bun run typecheck`
- [x] Lint/format passes: `bun run check:fix`
- [x] Tests pass: `bun test`
- [x] Files exist: `ls src/cli/commands/suite/{index,list,info,create,update,delete,run}.ts`

#### Manual Verification:
- [ ] `bun run cli suite --help` shows all subcommands
- [ ] `bun run cli suite list` shows table of suites
- [ ] `bun run cli suite list --json` outputs valid JSON
- [ ] `bun run cli suite info <id>` shows detailed suite info
- [ ] `bun run cli suite create -F name="Test Suite"` creates a suite (confirm via `suite list`)
- [ ] `bun run cli suite update <id> -F description="Updated"` updates successfully
- [ ] `bun run cli suite delete <id>` prompts and deletes
- [ ] `bun run cli suite run <id>` triggers a suite run

**Implementation Note**: After completing this phase, pause for manual confirmation. This is the first new resource group — validate the pattern thoroughly before replicating in subsequent phases.

---

## Phase 5: Issues & Usage Commands

### Overview
Add read-only `issues` command group and `usage` command.

### Changes Required:

#### 1. Issues Command Group
**Directory**: `src/cli/commands/issues/` (new)

**Files:**
| File | Command | API Endpoint | Method |
|------|---------|-------------|--------|
| `index.ts` | Group registration | -- | -- |
| `list.ts` | `issues list` | `/api/v1/issues` | GET |
| `info.ts` | `issues info <id>` | `/api/v1/issues/{issue_id}` | GET |
| `occurrences.ts` | `issues occurrences <id>` | `/api/v1/issues/{issue_id}/occurrences` | GET |

**Command details:**

- **`issues list`**: Options `--limit`, `--offset`, `--json`, `--status <status>`. Table columns: ID, TITLE/DESCRIPTION, STATUS, OCCURRENCES, LAST_SEEN.
- **`issues info <id>`**: Options `--json`. Display: title, description, status, severity, first_seen, last_seen, occurrence_count, affected tests.
- **`issues occurrences <id>`**: Options `--limit`, `--offset`, `--json`. Table columns: OCCURRENCE_ID, TEST_RUN_ID, TIMESTAMP, ERROR_MESSAGE (truncated).

#### 2. Usage Command
**File**: `src/cli/commands/usage.ts` (new, standalone — not a group)
**Changes**: Single command with optional `--detailed` flag.

- **`usage`** (default): GET `/api/v1/usage`. Display summary: total runs, passed/failed counts, total duration, period.
- **`usage --detailed`**: GET `/api/v1/usage/lines`. Table: DATE, RUNS, PASSED, FAILED, DURATION, COST. Options: `--json`, `--limit`, `--offset`.

#### 3. Register in CLI Entry Point
**File**: `src/cli/index.ts`
**Changes**: Add imports and `program.addCommand()` for both `issuesCommand` and `usageCommand`.

### Success Criteria:

#### Automated Verification:
- [x] Type check passes: `bun run typecheck`
- [x] Lint/format passes: `bun run check:fix`
- [x] Tests pass: `bun test`
- [x] Files exist: `ls src/cli/commands/issues/{index,list,info,occurrences}.ts src/cli/commands/usage.ts`

#### Manual Verification:
- [ ] `bun run cli issues list` shows issues table
- [ ] `bun run cli issues info <id>` shows issue detail
- [ ] `bun run cli issues occurrences <id>` shows occurrence table
- [ ] `bun run cli usage` shows usage summary
- [ ] `bun run cli usage --detailed` shows line-item table
- [ ] All commands work with `--json`

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 6: App Config & App Context Commands

### Overview
Add `app-config` and `app-context` command groups. These share the same CRUD pattern.

### Changes Required:

#### 1. App Config Command Group
**Directory**: `src/cli/commands/app-config/` (new)

**Files:**
| File | Command | API Endpoint | Method |
|------|---------|-------------|--------|
| `index.ts` | Group registration | -- | -- |
| `list.ts` | `app-config list` | `/api/v1/app-configs` | GET |
| `info.ts` | `app-config info <id>` | `/api/v1/app-configs/{config_id}` | GET |
| `create.ts` | `app-config create` | `/api/v1/app-configs` | POST |
| `update.ts` | `app-config update <id>` | `/api/v1/app-configs/{config_id}` | PATCH |
| `delete.ts` | `app-config delete <id>` | `/api/v1/app-configs/{config_id}` | DELETE |

**Note:** The issue only specifies create/update/delete, but list and info endpoints exist and are useful for verification. Including them for completeness.

**Command details:**
- **`app-config list`**: Table columns: ID, NAME, APP_URL, CREATED.
- **`app-config info <id>`**: Full config detail including auth settings, selectors, etc.
- **`app-config create`**: Input via stdin pipe, `--input <file>`, or `-F/--field <key=value>` (flat keys; use `--input`/stdin for nested auth config). Key fields: name, app_url, auth config.
- **`app-config update <id>`**: PATCH with provided fields only.
- **`app-config delete <id>`**: Confirmation prompt.

#### 2. App Context Command Group
**Directory**: `src/cli/commands/app-context/` (new)

**Files:**
| File | Command | API Endpoint | Method |
|------|---------|-------------|--------|
| `index.ts` | Group registration | -- | -- |
| `list.ts` | `app-context list` | `/api/v1/app-contexts` | GET |
| `info.ts` | `app-context info <id>` | `/api/v1/app-contexts/{context_id}` | GET |
| `create.ts` | `app-context create` | `/api/v1/app-contexts` | POST |
| `update.ts` | `app-context update <id>` | `/api/v1/app-contexts/{context_id}` | PATCH |
| `delete.ts` | `app-context delete <id>` | `/api/v1/app-contexts/{context_id}` | DELETE |

**Command details:**
- **`app-context list`**: Table columns: ID, NAME, DESCRIPTION (truncated), CREATED.
- **`app-context info <id>`**: Full context detail.
- **`app-context create/update/delete`**: Same input pattern as app-config.

#### 3. Register in CLI Entry Point
**File**: `src/cli/index.ts`
**Changes**: Add imports and `program.addCommand()` for both groups.

### Success Criteria:

#### Automated Verification:
- [ ] Type check passes: `bun run typecheck`
- [ ] Lint/format passes: `bun run check:fix`
- [ ] Tests pass: `bun test`
- [ ] Files exist: `ls src/cli/commands/app-config/ src/cli/commands/app-context/`

#### Manual Verification:
- [ ] `bun run cli app-config list` shows configs
- [ ] `bun run cli app-config create --input /tmp/config.json` creates config
- [ ] `bun run cli app-config update <id> -F name="Updated"` updates
- [ ] `bun run cli app-config delete <id>` deletes with confirmation
- [ ] `bun run cli app-context list` shows contexts
- [ ] `bun run cli app-context create --input /tmp/context.json` creates
- [ ] `bun run cli app-context delete <id>` deletes with confirmation
- [ ] All commands work with `--json`

**Implementation Note**: After completing this phase, pause for manual confirmation. Both groups follow identical patterns — implement app-config first, then replicate for app-context.

---

## Phase 7: Persona & Data Asset Commands

### Overview
Add `persona` and `data-asset` command groups. Data asset has a special `upload` command for file upload.

### Changes Required:

#### 1. Persona Command Group
**Directory**: `src/cli/commands/persona/` (new)

**Files:**
| File | Command | API Endpoint | Method |
|------|---------|-------------|--------|
| `index.ts` | Group registration | -- | -- |
| `list.ts` | `persona list` | `/api/v1/personas` | GET |
| `info.ts` | `persona info <id>` | `/api/v1/personas/{persona_id}` | GET |
| `create.ts` | `persona create` | `/api/v1/personas` | POST |
| `update.ts` | `persona update <id>` | `/api/v1/personas/{persona_id}` | PATCH |
| `delete.ts` | `persona delete <id>` | `/api/v1/personas/{persona_id}` | DELETE |

**Command details:**
- **`persona list`**: Table columns: ID, NAME, DESCRIPTION (truncated), CREATED.
- **`persona info <id>`**: Full persona detail.
- **`persona create/update/delete`**: Same pattern as previous CRUD groups.

#### 2. Data Asset Command Group
**Directory**: `src/cli/commands/data-asset/` (new)

**Files:**
| File | Command | API Endpoint | Method |
|------|---------|-------------|--------|
| `index.ts` | Group registration | -- | -- |
| `list.ts` | `data-asset list` | `/api/v1/data-assets` | GET |
| `info.ts` | `data-asset info <id>` | `/api/v1/data-assets/{asset_id}` | GET |
| `upload.ts` | `data-asset upload <file>` | `/api/v1/data-assets` | POST (multipart) |
| `delete.ts` | `data-asset delete <id>` | `/api/v1/data-assets/{asset_id}` | DELETE |

**Command details:**
- **`data-asset list`**: Table columns: ID, NAME, TYPE, SIZE, CREATED.
- **`data-asset info <id>`**: Full asset detail including download URL.
- **`data-asset upload <file>`**: Takes a local file path as positional argument. Options: `-F name=<name>` to override name (defaults to filename). Uses `multipart/form-data` via axios — this is the only command that can't use `executeApiRequest` directly. Add a dedicated upload function in `api-helpers.ts` using `FormData` from Node.js.
- **`data-asset delete <id>`**: Confirmation prompt.

#### 3. Register in CLI Entry Point
**File**: `src/cli/index.ts`
**Changes**: Add imports and `program.addCommand()` for both groups.

### Success Criteria:

#### Automated Verification:
- [ ] Type check passes: `bun run typecheck`
- [ ] Lint/format passes: `bun run check:fix`
- [ ] Tests pass: `bun test`
- [ ] Files exist: `ls src/cli/commands/persona/ src/cli/commands/data-asset/`

#### Manual Verification:
- [ ] `bun run cli persona list` shows personas
- [ ] `bun run cli persona create --input /tmp/persona.json` creates persona
- [ ] `bun run cli persona delete <id>` deletes with confirmation
- [ ] `bun run cli data-asset list` shows assets
- [ ] `bun run cli data-asset upload /tmp/test-data.csv` uploads successfully
- [ ] `bun run cli data-asset info <id>` shows asset detail
- [ ] `bun run cli data-asset delete <id>` deletes with confirmation
- [ ] All commands work with `--json`

**Implementation Note**: After completing this phase, pause for manual confirmation. The `data-asset upload` command requires special handling for multipart file upload — test this extra carefully.

---

## Phase 8: Help Text, Docs & E2E Tests

### Overview
Update CLI help text, documentation, and extend the E2E regression test to cover new command groups.

### Changes Required:

#### 1. Update CLI Help Text
**File**: `src/cli/index.ts`
**Changes**: Update the `addHelpText('after', ...)` section:
- Add new command groups to "Command Groups" section:
  ```
  Command Groups:
    Setup:     setup, info, install-deps, update
    Testing:   test run, test list, test validate, test init
    Runs:      test runs list, test runs info, test runs steps
    Suites:    suite list, suite create, suite run
    Issues:    issues list, issues info, issues occurrences
    Browser:   browser create, browser goto, browser snapshot, browser click
    Config:    app-config list, app-config create
    Context:   app-context list, app-context create
    Personas:  persona list, persona create
    Assets:    data-asset list, data-asset upload
    Usage:     usage, usage --detailed
    API:       api ls, api info, api examples, api openapi
    Docs:      docs, docs <topic>, docs --list
    Advanced:  mcp
  ```
- Add new common workflow examples

#### 2. Update CLAUDE.md
**File**: `CLAUDE.md`
**Changes**: Add new command groups to the E2E testing sections. Update architecture section to mention new command directories.

#### 3. Extend E2E Regression Test
**File**: `scripts/e2e.ts`
**Changes**: Add new test sections after existing ones:
- **Section 4: Suite CRUD** — create, list, info, update, delete a suite
- **Section 5: Test Runs subcommands** — list runs, info on a run, steps, logs
- **Section 6: Resource commands smoke test** — quick `list --json` on each new group to verify they respond (issues, app-config, app-context, persona, data-asset, usage)

### Success Criteria:

#### Automated Verification:
- [ ] Type check passes: `bun run typecheck`
- [ ] Lint/format passes: `bun run check:fix`
- [ ] Tests pass: `bun test`
- [ ] E2E passes: `bun run scripts/e2e.ts`

#### Manual Verification:
- [ ] `bun run cli --help` shows updated command groups and workflows
- [ ] New workflow examples in help are accurate and work
- [ ] E2E script exercises new commands without failures
- [ ] `bun run cli docs` reflects any updated docs content

**Implementation Note**: This is the final phase. Run the full E2E regression to confirm nothing is broken.

---

## Testing Strategy

### Unit Tests
- `src/cli/lib/api-helpers.test.ts` — mock `executeApiRequest`, test auth injection, error formatting, pagination
- `src/cli/lib/table.test.ts` — test column rendering, JSON mode, edge cases (empty data, long strings, missing fields)

### Integration Tests
- Existing test files are not affected (no changes to `ApiClient` or `BrowserApiClient`)

### E2E Tests
- Extend `scripts/e2e.ts` with new sections (Phase 8)
- All new commands should be exercised at least once with `--json` output, which is easy to assert on

### Manual E2E Verification
After all phases, verify end-to-end against a running backend:
```bash
# Test enhancements
bun run cli test list --cloud --json
bun run cli test info <uuid>

# Test runs
bun run cli test runs list --limit 3
bun run cli test runs info <run-id>
bun run cli test runs steps <run-id>
bun run cli test runs logs <run-id>

# Suites
bun run cli suite list
bun run cli suite create -F name="E2E Suite"
bun run cli suite run <id>
bun run cli suite delete <id> --force

# Issues
bun run cli issues list --limit 5
bun run cli issues info <id>
bun run cli issues occurrences <id>

# App config
bun run cli app-config list
bun run cli app-config create --input /tmp/config.json
bun run cli app-config delete <id> --force

# App context
bun run cli app-context list
bun run cli app-context create --input /tmp/context.json
bun run cli app-context delete <id> --force

# Persona
bun run cli persona list
bun run cli persona create --input /tmp/persona.json
bun run cli persona delete <id> --force

# Data asset
bun run cli data-asset list
bun run cli data-asset upload /tmp/test-file.csv
bun run cli data-asset delete <id> --force

# Usage
bun run cli usage
bun run cli usage --detailed --json

# Full E2E
bun run scripts/e2e.ts
```

## File Summary

### New Files (~45)
| Directory | Files | Purpose |
|-----------|-------|---------|
| `src/cli/lib/` | `api-helpers.ts`, `table.ts`, + tests | Shared infrastructure |
| `src/cli/commands/test/runs/` | `index.ts`, `list.ts`, `info.ts`, `logs.ts`, `steps.ts`, `cancel.ts` | Test runs subcommands |
| `src/cli/commands/suite/` | `index.ts`, `list.ts`, `info.ts`, `create.ts`, `update.ts`, `delete.ts`, `run.ts` | Suite CRUD + run |
| `src/cli/commands/issues/` | `index.ts`, `list.ts`, `info.ts`, `occurrences.ts` | Issues read-only |
| `src/cli/commands/app-config/` | `index.ts`, `list.ts`, `info.ts`, `create.ts`, `update.ts`, `delete.ts` | App config CRUD |
| `src/cli/commands/app-context/` | `index.ts`, `list.ts`, `info.ts`, `create.ts`, `update.ts`, `delete.ts` | App context CRUD |
| `src/cli/commands/persona/` | `index.ts`, `list.ts`, `info.ts`, `create.ts`, `update.ts`, `delete.ts` | Persona CRUD |
| `src/cli/commands/data-asset/` | `index.ts`, `list.ts`, `info.ts`, `upload.ts`, `delete.ts` | Data asset + upload |
| `src/cli/commands/` | `usage.ts` | Usage summary |

### Modified Files (~6)
- `src/cli/index.ts` — register all new command groups
- `src/cli/commands/test/index.ts` — rewire runs import
- `src/cli/commands/test/list.ts` — add --json, improve columns
- `src/cli/commands/test/info.ts` — positional UUID, better messaging
- `scripts/e2e.ts` — extend with new command coverage
- `CLAUDE.md` — update architecture docs

### Deleted Files (1)
- `src/cli/commands/test/runs.ts` — replaced by `runs/` directory

## References
- Linear issue: [DES-103](https://linear.app/desplega-labs/issue/DES-103/add-qa-use-command-coverage-for-new-apiv1-endpoints)
- Parent issue: DES-101
- Existing patterns: `src/cli/commands/browser/` (CRUD), `src/cli/commands/test/runs.ts` (table output), `src/cli/commands/api/lib/http.ts` (HTTP execution)
- OpenAPI spec: `GET /api/v1/openapi.json` (44 endpoints confirmed)

---

## Review Errata

_Reviewed: 2026-04-04 by Claude_

### Critical

- [x] **Phase 3: `test runs` backward compatibility.** — Resolved: breaking change is acceptable per review. Updated Phase 3 to note version bump required and all docs/skills must be updated to use `test runs list`. No default command fallback needed.

### Important

- [x] **`-f/--field` doesn’t handle nested JSON objects.** — Resolved: `-F` is for flat top-level fields only. Added stdin pipe support and `--input <file>` for complex/nested payloads. Values that parse as JSON are treated as JSON (e.g., `-F test_ids=’["id1"]’`). Shared `parseResourceInput()` added to Phase 1.

- [x] **`-f` short flag conflicts with `--force`.** — Resolved: changed to `-F/--field` throughout the plan.

- [x] **Phase 3: Test runs list N+1 API calls for test name resolution.** — Resolved: show `test_id` always, show `test_name` only if the API response includes it (no extra calls).

- [x] **Phase 4: `suite run` monitoring suggestion was wrong.** — Resolved: now suggests `qa-use api /api/v1/test-suite-runs/{id}` instead of `test runs list`.

- [x] **Missing: `--input`/`-F` parsing should be shared infrastructure.** — Resolved: added `parseResourceInput()` and `collectFields()` to Phase 1’s `api-helpers.ts`, including stdin pipe support.

- [x] **Missing Quick Verification Reference section.** — Resolved: added section between Current State Analysis and Desired End State.

### Resolved

- [x] All factual claims (file paths, line numbers, function signatures) verified against codebase — all accurate
- [x] All 44 OpenAPI endpoints confirmed via live `api ls` output
- [x] Node.js native `FormData` is available (Node >= 20, confirmed via `package.json:20` and `tsconfig.json`)
- [x] `--force` flag convention confirmed in 3 existing commands (`test sync pull/push`, `install-deps`)
