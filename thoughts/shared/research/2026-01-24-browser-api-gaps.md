---
date: 2026-01-24T18:40:00Z
topic: "Browser Protocol API - Documentation vs Implementation Gaps"
status: complete
type: research
---

# Research: Browser Protocol API - Documentation vs Implementation Gaps

**Subject:** Analysis of `/browsers/v1/docs.md` vs qa-use implementation

---

## Executive Summary

After thorough analysis of the API documentation at `http://localhost:5005/browsers/v1/docs.md` and the qa-use codebase, I identified several gaps between what's documented and what's implemented in the client library.

---

## Documentation Structure

The API documentation describes a **backend REST API** served by desplega.ai, not qa-use directly. The qa-use project is a **client** that consumes this API. The gaps fall into two categories:

1. **Client Implementation Gaps** - Backend endpoints that exist but aren't implemented in the qa-use client
2. **Type Definition Gaps** - Response fields or action types that aren't reflected in TypeScript types

---

## Critical Gaps (Not Implemented in Client)

### 1. `POST /browsers/v1/sessions/{id}/generate-test`

**Documented functionality:**
```json
POST /browsers/v1/sessions/{id}/generate-test
{
  "name": "Login Flow Test",
  "app_config": "my-app-config-id",
  "variables": {"email": "test@example.com"}
}
```

**Response:**
```json
{
  "yaml": "name: Login Flow Test\nsteps:\n  ...",
  "test_definition": {...},
  "block_count": 5
}
```

**Current status in qa-use:**
- Only referenced in `SETUP.md`
- NOT implemented in `BrowserApiClient` (`lib/api/browser.ts`)
- No CLI command for this

**Impact:** Users cannot generate test YAML from recorded session blocks via the client.

---

### 2. `GET /browsers/v1/sessions/{id}/logs/console`

**Documented functionality:**
```
GET /browsers/v1/sessions/{id}/logs/console?level=error&limit=100
```

Returns console logs (log, warn, error, info, debug) captured during session.

**Response:**
```json
{
  "logs": [
    {"level": "error", "text": "...", "timestamp": "...", "url": "..."}
  ],
  "total": 42
}
```

**Current status in qa-use:**
- NOT implemented in `BrowserApiClient`
- No CLI command
- No type definitions

**Impact:** Users cannot retrieve console logs from closed sessions for debugging.

---

### 3. `GET /browsers/v1/sessions/{id}/logs/network`

**Documented functionality:**
```
GET /browsers/v1/sessions/{id}/logs/network?status=4xx,5xx&url_pattern=*api*
```

Returns network request logs from HAR file.

**Response:**
```json
{
  "requests": [
    {"method": "GET", "url": "...", "status": 200, "duration_ms": 150, ...}
  ],
  "total": 150
}
```

**Current status in qa-use:**
- NOT implemented in `BrowserApiClient`
- No CLI command
- No type definitions

**Impact:** Users cannot analyze network requests from closed sessions.

---

## Type Definition Gaps

### 4. Session Response Fields Missing

**Documented fields NOT in `BrowserSession` type:**

```typescript
// Current type in lib/api/browser-types.ts:
export interface BrowserSession {
  id: string;
  status: BrowserSessionStatus;
  created_at: string;
  updated_at?: string;
  current_url?: string;
  viewport?: ViewportType;
  headless?: boolean;
  timeout?: number;
}

// Missing fields from documentation:
// - app_url: Frontend URL to view session visualization
// - last_action_at: Timestamp of last action
// - error_message: Error if session failed
// - config: Session configuration object
// - recording_url: Video recording (after close)
// - har_url: HAR file URL (after close)
// - storage_state_url: Browser storage state (after close)
```

**Impact:** Client code cannot access artifact URLs or visualization links.

---

### 5. `set_checked` Action Type

**Documented:**
```json
{"type": "set_checked", "ref": "e1", "checked": true}
```

**Current status:**
- Listed in `BrowserActionType` union but no interface definition
- No `SetCheckedAction` interface in `browser-types.ts`
- Exists only in `test-definition.ts` as string literal

**Fix needed:**
```typescript
export interface SetCheckedAction {
  type: 'set_checked';
  ref?: string;
  text?: string;
  checked: boolean;
}

// Add to BrowserAction union
export type BrowserAction = ... | SetCheckedAction;
```

---

### 6. Action Response Fields

**Documented response:**
```json
{
  "success": true,
  "action_id": "uuid",
  "error": null,
  "url_before": "https://before.com",
  "url_after": "https://after.com",
  "data": {}
}
```

**Current type:**
```typescript
export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

// Missing:
// - action_id
// - url_before
// - url_after
```

---

### 7. Create Session Request Parameters

**Documented:**
```json
{
  "timeout_seconds": 3600,
  "headless": true,
  "viewport_type": "desktop",
  "record_blocks": true,
  "ws_url": "ws://..."
}
```

**Current type:**
```typescript
export interface CreateBrowserSessionOptions {
  headless?: boolean;
  viewport?: ViewportType;  // Should be 'viewport_type'
  timeout?: number;         // Should be 'timeout_seconds'
  ws_url?: string;
  // Missing: record_blocks
}
```

**Issues:**
- Parameter name mismatch: `viewport` vs `viewport_type`
- Parameter name mismatch: `timeout` vs `timeout_seconds`
- Missing: `record_blocks` option

---

## Documentation Gaps (Present in Code but Not Documented)

### CLI Commands Not Documented

CLI browser commands in `/src/cli/commands/browser/`:
- `qa-use browser create`
- `qa-use browser list`
- `qa-use browser status`
- `qa-use browser close`
- `qa-use browser goto`
- `qa-use browser click`
- `qa-use browser fill`
- `qa-use browser type`
- `qa-use browser press`
- `qa-use browser hover`
- `qa-use browser scroll`
- `qa-use browser scroll-into-view`
- `qa-use browser select`
- `qa-use browser check`
- `qa-use browser uncheck`
- `qa-use browser wait`
- `qa-use browser wait-for-selector`
- `qa-use browser wait-for-load`
- `qa-use browser snapshot`
- `qa-use browser screenshot`
- `qa-use browser url`
- `qa-use browser get-blocks`
- `qa-use browser stream`
- `qa-use browser run`
- `qa-use browser back`
- `qa-use browser forward`
- `qa-use browser reload`

---

## Recommendations

### Priority 1 (High Impact)

1. **Implement `generateTest()` method in BrowserApiClient**
   - Add method to `lib/api/browser.ts`
   - Add CLI command `qa-use browser generate-test`
   - This enables test generation workflow

2. **Implement console/network log methods**
   - Add `getConsoleLogs()` and `getNetworkLogs()` to client
   - Add CLI commands for debugging workflows

### Priority 2 (Type Safety)

3. **Update `BrowserSession` interface** with missing fields:
   - `app_url`, `last_action_at`, `error_message`
   - `recording_url`, `har_url`, `storage_state_url`

4. **Add `SetCheckedAction` interface** and add to union type

5. **Fix parameter naming** in `CreateBrowserSessionOptions`:
   - Rename `viewport` → `viewport_type`
   - Rename `timeout` → `timeout_seconds`
   - Add `record_blocks` option

---

## Files to Modify

| File | Changes |
|------|---------|
| `lib/api/browser.ts` | Add `generateTest()`, `getConsoleLogs()`, `getNetworkLogs()` |
| `lib/api/browser-types.ts` | Add missing fields to interfaces |
| `src/cli/commands/browser/` | Add new CLI commands |

---

## References

- API Documentation: `http://localhost:5005/browsers/v1/docs.md`
- Browser API Client: `lib/api/browser.ts`
- Browser Types: `lib/api/browser-types.ts`
- MCP Server: `src/server.ts`
- CLI Commands: `src/cli/commands/browser/`
