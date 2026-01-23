---
date: 2026-01-23
researcher: Claude
topic: browser subcommand for qa-use CLI
git_branch: main
git_commit: f675623
tags: [cli, browser-api, automation, agent-browser]
status: complete
last_updated: 2026-01-23T12:00:00Z
autonomy_mode: verbose
---

# Research: Browser Subcommand for QA-Use CLI

## Research Question

How to create a `browser <xxx>` subcommand that uses the desplega.ai browsers API (`/browsers/v1/`) to control remote browsers, following patterns from Vercel's agent-browser project.

## Summary

This research covers three areas:
1. **desplega.ai browsers API** - REST + WebSocket API with 10 endpoints for session management, browser actions, snapshots, and screenshots
2. **Vercel agent-browser patterns** - CLI architecture, command protocol design, and accessibility-based element targeting
3. **qa-use CLI structure** - How to integrate a new `browser` command using existing patterns

The desplega API is action-based (single endpoint for all browser actions) while agent-browser uses discrete commands. A mapping layer will translate CLI commands to API actions.

---

## Detailed Findings

### 1. desplega.ai Browsers API

**Base URL:** `https://api.desplega.ai/browsers/v1/` (or localhost:5005 for dev)

**Authentication:** Bearer token in `Authorization` header

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sessions` | Create a new browser session |
| `GET` | `/sessions` | List sessions for the organization |
| `GET` | `/sessions/{id}` | Get session details |
| `DELETE` | `/sessions/{id}` | Close a session |
| `POST` | `/sessions/{id}/action` | Execute a browser action |
| `GET` | `/sessions/{id}/snapshot` | Get ARIA accessibility tree |
| `GET` | `/sessions/{id}/screenshot` | Get PNG screenshot |
| `GET` | `/sessions/{id}/url` | Get current URL |
| `WS` | `/sessions/{id}/stream` | Real-time event streaming |

#### Session Lifecycle

```
Create session → Wait for "active" status → Execute actions → Close session
     ↓                    ↓                       ↓              ↓
  starting             poll GET              action API       DELETE
```

**Session states:** `starting` → `active` → `closing` → `closed`

#### Action Types

| Action | Required Fields | Description |
|--------|----------------|-------------|
| `goto` | `url` | Navigate to URL |
| `click` | `ref` | Click element by accessibility ref |
| `fill` | `ref`, `value` | Fill input field |
| `type` | `ref`, `text` | Type text with keystroke delays |
| `press` | `key` | Press keyboard key |
| `hover` | `ref` | Hover over element |
| `scroll` | `direction`, `amount` | Scroll page |
| `select` | `ref`, `value` | Select dropdown option |
| `wait` | `duration_ms` | Wait fixed time |
| `wait_for_selector` | `selector`, `state` | Wait for element |
| `wait_for_load` | `state` | Wait for page load |
| `snapshot` | - | Get ARIA tree (prefer GET endpoint) |
| `screenshot` | - | Get screenshot (prefer GET endpoint) |

#### Element Refs

The snapshot returns an ARIA tree with refs:
```
- heading "Page Title" [level=1] [ref=e2]
- button "Click Me" [ref=e3]
- textbox "Email" [ref=e4]
```

Use refs in actions: `{"type": "click", "ref": "e3"}`

#### WebSocket Events

Server events:
- `action_started` - Action began executing
- `action_completed` - Action finished
- `status_changed` - Session status change
- `error` - Error occurred
- `closed` - Session closed
- Binary frames - PNG screenshots

Client messages:
- `{"type": "ping"}` - Keep-alive
- `{"type": "action", "data": {...}}` - Execute action
- `{"type": "get_status"}` - Get session status

---

### 2. Vercel agent-browser Patterns

**Architecture:** Rust CLI + Node.js daemon (via Unix socket)

Key patterns applicable to qa-use:

#### 2.1 Command Protocol Design

Discriminated unions with `id` + `action`:
```typescript
type Command =
  | { id: string; action: 'navigate'; url: string }
  | { id: string; action: 'click'; selector: string }
  | { id: string; action: 'snapshot'; interactive?: boolean }
```

#### 2.2 Accessibility-First Element Targeting

Instead of CSS selectors, uses `@ref` syntax:
- `@e1`, `@e2`, `@e3` etc.
- Refs are stable across page changes
- AI-friendly for automated scripts

#### 2.3 Cloud Provider Connection Pattern

```typescript
async connectToProvider(): Promise<void> {
  // 1. Create session via REST API
  const { id, connectUrl } = await this.createSession();
  // 2. Store session ID for cleanup
  this.sessionId = id;
  // 3. Connect (or track for REST-only like desplega)
}

async close(): Promise<void> {
  // Cleanup via API
  await this.deleteSession(this.sessionId);
}
```

#### 2.4 AI-Friendly Errors

```typescript
// Bad
{ "error": "Element not found" }

// Good
{ "error": "Element not found. Use 'snapshot' to see available elements with refs." }
```

#### 2.5 Output Formatting

Human-readable by default, JSON with `--json` flag:
```
✓ Navigated to https://example.com
Page title: Example Domain
```

---

### 3. qa-use CLI Structure

**Entry point:** `src/cli/index.ts` (Commander.js)

**Command registration:**
```typescript
program.addCommand(setupCommand);
program.addCommand(infoCommand);
program.addCommand(testCommand);
program.addCommand(mcpCommand);
// Add: program.addCommand(browserCommand);
```

#### Patterns to Follow

**Flat command:** `src/cli/commands/browser.ts`
```typescript
export const browserCommand = new Command('browser')
  .description('Control remote browsers via desplega.ai')
  .addCommand(sessionSubcommand)
  .addCommand(actionSubcommand)
  ...
```

**Nested commands:** `src/cli/commands/browser/index.ts`
```typescript
export const browserCommand = new Command('browser')
  .description('Control remote browsers');

browserCommand.addCommand(createCommand);
browserCommand.addCommand(listCommand);
...
```

**Config/Auth loading:**
```typescript
const config = await loadConfig();
if (!config.api_key) {
  console.log(error('API key not configured'));
  process.exit(1);
}
```

**API client:**
```typescript
const client = new ApiClient(config.api_url);
client.setApiKey(config.api_key);
```

---

## Session Persistence Design

The CLI will track active sessions locally in `~/.qa-use.json`:

```json
{
  "api_key": "...",
  "sessions": [
    {
      "id": "uuid-1234",
      "created_at": "2026-01-23T10:00:00Z",
      "last_updated": "2026-01-23T10:15:00Z"
    }
  ]
}
```

**Session resolution rules:**
1. If `--session-id` (`-s`) is provided, use that session
2. If no session ID provided, check stored sessions:
   - Filter out stale sessions (last_updated > 1 hour ago)
   - If exactly one active session, use it
   - If multiple active sessions, fail with error listing them
   - If no active sessions, fail with "No active session. Run `qa-use browser create` first."
3. On `browser close`, remove session from storage
4. On any action, update `last_updated` timestamp

**Stale session handling:**
- Sessions with `last_updated` > 1 hour ago are considered stale/disconnected
- Stale sessions are automatically removed from local storage (not closed on API)
- User can run `browser list` to see actual API state

---

## Command Mapping: agent-browser → desplega API

| agent-browser Command | desplega API Action | Notes |
|-----------------------|---------------------|-------|
| `launch` | `POST /sessions` | Create session, wait for active |
| `navigate <url>` / `open` / `goto` | `action: goto` | URL parameter |
| `click @e1` | `action: click` | ref parameter |
| `fill @e1 "text"` | `action: fill` | ref + value |
| `type @e1 "text"` | `action: type` | ref + text |
| `press Enter` | `action: press` | key parameter |
| `hover @e1` | `action: hover` | ref parameter |
| `scroll down 500` | `action: scroll` | direction + amount |
| `select @e1 "option"` | `action: select` | ref + value |
| `wait 1000` | `action: wait` | duration_ms |
| `snapshot` | `GET /snapshot` | Returns ARIA tree |
| `screenshot` | `GET /screenshot` | Returns PNG |
| `close` | `DELETE /sessions/{id}` | Cleanup |

### Additional CLI Commands (No agent-browser equivalent)

| qa-use Command | API | Description |
|----------------|-----|-------------|
| `browser list` | `GET /sessions` | List active sessions |
| `browser status <id>` | `GET /sessions/{id}` | Session details |
| `browser url <id>` | `GET /url` | Current page URL |
| `browser stream <id>` | `WS /stream` | Real-time events |

---

## Proposed CLI Structure

**Note:** Session ID is optional for all commands. If omitted, uses the stored active session (see Session Persistence above).

```
qa-use browser
├── create [options]          # Create new session (stores session ID locally)
│   --headless                # Run headless (default: true)
│   --viewport <type>         # desktop|mobile|tablet
│   --timeout <seconds>       # Session timeout (60-3600)
├── list                      # List sessions (from API)
├── status [-s <id>]          # Get session status
├── close [-s <id>]           # Close session (removes from local storage)
├── goto [-s <id>] <url>      # Navigate to URL
├── click [-s <id>] <ref>     # Click element
├── fill [-s <id>] <ref> <value>   # Fill input
├── type [-s <id>] <ref> <text>    # Type with delays
├── press [-s <id>] <key>     # Press key
├── hover [-s <id>] <ref>     # Hover element
├── scroll [-s <id>] <direction> [amount]  # Scroll page
├── select [-s <id>] <ref> <value>  # Select option
├── wait [-s <id>] <ms>       # Wait fixed time
├── snapshot [-s <id>]        # Get ARIA tree
├── screenshot [-s <id>] [file]    # Save screenshot
│   --base64                  # Output as base64 to stdout
│   --stdout                  # Output raw PNG to stdout
├── url [-s <id>]             # Get current URL
├── stream [-s <id>]          # Real-time event streaming (read-only)
└── run [-s <id>]             # Interactive REPL mode
```

**Global options:**
- `--json` - Output as JSON
- `--api-url <url>` - Override API URL

---

## Code References

| Component | Path |
|-----------|------|
| CLI entry point | `src/cli/index.ts:7-27` |
| Command pattern | `src/cli/commands/setup.ts:11-70` |
| Nested commands | `src/cli/commands/test/index.ts:1-21` |
| API client | `lib/api/index.ts:305-327` |
| Config loading | `src/cli/lib/config.ts:63-107` |
| Output helpers | `src/cli/lib/output.ts:79-102` |

---

## Decisions Made

Based on review feedback:

1. **Session persistence:** ✅ Yes - store in `~/.qa-use.json` with session ID and timestamps. Use `-s/--session-id` flag, auto-resolve if only one active session.

2. **Interactive REPL mode:** ✅ Yes - `browser run` will launch REPL for multi-command sessions (like individual CLI commands but in a single session).

3. **Streaming output:** ✅ Yes - `browser stream` will display real-time events in terminal (read-only for now).

4. **Screenshot format:** ✅ Support all formats for extensibility:
   - Default: write to file
   - `--base64`: output base64 to stdout
   - `--stdout`: output raw PNG to stdout (for piping)

5. **Command style:** ✅ Individual commands (click, fill, type, etc.) rather than single `action` subcommand - more discoverable and user-friendly.

---

## Suggested API Enhancements

Based on agent-browser patterns, these features would be valuable additions to the desplega browsers API:

### High Priority

| Feature | Description | agent-browser equivalent |
|---------|-------------|-------------------------|
| **Element queries** | `getByRole`, `getByText`, `getByLabel`, `getByTestId` | Query commands |
| **Tab management** | Create/list/switch/close tabs | `tab_new`, `tab_list`, `tab_switch`, `tab_close` |

### Medium Priority

| Feature | Description | agent-browser equivalent |
|---------|-------------|-------------------------|
| **Cookies access** | Get/set/clear cookies | `cookies_get`, `cookies_set`, `cookies_clear` |
| **Local storage** | Get/set/clear localStorage | `storage_get`, `storage_set`, `storage_clear` |
| **Request mocking** | Intercept and mock network requests | `route`, `unroute` |

### Nice to Have

| Feature | Description | agent-browser equivalent |
|---------|-------------|-------------------------|
| **Element inspection** | `getText`, `getAttribute`, `isVisible`, `isEnabled` | Inspection commands |
| **Input events** | `keydown`, `keyup`, `mousemove`, `tap` | Low-level input |
| **PDF generation** | Save page as PDF | `pdf` command |

---

## Next Steps

1. Create `src/cli/commands/browser/` directory structure
2. Implement `BrowserApiClient` class extending/wrapping `ApiClient` for `/browsers/v1/` endpoints
3. Implement session persistence in `~/.qa-use.json`
4. Add session commands: create, list, status, close
5. Add action commands: goto, click, fill, type, hover, scroll, select, wait, press
6. Add inspection commands: snapshot, screenshot (with format options), url
7. Add streaming command: stream (read-only WebSocket events)
8. Add interactive REPL mode: run
