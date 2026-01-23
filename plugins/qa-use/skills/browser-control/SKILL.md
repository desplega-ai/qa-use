---
name: browser-control
description: Control remote browsers via qa-use CLI for web automation, testing, and data extraction
---

# Browser Control

This skill enables browser automation using the `qa-use browser` CLI.

## Prerequisites

The qa-use CLI must be installed. Install via:

```bash
# Global install (recommended for frequent use)
npm install -g @desplega.ai/qa-use

# Or use npx for one-off commands
npx @desplega.ai/qa-use browser <command>
```

**Note:** All commands in this skill assume global installation (`qa-use browser ...`). If using npx, prefix commands with `npx @desplega.ai/qa-use`.

## When to Use

- Navigate websites and interact with web pages
- Fill forms and test web applications
- Extract information from web pages
- Take screenshots and capture page state
- Debug visual issues with real browser

## Critical Constraints

- ALWAYS create a session before running actions
- ALWAYS use `snapshot` to get available element refs before clicking/filling
- NEVER guess element refs - always verify via snapshot
- ALWAYS close sessions when done to free resources
- If element not found, run `snapshot` to see available elements
- **ALWAYS use `--tunnel` when testing localhost URLs** (e.g., `http://localhost:3000`) - the cloud cannot access your local machine without a tunnel!

## Workflow

### 1. Session Management

```bash
# Create session (remote browser managed by API)
qa-use browser create --viewport desktop

# Create session with local browser + tunnel (visible browser on your machine)
qa-use browser create --tunnel

# Create session with existing WebSocket URL (e.g., browserbase)
qa-use browser create --ws-url wss://my-browser.example.com/ws

# List active sessions
qa-use browser list

# Close session (also stops tunnel if running)
qa-use browser close
```

**Local Browser with Tunnel (`--tunnel`):**
- Starts a real browser on your machine (visible by default, use `--headless` for headless)
- Creates a tunnel so the API can control it
- Useful for debugging - you see exactly what happens
- Auto-cleans up when closed via `browser close` or Ctrl+C
- Process stays running until you close it

### 2. Navigation

```bash
# Navigate to URL
qa-use browser goto https://example.com

# History navigation
qa-use browser back
qa-use browser forward
qa-use browser reload
```

### 3. Element Targeting

**Step 1: Get snapshot to identify elements**
```bash
qa-use browser snapshot
```

Output shows ARIA tree with refs:
```
- heading "Page Title" [level=1] [ref=e2]
- button "Click Me" [ref=e3]
- textbox "Email" [ref=e4]
```

**Step 2: Use refs in actions**
```bash
qa-use browser click e3
qa-use browser fill e4 "user@example.com"
```

**Alternative: Semantic selection with --text**
```bash
qa-use browser click --text "Submit button"
qa-use browser fill --text "Email field" "user@example.com"
```

### 4. Interactions

```bash
# Click element
qa-use browser click <ref>

# Fill input
qa-use browser fill <ref> "value"

# Type with delays (for autocomplete)
qa-use browser type <ref> "text"

# Press key
qa-use browser press Enter

# Checkbox
qa-use browser check <ref>
qa-use browser uncheck <ref>

# Select dropdown
qa-use browser select <ref> "option value"

# Scroll
qa-use browser scroll down 500
qa-use browser scroll-into-view <ref>

# Hover
qa-use browser hover <ref>
```

### 5. Inspection

```bash
# Get current URL
qa-use browser url

# Get ARIA snapshot
qa-use browser snapshot

# Take screenshot
qa-use browser screenshot                    # To file
qa-use browser screenshot --base64           # Base64 to stdout
qa-use browser screenshot screenshot.png     # Named file

# Get recorded test blocks
qa-use browser get-blocks
```

### 6. Waiting

```bash
# Fixed wait
qa-use browser wait 2000

# Wait for selector
qa-use browser wait-for-selector ".content" --state visible

# Wait for page load
qa-use browser wait-for-load --state networkidle
```

### 7. Interactive Mode

For multi-command sessions without repeated CLI invocations:

```bash
qa-use browser run
```

## Session Persistence

Sessions are stored in `~/.qa-use.json`:
- If only one active session, it's used automatically
- Use `-s/--session-id` to specify a specific session
- Sessions expire after 1 hour of inactivity

## Tips

1. **Start with snapshot** - Always run `snapshot` after navigation to understand page structure
2. **Use refs, not guessing** - Element refs are stable; don't guess CSS selectors
3. **Close sessions** - Always close when done to free remote browser resources
4. **Use --text for dynamic content** - When refs aren't stable, use semantic selection
