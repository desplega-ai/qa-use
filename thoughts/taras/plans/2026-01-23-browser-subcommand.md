---
date: 2026-01-23T14:00:00Z
topic: "Browser Subcommand Implementation Plan"
researcher: Claude
status: draft
tags: [cli, browser-api, automation, implementation]
related_research: thoughts/taras/research/2026-01-23-browser-subcommand.md
---

# Browser Subcommand Implementation Plan

## Overview

Implement a `qa-use browser <subcommand>` CLI that controls remote browsers via the desplega.ai `/browsers/v1/` API. This provides direct browser automation capabilities following patterns from Vercel's agent-browser project, with accessibility-based element targeting via refs.

## Current State Analysis

The qa-use CLI exists with four top-level commands: `setup`, `info`, `test`, and `mcp`. The `test` command demonstrates the nested subcommand pattern we'll follow.

**Existing infrastructure**:
- CLI entry: `src/cli/index.ts:18-29` - Commander.js setup
- Nested commands: `src/cli/commands/test/index.ts:1-21` - Subcommand registration pattern
- Config loading: `src/cli/lib/config.ts:63-107` - Async config with env overrides
- API client: `lib/api/index.ts:305-327` - Axios-based with Bearer auth
- Output helpers: `src/cli/lib/output.ts` - Console formatting utilities

**What's missing**:
- BrowserApiClient for `/browsers/v1/` endpoints
- Session persistence in `~/.qa-use.json`
- Browser command directory and subcommands

### Key Discoveries:
- Config uses two files: `~/.qa-use.json` (lib/env) and `.qa-use-tests.json` (CLI)
- Session persistence will extend `~/.qa-use.json` with `browser_sessions` key
- API client pattern: constructor auto-loads API key from env/config (`lib/api/index.ts:323-326`)
- Error handling uses axios error detection with message extraction (`lib/api/index.ts:477-491`)

## Desired End State

A fully functional `qa-use browser` command with 14 subcommands:

```
qa-use browser
├── create          # Create new session
├── list            # List sessions from API
├── status          # Get session status
├── close           # Close session
├── goto            # Navigate to URL
├── click           # Click element by ref
├── fill            # Fill input field
├── type            # Type with keystroke delays
├── press           # Press keyboard key
├── hover           # Hover over element
├── scroll          # Scroll page
├── select          # Select dropdown option
├── wait            # Wait fixed time
├── snapshot        # Get ARIA accessibility tree
├── screenshot      # Save screenshot
├── url             # Get current URL
├── stream          # Real-time WebSocket events
└── run             # Interactive REPL mode
```

**Verification**: Run `qa-use browser create`, verify session created, run actions, close session.

## Quick Verification Reference

Common commands to verify the implementation:
- `bun typecheck` - TypeScript type checking
- `bun lint` - ESLint checks
- `bun build` - Build TypeScript to dist/
- `qa-use browser --help` - Verify command registered

Key files to check:
- `src/cli/commands/browser/index.ts` - Parent command
- `lib/api/browser.ts` - BrowserApiClient
- `src/cli/lib/browser-sessions.ts` - Session persistence

## What We're NOT Doing

1. **Tab management** - Not supported by current desplega API
2. **Cookie/storage access** - Suggested API enhancement, not implemented
3. **Request mocking** - Suggested API enhancement, not implemented
4. **PDF generation** - Out of scope
5. **Visual diff testing** - Out of scope
6. **WebSocket bidirectional actions** - `stream` is read-only for now

## Implementation Approach

1. **Infrastructure first**: Create BrowserApiClient wrapper and session persistence before commands
2. **Session commands**: Lifecycle management before actions
3. **Core actions**: Navigation and interaction commands
4. **Inspection commands**: Snapshot, screenshot, URL
5. **Advanced features**: WebSocket streaming and REPL mode last

---

## Phase 1: Infrastructure

### Overview
Create the foundational classes and utilities that all browser commands will depend on.

### Changes Required:

#### 1. BrowserApiClient Class
**File**: `lib/api/browser.ts` (new)
**Changes**: Create wrapper class around ApiClient for `/browsers/v1/` endpoints

```typescript
export interface BrowserSession {
  id: string;
  status: 'starting' | 'active' | 'closing' | 'closed';
  created_at: string;
  // ... other fields from API
}

export interface ActionResult {
  success: boolean;
  error?: string;
  // ... action-specific data
}

export class BrowserApiClient {
  constructor(private client: ApiClient) {}

  // Session lifecycle
  async createSession(options: CreateSessionOptions): Promise<BrowserSession>
  async listSessions(): Promise<BrowserSession[]>
  async getSession(id: string): Promise<BrowserSession>
  async deleteSession(id: string): Promise<void>

  // Actions
  async executeAction(sessionId: string, action: BrowserAction): Promise<ActionResult>

  // Inspection
  async getSnapshot(sessionId: string): Promise<string>
  async getScreenshot(sessionId: string): Promise<Buffer>
  async getUrl(sessionId: string): Promise<string>

  // Streaming
  createStream(sessionId: string): WebSocket
}
```

#### 2. Session Persistence Utilities
**File**: `src/cli/lib/browser-sessions.ts` (new)
**Changes**: Functions to store/retrieve active sessions in `~/.qa-use.json`

```typescript
export interface StoredSession {
  id: string;
  created_at: string;
  last_updated: string;
}

// Load sessions from ~/.qa-use.json
export async function loadStoredSessions(): Promise<StoredSession[]>

// Save session to storage
export async function storeSession(session: StoredSession): Promise<void>

// Remove session from storage
export async function removeStoredSession(id: string): Promise<void>

// Resolve session ID (from flag or auto-detect)
export async function resolveSessionId(
  explicitId: string | undefined,
  client: BrowserApiClient
): Promise<string>

// Update last_updated timestamp
export async function touchSession(id: string): Promise<void>

// Clean stale sessions (>1 hour old)
export async function cleanStaleSessions(): Promise<void>
```

#### 3. Browser Command Structure
**File**: `src/cli/commands/browser/index.ts` (new)
**Changes**: Parent command that registers all subcommands

#### 4. Type Definitions
**File**: `lib/api/browser-types.ts` (new)
**Changes**: TypeScript interfaces for all API requests/responses

#### 5. Register Browser Command
**File**: `src/cli/index.ts`
**Changes**: Add `program.addCommand(browserCommand)`

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `bun typecheck`
- [ ] Linting passes: `bun lint`
- [ ] Build succeeds: `bun build`
- [ ] Command registered: `qa-use browser --help`

#### Manual Verification:
- [ ] `qa-use browser --help` shows "Control remote browsers" description
- [ ] No runtime errors when running help

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Session Management

### Overview
Implement session lifecycle commands: create, list, status, close.

### Changes Required:

#### 1. Create Command
**File**: `src/cli/commands/browser/create.ts` (new)
**Changes**:
- Create session via API
- Wait for "active" status (poll GET /sessions/{id})
- Store session in `~/.qa-use.json`
- Print session ID and status

Options:
- `--headless` (default: true)
- `--viewport <desktop|mobile|tablet>` (default: desktop)
- `--timeout <seconds>` (default: 300)

#### 2. List Command
**File**: `src/cli/commands/browser/list.ts` (new)
**Changes**:
- Fetch sessions from API
- Display table with ID, status, created_at
- Mark locally tracked sessions

#### 3. Status Command
**File**: `src/cli/commands/browser/status.ts` (new)
**Changes**:
- Get session details from API
- Display status, URL, created_at
- Support `-s/--session-id` or auto-resolve

#### 4. Close Command
**File**: `src/cli/commands/browser/close.ts` (new)
**Changes**:
- Delete session via API
- Remove from local storage
- Confirm closure

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `bun typecheck`
- [ ] Linting passes: `bun lint`
- [ ] Build succeeds: `bun build`

#### Manual Verification:
- [ ] `qa-use browser create` creates session and shows ID
- [ ] `qa-use browser list` shows the created session
- [ ] `qa-use browser status` shows session details
- [ ] `qa-use browser close` closes and removes session
- [ ] `qa-use browser list` no longer shows closed session

**Implementation Note**: After completing this phase, pause for manual confirmation. This is a critical checkpoint - all subsequent phases depend on working session management.

---

## Phase 3: Navigation & Actions

### Overview
Implement browser action commands for navigation and user interaction.

### Changes Required:

#### 1. Goto Command
**File**: `src/cli/commands/browser/goto.ts` (new)
**Changes**: Navigate to URL
- Argument: `<url>`
- Option: `-s/--session-id`
- Updates `last_updated` timestamp

#### 2. Click Command
**File**: `src/cli/commands/browser/click.ts` (new)
**Changes**: Click element by accessibility ref
- Argument: `<ref>` (e.g., "e3" or "@e3")
- Option: `-s/--session-id`
- Strip leading "@" if present

#### 3. Fill Command
**File**: `src/cli/commands/browser/fill.ts` (new)
**Changes**: Fill input field
- Arguments: `<ref> <value>`
- Option: `-s/--session-id`

#### 4. Type Command
**File**: `src/cli/commands/browser/type.ts` (new)
**Changes**: Type with keystroke delays
- Arguments: `<ref> <text>`
- Option: `-s/--session-id`

#### 5. Press Command
**File**: `src/cli/commands/browser/press.ts` (new)
**Changes**: Press keyboard key
- Argument: `<key>` (e.g., "Enter", "Tab", "Escape")
- Option: `-s/--session-id`

#### 6. Hover Command
**File**: `src/cli/commands/browser/hover.ts` (new)
**Changes**: Hover over element
- Argument: `<ref>`
- Option: `-s/--session-id`

#### 7. Scroll Command
**File**: `src/cli/commands/browser/scroll.ts` (new)
**Changes**: Scroll page
- Arguments: `<direction>` (up/down/left/right), `[amount]` (pixels, default: 500)
- Option: `-s/--session-id`

#### 8. Select Command
**File**: `src/cli/commands/browser/select.ts` (new)
**Changes**: Select dropdown option
- Arguments: `<ref> <value>`
- Option: `-s/--session-id`

#### 9. Wait Command
**File**: `src/cli/commands/browser/wait.ts` (new)
**Changes**: Wait fixed time
- Argument: `<ms>` (milliseconds)
- Option: `-s/--session-id`

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `bun typecheck`
- [ ] Linting passes: `bun lint`
- [ ] Build succeeds: `bun build`

#### Manual Verification:
- [ ] Create session: `qa-use browser create`
- [ ] Navigate: `qa-use browser goto https://example.com`
- [ ] Get snapshot to find refs: `qa-use browser snapshot`
- [ ] Click element: `qa-use browser click e3` (use actual ref from snapshot)
- [ ] Fill input: `qa-use browser fill e4 "test@example.com"` (if form exists)
- [ ] Scroll: `qa-use browser scroll down 200`
- [ ] Press key: `qa-use browser press Escape`
- [ ] Close session: `qa-use browser close`

**Implementation Note**: After completing this phase, pause for manual testing with a real website to verify actions work correctly.

---

## Phase 4: Inspection Commands

### Overview
Implement commands to inspect browser state: snapshot, screenshot, url.

### Changes Required:

#### 1. Snapshot Command
**File**: `src/cli/commands/browser/snapshot.ts` (new)
**Changes**: Get ARIA accessibility tree
- Option: `-s/--session-id`
- Option: `--json` (output raw JSON instead of formatted tree)
- Default: Pretty-print the ARIA tree with refs highlighted

#### 2. Screenshot Command
**File**: `src/cli/commands/browser/screenshot.ts` (new)
**Changes**: Capture and save screenshot
- Argument: `[file]` (optional, default: `screenshot-{timestamp}.png`)
- Option: `-s/--session-id`
- Option: `--base64` (output base64 to stdout)
- Option: `--stdout` (output raw PNG bytes to stdout for piping)

#### 3. URL Command
**File**: `src/cli/commands/browser/url.ts` (new)
**Changes**: Get current page URL
- Option: `-s/--session-id`
- Simply prints the URL

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `bun typecheck`
- [ ] Linting passes: `bun lint`
- [ ] Build succeeds: `bun build`

#### Manual Verification:
- [ ] Create session and navigate: `qa-use browser create && qa-use browser goto https://example.com`
- [ ] Get snapshot: `qa-use browser snapshot` shows ARIA tree with refs
- [ ] Get screenshot to file: `qa-use browser screenshot` creates PNG file
- [ ] Get screenshot to stdout: `qa-use browser screenshot --base64` outputs base64
- [ ] Get URL: `qa-use browser url` prints "https://example.com"
- [ ] Close session: `qa-use browser close`

**Implementation Note**: After completing this phase, pause for verification. Snapshot output format is important for usability.

---

## Phase 5: Advanced Features

### Overview
Implement WebSocket streaming and interactive REPL mode.

### Changes Required:

#### 1. Stream Command
**File**: `src/cli/commands/browser/stream.ts` (new)
**Changes**: Real-time WebSocket event streaming (read-only)
- Option: `-s/--session-id`
- Connects to `WS /sessions/{id}/stream`
- Prints events as they arrive:
  - `action_started` - "▶ Action started: {type}"
  - `action_completed` - "✓ Action completed"
  - `status_changed` - "⚡ Status: {status}"
  - `error` - "✗ Error: {message}"
  - `closed` - "Session closed"
- Ctrl+C to disconnect

#### 2. Run Command (REPL)
**File**: `src/cli/commands/browser/run.ts` (new)
**Changes**: Interactive REPL mode for multi-command sessions
- Option: `-s/--session-id` (or creates new session)
- Option: `--headless` (for new session)
- Provides prompt: `browser> `
- Supports commands: goto, click, fill, type, press, hover, scroll, select, wait, snapshot, screenshot, url, help, exit
- On `exit`, asks whether to close session or keep alive

Example session:
```
$ qa-use browser run
Creating new browser session...
Session e1234567 ready.

browser> goto https://example.com
✓ Navigated to https://example.com

browser> snapshot
- heading "Example Domain" [level=1] [ref=e2]
- paragraph [ref=e3]
- link "More information..." [ref=e4]

browser> click e4
✓ Clicked element e4

browser> exit
Close session? (y/n): y
Session closed.
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `bun typecheck`
- [ ] Linting passes: `bun lint`
- [ ] Build succeeds: `bun build`

#### Manual Verification:
- [ ] Stream command: Create session, run `qa-use browser stream`, perform action in another terminal, see events
- [ ] REPL mode: `qa-use browser run` starts session and shows prompt
- [ ] REPL commands: Execute goto, snapshot, click, screenshot within REPL
- [ ] REPL exit: `exit` prompts for session cleanup choice
- [ ] REPL with existing session: `qa-use browser run -s <id>` attaches to existing session

**Implementation Note**: After completing this phase, pause for comprehensive manual testing of the interactive features.

---

## Phase 6: Additional Protocol Commands

### Overview
Implement remaining browser protocol commands not covered in earlier phases: navigation history (back, forward, reload), checkbox actions (check, uncheck), scroll-into-view, advanced waits, and get-blocks.

### Changes Required:

#### Navigation History Commands

##### 1. Back Command
**File**: `src/cli/commands/browser/back.ts` (new)
**Changes**: Navigate back in browser history
- Option: `-s/--session-id`

##### 2. Forward Command
**File**: `src/cli/commands/browser/forward.ts` (new)
**Changes**: Navigate forward in browser history
- Option: `-s/--session-id`

##### 3. Reload Command
**File**: `src/cli/commands/browser/reload.ts` (new)
**Changes**: Reload current page
- Option: `-s/--session-id`

#### Checkbox Commands

##### 4. Check Command
**File**: `src/cli/commands/browser/check.ts` (new)
**Changes**: Check a checkbox
- Argument: `<ref>` (or use `--text` for semantic selection)
- Option: `--text <description>` (AI-based element selection)
- Option: `-s/--session-id`

##### 5. Uncheck Command
**File**: `src/cli/commands/browser/uncheck.ts` (new)
**Changes**: Uncheck a checkbox
- Argument: `<ref>` (or use `--text` for semantic selection)
- Option: `--text <description>` (AI-based element selection)
- Option: `-s/--session-id`

#### Scroll Commands

##### 6. Scroll Into View Command
**File**: `src/cli/commands/browser/scroll-into-view.ts` (new)
**Changes**: Scroll element into view
- Argument: `<ref>` (or use `--text` for semantic selection)
- Option: `--text <description>` (AI-based element selection)
- Option: `-s/--session-id`

#### Advanced Wait Commands

##### 7. Wait For Selector Command
**File**: `src/cli/commands/browser/wait-for-selector.ts` (new)
**Changes**: Wait for CSS selector to reach a state
- Argument: `<selector>` (CSS selector)
- Option: `--state <state>` (attached/detached/visible/hidden, default: visible)
- Option: `--timeout <ms>` (default: 30000)
- Option: `-s/--session-id`

##### 8. Wait For Load Command
**File**: `src/cli/commands/browser/wait-for-load.ts` (new)
**Changes**: Wait for page load state
- Option: `--state <state>` (load/domcontentloaded/networkidle, default: load)
- Option: `--timeout <ms>` (default: 30000)
- Option: `-s/--session-id`

#### Inspection Commands

##### 9. Get Blocks Command
**File**: `src/cli/commands/browser/get-blocks.ts` (new)
**Changes**: Get recorded blocks (test steps) from the session
- Option: `-s/--session-id`
- Option: `--json` (output raw JSON, default)
- Returns `ExtendedStep[]` (types in `src/types/test-definition.ts`)
- Useful for debugging/inspecting recorded actions and test generation

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `bun typecheck`
- [x] Linting passes: `bun lint`
- [x] Build succeeds: `bun run build`

#### Manual Verification:
- [ ] Navigation: `back`, `forward`, `reload` work after navigating between pages
- [ ] Checkbox: `check` and `uncheck` toggle checkbox state
- [ ] Scroll: `scroll-into-view` scrolls element into viewport
- [ ] Wait for selector: `wait-for-selector ".content"` waits for element
- [ ] Wait for load: `wait-for-load --state networkidle` waits for network idle
- [ ] Get blocks: `get-blocks` shows recorded actions as ExtendedStep[]

**Implementation Note**: These commands can be implemented in any order. They are independent additions to the existing command set.

---

## Updated Command Summary

| Command | Arguments | Key Options | Description |
|---------|-----------|-------------|-------------|
| create | - | --headless, --viewport, --timeout | Create new session |
| list | - | - | List all sessions |
| status | - | -s | Get session status |
| close | - | -s | Close session |
| goto | `<url>` | -s | Navigate to URL |
| **back** | - | -s | Navigate back |
| **forward** | - | -s | Navigate forward |
| **reload** | - | -s | Reload page |
| click | `<ref>` | -s, --text | Click element |
| fill | `<ref> <value>` | -s, --text | Fill input |
| type | `<ref> <text>` | -s | Type text |
| press | `<key>` | -s, --ref | Press key |
| hover | `<ref>` | -s, --text | Hover element |
| select | `<ref> <value>` | -s, --text | Select option |
| **check** | `<ref>` | -s, --text | Check checkbox |
| **uncheck** | `<ref>` | -s, --text | Uncheck checkbox |
| scroll | `<direction> [amount]` | -s, --ref | Scroll page/element |
| **scroll-into-view** | `<ref>` | -s, --text | Scroll element into view |
| wait | `<ms>` | -s | Wait fixed time |
| **wait-for-selector** | `<selector>` | -s, --state, --timeout | Wait for selector |
| **wait-for-load** | - | -s, --state, --timeout | Wait for load state |
| snapshot | - | -s, --json | Get ARIA tree |
| screenshot | `[file]` | -s, --base64, --stdout | Take screenshot |
| url | - | -s | Get current URL |
| **get-blocks** | - | -s, --json | Get recorded blocks |
| stream | - | -s | WebSocket event stream |
| run | - | -s, --headless | Interactive REPL |

**Bold** = New commands added in Phase 6

**Note**: Commands supporting `--text` use AI-based semantic element selection (slower but doesn't require refs from snapshot).

---

## Testing Strategy

### Unit Tests
- `BrowserApiClient` methods with mocked axios responses
- Session persistence functions with temp file
- Session resolution logic (explicit ID, auto-detect, multiple sessions)

### Integration Tests
- Full session lifecycle: create → action → close
- Error handling: invalid session ID, network errors, API errors

### Manual Testing Checklist
1. Create session, verify in `~/.qa-use.json`
2. Navigate to real website
3. Get snapshot, identify refs
4. Click/fill/type with refs
5. Check/uncheck checkboxes
6. Select dropdown options
7. Scroll page and scroll-into-view
8. Wait for selectors and load states
9. Screenshot to file and stdout
10. Get blocks (ExtendedStep[])
11. Navigate back/forward/reload
12. Stream events while performing actions
13. REPL mode full workflow
14. Session auto-resolution with single session
15. Error when multiple sessions and no `-s` flag
16. Stale session cleanup
17. Text-based semantic selection (--text option)

## References
- Related research: `thoughts/taras/research/2026-01-23-browser-subcommand.md`
- CLI patterns: `src/cli/commands/test/index.ts`
- API client patterns: `lib/api/index.ts`
- Config patterns: `src/cli/lib/config.ts`
