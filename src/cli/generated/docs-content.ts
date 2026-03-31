/**
 * Auto-generated documentation content for the docs command.
 * DO NOT EDIT MANUALLY — Generated from plugins/qa-use/skills/qa-use/
 * Run 'bun run generate:docs' to regenerate.
 */

export const MAIN_DOC = `---
name: qa-use
description: E2E testing and browser automation with qa-use CLI. Use when the user needs to run tests, verify features, automate browser interactions, or debug test failures.
allowed-tools: Bash(qa-use *)
---

# qa-use

E2E testing and browser automation for AI-driven development workflows.

## Critical Insight: Plugin Commands as Shortcuts

**For AI Harnesses (codex, opencode, etc.):**

Plugin commands (slash commands like \`/qa-use:verify\`) are **convenience shortcuts** that wrap CLI workflows. Harnesses with only the Bash tool can access ALL functionality via CLI commands documented below.

**Pattern throughout this document:**
- **CLI Workflow**: Step-by-step CLI commands (works for ALL harnesses)
- **Plugin Shortcut**: Optional slash command (convenience)

## Core Workflow

### 1. Browser Control & Session Lifecycle

**CLI Workflow:**
\`\`\`bash
# Create browser session
qa-use browser create --viewport desktop

# For localhost testing
qa-use browser create --tunnel --no-headless

# Navigate
qa-use browser goto https://example.com

# Snapshot to get element refs (ALWAYS do this before interacting)
qa-use browser snapshot

# Interact by ref
qa-use browser click e3
qa-use browser fill e5 "text"

# Close
qa-use browser close
\`\`\`

**Plugin Shortcut:**
\`\`\`
/qa-use:explore https://example.com
\`\`\`
(Wraps create + goto + snapshot with autonomous exploration)

**Critical:** Always run \`snapshot\` before your **first** interaction on a page. Never guess element refs.

**Snapshot Diff Feature (use it to avoid unnecessary snapshots):**
After each action (goto, click, fill, etc.), the browser automatically shows DOM changes:
- **Summary**: "5 elements added, 1 element modified"
- **Added elements**: \`+ [e54] generic "Thanks for agreeing!"\` (green)
- **Modified elements**: \`~ [e18] checkbox "I agree..."\` with \`+attrs: checked, active\` (yellow)
- **Removed elements**: \`- [e99] button "Submit"\` (red)

**When you can skip a full \`snapshot\`:** If the diff output from your last action already shows the element ref you need to interact with next, use it directly — no need for an intermediate \`snapshot\`. For example, if clicking a button shows \`+ [e54] button "Submit"\` in the diff, you can \`click e54\` immediately.

**When you still need a full \`snapshot\`:** Run \`snapshot\` when you need to find elements that weren't in the diff (e.g., pre-existing elements you haven't interacted with yet), or when the diff was truncated (shows "... and N more changes").

### 2. Understanding Blocks

**What are blocks?**

Blocks are atomic recorded interactions from a browser session. They are:
- Automatically captured during any browser interaction (click, fill, goto, scroll, etc.)
- Stored server-side with the session
- Retrieved via \`qa-use browser get-blocks\`
- The foundation for test generation

**Why blocks matter:**
- **Record-once, replay-many**: Interactive recording becomes automated test
- **AI-friendly**: Agents can analyze blocks to understand user intent
- **Version control**: Blocks stored with session enable test iteration
- **Bridge CLI → Tests**: Natural workflow from exploration to automation

**How blocks work:**

\`\`\`bash
# 1. Create session and interact
qa-use browser create --tunnel --no-headless
qa-use browser goto https://example.com
qa-use browser snapshot        # Returns: [ref=e1] button
qa-use browser click e1        # Records as block
qa-use browser fill e5 "text"  # Records as block

# 2. Retrieve blocks (JSON array)
qa-use browser get-blocks
# Returns:
# [
#   {"type": "goto", "url": "...", "timestamp": "..."},
#   {"type": "click", "ref": "e1", "timestamp": "..."},
#   {"type": "fill", "ref": "e5", "value": "text", "timestamp": "..."}
# ]

# 3. Generate test YAML from blocks
qa-use browser generate-test -n "my_test" -o qa-tests/my_test.yaml

# 4. Run generated test
qa-use test run my_test
\`\`\`

**Plugin Shortcut:**
\`\`\`
/qa-use:record start my_test
# ... perform interactions ...
/qa-use:record stop
\`\`\`
(Wraps the interactive workflow with AI-powered test generation)

### 3. Test Management

**CLI Workflow:**
\`\`\`bash
# Run test by name
qa-use test run login

# Run with autofix (AI self-healing)
qa-use test run login --autofix

# Validate syntax
qa-use test validate login

# Show test details
qa-use test info login

# List test runs
qa-use test runs --status failed
\`\`\`

**Plugin Shortcut:**
\`\`\`
/qa-use:test-run login --autofix
\`\`\`
(Convenience shortcut for common test execution)

### 4. Test Sync Lifecycle

**CLI Workflow:**
\`\`\`bash
# Pull tests from cloud
qa-use test sync pull

# Push all local tests to cloud
qa-use test sync push --all

# Push specific test
qa-use test sync push --id <uuid>

# Force push (overwrite conflicts)
qa-use test sync push --force

# Compare local vs cloud
qa-use test diff login.yaml
\`\`\`

**No Plugin Shortcut** - Use CLI commands directly

## Essential Commands

### Browser Session Management

| Command | Description |
|---------|-------------|
| \`qa-use browser create\` | Create remote browser session |
| \`qa-use browser create <url>\` | Create session and navigate to URL |
| \`qa-use browser create --tunnel\` | Create local browser with API tunnel |
| \`qa-use browser create --no-headless\` | Show browser window (tunnel mode only) |
| \`qa-use browser create --viewport <size>\` | Set viewport: \`desktop\`, \`tablet\`, \`mobile\` |
| \`qa-use browser create --ws-url <url>\` | Connect to existing WebSocket browser |
| \`qa-use browser create --after-test-id <uuid>\` | Run a test first, then become interactive |
| \`qa-use browser create --var <key=value>\` | Override app config variables (repeatable) |
| \`qa-use browser list\` | List active sessions |
| \`qa-use browser status\` | Show current session details (app_url, recording_url, etc.) |
| \`qa-use browser close\` | Close active session |

Sessions auto-persist in \`~/.qa-use.json\`. One active session = no \`-s\` flag needed.

### Navigation

| Command | Description |
|---------|-------------|
| \`qa-use browser goto <url>\` | Navigate to URL |
| \`qa-use browser back\` | Go back |
| \`qa-use browser forward\` | Go forward |
| \`qa-use browser reload\` | Reload page |

### Element Interaction

| Command | Description |
|---------|-------------|
| \`qa-use browser click <ref>\` | Click element by ref |
| \`qa-use browser click --text "Button"\` | Click by semantic description |
| \`qa-use browser fill <ref> "value"\` | Fill input field |
| \`qa-use browser type <ref> "text"\` | Type with delays (for autocomplete) |
| \`qa-use browser press <key>\` | Press key (e.g., \`Enter\`, \`Tab\`) |
| \`qa-use browser check <ref>\` | Check checkbox |
| \`qa-use browser uncheck <ref>\` | Uncheck checkbox |
| \`qa-use browser select <ref> "option"\` | Select dropdown option |
| \`qa-use browser hover <ref>\` | Hover over element |
| \`qa-use browser scroll down 500\` | Scroll by pixels |
| \`qa-use browser scroll-into-view <ref>\` | Scroll element into view |
| \`qa-use browser drag <ref> --target <ref>\` | Drag element to target |
| \`qa-use browser mfa-totp [ref] <secret>\` | Generate TOTP code (optionally fill) |
| \`qa-use browser upload <ref> <file>...\` | Upload file(s) to input (base64-encoded, works remote & tunnel) |

### Inspection & Snapshot Diff

| Command | Description |
|---------|-------------|
| \`qa-use browser snapshot\` | Get full ARIA tree with element refs (use only when diff output is insufficient) |
| \`qa-use browser url\` | Get current URL |
| \`qa-use browser screenshot\` | Save screenshot.png |
| \`qa-use browser screenshot file.png\` | Save to custom path |
| \`qa-use browser screenshot --base64\` | Output base64 to stdout |
| \`qa-use browser evaluate <expression>\` | Execute JavaScript in browser context |

The snapshot-diff feature automatically displays DOM changes after each browser action:
- **Added elements**: Shown with \`+\` prefix and green color — these refs are immediately usable
- **Modified elements**: Shown with \`~\` prefix and yellow color, including attribute changes (\`+attrs: checked\`)
- **Removed elements**: Shown with \`-\` prefix and red color — do NOT use these refs

**Downloads:** When an action triggers a file download (e.g., clicking a download link), the response includes download info: filename, size, and a presigned URL. Use \`qa-use browser downloads\` to list all downloads or \`--save <dir>\` to save them locally.

Use diff output to interact with newly appeared elements directly, without running a full \`snapshot\` first.

### Test Operations

| Command | Description |
|---------|-------------|
| \`qa-use test run <name>\` | Run test by name |
| \`qa-use test run --all\` | Run all tests |
| \`qa-use test run <name> --tunnel\` | Run with local browser tunnel |
| \`qa-use test run <name> --autofix\` | Enable AI self-healing |
| \`qa-use test run <name> --update-local\` | Persist AI fixes to file |
| \`qa-use test run <name> --download\` | Download assets to \`/tmp/qa-use/downloads/\` |
| \`qa-use test run <name> --var key=value\` | Override variable |
| \`qa-use test validate <name>\` | Validate test syntax |
| \`qa-use test list\` | List available tests |
| \`qa-use test info <name>\` | Show test details (steps, tags, description) |
| \`qa-use test info --id <uuid>\` | Show cloud test details by ID |
| \`qa-use test runs [name]\` | List test run history |
| \`qa-use test runs --id <uuid>\` | Filter runs by test ID |
| \`qa-use test runs --status failed\` | Filter runs by status |
| \`qa-use test init\` | Initialize test directory |
| \`qa-use test sync pull\` | Pull tests from cloud |
| \`qa-use test sync push --all\` | Push all local tests to cloud |
| \`qa-use test sync push --id <uuid>\` | Push specific test |
| \`qa-use test sync push --force\` | Push tests, overwriting conflicts |
| \`qa-use test diff <file>\` | Compare local vs cloud test |
| \`qa-use test schema [path]\` | View test definition schema |

### API Operations (Dynamic OpenAPI)

\`qa-use api\` dynamically discovers operations from \`/api/v1/openapi.json\` and caches metadata locally for offline fallback.

| Command | Description |
|---------|-------------|
| \`qa-use api ls\` | List available \`/api/v1/*\` routes from OpenAPI |
| \`qa-use api ls --refresh\` | Force refresh OpenAPI cache |
| \`qa-use api ls --offline\` | Use cached OpenAPI metadata only |
| \`qa-use api /api/v1/tests\` | Call endpoint (method inferred when possible) |
| \`qa-use api -X GET /api/v1/test-runs -f limit=5\` | GET with query fields |
| \`qa-use api -X POST /api/v1/tests-actions/run --input body.json\` | POST with JSON body file |
| \`qa-use api -X GET /api/v1/test-runs/<id>\` | Fetch detail endpoint by ID |

**No Plugin Shortcut** - Use CLI commands directly.

### Logs & Debugging

| Command | Description |
|---------|-------------|
| \`qa-use browser logs console\` | View console logs from session |
| \`qa-use browser logs console -s <id>\` | View logs from specific/closed session |
| \`qa-use browser logs network\` | View network request logs |
| \`qa-use browser logs network -s <id>\` | View network logs from specific session |
| \`qa-use browser downloads\` | List downloaded files from session |
| \`qa-use browser downloads --save <dir>\` | Save downloaded files to local directory |
| \`qa-use browser downloads --json\` | Output download info as JSON |

### Test Generation

| Command | Description |
|---------|-------------|
| \`qa-use browser generate-test\` | Generate test YAML from recorded session |
| \`qa-use browser generate-test -s <id>\` | Generate from specific session |
| \`qa-use browser generate-test -n <name>\` | Specify test name |
| \`qa-use browser generate-test -o <path>\` | Specify output path |
| \`qa-use browser get-blocks\` | Get recorded interaction blocks (JSON) |

### Waiting

| Command | Description |
|---------|-------------|
| \`qa-use browser wait <ms>\` | Fixed wait |
| \`qa-use browser wait-for-selector ".class"\` | Wait for selector |
| \`qa-use browser wait-for-load\` | Wait for page load |

### Variable Overrides

Use \`--var\` to override app config variables at runtime. Common variables:

| Variable | Description |
|----------|-------------|
| \`base_url\` | Base URL for the app (e.g., preview deployment URL) |
| \`login_url\` | Login page URL |
| \`login_username\` | Username/email for authentication |
| \`login_password\` | Password for authentication |

Example with ephemeral preview URL:
\`\`\`bash
qa-use browser create --after-test-id <login-test-uuid> \\
  --var base_url=https://preview-123.example.com \\
  --var login_url=https://preview-123.example.com/auth/login
\`\`\`

## Common Patterns

### Pattern 1: Feature Verification

**CLI Workflow:**
\`\`\`bash
# 1. Search for existing test
qa-use test list | grep "login"

# 2. Run test with autofix
qa-use test run login --autofix

# 3. Debug failures
qa-use browser logs console
\`\`\`

**Plugin Shortcut:**
\`\`\`
/qa-use:verify "login works with valid credentials"
\`\`\`
(Wraps the above CLI workflow with AI-powered test discovery and analysis)

### Pattern 2: Record & Generate Test

**CLI Workflow:**
\`\`\`bash
# 1. Create session
qa-use browser create --tunnel --no-headless

# 2. Navigate and interact
qa-use browser goto https://example.com
qa-use browser snapshot
qa-use browser click e1
qa-use browser fill e5 "test"

# 3. Generate test from blocks
qa-use browser get-blocks
qa-use browser generate-test -n "my_test"

# 4. Run test
qa-use test run my_test
\`\`\`

**Plugin Shortcut:**
\`\`\`
/qa-use:record start my_test
# ... perform interactions ...
/qa-use:record stop
\`\`\`

### Pattern 3: Authenticated Exploration

**CLI Workflow:**
\`\`\`bash
# Create session that runs login test first
qa-use browser create --after-test-id <login-test-uuid>

# Session now authenticated, explore
qa-use browser goto /dashboard
qa-use browser snapshot
\`\`\`

**Plugin Shortcut:**
\`\`\`
/qa-use:explore /dashboard
\`\`\`
(Automatically handles auth detection and session creation)

### Pattern 4: Edit Existing Test

**CLI Workflow:**
\`\`\`bash
# 1. Open test file in editor
vim qa-tests/login.yaml

# 2. Validate syntax
qa-use test validate login

# 3. Run to verify
qa-use test run login
\`\`\`

**Plugin Shortcut:**
\`\`\`
/qa-use:record edit login
\`\`\`
(AI-assisted editing with validation)

### Pattern 5: Using Snapshot Diff to Avoid Unnecessary Snapshots

**CLI Workflow:**
\`\`\`bash
# Create session and navigate
qa-use browser create --tunnel --no-headless
qa-use browser goto https://evals.desplega.ai/checkboxes

# goto shows diff — initial page load shows all elements:
# Changes: 45 elements added
# + [e18] checkbox "I agree to the terms and conditions"
# + [e19] generic "I agree to the terms and conditions"

# ✅ Use ref from diff directly — no snapshot needed!
qa-use browser click e18

# Diff shows what changed:
# Changes: 5 elements added, 1 element modified
# + [e54] generic "Thanks for agreeing!"
# + [e55] link "Terms and Conditions"
# ~ [e18] checkbox "I agree to the terms and conditions"
#     +attrs: active, checked

# ✅ Can click e55 directly from diff output — no snapshot needed!
qa-use browser click e55

# ❌ Need to find an element NOT in the diff? Now run snapshot:
qa-use browser snapshot
\`\`\`

**Key principle:** Use diff output as your primary source of element refs after actions. Only fall back to \`snapshot\` when you need to find elements that weren't in the diff.

**Benefits:**
- Fewer API calls = faster automation
- Diff refs are always fresh (just returned from the server)
- Instantly see what changed (new elements, attribute changes, removals)

**No Plugin Shortcut** - Automatic feature in all browser commands

## CI/CD Integration

### Running Tests in CI

**Environment Variables:**
\`\`\`bash
export QA_USE_API_KEY="your-api-key"
export QA_USE_REGION="us"  # Optional: "us" or "auto"
\`\`\`

**Basic Test Execution:**
\`\`\`bash
# Run all tests
qa-use test run --all

# Run specific tag
qa-use test run --tag smoke

# Exit codes: 0 = pass, 1 = fail
\`\`\`

### GitHub Actions Example

\`\`\`yaml
name: QA Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install qa-use
        run: npm install -g @desplega.ai/qa-use
      - name: Run tests
        run: qa-use test run --all
        env:
          QA_USE_API_KEY: \${{ secrets.QA_USE_API_KEY }}
\`\`\`

### Test Artifacts

**Screenshots:**
- Automatically saved on failure
- Location: \`/tmp/qa-use/downloads/\` (local) or cloud (remote)

**Logs:**
- Console logs: \`qa-use browser logs console -s <session-id>\`
- Network logs: \`qa-use browser logs network -s <session-id>\`

## Advanced Topics

### Localhost Testing (Tunnel Mode)

**When to use tunnel mode:**

\`\`\`
Testing localhost (http://localhost:3000)?
  ├─ YES → Use --tunnel
  │   └─ qa-use browser create --tunnel [--no-headless]
  │       (Starts local Playwright, creates localtunnel, keeps running)
  │
  └─ NO (Public URL) → Use remote browser (default)
      └─ qa-use browser create
          (Uses desplega.ai cloud browser via WebSocket)
\`\`\`

**The \`--tunnel\` flag is a binary choice:**
- **Local tunnel mode**: Playwright on your machine + localtunnel
- **Remote mode**: WebSocket URL to cloud-hosted browser

**For test execution:**
\`\`\`bash
# Local app
qa-use test run my_test --tunnel [--headful]

# Public app
qa-use test run my_test
\`\`\`

**Plugin shortcuts handle tunnel detection automatically:**
\`\`\`
/qa-use:explore http://localhost:3000
/qa-use:record start local_test
\`\`\`

See [references/localhost-testing.md](references/localhost-testing.md) for troubleshooting.

### Session Persistence

Sessions are stored in \`~/.qa-use.json\` and have:
- **TTL**: 30 minutes (default)
- **Auto-resolve**: One active session = no \`-s\` flag needed
- **Cleanup**: Automatic on timeout or explicit \`browser close\`

### Block Limitations

**What's captured:**
- goto, click, fill, type, check, uncheck, select, hover
- scroll, scroll-into-view, drag, upload, press

**What's NOT captured:**
- Assertions (must be added manually)
- Waits (inferred from timing, may need adjustment)
- Complex interactions (multi-drag, hover sequences)

**Manual editing:** Edit generated YAML to add assertions and refine selectors.

### WebSocket Sessions

**Sharing sessions across processes:**
\`\`\`bash
# Process 1: Create session
qa-use browser create --tunnel
# Output: ws://localhost:12345/browser/abc123

# Process 2: Connect to session
qa-use browser goto https://example.com --ws-url ws://localhost:12345/browser/abc123
\`\`\`

## Deep-Dive References

| Document | Description |
|----------|-------------|
| [browser-commands.md](references/browser-commands.md) | Complete browser CLI reference with all flags |
| [test-format.md](references/test-format.md) | Full test YAML specification |
| [localhost-testing.md](references/localhost-testing.md) | Tunnel setup for local development |
| [failure-debugging.md](references/failure-debugging.md) | Failure classification and diagnostics |
| [ci.md](references/ci.md) | CI/CD integration patterns and examples |

## Templates

| Template | Description |
|----------|-------------|
| [basic-test.yaml](templates/basic-test.yaml) | Simple navigation and assertion |
| [auth-flow.yaml](templates/auth-flow.yaml) | Login flow with credentials |
| [form-test.yaml](templates/form-test.yaml) | Form submission with validation |

## Test Format Overview

\`\`\`yaml
name: Login Test
description: Validates login functionality with valid credentials
tags:
  - smoke
  - auth
app_config: <app-config-id>
variables:
  email: test@example.com
  password: secret123
depends_on: setup-test  # Optional
steps:
  - action: goto
    url: /login
  - action: fill
    target: email input
    value: $email
  - action: click
    target: login button
  - action: to_be_visible
    target: dashboard
\`\`\`

See [references/test-format.md](references/test-format.md) for complete specification.

## Common Mistakes

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| \`browser navigate <url>\` | \`browser goto <url>\` |
| \`browser destroy\` | \`browser close\` |
| \`browser close <session-id>\` | \`browser close\` |
| Guessing element refs | Use refs from diff output or \`snapshot\` |
| Running \`snapshot\` after every action | Use diff output; only \`snapshot\` when needed |
| Testing localhost without \`--tunnel\` | Use \`--tunnel\` flag |
| \`test sync --pull\` | \`test sync pull\` (subcommand, not flag) |
| \`test sync --push\` | \`test sync push\` (subcommand, not flag) |

## npx Alternative

All commands use \`qa-use\` assuming global install. For one-off use:
\`\`\`bash
npx @desplega.ai/qa-use browser <command>
\`\`\`
`;

export const REFERENCE_DOCS: Record<string, { title: string; content: string }> = {
  'browser-commands': {
    title: 'Browser Commands Reference',
    content: `# Browser Commands Reference

Complete reference for \`qa-use browser\` CLI commands.

## Session Management

### create

Create a new browser session.

\`\`\`bash
qa-use browser create [url] [options]
\`\`\`

| Argument / Flag | Description |
|------|-------------|
| \`[url]\` | URL to navigate to after session is ready |
| \`--viewport <size>\` | Viewport size: \`desktop\` (1280x720), \`tablet\` (768x1024), \`mobile\` (375x667) |
| \`--tunnel\` | Run local browser with API tunnel (for localhost testing) |
| \`--headless\` | Run in headless mode (default with \`--tunnel\`) |
| \`--no-headless\` | Show browser window (use with \`--tunnel\` for debugging) |
| \`--ws-url <url>\` | Connect to existing WebSocket browser endpoint |
| \`--after-test-id <uuid>\` | Run a test before session becomes interactive (start after login, etc.) |

**Examples:**
\`\`\`bash
qa-use browser create                        # Remote browser, default viewport
qa-use browser create https://example.com    # Remote browser, navigate to URL
qa-use browser create --viewport mobile      # Remote browser, mobile viewport
qa-use browser create --tunnel               # Local headless browser with tunnel
qa-use browser create --tunnel --no-headless # Local visible browser for debugging
qa-use browser create --ws-url wss://...     # Connect to existing browser
qa-use browser create --after-test-id <uuid> # Start session after running a test
qa-use browser create --after-test-id <uuid> https://example.com/dashboard  # After login, go to dashboard
\`\`\`

**Starting after login (--after-test-id):**

The \`--after-test-id\` flag runs an existing test before the session becomes interactive. This is extremely useful for:
- **Bypassing login walls** - use a test that logs in, then start exploring from the authenticated state
- **Starting from a specific page state** - run a test that navigates to a complex form, then continue manually
- **Resuming from checkpoints** - save common setup steps as a test, reuse across explorations

\`\`\`bash
# First, create a login test and get its ID from the test listing
qa-use test run --list

# Then create a session that starts after login
qa-use browser create --after-test-id 4292938b-338d-4c1c-952e-6bcdf3f7731a

# Session is now logged in and ready for exploration
qa-use browser snapshot
\`\`\`

**Error handling for --after-test-id:**
- If test not found: "Test not found" (exit 1)
- If test belongs to different org: "Test belongs to different organization" (exit 1)
- If test fails: Session status becomes "failed" with error message displayed

**Session persistence:** Sessions are stored in \`~/.qa-use.json\`. If only one active session exists, it's used automatically for all commands.

### list

List all active browser sessions.

\`\`\`bash
qa-use browser list
\`\`\`

Shows session IDs, creation time, and status.

### status

Show detailed status of current session.

\`\`\`bash
qa-use browser status
qa-use browser -s <session-id> status
\`\`\`

**Output includes:**
- Session ID
- Current URL
- Viewport size
- \`app_url\` - Web UI for viewing the session
- \`recording_url\` - URL to download session recording
- \`har_url\` - URL to download HAR file (network logs)
- Creation time and deadline

### close

Close the active browser session.

\`\`\`bash
qa-use browser close
\`\`\`

**Note:** Takes no arguments. Closes the currently active session. Use \`browser list\` first if you have multiple sessions and need to switch.

## Navigation

### goto

Navigate to a URL.

\`\`\`bash
qa-use browser goto <url>
\`\`\`

URL can be absolute (\`https://example.com\`) or relative (\`/login\`).

### back / forward / reload

History navigation.

\`\`\`bash
qa-use browser back
qa-use browser forward
qa-use browser reload
\`\`\`

## Element Targeting

### snapshot

Get the page's ARIA accessibility tree with element refs.

\`\`\`bash
qa-use browser snapshot [options]
\`\`\`

| Flag | Description |
|------|-------------|
| \`-i, --interactive\` | Only include interactive elements (buttons, inputs, links) |
| \`-c, --compact\` | Remove empty structural elements |
| \`-d, --max-depth <n>\` | Limit tree depth (1-20, where 1 = top level only) |
| \`--scope <selector>\` | CSS selector to scope snapshot (e.g., \`#main\`, \`.form\`) |
| \`--json\` | Output raw JSON including filter_stats |

**Output format:**
\`\`\`
- heading "Page Title" [level=1] [ref=e2]
- button "Click Me" [ref=e3]
- textbox "Email" [ref=e4]
- link "Sign Up" [ref=e5]
\`\`\`

**Filtering examples:**
\`\`\`bash
# Get only interactive elements (great for reducing token count)
qa-use browser snapshot --interactive

# Combine filters for maximum reduction
qa-use browser snapshot --interactive --compact --max-depth 3

# Scope to specific section
qa-use browser snapshot --scope "#main-content"
\`\`\`

**Typical reductions:**
- \`--max-depth 3\`: ~98% reduction
- \`--interactive\`: 0-80% depending on page
- Combined \`--interactive --max-depth 4\`: ~95% reduction

Use the \`[ref=eN]\` values in interaction commands.

**Critical workflow:** Run \`snapshot\` before your first interaction on a new page. After that, use the snapshot diff output from actions to get fresh refs — only run \`snapshot\` again when you need elements not shown in the diff. Refs are session-specific and change between page loads.

## Interactions

### click

Click an element.

\`\`\`bash
qa-use browser click <ref>
qa-use browser click --text "Button label"
\`\`\`

| Argument | Description |
|----------|-------------|
| \`<ref>\` | Element ref from snapshot (e.g., \`e3\`) |
| \`--text\` | Semantic description for AI selection |

### fill

Fill an input field (clears existing content).

\`\`\`bash
qa-use browser fill <ref> "value"
qa-use browser fill --text "Email field" "user@example.com"
\`\`\`

### type

Type text with keystroke delays (useful for autocomplete).

\`\`\`bash
qa-use browser type <ref> "text"
\`\`\`

### press

Press a keyboard key.

\`\`\`bash
qa-use browser press Enter
qa-use browser press Tab
qa-use browser press Escape
\`\`\`

### check / uncheck

Toggle checkboxes.

\`\`\`bash
qa-use browser check <ref>
qa-use browser uncheck <ref>
\`\`\`

### select

Select dropdown option by value or label.

\`\`\`bash
qa-use browser select <ref> "option value"
\`\`\`

### hover

Hover over an element.

\`\`\`bash
qa-use browser hover <ref>
\`\`\`

### scroll

Scroll the page or viewport.

\`\`\`bash
qa-use browser scroll down 500    # Scroll down 500px
qa-use browser scroll up 300      # Scroll up 300px
qa-use browser scroll-into-view <ref>  # Scroll element into viewport
\`\`\`

### drag

Drag an element to a target element.

\`\`\`bash
qa-use browser drag <ref> --target <target-ref>
qa-use browser drag <ref> --target-selector ".drop-zone"
qa-use browser drag --text "Draggable item" --target <target-ref>
\`\`\`

| Argument | Description |
|----------|-------------|
| \`<ref>\` | Source element ref from snapshot |
| \`--text\` | Semantic source description for AI selection |
| \`--target <ref>\` | Target element ref |
| \`--target-selector <sel>\` | Target CSS selector |

**Examples:**
\`\`\`bash
qa-use browser drag e5 --target e10          # Drag by ref to ref
qa-use browser drag e5 --target-selector ".canvas"  # Drag to CSS selector
qa-use browser drag --text "Process node" --target e10  # Drag by text
\`\`\`

**Note:** The browser CLI drag command uses element refs from snapshots. This is different from the test YAML format which uses locator chains. See test-format.md for YAML test syntax.

### mfa-totp

Generate TOTP code and optionally fill into an input field.

\`\`\`bash
qa-use browser mfa-totp <secret>                    # Generate only
qa-use browser mfa-totp <ref> <secret>              # Generate and fill by ref
qa-use browser mfa-totp --text "OTP input" <secret> # Generate and fill by text
\`\`\`

| Argument | Description |
|----------|-------------|
| \`<secret>\` | TOTP secret (base32 encoded) |
| \`<ref>\` | Element ref to fill (optional) |
| \`--text\` | Semantic element description for AI selection |

**Examples:**
\`\`\`bash
qa-use browser mfa-totp JBSWY3DPEHPK3PXP              # Generate code only
qa-use browser mfa-totp e15 JBSWY3DPEHPK3PXP          # Fill into element e15
qa-use browser mfa-totp --text "verification code" JBSWY3DPEHPK3PXP
\`\`\`

### upload

Upload file(s) to a file input element.

\`\`\`bash
qa-use browser upload <ref> <file>...
qa-use browser upload --text "Choose file" <file>...
\`\`\`

| Argument | Description |
|----------|-------------|
| \`<ref>\` | File input element ref from snapshot |
| \`--text\` | Semantic element description for AI selection |
| \`<file>...\` | One or more file paths to upload |

**Examples:**
\`\`\`bash
qa-use browser upload e8 /tmp/document.pdf                    # Single file
qa-use browser upload e8 /tmp/file1.pdf /tmp/file2.pdf        # Multiple files
qa-use browser upload --text "Upload attachment" /tmp/doc.pdf # By text
\`\`\`

**Upload encoding:** Files are read locally and sent as base64-encoded data. This works in both remote and tunnel modes — no need for the browser to have direct access to the file system.

## Downloads

### downloads

List or save files downloaded during the browser session.

\`\`\`bash
qa-use browser downloads                    # List downloads
qa-use browser downloads --json             # Output as JSON
qa-use browser downloads --save /tmp/dl     # Save files to directory
qa-use browser downloads -s <id>            # Downloads from specific/closed session
\`\`\`

| Flag | Description |
|------|-------------|
| \`--json\` | Output raw JSON with URLs and metadata |
| \`--save <dir>\` | Download files to local directory |
| \`-s, --session-id <id>\` | Specify session (default: auto-resolved) |

**Download detection:** When any browser action triggers a file download (e.g., clicking a download link), the action response automatically includes download info (filename, size, presigned URL). The \`downloads\` command retrieves the full list.

## Inspection

### url

Get current page URL.

\`\`\`bash
qa-use browser url
\`\`\`

### screenshot

Capture a screenshot.

\`\`\`bash
qa-use browser screenshot                  # Saves as screenshot.png
qa-use browser screenshot myfile.png       # Custom filename
qa-use browser screenshot /path/to/file.png  # Custom path
qa-use browser screenshot --base64         # Output base64 to stdout
\`\`\`

**Note:** Path is a positional argument, not a flag. Do NOT use \`--output\` or \`--path\`.

### get-blocks

Get recorded interaction blocks from the session.

\`\`\`bash
qa-use browser get-blocks
\`\`\`

Returns structured data of interactions performed during the session.

## Logs

### logs console

View browser console logs.

\`\`\`bash
qa-use browser logs console              # Current session
qa-use browser logs console -s <id>      # Specific or closed session
\`\`\`

Shows console.log, console.error, and other console output from the page.

### logs network

View network request logs.

\`\`\`bash
qa-use browser logs network              # Current session
qa-use browser logs network -s <id>      # Specific or closed session
\`\`\`

Shows HTTP requests, responses, and timing information.

## Test Generation

### generate-test

Generate a test YAML file from recorded session interactions.

\`\`\`bash
qa-use browser generate-test              # Current session
qa-use browser generate-test -s <id>      # Specific session
qa-use browser generate-test --output my-test.yaml  # Custom output path
\`\`\`

Creates a test definition based on the interactions performed during the session.

## Waiting

### wait

Fixed time wait.

\`\`\`bash
qa-use browser wait 2000  # Wait 2 seconds
\`\`\`

### wait-for-selector

Wait for an element to appear.

\`\`\`bash
qa-use browser wait-for-selector ".content"
qa-use browser wait-for-selector ".modal" --state visible
qa-use browser wait-for-selector ".loading" --state hidden
\`\`\`

| Flag | Description |
|------|-------------|
| \`--state\` | Wait for state: \`visible\`, \`hidden\`, \`attached\`, \`detached\` |
| \`--timeout\` | Max wait time in ms (default: 30000) |

### wait-for-load

Wait for page load state.

\`\`\`bash
qa-use browser wait-for-load
qa-use browser wait-for-load --state networkidle
qa-use browser wait-for-load --state domcontentloaded
\`\`\`

| State | Description |
|-------|-------------|
| \`load\` | Wait for load event (default) |
| \`domcontentloaded\` | Wait for DOMContentLoaded |
| \`networkidle\` | Wait for no network activity |

## Session Flag Position

When working with multiple sessions, use \`-s <id>\` BEFORE the command:

\`\`\`bash
qa-use browser -s abc123 goto https://example.com  # ✅ Correct
qa-use browser goto -s abc123 https://example.com  # ❌ Wrong
qa-use browser goto https://example.com -s abc123  # ❌ Wrong
\`\`\`

## Interactive Mode

For extended multi-command sessions:

\`\`\`bash
qa-use browser run
qa-use browser run --after-test-id <uuid>  # Start REPL from post-test state
\`\`\`

Opens interactive REPL for browser commands. Use \`--after-test-id\` to start the REPL in an authenticated or pre-configured state.

## Local Browser with Tunnel

The \`--tunnel\` flag starts a real browser on your machine with a tunnel for API control:

1. **Browser runs locally** - you can see it (with \`--no-headless\`)
2. **API controls via tunnel** - cloud API sends commands through the tunnel
3. **Auto-cleanup** - session closes when you press Ctrl+C or run \`browser close\`

**Use cases:**
- Debugging tests visually
- Testing localhost URLs
- Developing tests interactively

\`\`\`bash
# Start visible local browser
qa-use browser create --tunnel --no-headless

# Now interact normally
qa-use browser goto http://localhost:3000
qa-use browser snapshot
qa-use browser click e3

# Watch the browser respond in real-time
\`\`\`
`,
  },
  ci: {
    title: 'CI Integration Guide',
    content: `# CI Integration Guide

Run qa-use verification in GitHub Actions and other CI environments.

## GitHub Actions Setup

### Basic Workflow

\`\`\`yaml
# .github/workflows/pr-verify.yml
name: PR Verification

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  verify-pr:
    runs-on: ubuntu-latest
    # Optional: only run on PRs with frontend changes
    # if: contains(github.event.pull_request.labels.*.name, 'frontend')

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for diff analysis

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Claude Code CLI
        run: |
          curl -fsSL https://claude.ai/install.sh | bash
          echo "$HOME/.local/bin" >> $GITHUB_PATH

      - name: Install qa-use plugin and CLI
        run: |
          claude mcp add-from-marketplace qa-use
          npm install -g @desplega.ai/qa-use

      - name: Run PR Verification
        env:
          CLAUDE_CODE_OAUTH_TOKEN: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          QA_USE_API_KEY: \${{ secrets.QA_USE_API_KEY }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          CI: true
        run: |
          # Run Claude Code with the verify-pr command
          claude --print "/qa-use:verify-pr #\${{ github.event.pull_request.number }}"

      - name: Post Report to PR
        if: always()  # Post even if verification had warnings
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          if [ -f /tmp/pr-verify-report-\${{ github.event.pull_request.number }}.md ]; then
            gh pr comment \${{ github.event.pull_request.number }} \\
              --body-file /tmp/pr-verify-report-\${{ github.event.pull_request.number }}.md
          fi
\`\`\`

### With Preview Deployment (Vercel/Netlify)

\`\`\`yaml
# .github/workflows/pr-verify.yml
name: PR Verification

on:
  pull_request:
    branches:
      - main
    types: [opened, synchronize, reopened, ready_for_review]
  workflow_dispatch:
    inputs:
      pr_number:
        description: "PR number to verify"
        required: true
        type: number

concurrency:
  group: pr-verify-\${{ github.event.pull_request.number || inputs.pr_number }}
  cancel-in-progress: true

jobs:
  verify-pr:
    if: github.event_name == 'workflow_dispatch' || github.event.pull_request.draft == false
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: read
      pull-requests: write
      statuses: read

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history for diff analysis

      - name: Check PR approval status
        id: approval
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          # REVIEW_DECISION=$(gh pr view \${{ github.event.pull_request.number || inputs.pr_number }} --json reviewDecision -q '.reviewDecision')
          # echo "Review decision: $REVIEW_DECISION"
          # if [ "$REVIEW_DECISION" != "APPROVED" ]; then
          #   echo "PR is not approved yet. Skipping verification."
          #   echo "approved=false" >> $GITHUB_OUTPUT
          # else
          #   echo "approved=true" >> $GITHUB_OUTPUT
          # fi
          # For demonstration purposes, we will assume all PRs are approved.
          echo "approved=true" >> $GITHUB_OUTPUT

      - name: Setup Node.js
        if: steps.approval.outputs.approved == 'true'
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install Claude Code CLI
        if: steps.approval.outputs.approved == 'true'
        run: |
          curl -fsSL https://claude.ai/install.sh | bash
          echo "$HOME/.local/bin" >> $GITHUB_PATH

      - name: Verify Claude CLI Installation
        if: steps.approval.outputs.approved == 'true'
        run: |
          claude --version || (echo "Claude CLI installation failed" && exit 1)

      - name: Install qa-use plugin and CLI
        if: steps.approval.outputs.approved == 'true'
        run: |
          claude plugin marketplace add desplega-ai/qa-use
          claude plugin install qa-use@desplega.ai
          npm install -g @desplega.ai/qa-use

      - name: Wait for Vercel Preview
        if: steps.approval.outputs.approved == 'true'
        uses: patrickedqvist/wait-for-vercel-preview@v1.3.1
        id: vercel
        with:
          token: \${{ secrets.GITHUB_TOKEN }}
          max_timeout: 300

      - name: Run PR Verification
        if: steps.approval.outputs.approved == 'true'
        env:
          CLAUDE_CODE_OAUTH_TOKEN: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          QA_USE_API_KEY: \${{ secrets.QA_USE_API_KEY }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          CI: true
        run: |
          # Run Claude Code with the verify-pr command using Vercel preview URL
          claude --print --verbose --dangerously-skip-permissions --output-format stream-json --model haiku "/qa-use:verify-pr #\${{ github.event.pull_request.number || inputs.pr_number }} --base-url \${{ steps.vercel.outputs.url }}" 2>&1 | jq -c 'select(.type == "assistant" or .type == "tool_use" or .type == "result")'

      - name: Post Report to PR
        if: always() && steps.approval.outputs.approved == 'true'
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          if [ -f /tmp/pr-verify-report-\${{ github.event.pull_request.number || inputs.pr_number }}.md ]; then
            gh pr comment \${{ github.event.pull_request.number || inputs.pr_number }} \\
              --body-file /tmp/pr-verify-report-\${{ github.event.pull_request.number || inputs.pr_number }}.md
          fi

      - name: Upload Verification Artifacts
        if: always() && steps.approval.outputs.approved == 'true'
        uses: actions/upload-artifact@v4
        with:
          name: pr-verification-\${{ github.event.pull_request.number || inputs.pr_number }}
          path: |
            /tmp/pr-verify-*.png
            /tmp/pr-verify-*.json
            /tmp/pr-verify-*.jsonl
            /tmp/pr-verify-*.log
            /tmp/pr-verify-report-*.md
\`\`\`

### Netlify Preview Deployment

\`\`\`yaml
      # Wait for Netlify preview deployment
      - name: Wait for Netlify Preview
        uses: jlevy-io/wait-for-netlify-deploy-with-headers@v1.0.1
        id: netlify
        with:
          site_name: 'your-netlify-site-name'
          max_timeout: 300

      - name: Run PR Verification
        env:
          CLAUDE_CODE_OAUTH_TOKEN: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          QA_USE_API_KEY: \${{ secrets.QA_USE_API_KEY }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          CI: true
        run: |
          claude --print "/qa-use:verify-pr #\${{ github.event.pull_request.number }} --base-url \${{ steps.netlify.outputs.url }}"
\`\`\`

## Variable Overrides

When running tests against preview deployments, you can override app config variables using \`--var\`:

\`\`\`bash
qa-use browser create --after-test-id <login-test-uuid> \\
  --var base_url=https://preview-123.example.com \\
  --var login_url=https://preview-123.example.com/auth/login
\`\`\`

Common app config variables:

| Variable | Description |
|----------|-------------|
| \`base_url\` | Base URL for the app (e.g., preview deployment) |
| \`login_url\` | Login page URL |
| \`login_username\` | Username/email for authentication |
| \`login_password\` | Password for authentication |

The \`/qa-use:verify-pr\` command handles this automatically when you pass \`--base-url\`.

## Pre-installed Tools on GitHub Runners

GitHub-hosted runners include:

| Tool | Status | Notes |
|------|--------|-------|
| \`gh\` CLI | Pre-installed | Auto-authenticated via \`GITHUB_TOKEN\` |
| Node.js | Available | Pin version for consistency |
| git | Pre-installed | Full functionality |
| curl | Pre-installed | For fallback API calls |

## Required Secrets

| Secret | Description | How to Get |
|--------|-------------|------------|
| \`CLAUDE_CODE_OAUTH_TOKEN\` | OAuth token for Claude Code authentication | Run \`claude setup-token\` locally (see below) |
| \`QA_USE_API_KEY\` | qa-use/desplega.ai API key | From [desplega.ai dashboard](https://desplega.ai) |
| \`GITHUB_TOKEN\` | Auto-provided by GitHub Actions | No setup needed (automatic) |

### Getting CLAUDE_CODE_OAUTH_TOKEN

Run locally to generate and retrieve your OAuth token:

\`\`\`bash
# This will authenticate and store the token locally
claude setup-token

# The token is stored in ~/.claude/.credentials.json
# Copy the token value and add it as a GitHub secret
\`\`\`

Claude Code automatically picks up \`CLAUDE_CODE_OAUTH_TOKEN\` from the environment when running in CI.

## Headless/Autonomous Mode

When \`CI=true\` or \`GITHUB_ACTIONS=true\` is set, the verify-pr command operates in fully autonomous mode:

| Behavior | Description |
|----------|-------------|
| No user prompts | Makes autonomous decisions with sensible defaults |
| Auto-select first match | When multiple options exist (e.g., login tests) |
| Continue on soft failures | Reports issues but doesn't block execution |
| Fail fast on hard failures | Missing API key, no PR context, etc. |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Verification completed (even with warnings/partial results) |
| 1 | Hard failure (no PR context, API key missing, session creation failed) |

The report is always generated regardless of exit code, allowing PR comments to be posted even on partial failures.

## Filtering by Label

To only run verification on PRs with specific labels:

\`\`\`yaml
jobs:
  verify-pr:
    runs-on: ubuntu-latest
    if: contains(github.event.pull_request.labels.*.name, 'needs-verification')
\`\`\`

Or to only run on frontend changes:

\`\`\`yaml
on:
  pull_request:
    paths:
      - 'src/**/*.tsx'
      - 'src/**/*.jsx'
      - 'src/**/*.ts'
      - 'src/**/*.js'
      - 'src/**/*.vue'
      - 'src/**/*.svelte'
\`\`\`

## Debugging

### View Raw Output

The command outputs a markdown report to stdout. To see raw output:

\`\`\`yaml
- name: Run PR Verification
  run: |
    claude --print "/qa-use:verify-pr #\${{ github.event.pull_request.number }}" 2>&1 | tee /tmp/verification-output.txt
\`\`\`

### Check Session Artifacts

After verification, session artifacts are available:

\`\`\`yaml
- name: Upload Verification Artifacts
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: pr-verification-\${{ github.event.pull_request.number }}
    path: |
      /tmp/pr-verify-*.png
      /tmp/pr-verify-*.json
      /tmp/pr-verify-report-*.md
\`\`\`

### Common Issues

| Issue | Solution |
|-------|----------|
| "API key not configured" | Ensure \`QA_USE_API_KEY\` secret is set |
| "No login test found" | Either upload a login test or the command will proceed without auth |
| "Session creation failed" | Check if \`QA_USE_API_KEY\` is valid and not expired |
| "gh: command not found" | \`gh\` should be pre-installed; ensure checkout step runs first |
`,
  },
  'failure-debugging': {
    title: 'Failure Debugging',
    content: `# Failure Debugging

Guide for analyzing E2E test failures and determining root causes.

## Failure Classification

Every test failure falls into one of three categories:

| Category | Meaning | Who Fixes |
|----------|---------|-----------|
| **CODE BUG** | Feature doesn't work | Developer (fix application code) |
| **TEST BUG** | Test is outdated | Developer/QA (update test) |
| **ENVIRONMENT** | External issue | Ops (fix infrastructure) |

Getting the classification right determines the correct fix approach.

## CODE BUG

**The feature doesn't work as expected. The application code is broken.**

### Indicators

- Expected behavior doesn't happen (redirect doesn't occur, data isn't saved)
- JavaScript errors in browser console
- API calls returning error responses (4xx, 5xx)
- Application crashes or shows error pages
- Form submission has no effect
- Data not persisting

### Diagnostic Questions

1. Does the feature work when tested manually in a browser?
2. Are there related recent code changes?
3. Is the backend API responding correctly?
4. Are there JavaScript errors in the console? (\`qa-use browser logs console\`)
5. Are API requests failing? (\`qa-use browser logs network\`)

### Investigation Steps

\`\`\`bash
# 1. Get console logs
qa-use browser logs console -s <session-id>

# 2. Get network logs
qa-use browser logs network -s <session-id>

# 3. Check for errors
# Look for: console.error, failed requests, 4xx/5xx responses
\`\`\`

### Suggested Actions

- **Locate relevant code:**
  - URL \`/login\` → look for \`pages/login\`, \`routes/login\`, \`auth/\`
  - Component "dashboard" → look for \`Dashboard.tsx\`, \`components/dashboard\`
  - Form submission → look for \`handleSubmit\`, form handlers, API calls

- **Check recent changes:**
  \`\`\`bash
  git log --oneline -20 -- src/
  git diff HEAD~5 -- src/auth/
  \`\`\`

- **Debug manually** - reproduce the issue in a browser with DevTools open

## TEST BUG

**The test definition is outdated or incorrect. The feature works, but the test doesn't match it.**

### Indicators

- Element selector/target no longer matches
- Timing issues (element appears with different delay)
- Expected value changed (button text "Submit" → "Sign In")
- Test assumes old workflow that was redesigned
- Assertion expects outdated content

### Diagnostic Questions

1. Has the UI changed recently (button text, layout, element attributes)?
2. Is this a timing/race condition issue?
3. Does the test pass with \`--autofix\`?
4. Did someone refactor the component without updating tests?

### Investigation Steps

\`\`\`bash
# 1. Run with autofix to see if AI can fix it
qa-use test run my-test --autofix

# 2. If autofix works, persist the fix
qa-use test run my-test --autofix --update-local

# 3. Check what changed
git diff qa-tests/my-test.yaml
\`\`\`

### Suggested Actions

- **Update target description** to match current UI
- **Add wait steps** for timing issues
- **Run with \`--autofix --update-local\`** to let AI fix and persist
- **Review the diff** to understand what changed

### Common Test Bug Patterns

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| "Element not found: submit button" | Button text changed | Update target to new text |
| "Timeout waiting for dashboard" | Slower load time | Add \`wait\` or increase timeout |
| "Expected 'Welcome' but got 'Hello'" | Copy changed | Update assertion value |
| "Element not interactable" | Overlay blocking | Add wait for overlay to close |

## ENVIRONMENT

**External factors are causing the failure. The code and test are correct.**

### Indicators

- Network timeouts or connection errors
- Authentication failures (session expired, invalid credentials)
- Missing test data (database not seeded, user doesn't exist)
- Service unavailable (third-party API down)
- Rate limiting errors
- SSL/TLS certificate errors

### Diagnostic Questions

1. Does the app work when accessed manually?
2. Are API credentials valid and not expired?
3. Is test data in the expected state?
4. Are external services (APIs, databases) accessible?
5. Is this a transient network issue?

### Investigation Steps

\`\`\`bash
# 1. Check if app is accessible
curl https://your-app.com/health

# 2. Check network logs for failed requests
qa-use browser logs network -s <session-id>

# 3. Verify credentials haven't expired
# Check .qa-use-tests.json or environment variables
\`\`\`

### Suggested Actions

- **Retry the test** - transient issues often resolve themselves
- **Refresh credentials** - update expired API keys or tokens
- **Reset test data** - re-seed database, recreate test user
- **Check service status** - verify third-party services are up
- **Wait and retry** - for rate limiting, wait before retrying

## Debugging Workflow

\`\`\`
Test Failed
    │
    ▼
┌──────────────────────────────────────┐
│ 1. Get session logs                  │
│    qa-use browser logs console -s ID │
│    qa-use browser logs network -s ID │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 2. Check for JS errors or API fails  │
│    - Console errors = CODE BUG       │
│    - 4xx/5xx responses = CODE BUG    │
│    - Network timeout = ENVIRONMENT   │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 3. Try --autofix                     │
│    qa-use test run name --autofix    │
│    - Works = TEST BUG, use           │
│      --update-local to persist       │
│    - Still fails = probably CODE BUG │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 4. Manual verification               │
│    - Open app in browser             │
│    - Try the same flow manually      │
│    - Works manually = TEST BUG       │
│    - Fails manually = CODE BUG       │
└──────────────────────────────────────┘
\`\`\`

## Error Message Reference

| Error Message | Category | Likely Fix |
|---------------|----------|------------|
| "Element not found: ..." | TEST BUG | Update target description |
| "Timeout waiting for ..." | TEST BUG/ENV | Add wait or check service |
| "Expected ... but got ..." | TEST BUG/CODE | Verify expected value |
| "Navigation to ... failed" | TEST BUG/CODE | Check URL and redirects |
| "Element not interactable" | TEST BUG | Wait for overlays |
| "Network request failed" | ENVIRONMENT | Check service health |
| "Unauthorized" / "401" | ENVIRONMENT | Refresh credentials |
| "Internal Server Error" / "500" | CODE BUG | Check server logs |
| "Not Found" / "404" | CODE BUG | Check routing |
| "TypeError: Cannot read ..." | CODE BUG | Fix JavaScript error |

## Using AI Self-Healing

The \`--autofix\` flag enables AI-powered test repair:

\`\`\`bash
# Try autofix
qa-use test run my-test --autofix

# If it works, persist the changes
qa-use test run my-test --autofix --update-local

# Review what changed
git diff qa-tests/my-test.yaml
\`\`\`

**What autofix can fix:**
- Selector/target changes
- Timing issues (adds waits)
- Minor assertion value changes

**What autofix cannot fix:**
- Broken application code
- Major workflow changes
- Missing features
- Authentication issues
`,
  },
  'localhost-testing': {
    title: 'Localhost Testing',
    content: `# Localhost Testing

Testing applications running on \`localhost\` requires a tunnel because the cloud-hosted browser cannot access your local machine.

## Why Tunnels Are Needed

\`\`\`
Your Machine                    Cloud
┌─────────────────┐            ┌─────────────────┐
│ localhost:3000  │     ✗      │ Cloud Browser   │
│ (your app)      │ ◄──────────│ (qa-use API)    │
└─────────────────┘            └─────────────────┘

Without tunnel: Cloud cannot reach localhost
\`\`\`

\`\`\`
Your Machine                    Cloud
┌─────────────────┐            ┌─────────────────┐
│ localhost:3000  │            │ Cloud Browser   │
│ (your app)      │            │ (qa-use API)    │
└────────┬────────┘            └────────┬────────┘
         │                              │
         └──────────┐    ┌──────────────┘
                    │    │
              ┌─────▼────▼─────┐
              │  Local Browser │
              │   + Tunnel     │
              └────────────────┘

With tunnel: Local browser accesses localhost,
             API controls browser through tunnel
\`\`\`

## Using \`--tunnel\` Flag

The simplest approach - add \`--tunnel\` to your test run command:

\`\`\`bash
qa-use test run my-test --tunnel
\`\`\`

This:
1. Starts a local headless browser
2. Creates a tunnel for API control
3. Runs the test
4. Cleans up automatically

### With Visible Browser

For debugging, add \`--headful\`:

\`\`\`bash
qa-use test run my-test --tunnel --headful
\`\`\`

## Persistent Tunnel Session

For running multiple tests or interactive development, create a persistent tunnel session:

### Terminal 1: Start Tunnel

\`\`\`bash
qa-use browser create --tunnel --no-headless
\`\`\`

Output:
\`\`\`
Session created: abc123
WebSocket URL: wss://tunnel.desplega.ai/abc123
Tunnel active. Press Ctrl+C to stop.
\`\`\`

### Terminal 2: Run Tests

\`\`\`bash
# Run test against the tunneled browser
qa-use test run my-test --ws-url wss://tunnel.desplega.ai/abc123

# Or run multiple tests
qa-use test run login --ws-url wss://tunnel.desplega.ai/abc123
qa-use test run checkout --ws-url wss://tunnel.desplega.ai/abc123
\`\`\`

### Benefits

- **Reuse browser session** - no startup time between tests
- **Watch execution** - see what's happening in real-time
- **Debug interactively** - use browser commands between test runs
- **Inspect state** - check page state after failures

## Browser Session Commands with Tunnel

You can also use browser commands directly for exploration:

\`\`\`bash
# Create tunneled session
qa-use browser create --tunnel --no-headless

# Navigate to your local app
qa-use browser goto http://localhost:3000

# Explore
qa-use browser snapshot
qa-use browser click e3
qa-use browser screenshot

# Close when done
qa-use browser close
\`\`\`

## Environment-Specific URLs

If your app runs on different ports in different environments, use variables:

\`\`\`yaml
# test.yaml
name: Local Test
app_config: my-app
variables:
  base_url: http://localhost:3000
steps:
  - action: goto
    url: $base_url/login
\`\`\`

Override at runtime:

\`\`\`bash
# Local development
qa-use test run my-test --tunnel --var base_url=http://localhost:3000

# Staging
qa-use test run my-test --var base_url=https://staging.example.com
\`\`\`

## Common Issues

### "Connection refused" / "Network error"

Your local server isn't running or is on a different port.

**Fix:** Verify your app is running:
\`\`\`bash
curl http://localhost:3000
\`\`\`

### Tunnel disconnects

The tunnel process was interrupted.

**Fix:** Restart the tunnel:
\`\`\`bash
qa-use browser create --tunnel
\`\`\`

### "localhost" resolved differently

Some setups resolve \`localhost\` differently than \`127.0.0.1\`.

**Fix:** Try the explicit IP:
\`\`\`bash
qa-use browser goto http://127.0.0.1:3000
\`\`\`

### HTTPS localhost with self-signed cert

Local HTTPS with self-signed certificates may fail.

**Fix:** Use HTTP for local testing, or configure your browser to accept the cert:
\`\`\`bash
# Use HTTP locally
qa-use browser goto http://localhost:3000

# Test HTTPS only in staging/prod environments
\`\`\`

## Best Practices

1. **Use \`--tunnel\` for all localhost tests** - Don't forget, or tests will fail with confusing network errors

2. **Keep tunnel running during development** - Create once, run many tests

3. **Use \`--no-headless\` for debugging** - Watch what's happening

4. **Save WebSocket URL** - Copy it from tunnel output for reuse in \`--ws-url\`

5. **Clean up sessions** - Run \`qa-use browser close\` when done to free resources
`,
  },
  'test-format': {
    title: 'Test Format Reference',
    content: `# Test Format Reference

Complete specification for qa-use test YAML files.

## Basic Structure

\`\`\`yaml
name: Test Name
description: Optional description of what this test verifies
tags:
  - smoke
  - auth
app_config: <app-config-id>
variables:
  key: value
depends_on: optional-prerequisite-test
steps:
  - action: goto
    url: /path
\`\`\`

## Required Fields

| Field | Description |
|-------|-------------|
| \`name\` | Human-readable test name |
| \`app_config\` | App configuration ID from desplega.ai (or use default from \`.qa-use-tests.json\`) |
| \`steps\` | Array of test steps |

## Optional Fields

| Field | Description |
|-------|-------------|
| \`description\` | What this test verifies |
| \`tags\` | Array of strings for categorization (e.g., \`smoke\`, \`auth\`, \`critical\`) |
| \`variables\` | Key-value pairs for parameterization |
| \`depends_on\` | Name of test that must run first |

## Variables

Define variables at the top level:

\`\`\`yaml
variables:
  email: test@example.com
  password: secret123
  base_path: /app
\`\`\`

Reference with \`$\` prefix:

\`\`\`yaml
steps:
  - action: fill
    target: email input
    value: $email
  - action: goto
    url: $base_path/dashboard
\`\`\`

Variables can be overridden at runtime:

\`\`\`bash
qa-use test run my-test --var email=other@example.com
\`\`\`

## Dependencies

Run prerequisite tests first:

\`\`\`yaml
name: Checkout Test
depends_on: login-test
steps:
  - action: goto
    url: /checkout
\`\`\`

Dependencies are resolved recursively. If \`checkout-test\` depends on \`login-test\`, and \`login-test\` depends on \`setup-test\`, all three run in order.

## Step Format

Each step has an \`action\` and action-specific fields:

\`\`\`yaml
- action: <action-type>
  target: <element description>  # For interactions
  value: <value>                 # For fill, type, assertions
  url: <path>                    # For navigation
\`\`\`

## Available Actions

### Navigation

| Action | Fields | Description |
|--------|--------|-------------|
| \`goto\` | \`url\` | Navigate to URL (absolute or relative) |
| \`back\` | - | Browser back |
| \`forward\` | - | Browser forward |
| \`reload\` | - | Reload page |

\`\`\`yaml
- action: goto
  url: /login

- action: goto
  url: https://example.com/page
\`\`\`

### Interactions

| Action | Fields | Description |
|--------|--------|-------------|
| \`click\` | \`target\` | Click element |
| \`fill\` | \`target\`, \`value\` | Fill input (clears first) |
| \`type\` | \`target\`, \`value\` | Type with delays |
| \`press\` | \`value\` | Press keyboard key |
| \`check\` | \`target\` | Check checkbox |
| \`uncheck\` | \`target\` | Uncheck checkbox |
| \`select\` | \`target\`, \`value\` | Select dropdown option |
| \`hover\` | \`target\` | Hover over element |
| \`scroll\` | \`target\` or direction | Scroll page or element |
| \`mfa_totp\` | \`target\` (optional), \`secret\` | Generate TOTP and optionally fill |
| \`set_input_files\` | \`target\`, \`files\` | Upload files to input |

\`\`\`yaml
- action: click
  target: submit button

- action: fill
  target: email input
  value: $email

- action: type
  target: search box
  value: search query

- action: press
  value: Enter

- action: select
  target: country dropdown
  value: United States

- action: mfa_totp
  target: OTP input field
  secret: $totp_secret

- action: set_input_files
  target: file upload button
  files:
    - /path/to/file1.pdf
    - /path/to/file2.pdf
\`\`\`

### Assertions

| Action | Fields | Description |
|--------|--------|-------------|
| \`to_be_visible\` | \`target\` | Assert element is visible |
| \`to_be_hidden\` | \`target\` | Assert element is hidden |
| \`to_have_text\` | \`target\`, \`value\` | Assert element has text |
| \`to_have_value\` | \`target\`, \`value\` | Assert input has value |
| \`to_be_checked\` | \`target\` | Assert checkbox is checked |
| \`to_be_unchecked\` | \`target\` | Assert checkbox is unchecked |

\`\`\`yaml
- action: to_be_visible
  target: success message

- action: to_have_text
  target: page heading
  value: Welcome

- action: to_be_checked
  target: remember me checkbox
\`\`\`

### Waiting

| Action | Fields | Description |
|--------|--------|-------------|
| \`wait\` | \`value\` | Wait fixed time (ms) |
| \`wait_for_url\` | \`url\` | Wait for URL to match |
| \`wait_for_selector\` | \`target\`, \`state\` | Wait for element state |

\`\`\`yaml
- action: wait
  value: 2000

- action: wait_for_url
  url: /dashboard

- action: wait_for_selector
  target: .modal
  state: hidden
\`\`\`

### AI-Powered Actions

Use when human-readable selectors are insufficient:

| Action | Fields | Description |
|--------|--------|-------------|
| \`ai_action\` | \`value\` | AI performs action from description |
| \`ai_assertion\` | \`value\` | AI verifies condition from description |

\`\`\`yaml
- action: ai_action
  value: scroll to the pricing section

- action: ai_action
  value: dismiss the cookie banner if present

- action: ai_assertion
  value: verify the cart shows exactly 3 items

- action: ai_assertion
  value: confirm the total price is greater than $50
\`\`\`

AI actions are more flexible but slower and less deterministic. Prefer explicit actions when possible.

### Extended Step Format

For actions not available in simple format (like drag operations), use the extended format:

| Action | Description |
|--------|-------------|
| \`drag_and_drop\` | Drag source element to target |
| \`relative_drag_and_drop\` | Drag with relative positioning |
| \`mfa_totp\` | Generate and enter TOTP code |
| \`set_input_files\` | Upload files |

#### Drag and Drop Example

\`\`\`yaml
- type: extended
  name: Drag item to drop zone
  action:
    action: drag_and_drop
    value:
      target_locator: "#drop-zone"  # Playwright locator string
  locator:
    chain:
      - method: get_by_text
        args: ["draggable item"]
\`\`\`

The \`target_locator\` must be a valid Playwright locator string:
- \`"#drop-zone"\` - CSS ID selector
- \`".drop-area"\` - CSS class selector
- \`"text=Drop here"\` - Text selector
- \`"[data-testid='target']"\` - Attribute selector

#### TOTP Example

\`\`\`yaml
- type: extended
  name: Enter MFA code
  action:
    action: mfa_totp
    value:
      target_locator: "#otp-input"
  locator:
    chain:
      - method: get_by_label
        args: ["Enter your code"]
\`\`\`

**Tip:** Use \`qa-use test schema\` to explore all available actions and their schemas.

## Target Descriptions

The \`target\` field uses natural language descriptions:

\`\`\`yaml
# Good - specific and unambiguous
target: submit button in the login form
target: email input field
target: first product card
target: navigation menu item labeled "Settings"

# Avoid - too generic
target: button
target: input
target: link
\`\`\`

The AI matches your description against the page's ARIA accessibility tree. Be specific enough to uniquely identify the element.

## Complete Example

\`\`\`yaml
name: User Registration
description: Tests the full user registration flow
tags:
  - smoke
  - registration
  - critical
app_config: my-app-config-id
variables:
  email: newuser@example.com
  password: SecurePass123!
  name: Test User
depends_on: clear-test-data

steps:
  # Navigate to registration
  - action: goto
    url: /register

  # Fill registration form
  - action: fill
    target: name input
    value: $name

  - action: fill
    target: email input
    value: $email

  - action: fill
    target: password input
    value: $password

  - action: fill
    target: confirm password input
    value: $password

  # Accept terms
  - action: check
    target: terms and conditions checkbox

  # Submit
  - action: click
    target: create account button

  # Wait for redirect
  - action: wait_for_url
    url: /welcome

  # Verify success
  - action: to_be_visible
    target: welcome message

  - action: to_have_text
    target: user greeting
    value: Hello, Test User
\`\`\`

## File Location

Tests should be placed in the test directory (default: \`qa-tests/\`):

\`\`\`
qa-tests/
├── login.yaml
├── registration.yaml
├── checkout.yaml
└── setup/
    └── seed-data.yaml
\`\`\`

Configure the test directory in \`.qa-use-tests.json\`:

\`\`\`json
{
  "test_directory": "./qa-tests"
}
\`\`\`
`,
  },
};

export const TEMPLATES: Record<string, { title: string; content: string }> = {
  'auth-flow': {
    title: 'Auth Flow Template',
    content: `# Authentication Flow Template
# Login with credentials and verify dashboard access

name: Authentication Flow
description: Login with credentials and verify successful authentication

# Replace with your app config ID from desplega.ai
app_config: $APP_CONFIG_ID

# Variables for credentials
# Override at runtime: qa-use test run auth-flow --var email=real@example.com
variables:
  email: test@example.com
  password: "********"

steps:
  # Navigate to login page
  - action: goto
    url: /login

  # Fill login form
  - action: fill
    target: email input
    value: $email

  - action: fill
    target: password input
    value: $password

  # Submit the form
  - action: click
    target: sign in button

  # Wait for successful redirect
  - action: wait_for_url
    url: /dashboard

  # Verify dashboard is visible
  - action: to_be_visible
    target: dashboard content

  # Optional: verify user greeting
  # - action: to_be_visible
  #   target: welcome message
`,
  },
  'basic-test': {
    title: 'Basic Test Template',
    content: `# Basic Test Template
# A simple navigation and assertion test

name: Basic Test
description: Navigate to a page and verify an element is visible

# Replace with your app config ID from desplega.ai
# Or set default_app_config_id in .qa-use-tests.json
app_config: $APP_CONFIG_ID

steps:
  # Navigate to the starting page
  - action: goto
    url: /

  # Verify the main content is visible
  - action: to_be_visible
    target: main content area

  # Optional: verify page heading
  # - action: to_have_text
  #   target: page heading
  #   value: Welcome
`,
  },
  'form-test': {
    title: 'Form Test Template',
    content: `# Form Submission Template
# Fill out a form and verify successful submission

name: Form Submission
description: Fill a contact form and verify submission success

# Replace with your app config ID from desplega.ai
app_config: $APP_CONFIG_ID

# Variables for form data
variables:
  name: Test User
  email: test@example.com
  message: This is a test message from automated testing.

steps:
  # Navigate to the form page
  - action: goto
    url: /contact

  # Fill form fields
  - action: fill
    target: name input
    value: $name

  - action: fill
    target: email input
    value: $email

  - action: fill
    target: message textarea
    value: $message

  # Optional: handle checkbox/consent
  # - action: check
  #   target: consent checkbox

  # Submit the form
  - action: click
    target: submit button

  # Verify success
  - action: to_be_visible
    target: success message

  # Optional: verify specific success text
  # - action: to_have_text
  #   target: confirmation message
  #   value: Thank you for your message
`,
  },
};
