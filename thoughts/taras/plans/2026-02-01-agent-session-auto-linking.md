---
date: 2026-02-01T12:00:00Z
topic: "qa-use CLI Auto-Linking Support"
status: implemented
priority: required
---

# Plan: qa-use CLI Auto-Linking Support

**Created:** 2026-02-01
**Status:** Draft
**Priority:** Required for Agent Session UI

## Overview

Add automatic agent session linking to qa-use CLI commands. When the environment variable `QA_USE_AGENT_SESSION_ID` is set, the CLI will automatically include it in API requests for browser session creation and test run execution.

## Current State

### Environment Variable Handling
- `lib/env/index.ts` provides `getEnv()` function that checks `process.env` first, then falls back to `~/.qa-use.json`
- Existing env vars: `QA_USE_API_KEY`, `QA_USE_API_URL`, `QA_USE_REGION`, `QA_USE_APP_URL`
- Pattern established: simple string lookup with optional config file fallback

### Browser Session Creation
- `lib/api/browser.ts:70-86` - `BrowserApiClient.createSession()` sends POST to `/sessions`
- `lib/api/browser-types.ts:13-21` - `CreateBrowserSessionOptions` interface defines request options
- `src/cli/commands/browser/create.ts:126-133` - CLI command calls `client.createSession()`

### Test Run Execution
- `lib/api/index.ts:262-273` - `RunCliTestOptions` interface defines test run request options
- `lib/api/index.ts:820-830` - `runCliTest()` sends POST to `/vibe-qa/cli/run`
- `src/cli/commands/test/run.ts:154-175` - CLI command builds options and calls `runTest()`

## Desired End State

1. New environment variable `QA_USE_AGENT_SESSION_ID` recognized by the CLI
2. Browser session creation (`qa-use browser create`) automatically includes `agent_session_id` in API request when env var is set
3. Test run execution (`qa-use test run`) automatically includes `agent_session_id` in API request when env var is set
4. No changes to CLI command signatures - purely transparent behavior
5. Backend can associate browser sessions and test runs with agent sessions for UI grouping

## Implementation Phases

### Phase 1: Add Environment Variable Helper

**Files to modify:**
- `lib/env/index.ts`

**Changes:**
1. Add new helper function `getAgentSessionId()` that returns `QA_USE_AGENT_SESSION_ID` env var value or undefined
2. Keep it simple - no config file fallback needed (this is a runtime-only value)

**Code changes:**

```typescript
// lib/env/index.ts - Add at end of file

/**
 * Get agent session ID from environment if available.
 * Used for auto-linking browser sessions and test runs to agent sessions.
 *
 * Unlike other env vars, this does NOT fall back to config file - it's purely
 * a runtime value set by the test-agent container.
 */
export function getAgentSessionId(): string | undefined {
  return process.env.QA_USE_AGENT_SESSION_ID || undefined;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `bun run typecheck`
- [x] Lint passes: `bun run check:fix`
- [x] Function is exported: `grep -q "export function getAgentSessionId" lib/env/index.ts`

#### Manual Verification:
- [x] N/A - no behavioral change yet

**Implementation Note**: Proceed to Phase 2 after automated checks pass.

---

### Phase 2: Update Browser API Types and Client

**Files to modify:**
- `lib/api/browser-types.ts`
- `lib/api/browser.ts`

**Changes:**

1. Add `agent_session_id?: string` to `CreateBrowserSessionOptions` interface in `browser-types.ts:13-21`
2. Update `createSession()` in `browser.ts:70-86` to include `agent_session_id` in request body when provided

**Code changes:**

```typescript
// lib/api/browser-types.ts - Update CreateBrowserSessionOptions
export interface CreateBrowserSessionOptions {
  headless?: boolean;
  viewport?: ViewportType;
  timeout?: number;
  ws_url?: string;
  record_blocks?: boolean;
  after_test_id?: string;
  vars?: Record<string, string>;
  agent_session_id?: string; // NEW: Link to agent session for UI grouping
}
```

```typescript
// lib/api/browser.ts - Update createSession() request body (line ~72-80)
async createSession(options: CreateBrowserSessionOptions = {}): Promise<BrowserSession> {
  try {
    const response = await this.client.post('/sessions', {
      headless: options.headless ?? true,
      viewport: options.viewport ?? 'desktop',
      timeout: options.timeout ?? 300,
      ...(options.ws_url && { ws_url: options.ws_url }),
      ...(options.record_blocks !== undefined && { record_blocks: options.record_blocks }),
      ...(options.after_test_id && { after_test_id: options.after_test_id }),
      ...(options.vars && Object.keys(options.vars).length > 0 && { vars: options.vars }),
      ...(options.agent_session_id && { agent_session_id: options.agent_session_id }), // NEW
    });

    return response.data as BrowserSession;
  } catch (error) {
    throw this.handleError(error, 'create session');
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `bun run typecheck`
- [x] Lint passes: `bun run check:fix`
- [x] Type includes new field: `grep -q "agent_session_id" lib/api/browser-types.ts`
- [x] Request body includes field: `grep -q "agent_session_id" lib/api/browser.ts`

#### Manual Verification:
- [x] N/A - no behavioral change yet (field not being set)

**Implementation Note**: Proceed to Phase 3 after automated checks pass.

---

### Phase 3: Update Test Run API Types and Client

**Files to modify:**
- `lib/api/index.ts`

**Changes:**

1. Add `agent_session_id?: string` to `RunCliTestOptions` interface (line ~262-273)
2. The field will be automatically included in the JSON.stringify() of the request body at line 829

**Code changes:**

```typescript
// lib/api/index.ts - Update RunCliTestOptions (around line 262)
export interface RunCliTestOptions {
  test_definitions?: TestDefinition[];
  test_id?: string;
  persist?: boolean;
  headless?: boolean;
  allow_fix?: boolean;
  capture_screenshots?: boolean;
  store_recording?: boolean;
  store_har?: boolean;
  ws_url?: string;
  vars?: Record<string, string>;
  agent_session_id?: string; // NEW: Link to agent session for UI grouping
}
```

Note: No code change needed in `runCliTest()` since it does `body: JSON.stringify(options)` - the new field will be included automatically when present.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `bun run typecheck`
- [x] Lint passes: `bun run check:fix`
- [x] Type includes new field: `grep -q "agent_session_id.*string" lib/api/index.ts`

#### Manual Verification:
- [x] N/A - no behavioral change yet (field not being set)

**Implementation Note**: Proceed to Phase 4 after automated checks pass.

---

### Phase 4: Wire Up Auto-Linking in CLI Commands

**Files to modify:**
- `src/cli/commands/browser/create.ts`
- `src/cli/commands/test/run.ts`

**Note:** `src/cli/lib/runner.ts` does NOT need modification - it passes the entire `options` object through to `client.runCliTest(options, ...)` at line 56, so `agent_session_id` will automatically be included when present.

**Changes:**

1. In `browser/create.ts`:
   - Import `getAgentSessionId` from `lib/env/index.js`
   - Pass `agent_session_id: getAgentSessionId()` to `createSession()` calls (two locations: `createRemoteSession` line ~126 and `runTunnelMode` line ~318)

2. In `test/run.ts`:
   - Import `getAgentSessionId` from `lib/env/index.js`
   - Pass `agent_session_id: getAgentSessionId()` to `runTest()` options (line ~154-175)

**Code changes:**

```typescript
// src/cli/commands/browser/create.ts - Add import at top
import { getAgentSessionId } from '../../../../lib/env/index.js';

// In createRemoteSession() around line 126
const session = await client.createSession({
  headless: options.headless !== false,
  viewport,
  timeout,
  ws_url: options.wsUrl,
  after_test_id: options.afterTestId,
  vars: options.var,
  agent_session_id: getAgentSessionId(), // NEW
});

// In runTunnelMode() around line 318
const session = await client.createSession({
  headless,
  viewport,
  timeout,
  ws_url: tunneledWsUrl,
  agent_session_id: getAgentSessionId(), // NEW
});
```

```typescript
// src/cli/commands/test/run.ts - Add import at top
import { getAgentSessionId } from '../../../../lib/env/index.js';

// In runTest() call around line 154
const result = await runTest(
  client,
  {
    test_definitions: testDefinitions,
    test_id: options.id,
    persist: options.persist || config.defaults?.persist || false,
    headless: wsUrl ? true : options.headful ? false : (config.defaults?.headless ?? true),
    allow_fix: options.autofix || config.defaults?.allow_fix || false,
    capture_screenshots: options.screenshots || options.download || false,
    ws_url: wsUrl,
    agent_session_id: getAgentSessionId(), // NEW
  },
  // ... rest of options
);
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `bun run typecheck`
- [x] Lint passes: `bun run check:fix`
- [x] Import added to browser/create.ts: `grep -q "getAgentSessionId" src/cli/commands/browser/create.ts`
- [x] Import added to test/run.ts: `grep -q "getAgentSessionId" src/cli/commands/test/run.ts`
- [x] Existing tests pass: `bun test`

#### Manual Verification:
- [x] Test without env var: `bun run cli browser create --no-headless` works normally (close session after)
- [x] Test with env var: `QA_USE_AGENT_SESSION_ID=test-123 bun run cli browser create --no-headless` works (backend may reject unknown ID, but request should include the field)

**Implementation Note**: This phase completes the CLI-side implementation.

---

## Out of Scope

- **CLI flag for agent_session_id**: Per decision, only env var support (no `--agent-session-id` flag)
- **Backend API changes**: Backend team handles `POST /client/browser-sessions` and `POST /vibe-qa/cli/run` to accept the new field
- **Database migrations**: Backend team handles FK columns to link sessions/runs to agent sessions

## Dependencies

- **Backend must accept new field**: The API endpoints must be updated to accept `agent_session_id` field. If backend rejects unknown fields, this will fail until backend is updated.

## Testing Strategy

1. **Unit tests**: Verify `getAgentSessionId()` returns correct values
2. **Integration tests**:
   - Without env var: commands work normally
   - With env var: commands include `agent_session_id` in request body
3. **E2E tests**: Once backend is ready, verify sessions appear linked in Agent Session UI

## Rollout Plan

1. Merge CLI changes (this plan)
2. Backend deploys API changes (parallel work)
3. Verify end-to-end linking works in staging
4. Deploy to production
