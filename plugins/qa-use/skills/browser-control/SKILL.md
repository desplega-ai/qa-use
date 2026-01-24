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

## Quick Start Example

Here's a complete workflow - copy this pattern:

```bash
# 1. Create session (becomes active automatically)
qa-use browser create --viewport desktop

# 2. Navigate
qa-use browser goto https://example.com

# 3. Get snapshot to see elements
qa-use browser snapshot
# Output: - button "Submit" [ref=e3]

# 4. Interact with elements
qa-use browser click e3

# 5. Take screenshot
qa-use browser screenshot result.png

# 6. Clean up
qa-use browser close
```

**For localhost testing:**
```bash
# Use --tunnel for local apps
qa-use browser create --tunnel
qa-use browser goto http://localhost:3000
qa-use browser snapshot
qa-use browser close
```

## Workflow

### 1. Session Management

**IMPORTANT:** Sessions are automatically active after creation. Most commands DO NOT require passing a session ID!

```bash
# Create session (becomes active automatically)
qa-use browser create --viewport desktop

# Create session with local browser + tunnel (visible browser on your machine)
qa-use browser create --tunnel

# Create session with existing WebSocket URL (e.g., browserbase)
qa-use browser create --ws-url wss://my-browser.example.com/ws

# All subsequent commands use the active session automatically
qa-use browser goto https://example.com
qa-use browser snapshot
qa-use browser click e3

# List active sessions
qa-use browser list

# Close active session (NO arguments needed)
qa-use browser close
```

**Multiple Sessions:**
If you have multiple sessions and need to specify one, use the `-s` flag BEFORE the command:

```bash
# List sessions to get IDs
qa-use browser list

# Use specific session
qa-use browser -s <session-id> goto https://example.com
qa-use browser -s <session-id> snapshot
```

**Common Session Mistakes:**
- ❌ `qa-use browser close <session-id>` → ✅ `qa-use browser close`
- ❌ `qa-use browser goto --session <id> <url>` → ✅ `qa-use browser -s <id> goto <url>`
- ❌ `qa-use browser destroy` → ✅ `qa-use browser close`

**Local Browser with Tunnel (`--tunnel`):**
- Starts a real browser on your machine (visible by default, use `--headless` for headless)
- Creates a tunnel so the API can control it
- Useful for debugging - you see exactly what happens
- Auto-cleans up when closed via `browser close` or Ctrl+C
- Process stays running until you close it

### 2. Navigation

```bash
# Navigate to URL (NOT "navigate" - use "goto")
qa-use browser goto https://example.com

# History navigation
qa-use browser back
qa-use browser forward
qa-use browser reload
```

**Common Navigation Mistakes:**
- ❌ `qa-use browser navigate <url>` → ✅ `qa-use browser goto <url>`

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

# Take screenshot (saves to current directory)
qa-use browser screenshot                    # Saves as screenshot.png
qa-use browser screenshot myfile.png         # Custom filename (positional arg)
qa-use browser screenshot --base64           # Output base64 to stdout

# Get recorded test blocks
qa-use browser get-blocks
```

**Common Screenshot Mistakes:**
- ❌ `qa-use browser screenshot --output file.png` → ✅ `qa-use browser screenshot file.png`
- ❌ `qa-use browser screenshot --path /tmp/file.png` → ✅ `qa-use browser screenshot /tmp/file.png`

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
- Use `-s <session-id>` to specify a specific session
- Sessions expire after 1 hour of inactivity

## Common Command Mistakes Reference

| ❌ Wrong | ✅ Correct | Issue |
|---------|----------|-------|
| `browser navigate <url>` | `browser goto <url>` | Wrong command name |
| `browser destroy` | `browser close` | Wrong command name |
| `browser close <session-id>` | `browser close` | Unexpected argument |
| `browser goto --session <id> <url>` | `browser -s <id> goto <url>` | Wrong flag position |
| `browser screenshot --output file.png` | `browser screenshot file.png` | Use positional arg |
| `browser screenshot --path /tmp/file.png` | `browser screenshot /tmp/file.png` | Use positional arg |

## Tips

1. **Start with snapshot** - Always run `snapshot` after navigation to understand page structure
2. **Use refs, not guessing** - Element refs are stable; don't guess CSS selectors
3. **Close sessions** - Always close when done to free remote browser resources
4. **Use --text for dynamic content** - When refs aren't stable, use semantic selection
5. **Session IDs rarely needed** - Most commands work on the active session automatically
