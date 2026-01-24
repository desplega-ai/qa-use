---
date: 2026-01-24T19:00:00Z
topic: "Browser API Gaps Implementation"
status: complete
type: plan
research: thoughts/shared/research/2026-01-24-browser-api-gaps.md
---

# Browser API Gaps Implementation Plan

## Overview

Implement missing Browser API client methods and type definitions to close the gaps between the documented API and the qa-use client library. This enables test generation from recorded sessions and debugging via console/network logs.

## Current State Analysis

The research document (`thoughts/shared/research/2026-01-24-browser-api-gaps.md`) identified several gaps:

### Client Implementation Gaps (Not Implemented)
1. `POST /browsers/v1/sessions/{id}/generate-test` - Generate test YAML from session blocks
2. `GET /browsers/v1/sessions/{id}/logs/console` - Retrieve console logs
3. `GET /browsers/v1/sessions/{id}/logs/network` - Retrieve network logs

### Type Definition Gaps
4. `BrowserSession` missing fields: `app_url`, `last_action_at`, `error_message`, `recording_url`, `har_url`, `storage_state_url`
5. Missing `SetCheckedAction` interface (exists in action type union but no interface)
6. `ActionResult` missing: `action_id`, `url_before`, `url_after`
7. `CreateBrowserSessionOptions` missing: `record_blocks` option

### Key Discoveries:
- API client follows consistent pattern: `lib/api/browser.ts:63-76` shows how methods are structured
- Error handling centralized in `lib/api/browser.ts:240-267`
- CLI commands in `src/cli/commands/browser/` follow pattern seen in `get-blocks.ts:16-44`
- Tests use bun mock pattern in `lib/api/browser.test.ts:9-26`

## Desired End State

1. **New API Client Methods:**
   - `generateTest(sessionId, options)` returns generated test YAML
   - `getConsoleLogs(sessionId, options)` returns console log entries
   - `getNetworkLogs(sessionId, options)` returns network request entries

2. **New CLI Commands:**
   - `qa-use browser generate-test` - Generate test from session
   - `qa-use browser logs console` - View console logs
   - `qa-use browser logs network` - View network logs

3. **Updated Types:**
   - `BrowserSession` with all documented fields
   - `SetCheckedAction` interface
   - `ActionResult` with tracking fields
   - `CreateBrowserSessionOptions` with `record_blocks`

## Quick Verification Reference

Common commands to verify the implementation:
- `bun test` - Run all tests
- `bun run lint:fix` - Fix linting issues
- `bun run typecheck` - TypeScript type checking
- `bun run build` - Build the project

Key files:
- `lib/api/browser.ts` - Main API client
- `lib/api/browser-types.ts` - Type definitions
- `lib/api/browser.test.ts` - Unit tests
- `src/cli/commands/browser/index.ts` - CLI command registry

## What We're NOT Doing

- Parameter name changes (`viewport` → `viewport_type`, `timeout` → `timeout_seconds`) - These would be breaking changes requiring migration
- Documenting CLI commands in the API docs - That's a documentation task, not implementation
- MCP tool additions - Those are separate from the client library

## Implementation Approach

We'll implement in three phases:
1. **Type Definitions** - Add missing types and fields (foundation work)
2. **API Client Methods** - Add new methods following existing patterns
3. **CLI Commands** - Add commands that expose the new functionality

Each phase is independently testable and builds on the previous.

---

## Phase 1: Type Definition Updates

### Overview
Add missing type definitions and update existing interfaces to match the documented API. This is foundational work that Phase 2 depends on.

### Changes Required:

#### 1. Update `BrowserSession` Interface
**File**: `lib/api/browser-types.ts`
**Changes**: Add missing fields from API documentation

```typescript
export interface BrowserSession {
  id: string;
  status: BrowserSessionStatus;
  created_at: string;
  updated_at?: string;
  current_url?: string;
  viewport?: ViewportType;
  headless?: boolean;
  timeout?: number;
  // NEW FIELDS:
  app_url?: string;           // Frontend URL to view session visualization
  last_action_at?: string;    // Timestamp of last action
  error_message?: string;     // Error if session failed
  recording_url?: string;     // Video recording URL (after close)
  har_url?: string;           // HAR file URL (after close)
  storage_state_url?: string; // Browser storage state URL (after close)
}
```

#### 2. Add `SetCheckedAction` Interface
**File**: `lib/api/browser-types.ts`
**Changes**: Add interface for set_checked action type

```typescript
export interface SetCheckedAction {
  type: 'set_checked';
  ref?: string;
  text?: string;
  checked: boolean;
}
```

Update the `BrowserActionType` union to include `'set_checked'` and `BrowserAction` union to include `SetCheckedAction`.

#### 3. Update `ActionResult` Interface
**File**: `lib/api/browser-types.ts`
**Changes**: Add tracking fields

```typescript
export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
  // NEW FIELDS:
  action_id?: string;   // Unique action identifier
  url_before?: string;  // URL before action executed
  url_after?: string;   // URL after action executed
}
```

#### 4. Update `CreateBrowserSessionOptions` Interface
**File**: `lib/api/browser-types.ts`
**Changes**: Add record_blocks option

```typescript
export interface CreateBrowserSessionOptions {
  headless?: boolean;
  viewport?: ViewportType;
  timeout?: number;
  ws_url?: string;
  // NEW FIELD:
  record_blocks?: boolean;  // Enable block recording for test generation
}
```

#### 5. Add New Response Types for Logs and Test Generation
**File**: `lib/api/browser-types.ts`
**Changes**: Add types for new endpoints

```typescript
// Console log entry
export interface ConsoleLogEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  text: string;
  timestamp: string;
  url?: string;
}

export interface ConsoleLogsResult {
  logs: ConsoleLogEntry[];
  total: number;
}

export interface ConsoleLogsOptions {
  level?: 'log' | 'warn' | 'error' | 'info' | 'debug';
  limit?: number;
}

// Network log entry
export interface NetworkLogEntry {
  method: string;
  url: string;
  status: number;
  duration_ms: number;
  request_headers?: Record<string, string>;
  response_headers?: Record<string, string>;
  timestamp: string;
}

export interface NetworkLogsResult {
  requests: NetworkLogEntry[];
  total: number;
}

export interface NetworkLogsOptions {
  status?: string;      // e.g., "4xx,5xx"
  url_pattern?: string; // e.g., "*api*"
  limit?: number;
}

// Test generation
export interface GenerateTestOptions {
  name: string;
  app_config?: string;
  variables?: Record<string, string>;
}

export interface GenerateTestResult {
  yaml: string;
  test_definition: Record<string, unknown>;
  block_count: number;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `bun run typecheck`
- [x] Linting passes: `bun run lint:fix`
- [x] Build succeeds: `bun run build`

#### Manual Verification:
- [x] Review type definitions match API documentation
- [x] Verify no breaking changes to existing code

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: API Client Methods

### Overview
Implement the three new methods in `BrowserApiClient` following existing patterns.

### Changes Required:

#### 1. Add `generateTest()` Method
**File**: `lib/api/browser.ts`
**Changes**: Add method to generate test YAML from session blocks

```typescript
/**
 * Generate a test definition from recorded session blocks
 * @param sessionId - The session ID
 * @param options - Test generation options (name, app_config, variables)
 * @returns Generated test YAML and metadata
 */
async generateTest(
  sessionId: string,
  options: GenerateTestOptions
): Promise<GenerateTestResult> {
  try {
    const response = await this.client.post(
      `/sessions/${sessionId}/generate-test`,
      options
    );
    return response.data as GenerateTestResult;
  } catch (error) {
    throw this.handleError(error, 'generate test');
  }
}
```

#### 2. Add `getConsoleLogs()` Method
**File**: `lib/api/browser.ts`
**Changes**: Add method to retrieve console logs

```typescript
/**
 * Get console logs from a session
 * @param sessionId - The session ID
 * @param options - Filter options (level, limit)
 * @returns Console log entries
 */
async getConsoleLogs(
  sessionId: string,
  options: ConsoleLogsOptions = {}
): Promise<ConsoleLogsResult> {
  try {
    const params = new URLSearchParams();
    if (options.level) params.append('level', options.level);
    if (options.limit !== undefined) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    const url = `/sessions/${sessionId}/logs/console${queryString ? `?${queryString}` : ''}`;

    const response = await this.client.get(url);
    return response.data as ConsoleLogsResult;
  } catch (error) {
    throw this.handleError(error, 'get console logs');
  }
}
```

#### 3. Add `getNetworkLogs()` Method
**File**: `lib/api/browser.ts`
**Changes**: Add method to retrieve network logs

```typescript
/**
 * Get network request logs from a session
 * @param sessionId - The session ID
 * @param options - Filter options (status, url_pattern, limit)
 * @returns Network log entries
 */
async getNetworkLogs(
  sessionId: string,
  options: NetworkLogsOptions = {}
): Promise<NetworkLogsResult> {
  try {
    const params = new URLSearchParams();
    if (options.status) params.append('status', options.status);
    if (options.url_pattern) params.append('url_pattern', options.url_pattern);
    if (options.limit !== undefined) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    const url = `/sessions/${sessionId}/logs/network${queryString ? `?${queryString}` : ''}`;

    const response = await this.client.get(url);
    return response.data as NetworkLogsResult;
  } catch (error) {
    throw this.handleError(error, 'get network logs');
  }
}
```

#### 4. Update Type Exports
**File**: `lib/api/browser.ts`
**Changes**: Export new types at the bottom of the file

```typescript
export type {
  // ... existing exports ...
  GenerateTestOptions,
  GenerateTestResult,
  ConsoleLogsOptions,
  ConsoleLogsResult,
  ConsoleLogEntry,
  NetworkLogsOptions,
  NetworkLogsResult,
  NetworkLogEntry,
} from './browser-types.js';
```

#### 5. Update `createSession()` to Support `record_blocks`
**File**: `lib/api/browser.ts`
**Changes**: Pass record_blocks option when creating session

```typescript
async createSession(options: CreateBrowserSessionOptions = {}): Promise<BrowserSession> {
  try {
    const response = await this.client.post('/sessions', {
      headless: options.headless ?? true,
      viewport: options.viewport ?? 'desktop',
      timeout: options.timeout ?? 300,
      ...(options.ws_url && { ws_url: options.ws_url }),
      ...(options.record_blocks !== undefined && { record_blocks: options.record_blocks }),
    });

    return response.data as BrowserSession;
  } catch (error) {
    throw this.handleError(error, 'create session');
  }
}
```

#### 6. Add Unit Tests
**File**: `lib/api/browser.test.ts`
**Changes**: Add tests for new methods

```typescript
describe('generateTest', () => {
  it('should generate test from session blocks', async () => {
    const mockResult = {
      yaml: 'name: Login Test\nsteps:\n  - goto: https://example.com',
      test_definition: { name: 'Login Test' },
      block_count: 3,
    };
    mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

    const result = await client.generateTest('session-123', {
      name: 'Login Test',
    });

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/sessions/session-123/generate-test',
      { name: 'Login Test' }
    );
    expect(result.yaml).toContain('Login Test');
    expect(result.block_count).toBe(3);
  });
});

describe('getConsoleLogs', () => {
  it('should get console logs', async () => {
    const mockResult = {
      logs: [{ level: 'error', text: 'Test error', timestamp: '2026-01-24T10:00:00Z' }],
      total: 1,
    };
    mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResult });

    const result = await client.getConsoleLogs('session-123');

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/sessions/session-123/logs/console');
    expect(result.logs).toHaveLength(1);
  });

  it('should get console logs with filters', async () => {
    const mockResult = { logs: [], total: 0 };
    mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResult });

    await client.getConsoleLogs('session-123', { level: 'error', limit: 50 });

    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      '/sessions/session-123/logs/console?level=error&limit=50'
    );
  });
});

describe('getNetworkLogs', () => {
  it('should get network logs', async () => {
    const mockResult = {
      requests: [{ method: 'GET', url: 'https://api.example.com', status: 200, duration_ms: 150 }],
      total: 1,
    };
    mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResult });

    const result = await client.getNetworkLogs('session-123');

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/sessions/session-123/logs/network');
    expect(result.requests).toHaveLength(1);
  });

  it('should get network logs with filters', async () => {
    const mockResult = { requests: [], total: 0 };
    mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResult });

    await client.getNetworkLogs('session-123', { status: '4xx,5xx', url_pattern: '*api*' });

    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      '/sessions/session-123/logs/network?status=4xx%2C5xx&url_pattern=*api*'
    );
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] All tests pass: `bun test lib/api/browser.test.ts`
- [x] TypeScript compiles: `bun run typecheck`
- [x] Linting passes: `bun run lint:fix`
- [x] Build succeeds: `bun run build`

#### Manual Verification:
- [x] Methods follow existing code patterns
- [x] Error handling is consistent with other methods
- [x] Query parameter encoding is correct

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: CLI Commands

### Overview
Add CLI commands to expose the new API client methods to users.

### Changes Required:

#### 1. Create `generate-test.ts` Command
**File**: `src/cli/commands/browser/generate-test.ts`
**Changes**: New file

```typescript
/**
 * qa-use browser generate-test - Generate test YAML from recorded session blocks
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { success, error } from '../../lib/output.js';

interface GenerateTestOptions {
  sessionId?: string;
  name: string;
  appConfig?: string;
  output?: string;
}

export const generateTestCommand = new Command('generate-test')
  .description('Generate test YAML from recorded session blocks')
  .requiredOption('-n, --name <name>', 'Name for the generated test')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('-a, --app-config <id>', 'App config ID')
  .option('-o, --output <path>', 'Output file path (prints to stdout if not specified)')
  .action(async (options: GenerateTestOptions) => {
    try {
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      const client = new BrowserApiClient(config.api_url);
      client.setApiKey(config.api_key);

      const resolved = await resolveSessionId({
        explicitId: options.sessionId,
        client,
      });

      const result = await client.generateTest(resolved.id, {
        name: options.name,
        ...(options.appConfig && { app_config: options.appConfig }),
      });

      if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, result.yaml);
        console.log(success(`Test written to ${options.output} (${result.block_count} blocks)`));
      } else {
        console.log(result.yaml);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to generate test'));
      process.exit(1);
    }
  });
```

#### 2. Create `logs.ts` Command Group
**File**: `src/cli/commands/browser/logs.ts`
**Changes**: New file with subcommands for console and network logs

```typescript
/**
 * qa-use browser logs - View session logs (console, network)
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error } from '../../lib/output.js';

interface ConsoleLogsOptions {
  sessionId?: string;
  level?: 'log' | 'warn' | 'error' | 'info' | 'debug';
  limit?: string;
  json?: boolean;
}

interface NetworkLogsOptions {
  sessionId?: string;
  status?: string;
  urlPattern?: string;
  limit?: string;
  json?: boolean;
}

const consoleCommand = new Command('console')
  .description('View console logs from a session')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('-l, --level <level>', 'Filter by log level (log, warn, error, info, debug)')
  .option('--limit <n>', 'Maximum number of entries', '100')
  .option('--json', 'Output as JSON')
  .action(async (options: ConsoleLogsOptions) => {
    try {
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      const client = new BrowserApiClient(config.api_url);
      client.setApiKey(config.api_key);

      const resolved = await resolveSessionId({
        explicitId: options.sessionId,
        client,
      });

      const result = await client.getConsoleLogs(resolved.id, {
        level: options.level,
        limit: options.limit ? parseInt(options.limit, 10) : undefined,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Console logs (${result.total} total):\n`);
        for (const log of result.logs) {
          const prefix = log.level.toUpperCase().padEnd(5);
          console.log(`[${prefix}] ${log.text}`);
          if (log.url) console.log(`        at ${log.url}`);
        }
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to get console logs'));
      process.exit(1);
    }
  });

const networkCommand = new Command('network')
  .description('View network request logs from a session')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('--status <codes>', 'Filter by status codes (e.g., "4xx,5xx")')
  .option('--url-pattern <pattern>', 'Filter by URL pattern (e.g., "*api*")')
  .option('--limit <n>', 'Maximum number of entries', '100')
  .option('--json', 'Output as JSON')
  .action(async (options: NetworkLogsOptions) => {
    try {
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      const client = new BrowserApiClient(config.api_url);
      client.setApiKey(config.api_key);

      const resolved = await resolveSessionId({
        explicitId: options.sessionId,
        client,
      });

      const result = await client.getNetworkLogs(resolved.id, {
        status: options.status,
        url_pattern: options.urlPattern,
        limit: options.limit ? parseInt(options.limit, 10) : undefined,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Network requests (${result.total} total):\n`);
        for (const req of result.requests) {
          const statusColor = req.status >= 400 ? '!' : ' ';
          console.log(`${statusColor}${req.method.padEnd(6)} ${req.status} ${req.url} (${req.duration_ms}ms)`);
        }
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to get network logs'));
      process.exit(1);
    }
  });

export const logsCommand = new Command('logs')
  .description('View session logs')
  .addCommand(consoleCommand)
  .addCommand(networkCommand);
```

#### 3. Register New Commands
**File**: `src/cli/commands/browser/index.ts`
**Changes**: Import and register new commands

```typescript
// Add imports at the top:
import { generateTestCommand } from './generate-test.js';
import { logsCommand } from './logs.js';

// Register new commands (add after other command registrations):
browserCommand.addCommand(generateTestCommand);
browserCommand.addCommand(logsCommand);
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `bun run typecheck`
- [x] Linting passes: `bun run lint:fix`
- [x] Build succeeds: `bun run build`
- [x] Help text renders correctly: `bun run build && node dist/cli/index.js browser --help`

#### Manual Verification:
- [x] `qa-use browser generate-test --help` shows correct options
- [x] `qa-use browser logs console --help` shows correct options
- [x] `qa-use browser logs network --help` shows correct options
- [x] Commands follow same patterns as existing browser commands

**Implementation Note**: After completing this phase, pause for final review.

---

## Testing Strategy

### Unit Tests
- `lib/api/browser.test.ts` - Test new client methods with mocked axios

### Integration Testing (Manual)
- Create a browser session with `record_blocks: true`
- Perform some actions
- Call `generateTest()` and verify YAML output
- Call `getConsoleLogs()` and verify log retrieval
- Call `getNetworkLogs()` and verify request log retrieval

### CLI Testing (Manual)
- `qa-use browser create`
- Navigate and interact with a page
- `qa-use browser generate-test -n "Test Name"`
- `qa-use browser logs console`
- `qa-use browser logs network`

## References

- Research document: `thoughts/shared/research/2026-01-24-browser-api-gaps.md`
- API Documentation: `http://localhost:5005/browsers/v1/docs.md`
- Existing API client: `lib/api/browser.ts`
- Existing types: `lib/api/browser-types.ts`
- Existing tests: `lib/api/browser.test.ts`
- CLI command pattern: `src/cli/commands/browser/get-blocks.ts`

---

## Post-Implementation Notes

### Logs During Active Sessions
The client implementation (`getConsoleLogs`, `getNetworkLogs`) already supports fetching logs at any time. The current restriction to closed sessions is backend-side. Once the backend is updated to return logs during active sessions, the client will work without changes.

### Status Command Enhancement
Updated `qa-use browser status` to display new `BrowserSession` fields:
- `app_url` - Link to view session in the web UI
- `last_action_at` - Timestamp of most recent action
- `error_message` - Error details if session failed
- `recording_url` - Video recording (after close)
- `har_url` - HAR file for network analysis (after close)
- `storage_state_url` - Browser storage state (after close)
