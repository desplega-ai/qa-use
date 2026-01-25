# Browser Commands Reference

Complete reference for `qa-use browser` CLI commands.

## Session Management

### create

Create a new browser session.

```bash
qa-use browser create [options]
```

| Flag | Description |
|------|-------------|
| `--viewport <size>` | Viewport size: `desktop` (1280x720), `tablet` (768x1024), `mobile` (375x667) |
| `--tunnel` | Run local browser with API tunnel (for localhost testing) |
| `--headless` | Run in headless mode (default with `--tunnel`) |
| `--no-headless` | Show browser window (use with `--tunnel` for debugging) |
| `--ws-url <url>` | Connect to existing WebSocket browser endpoint |

**Examples:**
```bash
qa-use browser create                        # Remote browser, default viewport
qa-use browser create --viewport mobile      # Remote browser, mobile viewport
qa-use browser create --tunnel               # Local headless browser with tunnel
qa-use browser create --tunnel --no-headless # Local visible browser for debugging
qa-use browser create --ws-url wss://...     # Connect to existing browser
```

**Session persistence:** Sessions are stored in `~/.qa-use.json`. If only one active session exists, it's used automatically for all commands.

### list

List all active browser sessions.

```bash
qa-use browser list
```

Shows session IDs, creation time, and status.

### status

Show detailed status of current session.

```bash
qa-use browser status
qa-use browser -s <session-id> status
```

**Output includes:**
- Session ID
- Current URL
- Viewport size
- `app_url` - Web UI for viewing the session
- `recording_url` - URL to download session recording
- `har_url` - URL to download HAR file (network logs)
- Creation time and deadline

### close

Close the active browser session.

```bash
qa-use browser close
```

**Note:** Takes no arguments. Closes the currently active session. Use `browser list` first if you have multiple sessions and need to switch.

## Navigation

### goto

Navigate to a URL.

```bash
qa-use browser goto <url>
```

URL can be absolute (`https://example.com`) or relative (`/login`).

### back / forward / reload

History navigation.

```bash
qa-use browser back
qa-use browser forward
qa-use browser reload
```

## Element Targeting

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

## Interactions

### click

Click an element.

```bash
qa-use browser click <ref>
qa-use browser click --text "Button label"
```

| Argument | Description |
|----------|-------------|
| `<ref>` | Element ref from snapshot (e.g., `e3`) |
| `--text` | Semantic description for AI selection |

### fill

Fill an input field (clears existing content).

```bash
qa-use browser fill <ref> "value"
qa-use browser fill --text "Email field" "user@example.com"
```

### type

Type text with keystroke delays (useful for autocomplete).

```bash
qa-use browser type <ref> "text"
```

### press

Press a keyboard key.

```bash
qa-use browser press Enter
qa-use browser press Tab
qa-use browser press Escape
```

### check / uncheck

Toggle checkboxes.

```bash
qa-use browser check <ref>
qa-use browser uncheck <ref>
```

### select

Select dropdown option by value or label.

```bash
qa-use browser select <ref> "option value"
```

### hover

Hover over an element.

```bash
qa-use browser hover <ref>
```

### scroll

Scroll the page or viewport.

```bash
qa-use browser scroll down 500    # Scroll down 500px
qa-use browser scroll up 300      # Scroll up 300px
qa-use browser scroll-into-view <ref>  # Scroll element into viewport
```

## Inspection

### url

Get current page URL.

```bash
qa-use browser url
```

### screenshot

Capture a screenshot.

```bash
qa-use browser screenshot                  # Saves as screenshot.png
qa-use browser screenshot myfile.png       # Custom filename
qa-use browser screenshot /path/to/file.png  # Custom path
qa-use browser screenshot --base64         # Output base64 to stdout
```

**Note:** Path is a positional argument, not a flag. Do NOT use `--output` or `--path`.

### get-blocks

Get recorded interaction blocks from the session.

```bash
qa-use browser get-blocks
```

Returns structured data of interactions performed during the session.

## Logs

### logs console

View browser console logs.

```bash
qa-use browser logs console              # Current session
qa-use browser logs console -s <id>      # Specific or closed session
```

Shows console.log, console.error, and other console output from the page.

### logs network

View network request logs.

```bash
qa-use browser logs network              # Current session
qa-use browser logs network -s <id>      # Specific or closed session
```

Shows HTTP requests, responses, and timing information.

## Test Generation

### generate-test

Generate a test YAML file from recorded session interactions.

```bash
qa-use browser generate-test              # Current session
qa-use browser generate-test -s <id>      # Specific session
qa-use browser generate-test --output my-test.yaml  # Custom output path
```

Creates a test definition based on the interactions performed during the session.

## Waiting

### wait

Fixed time wait.

```bash
qa-use browser wait 2000  # Wait 2 seconds
```

### wait-for-selector

Wait for an element to appear.

```bash
qa-use browser wait-for-selector ".content"
qa-use browser wait-for-selector ".modal" --state visible
qa-use browser wait-for-selector ".loading" --state hidden
```

| Flag | Description |
|------|-------------|
| `--state` | Wait for state: `visible`, `hidden`, `attached`, `detached` |
| `--timeout` | Max wait time in ms (default: 30000) |

### wait-for-load

Wait for page load state.

```bash
qa-use browser wait-for-load
qa-use browser wait-for-load --state networkidle
qa-use browser wait-for-load --state domcontentloaded
```

| State | Description |
|-------|-------------|
| `load` | Wait for load event (default) |
| `domcontentloaded` | Wait for DOMContentLoaded |
| `networkidle` | Wait for no network activity |

## Session Flag Position

When working with multiple sessions, use `-s <id>` BEFORE the command:

```bash
qa-use browser -s abc123 goto https://example.com  # ✅ Correct
qa-use browser goto -s abc123 https://example.com  # ❌ Wrong
qa-use browser goto https://example.com -s abc123  # ❌ Wrong
```

## Interactive Mode

For extended multi-command sessions:

```bash
qa-use browser run
```

Opens interactive REPL for browser commands.

## Local Browser with Tunnel

The `--tunnel` flag starts a real browser on your machine with a tunnel for API control:

1. **Browser runs locally** - you can see it (with `--no-headless`)
2. **API controls via tunnel** - cloud API sends commands through the tunnel
3. **Auto-cleanup** - session closes when you press Ctrl+C or run `browser close`

**Use cases:**
- Debugging tests visually
- Testing localhost URLs
- Developing tests interactively

```bash
# Start visible local browser
qa-use browser create --tunnel --no-headless

# Now interact normally
qa-use browser goto http://localhost:3000
qa-use browser snapshot
qa-use browser click e3

# Watch the browser respond in real-time
```
