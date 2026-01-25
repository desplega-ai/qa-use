---
name: qa-use
description: E2E testing and browser automation with qa-use CLI. Use when the user needs to run tests, verify features, automate browser interactions, or debug test failures.
allowed-tools: Bash(qa-use *)
---

# qa-use

E2E testing and browser automation for AI-driven development workflows.

## Quick Start

```bash
qa-use browser create --viewport desktop  # Create browser session
qa-use browser goto https://example.com   # Navigate
qa-use browser snapshot                   # Get element refs
qa-use browser click e3                   # Interact by ref
qa-use browser close                      # Cleanup
```

**For localhost:** Add `--tunnel` to create (browser runs locally with API tunnel).

## Core Workflow

1. **Create session** → `qa-use browser create`
2. **Navigate** → `qa-use browser goto <url>`
3. **Snapshot** → `qa-use browser snapshot` (get element refs)
4. **Interact** → `qa-use browser click <ref>` / `fill <ref> "value"`
5. **Assert/Inspect** → `qa-use browser url` / `screenshot`
6. **Close** → `qa-use browser close`

**Critical:** Always run `snapshot` before interacting to get valid element refs. Never guess refs.

## Commands

### Browser Session Management

| Command | Description |
|---------|-------------|
| `qa-use browser create` | Create remote browser session |
| `qa-use browser create --tunnel` | Create local browser with API tunnel |
| `qa-use browser create --viewport <size>` | Set viewport: `desktop`, `tablet`, `mobile` |
| `qa-use browser create --ws-url <url>` | Connect to existing WebSocket browser |
| `qa-use browser create --after-test-id <uuid>` | Run a test first, then become interactive |
| `qa-use browser create --var <key=value>` | Override app config variables (repeatable) |
| `qa-use browser list` | List active sessions |
| `qa-use browser status` | Show current session details (app_url, recording_url, etc.) |
| `qa-use browser close` | Close active session |

Sessions auto-persist in `~/.qa-use.json`. One active session = no `-s` flag needed.

### Variable Overrides

Use `--var` to override app config variables at runtime. Common variables:

| Variable | Description |
|----------|-------------|
| `base_url` | Base URL for the app (e.g., preview deployment URL) |
| `login_url` | Login page URL |
| `login_username` | Username/email for authentication |
| `login_password` | Password for authentication |

Example with ephemeral preview URL:
```bash
qa-use browser create --after-test-id <login-test-uuid> \
  --var base_url=https://preview-123.example.com \
  --var login_url=https://preview-123.example.com/auth/login
```

### Navigation

| Command | Description |
|---------|-------------|
| `qa-use browser goto <url>` | Navigate to URL |
| `qa-use browser back` | Go back |
| `qa-use browser forward` | Go forward |
| `qa-use browser reload` | Reload page |

### Element Interaction

| Command | Description |
|---------|-------------|
| `qa-use browser click <ref>` | Click element by ref |
| `qa-use browser click --text "Button"` | Click by semantic description |
| `qa-use browser fill <ref> "value"` | Fill input field |
| `qa-use browser type <ref> "text"` | Type with delays (for autocomplete) |
| `qa-use browser press <key>` | Press key (e.g., `Enter`, `Tab`) |
| `qa-use browser check <ref>` | Check checkbox |
| `qa-use browser uncheck <ref>` | Uncheck checkbox |
| `qa-use browser select <ref> "option"` | Select dropdown option |
| `qa-use browser hover <ref>` | Hover over element |
| `qa-use browser scroll down 500` | Scroll by pixels |
| `qa-use browser scroll-into-view <ref>` | Scroll element into view |

### Inspection

| Command | Description |
|---------|-------------|
| `qa-use browser snapshot` | Get ARIA tree with element refs |
| `qa-use browser url` | Get current URL |
| `qa-use browser screenshot` | Save screenshot.png |
| `qa-use browser screenshot file.png` | Save to custom path |
| `qa-use browser screenshot --base64` | Output base64 to stdout |

### Logs

| Command | Description |
|---------|-------------|
| `qa-use browser logs console` | View console logs from session |
| `qa-use browser logs console -s <id>` | View logs from specific/closed session |
| `qa-use browser logs network` | View network request logs |
| `qa-use browser logs network -s <id>` | View network logs from specific session |

### Test Generation

| Command | Description |
|---------|-------------|
| `qa-use browser generate-test` | Generate test YAML from recorded session |
| `qa-use browser generate-test -s <id>` | Generate from specific session |
| `qa-use browser get-blocks` | Get recorded interaction blocks |

### Waiting

| Command | Description |
|---------|-------------|
| `qa-use browser wait <ms>` | Fixed wait |
| `qa-use browser wait-for-selector ".class"` | Wait for selector |
| `qa-use browser wait-for-load` | Wait for page load |

### Test Operations

| Command | Description |
|---------|-------------|
| `qa-use test run <name>` | Run test by name |
| `qa-use test run --all` | Run all tests |
| `qa-use test run <name> --tunnel` | Run with local browser tunnel |
| `qa-use test run <name> --autofix` | Enable AI self-healing |
| `qa-use test run <name> --update-local` | Persist AI fixes to file |
| `qa-use test run <name> --download` | Download assets to `/tmp/qa-use/downloads/` |
| `qa-use test run <name> --var key=value` | Override variable |
| `qa-use test validate <name>` | Validate test syntax |
| `qa-use test list` | List available tests |
| `qa-use test init` | Initialize test directory |
| `qa-use test sync --pull` | Pull tests from cloud |
| `qa-use test sync --push` | Push tests to cloud |

## Common Mistakes

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| `browser navigate <url>` | `browser goto <url>` |
| `browser destroy` | `browser close` |
| `browser close <session-id>` | `browser close` |
| `browser goto --session <id> <url>` | `browser -s <id> goto <url>` |
| `browser screenshot --output file.png` | `browser screenshot file.png` |

## Test Format Overview

```yaml
name: Login Test
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
```

See [references/test-format.md](references/test-format.md) for full specification.

## Failure Debugging

When tests fail, classify the issue:

| Type | Indicators | Action |
|------|------------|--------|
| **CODE BUG** | Feature doesn't work, JS errors, API failures | Fix application code |
| **TEST BUG** | Selector changed, timing issue, assertion value outdated | Update test or use `--autofix` |
| **ENVIRONMENT** | Network timeout, auth expired, missing data | Check services, retry |

See [references/failure-debugging.md](references/failure-debugging.md) for detailed diagnostics.

## Localhost Testing

The cloud cannot access `localhost`. Use tunnels:

```bash
# Option 1: Tunnel flag with test run
qa-use test run my-test --tunnel

# Option 2: Persistent tunnel session
qa-use browser create --tunnel  # Starts local browser
# Copy WebSocket URL from output
qa-use test run my-test --ws-url <websocket-url>
```

See [references/localhost-testing.md](references/localhost-testing.md) for details.

## Deep-Dive References

| Document | Description |
|----------|-------------|
| [browser-commands.md](references/browser-commands.md) | Complete browser CLI reference with all flags |
| [test-format.md](references/test-format.md) | Full test YAML specification |
| [localhost-testing.md](references/localhost-testing.md) | Tunnel setup for local development |
| [failure-debugging.md](references/failure-debugging.md) | Failure classification and diagnostics |

## Templates

| Template | Description |
|----------|-------------|
| [basic-test.yaml](templates/basic-test.yaml) | Simple navigation and assertion |
| [auth-flow.yaml](templates/auth-flow.yaml) | Login flow with credentials |
| [form-test.yaml](templates/form-test.yaml) | Form submission with validation |

## npx Alternative

All commands use `qa-use` assuming global install. For one-off use:
```bash
npx @desplega.ai/qa-use browser <command>
```
