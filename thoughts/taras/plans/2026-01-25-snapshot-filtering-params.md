---
date: 2026-01-25T12:00:00Z
topic: "Snapshot Filtering Parameters"
type: plan
status: complete
---

# Snapshot Filtering Parameters Implementation Plan

## Overview

Implement new snapshot filtering parameters from the backend API to reduce ARIA tree size and improve token efficiency. The backend now supports `interactive`, `compact`, `max_depth`, and `scope` query parameters, plus returns `filter_stats` in the response.

## Current State Analysis

### Existing Implementation

**Types** (`lib/api/browser-types.ts:168-170, 212-215`):
```typescript
export interface SnapshotAction {
  type: 'snapshot';
}

export interface SnapshotResult {
  snapshot: string;
  url?: string;
}
```

**API Client** (`lib/api/browser.ts:176-185`):
```typescript
async getSnapshot(sessionId: string): Promise<SnapshotResult> {
  const response = await this.client.get(`/sessions/${sessionId}/snapshot`);
  return response.data as SnapshotResult;
}
```

**CLI Command** (`src/cli/commands/browser/snapshot.ts`):
- Only supports `--session-id` and `--json` flags
- No filtering options

**Interactive REPL** (`src/cli/commands/browser/run.ts:393-398`):
- Simple `snapshot` command with no arguments

### Key Discoveries:
- Pattern for optional query params exists in `getConsoleLogs` and `getNetworkLogs` (`lib/api/browser.ts:258-300`)
- CLI options pattern in `logs.ts` shows Commander.js flag handling with type conversion
- Tests exist at `lib/api/browser.test.ts:275-288` for basic snapshot

## Desired End State

### New API Parameters (per docs)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `interactive` | bool | false | Only include interactive elements (buttons, inputs, links) |
| `compact` | bool | false | Remove empty structural elements |
| `max_depth` | int | - | Limit tree depth (1-20, where 1 = top level only) |
| `scope` | string | - | CSS selector to scope snapshot (e.g., `#main`, `.form`) |

### New Response Fields

```typescript
filter_stats?: {
  original_lines: number;
  filtered_lines: number;
  reduction_percent: number;
}
```

### Verification

After implementation:
```bash
# CLI usage
qa-use browser snapshot --interactive --compact --max-depth 3
qa-use browser snapshot --scope "#main"
qa-use browser snapshot --interactive --json  # Shows filter_stats

# Interactive REPL
snapshot --interactive --max-depth 3
```

## Quick Verification Reference

Common commands to verify the implementation:
- `bun test` - Run all tests
- `bun run lint:fix` - Fix linting issues
- `bun run typecheck` - Type check
- `bun run build` - Build TypeScript

Key files to check:
- `lib/api/browser-types.ts` - Type definitions
- `lib/api/browser.ts` - API client
- `src/cli/commands/browser/snapshot.ts` - CLI command
- `lib/api/browser.test.ts` - Tests

## What We're NOT Doing

- Not implementing snapshot via POST action (already exists, uses same params)
- Not changing the ARIA tree format itself
- Not adding any caching logic
- Not modifying other commands that call snapshot internally

## Implementation Approach

1. Start with types (foundation)
2. Update API client (enables testing)
3. Update CLI command (user-facing)
4. Update interactive REPL (parity)
5. Add tests (verification)
6. Update docs (discoverability)

---

## Phase 1: Type Definitions

### Overview
Add TypeScript interfaces for snapshot options and extended result type.

### Changes Required:

#### 1. Snapshot Options Interface
**File**: `lib/api/browser-types.ts`
**Location**: After line 170 (after `SnapshotAction`)

Add new interface:
```typescript
export interface SnapshotOptions {
  interactive?: boolean;  // Only include interactive elements
  compact?: boolean;      // Remove empty structural elements
  max_depth?: number;     // Limit tree depth (1-20)
  scope?: string;         // CSS selector to scope snapshot
}
```

#### 2. Extended SnapshotAction
**File**: `lib/api/browser-types.ts`
**Changes**: Update `SnapshotAction` to include optional parameters

```typescript
export interface SnapshotAction {
  type: 'snapshot';
  interactive?: boolean;
  compact?: boolean;
  max_depth?: number;
  scope?: string;
}
```

#### 3. Filter Stats Type
**File**: `lib/api/browser-types.ts`
**Location**: Before `SnapshotResult`

Add new interface:
```typescript
export interface SnapshotFilterStats {
  original_lines: number;
  filtered_lines: number;
  reduction_percent: number;
}
```

#### 4. Extended SnapshotResult
**File**: `lib/api/browser-types.ts`
**Changes**: Update `SnapshotResult` to include filter stats

```typescript
export interface SnapshotResult {
  snapshot: string;
  url?: string;
  filter_stats?: SnapshotFilterStats;
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type check passes: `bun run typecheck`
- [x] Build succeeds: `bun run build`

#### Manual Verification:
- [x] Verify new types are exported correctly by checking IDE autocomplete

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 2: API Client Update

### Overview
Update `BrowserApiClient.getSnapshot()` to accept options and pass them as query parameters.

### Changes Required:

#### 1. Update getSnapshot Method Signature
**File**: `lib/api/browser.ts`
**Location**: Lines 176-185

Change from:
```typescript
async getSnapshot(sessionId: string): Promise<SnapshotResult>
```

To:
```typescript
async getSnapshot(sessionId: string, options: SnapshotOptions = {}): Promise<SnapshotResult>
```

#### 2. Build Query Parameters
**File**: `lib/api/browser.ts`
**Changes**: Add URLSearchParams construction (follow pattern from `getConsoleLogs`)

```typescript
async getSnapshot(sessionId: string, options: SnapshotOptions = {}): Promise<SnapshotResult> {
  try {
    const params = new URLSearchParams();
    if (options.interactive) params.append('interactive', 'true');
    if (options.compact) params.append('compact', 'true');
    if (options.max_depth !== undefined) params.append('max_depth', options.max_depth.toString());
    if (options.scope) params.append('scope', options.scope);

    const queryString = params.toString();
    const url = `/sessions/${sessionId}/snapshot${queryString ? `?${queryString}` : ''}`;

    const response = await this.client.get(url);
    return response.data as SnapshotResult;
  } catch (error) {
    throw this.handleError(error, 'get snapshot');
  }
}
```

#### 3. Update Imports
**File**: `lib/api/browser.ts`
**Changes**: Add `SnapshotOptions` to imports from `browser-types.js`

#### 4. Update Exports
**File**: `lib/api/browser.ts`
**Changes**: Add `SnapshotOptions` to re-exports at bottom of file

### Success Criteria:

#### Automated Verification:
- [x] Type check passes: `bun run typecheck`
- [x] Existing tests still pass: `bun test lib/api/browser.test.ts`
- [x] Build succeeds: `bun run build`

#### Manual Verification:
- [ ] Test against local backend with filters:
  ```bash
  # Start a session first
  bun run cli browser create --no-headless
  bun run cli browser goto https://evals.desplega.ai/
  # Then manually test API client in Node REPL or add temp test
  ```

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 3: CLI Command Update

### Overview
Add filtering flags to `qa-use browser snapshot` command.

### Changes Required:

#### 1. Update Options Interface
**File**: `src/cli/commands/browser/snapshot.ts`
**Location**: Lines 11-14

```typescript
interface SnapshotOptions {
  sessionId?: string;
  json?: boolean;
  interactive?: boolean;
  compact?: boolean;
  maxDepth?: string;  // Commander parses as string
  scope?: string;
}
```

#### 2. Add Commander Options
**File**: `src/cli/commands/browser/snapshot.ts`
**Location**: After line 19

Add new options:
```typescript
export const snapshotCommand = new Command('snapshot')
  .description('Get the ARIA accessibility tree snapshot')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('--json', 'Output raw JSON instead of formatted tree')
  .option('-i, --interactive', 'Only include interactive elements (buttons, inputs, links)')
  .option('-c, --compact', 'Remove empty structural elements')
  .option('-d, --max-depth <n>', 'Limit tree depth (1-20)')
  .option('--scope <selector>', 'CSS selector to scope snapshot (e.g., "#main")')
  .action(async (options: SnapshotOptions) => {
    // ...
  });
```

#### 3. Pass Options to API Client
**File**: `src/cli/commands/browser/snapshot.ts`
**Location**: Line 40 (the getSnapshot call)

Change from:
```typescript
const snapshot = await client.getSnapshot(resolved.id);
```

To:
```typescript
const snapshot = await client.getSnapshot(resolved.id, {
  interactive: options.interactive,
  compact: options.compact,
  max_depth: options.maxDepth ? parseInt(options.maxDepth, 10) : undefined,
  scope: options.scope,
});
```

#### 4. Display Filter Stats (Optional Enhancement)
**File**: `src/cli/commands/browser/snapshot.ts`
**Location**: In the output section

When not using `--json`, optionally show filter stats:
```typescript
if (snapshot.filter_stats) {
  console.log(`\nFiltered: ${snapshot.filter_stats.filtered_lines}/${snapshot.filter_stats.original_lines} lines (${snapshot.filter_stats.reduction_percent}% reduction)\n`);
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type check passes: `bun run typecheck`
- [x] Build succeeds: `bun run build`
- [x] Linting passes: `bun run lint:fix`

#### Manual Verification:
- [x] Test CLI with various flag combinations:
  ```bash
  bun run cli browser snapshot --interactive
  bun run cli browser snapshot --compact --max-depth 3
  bun run cli browser snapshot --scope "#main"
  bun run cli browser snapshot --interactive --json
  bun run cli browser snapshot --help  # Verify help text shows new options
  ```

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 4: Interactive REPL Update

### Overview
Add snapshot filtering support to the interactive `qa-use browser run` command.

### Changes Required:

#### 1. Update Snapshot Handler
**File**: `src/cli/commands/browser/run.ts`
**Location**: Lines 393-398

Change from:
```typescript
snapshot: async (args, client, sessionId) => {
  const snapshot = await client.getSnapshot(sessionId);
  if (snapshot.url) {
    console.log(`URL: ${snapshot.url}\n`);
  }
  console.log(snapshot.snapshot);
},
```

To:
```typescript
snapshot: async (args, client, sessionId) => {
  // Parse flags from args
  const interactive = args.includes('--interactive') || args.includes('-i');
  const compact = args.includes('--compact') || args.includes('-c');
  const depthIdx = args.findIndex(a => a === '--max-depth' || a === '-d');
  const max_depth = depthIdx !== -1 ? parseInt(args[depthIdx + 1], 10) : undefined;
  const scopeIdx = args.findIndex(a => a === '--scope');
  const scope = scopeIdx !== -1 ? args[scopeIdx + 1] : undefined;

  const snapshot = await client.getSnapshot(sessionId, {
    interactive,
    compact,
    max_depth,
    scope,
  });

  if (snapshot.url) {
    console.log(`URL: ${snapshot.url}\n`);
  }
  if (snapshot.filter_stats) {
    console.log(`Filtered: ${snapshot.filter_stats.filtered_lines}/${snapshot.filter_stats.original_lines} lines (${snapshot.filter_stats.reduction_percent}% reduction)\n`);
  }
  console.log(snapshot.snapshot);
},
```

#### 2. Update Help Text
**File**: `src/cli/commands/browser/run.ts`
**Location**: Around line 641 (help text for snapshot command)

Update help text to show new options:
```
snapshot [-i|--interactive] [-c|--compact] [-d|--max-depth N] [--scope selector]
                            Get ARIA accessibility tree (with optional filtering)
```

### Success Criteria:

#### Automated Verification:
- [x] Type check passes: `bun run typecheck`
- [x] Build succeeds: `bun run build`

#### Manual Verification:
- [ ] Test in interactive REPL:
  ```bash
  bun run cli browser run
  > snapshot --interactive
  > snapshot --max-depth 3
  > snapshot --scope "#main"
  > help  # Verify updated help text
  ```

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 5: Tests

### Overview
Add unit tests for the new snapshot options functionality.

### Changes Required:

#### 1. Add Test for Snapshot with Options
**File**: `lib/api/browser.test.ts`
**Location**: After line 288 (after existing snapshot test)

```typescript
it('should get ARIA snapshot with filtering options', async () => {
  const mockSnapshot = {
    snapshot: '- button "Submit" [ref=e1]',
    url: 'https://example.com',
    filter_stats: {
      original_lines: 450,
      filtered_lines: 42,
      reduction_percent: 91,
    },
  };
  mockAxiosInstance.get.mockResolvedValueOnce({ data: mockSnapshot });

  const snapshot = await client.getSnapshot('session-123', {
    interactive: true,
    compact: true,
    max_depth: 3,
  });

  expect(mockAxiosInstance.get).toHaveBeenCalledWith(
    '/sessions/session-123/snapshot?interactive=true&compact=true&max_depth=3'
  );
  expect(snapshot.filter_stats?.reduction_percent).toBe(91);
});

it('should get ARIA snapshot with scope option', async () => {
  const mockSnapshot = {
    snapshot: '- heading "Main Content" [ref=e1]',
    url: 'https://example.com',
  };
  mockAxiosInstance.get.mockResolvedValueOnce({ data: mockSnapshot });

  await client.getSnapshot('session-123', { scope: '#main' });

  expect(mockAxiosInstance.get).toHaveBeenCalledWith(
    '/sessions/session-123/snapshot?scope=%23main'
  );
});

it('should get ARIA snapshot without options (backward compatible)', async () => {
  const mockSnapshot = {
    snapshot: '- heading "Example" [ref=e1]',
    url: 'https://example.com',
  };
  mockAxiosInstance.get.mockResolvedValueOnce({ data: mockSnapshot });

  await client.getSnapshot('session-123');

  expect(mockAxiosInstance.get).toHaveBeenCalledWith('/sessions/session-123/snapshot');
});
```

### Success Criteria:

#### Automated Verification:
- [x] All tests pass: `bun test`
- [x] Specific test file passes: `bun test lib/api/browser.test.ts`

#### Manual Verification:
- [x] Review test output for new snapshot tests

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 6: Documentation Updates

### Overview
Update plugin documentation to reflect new snapshot filtering options.

### Changes Required:

#### 1. Browser Commands Reference
**File**: `plugins/qa-use/skills/qa-use/references/browser-commands.md`
**Location**: Lines 96-114 (snapshot section)

Update to:
```markdown
### snapshot

Get the page's ARIA accessibility tree with element refs.

```bash
qa-use browser snapshot [options]
```

| Flag | Description |
|------|-------------|
| `-i, --interactive` | Only include interactive elements (buttons, inputs, links) |
| `-c, --compact` | Remove empty structural elements |
| `-d, --max-depth <n>` | Limit tree depth (1-20, where 1 = top level only) |
| `--scope <selector>` | CSS selector to scope snapshot (e.g., `#main`, `.form`) |
| `--json` | Output raw JSON including filter_stats |

**Output format:**
```
- heading "Page Title" [level=1] [ref=e2]
- button "Click Me" [ref=e3]
- textbox "Email" [ref=e4]
- link "Sign Up" [ref=e5]
```

**Filtering examples:**
```bash
# Get only interactive elements (great for reducing token count)
qa-use browser snapshot --interactive

# Combine filters for maximum reduction
qa-use browser snapshot --interactive --compact --max-depth 3

# Scope to specific section
qa-use browser snapshot --scope "#main-content"
```

**Typical reductions:**
- `--max-depth 3`: ~98% reduction
- `--interactive`: 0-80% depending on page
- Combined `--interactive --max-depth 4`: ~95% reduction

Use the `[ref=eN]` values in interaction commands.

**Critical workflow:** Always run `snapshot` before interacting to get valid refs. Refs are session-specific and change between page loads.
```

#### 2. Browser Navigator Agent
**File**: `plugins/qa-use/agents/browser-navigator.md`
**Location**: Line 47 (snapshot step in methodology)

Update to:
```markdown
   a. **Snapshot**: Run `qa-use browser snapshot --interactive --max-depth 5`
      - Use filtering to reduce token usage while preserving interactive elements
      - Increase max_depth if needed elements aren't visible
```

### Success Criteria:

#### Automated Verification:
- [x] Files exist and are valid markdown: `ls plugins/qa-use/skills/qa-use/references/browser-commands.md plugins/qa-use/agents/browser-navigator.md`

#### Manual Verification:
- [x] Review documentation for clarity and accuracy
- [x] Verify examples work as documented (E2E tested against https://qacrmdemo.netlify.app/dashboard)

**Implementation Note**: After completing this phase, pause for final review.

---

## Testing Strategy

### Unit Tests
- New tests in `lib/api/browser.test.ts` for options handling
- Backward compatibility test (no options = no query string)

### Integration Tests (Manual)
Test against local backend:
```bash
export QA_USE_API_URL=http://localhost:5005
bun run cli browser create --no-headless
bun run cli browser goto https://evals.desplega.ai/
bun run cli browser snapshot --interactive
bun run cli browser snapshot --max-depth 3 --json
bun run cli browser close
```

### Edge Cases to Verify
1. Empty options object doesn't add `?` to URL
2. `max_depth=0` is not sent (invalid per API)
3. `scope` with special chars (`#`, `.`) is URL-encoded
4. Boolean `false` values are not sent (defaults on server)

## References

- Backend API docs: `http://localhost:5005/browsers/v1/docs.md`
- Similar implementation pattern: `lib/api/browser.ts:258-300` (getConsoleLogs/getNetworkLogs)
- CLI options pattern: `src/cli/commands/browser/logs.ts`
