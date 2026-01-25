---
date: 2026-01-25T02:30:00Z
topic: "PR Verification Workflow with qa-use CLI + Plugin"
---

# PR Verification Workflow Research

> **Goal:** Build a **slash command / prompt** (e.g., `/qa-use:verify-pr`) that orchestrates these building blocks
> **Constraint:** CLI + plugin only, NO direct MCP tool usage

## Overview

This document details the building blocks available via the qa-use CLI and plugin system to create a PR verification workflow that:
1. Analyzes a PR's frontend changes
2. Starts a browser session (potentially from a logged-in state)
3. Validates the changed areas
4. Captures screenshots and action blocks
5. Generates a report with app_url, screenshots, and proposed new tests

---

## 1. CLI Commands Available

### 1.1 Session Management

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `qa-use browser create` | Create new browser session | `--after-test-id <uuid>`, `--tunnel`, `--viewport`, `--headless/--no-headless` |
| `qa-use browser list` | List active sessions | - |
| `qa-use browser status` | Show session details | `--json` |
| `qa-use browser close` | Close active session | - |

**Key feature - `--after-test-id <uuid>`:**
Creates a session that runs a specified test first, leaving the session in the post-test state (e.g., logged in). This is critical for starting sessions in an authenticated state.

**Session Status Output includes:**
- `app_url` - Frontend URL to view session visualization (live)
- `recording_url` - Video recording URL (available after close)
- `har_url` - HAR file URL (network logs, available after close)

### 1.2 Browser Interaction Commands

| Command | Description |
|---------|-------------|
| `qa-use browser goto <url>` | Navigate to URL |
| `qa-use browser snapshot` | Get ARIA tree with element refs |
| `qa-use browser click <ref>` | Click element by ref |
| `qa-use browser click --text "desc"` | Click by semantic description (AI) |
| `qa-use browser fill <ref> "value"` | Fill input field |
| `qa-use browser screenshot [file]` | Save screenshot to file |
| `qa-use browser screenshot --base64` | Output base64 to stdout |
| `qa-use browser url` | Get current URL |

**Snapshot Filtering:**
- `--interactive` / `-i`: Only interactive elements
- `--compact` / `-c`: Remove empty structural elements
- `--max-depth <n>` / `-d <n>`: Limit tree depth
- `--scope <selector>`: CSS selector to scope snapshot

### 1.3 Blocks and Test Generation

| Command | Description |
|---------|-------------|
| `qa-use browser get-blocks` | Get recorded interaction blocks as JSON |
| `qa-use browser generate-test -n <name>` | Generate test YAML from session blocks |
| `qa-use browser generate-test -o <path>` | Save generated test to file |

**Generate Test flags:**
- Required: `-n, --name <name>` - Name for the generated test
- Optional: `-a, --app-config <id>` - App config ID
- Optional: `-o, --output <path>` - Output file path (stdout if not specified)

### 1.4 Test Operations

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `qa-use test run <name>` | Run test by name | `--tunnel`, `--autofix`, `--download` |
| `qa-use test run --id <uuid>` | Run cloud test by ID | - |
| `qa-use test list` | List available tests | - |
| `qa-use test validate <name>` | Validate test syntax | - |
| `qa-use test sync --pull` | Pull tests from cloud | - |
| `qa-use test sync --push` | Push tests to cloud | - |

### 1.5 Logs

| Command | Description |
|---------|-------------|
| `qa-use browser logs console` | View console logs |
| `qa-use browser logs network` | View network request logs |

---

## 2. Test Dependencies

### YAML Format

```yaml
name: Checkout Test
depends_on: login-test  # Can be test name or UUID
steps:
  - action: goto
    url: /checkout
```

### Resolution Logic

- `depends_on` can be a test name (file name) or UUID
- Dependencies resolved recursively
- If UUID: looks for local file with matching `id` field first
- Circular dependencies detected and prevented

---

## 3. Plugin Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `browser-navigator` | Autonomous browsing for multi-step tasks | Exploring changed areas |
| `browser-recorder` | Record interactions and generate test YAML | Creating new tests |
| `test-analyzer` | Deep analysis of test failures | Understanding why tests fail |
| `step-generator` | Generate test steps from natural language | Writing tests from descriptions |

### browser-navigator

- Input: `{ goal, start_url, max_steps }`
- Methodology: snapshot → analyze → action loop
- Output: `{ success, goal_achieved, final_url, findings, steps_taken, page_summary }`
- Handles login walls by suggesting `--after-test-id`

### browser-recorder

- Input: `{ test_name, description, session_id, record_mode }`
- Smart features: variable extraction, secret detection, assertion inference
- Output: Test YAML with variables and semantic descriptions

---

## 4. Plugin Commands

| Command | Description |
|---------|-------------|
| `/qa-use:verify <description>` | Verify a feature works through automated testing |
| `/qa-use:explore <url or goal>` | Explore a web page or complete navigation goal |
| `/qa-use:record start [name]` | Start recording browser interactions |
| `/qa-use:record stop` | Stop recording and generate test YAML |

### /qa-use:verify Workflow

1. Searches for existing tests matching description
2. If no test exists, offers to explore and create one
3. Runs the test with AI self-healing
4. Reports results with specific fix recommendations

### /qa-use:explore Workflow

1. Creates browser session (or uses existing)
2. Navigates to URL
3. Analyzes page using accessibility snapshots
4. Reports elements, navigation options, content found
- Can use `--after-test-id` for authenticated exploration

---

## 5. PR Verification Workflow - Proposed Phases

### Phase 1: Analyze PR Changes (Code Analysis)
- Use `Grep` and `Read` to identify changed frontend files
- Identify affected components, routes, features
- Map changes to existing tests or areas requiring new tests

### Phase 2: Discover Existing Tests
```bash
# Sync from cloud to ensure we have latest
qa-use test sync --pull

# List available tests
qa-use test list

# Search for tests related to changed areas
# (manual or via test name patterns)
```

### Phase 3: Session Setup
```bash
# Option A: Start from login test (most common)
qa-use browser create --after-test-id <login-test-uuid>

# Option B: Start fresh for unauthenticated pages
qa-use browser create --viewport desktop
```

### Phase 4: Navigate and Validate
```bash
# Navigate to affected area
qa-use browser goto <url>

# Get page state
qa-use browser snapshot --interactive

# Take verification screenshot
qa-use browser screenshot /tmp/pr-verify-<feature>.png

# Perform interactions to verify feature
qa-use browser click <ref>
qa-use browser fill <ref> "test value"
```

### Phase 5: Capture Evidence
```bash
# Get session blocks (recorded actions)
qa-use browser get-blocks > /tmp/session-blocks.json

# Get session status (includes app_url)
qa-use browser status --json > /tmp/session-status.json

# Final screenshot
qa-use browser screenshot /tmp/final-state.png
```

### Phase 6: Generate Test Proposal (Optional)
```bash
# Generate test from session
qa-use browser generate-test -n "pr-verify-<feature>" -o qa-tests/pr-verify-<feature>.yaml

# Add depends_on if appropriate
# Edit YAML to add: depends_on: login-test
```

### Phase 7: Cleanup and Report
```bash
# Close session
qa-use browser close

# Get post-close status (has recording_url, har_url)
qa-use browser status -s <session-id> --json
```

---

## 6. Report Output Structure

Based on the available data, a PR verification report would include:

```markdown
## PR Verification Report

### Session Info
- **App URL:** <app_url from status>
- **Recording:** <recording_url from post-close status>

### Screenshots
1. ![Initial State](/tmp/pr-verify-initial.png)
2. ![After Interaction](/tmp/pr-verify-after.png)
3. ![Final State](/tmp/pr-verify-final.png)

### Actions Performed (Blocks)
<formatted output from get-blocks>

### Proposed Tests
- **New test generated:** `qa-tests/pr-verify-<feature>.yaml`
- **Depends on:** `login-test` (UUID: xxx)
- **Steps:** N steps covering the verification flow
```

---

## 7. Key Implementation Considerations

### Starting Point (Dependency)
- Most PRs will need authentication → use `--after-test-id` with a login test
- Login test UUID needs to be known/configured (could be stored in `.qa-use-tests.json` or discovered via `test list`)

### Blocks Format
- `get-blocks` returns JSON array of `ExtendedStep[]`
- Each step has: `action`, `locator`, `name`, `description`, `aaa_phase`
- Can be used to understand what the session did

### Test Generation
- `generate-test` calls API to convert blocks to semantic test YAML
- Result includes: `yaml` (string), `test_definition` (object), `block_count` (number)
- Generated tests use natural language targets instead of refs

### Session Lifecycle
- `app_url` available while session is active (for live viewing)
- `recording_url`, `har_url` only available after `close`
- Session must be closed to get full artifacts

---

## 8. Open Questions for Implementation

1. **How to identify login test?**
   - **Answer:** Check local tests first (`qa-use test list`), then cloud (`qa-use test list --cloud`), identify by name pattern (e.g., "login", "auth")

2. **How to map PR changes to URLs/features?**
   - **Answer:** Use `git diff` to identify changed files, research deeper if conventions exist for file→route mapping

3. **Report format/destination?**
   - **Answer:** Markdown text output, can then be used as PR comment via `gh pr comment`

4. **Test proposal handling?**
   - **Answer:** Suggest tests as text/artifacts initially, no auto-push to cloud

---

## 9. File References

| Purpose | File Path |
|---------|-----------|
| Browser create command | `src/cli/commands/browser/create.ts` |
| Get blocks command | `src/cli/commands/browser/get-blocks.ts` |
| Generate test command | `src/cli/commands/browser/generate-test.ts` |
| Test loader (deps) | `src/cli/lib/loader.ts` |
| qa-use skill | `plugins/qa-use/skills/qa-use/SKILL.md` |
| browser-navigator agent | `plugins/qa-use/agents/browser-navigator.md` |
| browser-recorder agent | `plugins/qa-use/agents/browser-recorder.md` |
| verify command | `plugins/qa-use/commands/verify.md` |
| explore command | `plugins/qa-use/commands/explore.md` |
| test format reference | `plugins/qa-use/skills/qa-use/references/test-format.md` |
