# QA-Use Setup Guide

This guide explains how to use qa-use to create E2E tests for your application and integrate them into CI pipelines.

## Initial Setup

### 1. Configuration

Configure qa-use with your application:

```bash
qa-use setup                    # Interactive config (sets base_url, login creds, etc.)
qa-use test init                # Creates qa-tests/ directory with example.yaml
```

> **Planned Enhancement**: A unified `qa-use init` command that combines setup + test init is planned. The goal is to have `.qa-use.json` be sufficient for all local operations, with a fully environment-based approach for CI (no config file required).

Or set environment variables (preferred for CI):

```bash
export QA_USE_API_KEY=your-key
export QA_USE_REGION=us         # Optional: "us" or "auto"
```

You can also use `~/.qa-use.json` config file (env vars take precedence).

---

## Creating Tests for a New Feature

### Approach A: Manual Recording (Recommended for complex flows)

1. **Start a browser session and explore your app:**

```bash
qa-use browser create                              # Create browser session
qa-use browser goto http://localhost:3000/new-feature
qa-use browser snapshot                            # See element refs like [ref=e3]
qa-use browser fill e3 "test input"
qa-use browser click e5
```

2. **Use the `/qa-use:record` skill** to capture interactions into a test definition

3. **Or manually create** `qa-tests/new-feature.yaml`:

```yaml
name: New Feature Test
app_config: your-app-id
variables:
  email: test@example.com
steps:
  - action: goto
    url: /new-feature
  - action: fill
    target: email input
    value: $email
  - action: click
    target: submit button
  - action: to_be_visible
    target: success message
```

### Approach B: AI-Driven Feature Verification

Use `/qa-use:verify "description of what the new feature should do"` which:

1. Launches a browser-navigator agent
2. Explores the page autonomously
3. Auto-generates test YAML
4. Executes and reports results

---

## Test Definition Format

Tests are YAML or JSON files with this structure:

```yaml
name: Test Name
app_config: your-app-config-id    # Required
variables:
  email: test@example.com
  password: secret123
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
depends_on: other-test            # Optional dependency
```

### Supported Actions

| Category | Actions |
|----------|---------|
| Navigation | `goto`, `go_back`, `go_forward`, `reload` |
| Input | `fill`, `type`, `click`, `hover`, `press`, `check`, `uncheck`, `select_option` |
| Waiting | `wait_for_selector`, `wait_for_timeout`, `wait_for_load_state` |
| Assertions | `to_be_visible`, `to_have_text`, `to_have_url`, `to_contain_text`, `to_be_checked` |
| Advanced | `ai_action`, `ai_assertion`, `extract_structured_data`, `variable_json_path` |

---

## Validating & Running Tests Locally

```bash
qa-use test validate new-feature       # Check syntax without running
qa-use test run new-feature            # Execute test locally
qa-use test run new-feature --headful  # With visible browser for debugging
qa-use test run --all                  # Run all tests in qa-tests/
```

### Useful Run Options

| Option | Description |
|--------|-------------|
| `--headful` | Show browser window (starts local browser + tunnel) |
| `--autofix` | Enable AI self-healing for broken selectors |
| `--screenshots` | Capture screenshots at each step |
| `--download` | Download assets (recordings, HAR, screenshots) |
| `--var key=value` | Override variables |
| `--persist` | Save test to cloud after successful run |
| `--update-local` | Update local file when AI auto-fixes |

---

## Syncing to Cloud

Once tests pass locally:

```bash
qa-use test run new-feature --persist   # Save to cloud after successful run
# OR
qa-use test sync --push                 # Push all local tests to cloud
qa-use test sync --pull                 # Pull tests from cloud to local
qa-use test sync --dry-run              # Preview what would happen
```

---

## CI Integration

### AI-Assisted Test Generation for PRs

Use Claude to automatically generate or update E2E tests based on PR changes:

```yaml
# .github/workflows/e2e-generate.yml
name: Generate E2E Tests for PR

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  generate-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Claude CLI
        run: curl -fsSL https://claude.ai/install.sh | bash

      - name: Install qa-use CLI
        run: npm install -g @desplega.ai/qa-use

      - name: Verify qa-use configuration
        env:
          QA_USE_API_KEY: ${{ secrets.QA_USE_API_KEY }}
        run: qa-use info  # Verify app config exists with base_url

      - name: Install qa-use plugin for Claude
        run: |
          claude plugin marketplace add desplega-ai/qa-use
          claude plugin install qa-use@desplega.ai

      - name: Generate E2E Tests with Claude
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          QA_USE_API_KEY: ${{ secrets.QA_USE_API_KEY }}
        run: |
          claude -p "Analyze this PR and generate E2E tests for changed features.

          Use /qa-use:verify to test any new UI functionality.
          If tests don't exist, use /qa-use:record to create them.
          Run tests with /qa-use:test-run and persist with --persist flag."

      - name: Run Generated Tests
        env:
          QA_USE_API_KEY: ${{ secrets.QA_USE_API_KEY }}
        run: qa-use test run --all --download

      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: generated-tests
          path: |
            qa-tests/
            /tmp/qa-use/downloads/
```

This workflow:
1. Installs Claude CLI and the qa-use plugin
2. Uses Claude with full access to qa-use skills (`/qa-use:verify`, `/qa-use:record`, etc.)
3. Claude explores the PR changes and generates E2E test definitions
4. Runs tests and uploads results as artifacts

> **Prerequisites**:
> - Add `ANTHROPIC_API_KEY` and `QA_USE_API_KEY` to your repository secrets
> - Your qa-use API key must be associated with an app config that has `base_url` set (run `qa-use setup` locally first to configure this)
> - Existing tests in `qa-tests/` should reference a valid `app_config` ID

### Basic GitHub Actions Example

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install qa-use
        run: npm install -g @desplega.ai/qa-use

      - name: Run E2E Tests
        env:
          QA_USE_API_KEY: ${{ secrets.QA_USE_API_KEY }}
        run: qa-use test run --all --download

      - name: Upload Test Artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-results
          path: /tmp/qa-use/downloads/
```

### CI Run Options

| Option | Description |
|--------|-------------|
| `--all` | Run all discovered tests in `qa-tests/` |
| `--download` | Save recordings/screenshots as artifacts |
| `--id <uuid>` | Run specific cloud test without needing local files |

---

## Test Dependencies

Tests can depend on each other (e.g., login before checkout):

```yaml
# qa-tests/checkout.yaml
name: Checkout Flow
app_config: your-app-id
depends_on: login-test    # Runs login-test first
steps:
  - action: goto
    url: /cart
  - action: click
    target: checkout button
  # ...
```

---

## Architecture Overview

```
Developer Machine                    Cloud (desplega.ai)
┌──────────────────┐                ┌─────────────────────┐
│ qa-use browser   │                │ Test Definitions    │
│ commands/record  │ ─── sync ───▶  │ Test Run Results    │
│                  │                │ Session Management  │
│ qa-tests/*.yaml  │                │ Browser Pool        │
└──────────────────┘                └─────────────────────┘
         │                                    │
         ▼                                    ▼
   CI Pipeline  ──────── run tests ──────▶  API
         │                                    │
         └──────── download assets ◀─────────┘
             (recordings, screenshots, HAR)
```

### Key Concepts

- **Single Global Browser**: qa-use maintains one browser with tunneling; tests share infrastructure efficiently
- **Session TTL**: 30-minute timeout with auto-refresh on interaction
- **Concurrent Limit**: Max 10 sessions with automatic cleanup
- **25s MCP Timeout**: Each MCP call has timeout protection

---

## Quick Reference

```bash
# Setup
qa-use setup                           # Interactive configuration
qa-use test init                       # Initialize test directory

# Browser Control
qa-use browser create                  # Start browser session
qa-use browser snapshot                # Get element refs
qa-use browser goto <url>              # Navigate
qa-use browser click <ref>             # Click element
qa-use browser fill <ref> <value>      # Fill input

# Test Management
qa-use test validate <name>            # Validate syntax
qa-use test run <name>                 # Run test
qa-use test run --all                  # Run all tests
qa-use test list                       # List local tests
qa-use test list --cloud               # List cloud tests
qa-use test sync --push                # Push to cloud
qa-use test sync --pull                # Pull from cloud
qa-use test export <id>                # Export cloud test to local
```
