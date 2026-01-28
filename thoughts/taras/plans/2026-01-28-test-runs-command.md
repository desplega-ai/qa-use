---
date: 2026-01-28T10:00:00Z
topic: "qa-use test runs Command"
type: plan
status: draft
---

# `qa-use test runs` Command Implementation Plan

## Overview

Add a `qa-use test runs` command to list test run history from the API. This enables users to view past test runs directly from the CLI, which is useful for debugging failed CI runs and understanding test history.

## Current State Analysis

### Existing Infrastructure

The codebase already has most of the infrastructure needed:

1. **API Client Method**: `listTestRuns()` already exists in `lib/api/index.ts:650-671`
   - Current endpoint: `GET /vibe-qa/tests-runs` (broken: ignores limit/offset/run_status)
   - Correct endpoint: `GET /api/v1/test-runs` (works: all filters functional)
   - Parameters: `test_id`, `run_id`, `limit`, `offset`
   - Returns: `TestRun[]`

2. **TestRun Type**: Already defined in `lib/api/index.ts:118-155`
   - Contains all fields from the spec: `id`, `name`, `test_id`, `run_status`, `duration_seconds`, `created_at`, etc.
   - Note: Uses `duration_seconds` not `elapsed_seconds` as in the spec

3. **ListTestRunsOptions Type**: `lib/api/index.ts:157-162`
   - Missing: `run_status` filter, `suite_id`, `suite_run_id`, `q` (search query)

4. **CLI Structure**: Test commands in `src/cli/commands/test/`
   - Pattern: Each subcommand is a separate file
   - Registration in `src/cli/commands/test/index.ts`

5. **Output Utilities**: `src/cli/lib/output.ts`
   - `duration()` for formatting seconds
   - `error()`, `success()`, `warning()` for messages
   - Colors object for ANSI codes

### Key Discoveries:
- `listTestRuns()` exists but uses wrong endpoint `/vibe-qa/tests-runs` which ignores limit/offset/run_status filters
- Correct endpoint is `/api/v1/test-runs` - validated manually, all filters work correctly
- `ListTestRunsOptions` is incomplete (missing `run_status`)
- Test name → ID resolution can use `listTests({ query: name })` to search by name
- Table formatting is done manually with `padEnd()` and ANSI codes (see `src/cli/commands/browser/list.ts:55-81`)
- Changing the endpoint also fixes the existing MCP tool (`src/server.ts:2101`)

## Desired End State

A new `qa-use test runs` command that:
1. Lists test run history with formatted table output
2. Supports filtering by test name, test ID, status
3. Supports `--json` flag for scripting
4. Follows existing CLI patterns and code style

Verification:
```bash
# List all runs (no filters)
bun run cli test runs

# Filter by test name (resolves to ID)
bun run cli test runs login-flow

# Filter by test ID directly
bun run cli test runs --id <uuid>

# Filter by status
bun run cli test runs --status failed

# JSON output
bun run cli test runs --json
```

## Quick Verification Reference

Common commands:
- `bun run build` - Build TypeScript
- `bun run typecheck` - Type check
- `bun run lint:fix` - Fix linting issues

Key files:
- `src/cli/commands/test/runs.ts` (new)
- `src/cli/commands/test/index.ts` (add import)
- `lib/api/index.ts` (fix endpoint + add `run_status` to `ListTestRunsOptions`)

## What We're NOT Doing

1. **Suite filtering**: The `--suite-id` and `--suite-run-id` options are excluded for simplicity (can add later)
2. **Search query**: The `--q` search option is excluded (can add later)

---

## Phase 1: Fix API Client Endpoint and Add run_status Filter

### Overview
Fix the `listTestRuns()` method to use the correct `/api/v1/test-runs` endpoint (which properly supports all filters) and add `run_status` to the options interface.

### Changes Required:

#### 1. API Types
**File**: `lib/api/index.ts`
**Changes**:
- Add `run_status` to `ListTestRunsOptions` interface (around line 157)
- Change endpoint from `/vibe-qa/tests-runs` to `/api/v1/test-runs` (around line 658)
- Add `run_status` parameter to the URL builder

```typescript
// Around line 157
export interface ListTestRunsOptions {
  test_id?: string;
  run_id?: string;
  run_status?: 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'cancelled' | 'timeout';
  limit?: number;
  offset?: number;
}
```

Update `listTestRuns()` method (around line 650):
```typescript
async listTestRuns(options: ListTestRunsOptions = {}): Promise<TestRun[]> {
  try {
    const params = new URLSearchParams();
    if (options.test_id) params.append('test_id', options.test_id);
    if (options.run_id) params.append('run_id', options.run_id);
    if (options.run_status) params.append('run_status', options.run_status);
    if (options.limit !== undefined) params.append('limit', options.limit.toString());
    if (options.offset !== undefined) params.append('offset', options.offset.toString());

    // CHANGED: Use /api/v1/test-runs instead of /vibe-qa/tests-runs
    // The v1 endpoint properly supports limit, offset, and run_status filters
    const response: AxiosResponse = await this.client.get(
      `/api/v1/test-runs?${params.toString()}`
    );
    return response.data as TestRun[];
  } catch (error) {
    // ... error handling unchanged
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `bun run typecheck`
- [ ] Build succeeds: `bun run build`

#### Manual Verification:
- [ ] Verify endpoint change works: `curl -s -H "Authorization: Bearer $API_KEY" "http://localhost:5005/api/v1/test-runs?limit=3" | jq 'length'` returns 3
- [ ] Verify run_status filter works: `curl -s -H "Authorization: Bearer $API_KEY" "http://localhost:5005/api/v1/test-runs?run_status=passed&limit=2" | jq 'length'`
- [ ] MCP tool still works (uses same `listTestRuns()` method)

**Implementation Note**: After completing this phase, pause for manual confirmation. This change also fixes the existing MCP `search_automated_test_runs` tool which had broken pagination.

---

## Phase 2: Create `runs` Command

### Overview
Create the new `runs.ts` command file with full CLI implementation.

### Changes Required:

#### 1. New Command File
**File**: `src/cli/commands/test/runs.ts` (new file)
**Changes**: Create command with:
- Commander setup with options
- API client integration
- Table and JSON output formatting
- Duration and timestamp formatting

```typescript
/**
 * qa-use test runs - List test run history
 */

import { Command } from 'commander';
import { loadConfig } from '../../lib/config.js';
import { ApiClient } from '../../../../lib/api/index.js';
import { error, warning, duration } from '../../lib/output.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
};

function formatStatus(status: string): string {
  const padded = status.padEnd(9);
  switch (status) {
    case 'passed':
      return `${colors.green}${padded}${colors.reset}`;
    case 'failed':
      return `${colors.red}${padded}${colors.reset}`;
    case 'running':
    case 'pending':
      return `${colors.yellow}${padded}${colors.reset}`;
    case 'cancelled':
    case 'timeout':
    case 'skipped':
      return `${colors.gray}${padded}${colors.reset}`;
    default:
      return padded;
  }
}

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || seconds === null) return '-'.padEnd(10);
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`.padEnd(10);
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`.padEnd(10);
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

export const runsCommand = new Command('runs')
  .description('List test run history')
  .argument('[test-name]', 'Filter by test name (optional)')
  .option('--id <uuid>', 'Filter by test ID')
  .option('--status <status>', 'Filter by run status (pending, running, passed, failed, cancelled, timeout)')
  .option('--limit <n>', 'Limit results (default: 20)', '20')
  .option('--offset <n>', 'Skip N results', '0')
  .option('--json', 'Output as JSON')
  .action(async (testName, options) => {
    try {
      const config = await loadConfig();

      if (!config.api_key) {
        console.log(error('API key not configured'));
        console.log('  Run `qa-use setup` to configure');
        process.exit(1);
      }

      const client = new ApiClient(config.api_url);
      client.setApiKey(config.api_key);

      // Resolve test name to ID if provided
      let testId = options.id;
      let testDisplayName: string | undefined;

      if (testName && !testId) {
        // Search for test by name in cloud
        const tests = await client.listTests({ query: testName, limit: 10 });
        const exactMatch = tests.find(t => t.name === testName);
        const partialMatches = tests.filter(t => t.name.toLowerCase().includes(testName.toLowerCase()));

        if (exactMatch) {
          testId = exactMatch.id;
          testDisplayName = exactMatch.name;
        } else if (partialMatches.length === 1) {
          testId = partialMatches[0].id;
          testDisplayName = partialMatches[0].name;
        } else if (partialMatches.length > 1) {
          console.log(error(`Multiple tests match "${testName}":`));
          for (const t of partialMatches.slice(0, 5)) {
            console.log(`  • ${t.name} (${t.id})`);
          }
          console.log('\nUse --id <uuid> to specify exactly.');
          process.exit(1);
        } else {
          console.log(error(`No test found matching "${testName}"`));
          process.exit(1);
        }
      }

      // Fetch test runs
      const runs = await client.listTestRuns({
        test_id: testId,
        run_status: options.status,
        limit: parseInt(options.limit),
        offset: parseInt(options.offset),
      });

      // JSON output
      if (options.json) {
        console.log(JSON.stringify(runs, null, 2));
        return;
      }

      // Human-readable output
      if (runs.length === 0) {
        if (testId) {
          console.log(warning(`No runs found for test${testDisplayName ? ` "${testDisplayName}"` : ''}`));
        } else if (options.status) {
          console.log(warning(`No runs found with status "${options.status}"`));
        } else {
          console.log(warning('No test runs found'));
        }
        return;
      }

      // Header
      if (testDisplayName) {
        console.log(`Test Runs for: ${testDisplayName} (${runs.length} run${runs.length === 1 ? '' : 's'})\n`);
      } else {
        console.log(`Test Runs (${runs.length} result${runs.length === 1 ? '' : 's'})\n`);
      }

      // Table header
      console.log('ID                                    STATUS     DURATION    CREATED');
      console.log('─'.repeat(85));

      for (const run of runs) {
        const statusStr = formatStatus(run.run_status);
        const durationStr = formatDuration(run.duration_seconds);
        const createdStr = formatTimestamp(run.created_at);

        console.log(`${run.id}  ${statusStr}${durationStr}${createdStr}`);
      }

      // Pagination hint
      if (runs.length === parseInt(options.limit)) {
        console.log(`\n${colors.gray}Use --offset ${parseInt(options.offset) + parseInt(options.limit)} to see more${colors.reset}`);
      }
    } catch (err) {
      console.log(error(`Failed to list test runs: ${err}`));
      process.exit(1);
    }
  });
```

#### 2. Register Command
**File**: `src/cli/commands/test/index.ts`
**Changes**: Import and register the new command

Add import:
```typescript
import { runsCommand } from './runs.js';
```

Add registration:
```typescript
testCommand.addCommand(runsCommand);
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `bun run typecheck`
- [ ] Build succeeds: `bun run build`
- [ ] Linting passes: `bun run lint:fix`

#### Manual Verification:
- [ ] `bun run cli test runs` shows help or runs list
- [ ] `bun run cli test runs --json` outputs valid JSON
- [ ] `bun run cli test runs --status failed` filters correctly
- [ ] `bun run cli test runs --limit 5` limits output

**Implementation Note**: After completing this phase, pause for manual confirmation. Test against localhost:5005 as configured in `.qa-use-tests.json`.

---

## Phase 3: Manual Testing & Polish

### Overview
Test the command against the real API and fix any issues.

### Testing Commands:
```bash
# Basic list
bun run cli test runs

# With limit
bun run cli test runs --limit 5

# Filter by status
bun run cli test runs --status failed

# JSON output
bun run cli test runs --json

# Filter by test ID (get a real ID from `bun run cli test list --cloud`)
bun run cli test runs --id <uuid>

# Pagination
bun run cli test runs --offset 20
```

### Success Criteria:

#### Automated Verification:
- [ ] All commands execute without errors

#### Manual Verification:
- [ ] Output is readable and properly formatted
- [ ] Status colors display correctly
- [ ] Duration formatting handles all cases (null, <1s, <60s, >60s)
- [ ] Timestamps are in local timezone
- [ ] JSON output includes all fields
- [ ] Error messages are helpful

**Implementation Note**: After completing this phase, the feature is ready for review.

---

## Testing Strategy

1. **Local API Testing**: Use localhost:5005 per `.qa-use-tests.json`
2. **Manual Verification**: Run commands and verify output format
3. **Edge Cases**:
   - No results
   - Many results (pagination)
   - Various status filters
   - Invalid test ID

## References

- API Client: `lib/api/index.ts:650-671` (listTestRuns method)
- MCP Tool using same method: `src/server.ts:2101`
- Similar command: `src/cli/commands/browser/list.ts`
- Output utilities: `src/cli/lib/output.ts`
- Config loading: `src/cli/lib/config.ts`
- API Endpoint (correct): `GET /api/v1/test-runs`
