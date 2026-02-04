---
date: 2026-02-04
topic: "QA-Use Plugin Structure Restructure Implementation"
tags: ["implementation", "plugin", "documentation", "KISS"]
research: "thoughts/taras/research/2026-02-04-qa-use-plugin-structure.md"
---

# QA-Use Plugin Structure Restructure Implementation Plan

## Overview

Restructure the qa-use plugin to reduce cognitive load by cutting plugin commands from 12 to 6 (50% reduction), while enhancing documentation to support harnesses with only Bash tool access (codex, opencode). The restructure applies KISS principles by keeping only commands that represent unique AI-driven workflows, and documenting simple CLI wrappers in SKILL.md instead.

## Current State Analysis

**Plugin Structure:**
- 12 plugin commands in `plugins/qa-use/commands/`
- Mix of high-level workflows (verify, explore, record) and low-level wrappers (test-info, test-validate, test-diff)
- All commands invoke the `qa-use` skill
- Located at: `plugins/qa-use/commands/*.md`
- Configuration: `plugins/qa-use/.claude-plugin/plugin.json`

**Documentation:**
- README.md: `plugins/qa-use/README.md` (210 lines)
- SKILL.md: `plugins/qa-use/skills/qa-use/SKILL.md` (248 lines)
- Missing: Blocks concept prominence, tunnel mode decision tree, dual-path documentation

**Key Gaps Identified:**
- 6 commands are simple CLI wrappers with no AI workflow value
- SKILL.md doesn't explain that slash commands are "shortcuts" for CLI workflows
- Blocks concept buried in command reference (line 123 in SKILL.md)
- Tunnel mode documentation hidden in flags (line 221 in SKILL.md)
- No CI/CD integration patterns documented

## Desired End State

**Plugin Commands (6 total):**
1. `/qa-use:verify` - AI-first feature verification
2. `/qa-use:explore` - Autonomous exploration
3. `/qa-use:record` - Interactive recording with edit mode (merged from test-update)
4. `/qa-use:verify-pr` - PR-level verification
5. `/qa-use:test-run` - Test execution shortcut
6. `/qa-use:test-init` - Setup initialization

**Documentation:**
- SKILL.md: Workflow-first with dual-path (CLI + plugin) examples
- README.md: Enhanced with blocks concept and localhost testing guide
- All deprecated commands documented as CLI workflows in SKILL.md

**Verification:**
- `ls plugins/qa-use/commands/ | wc -l` returns 6 (plus .gitkeep)
- SKILL.md includes "Critical Insight" section on shortcuts
- README.md has "How qa-use Works" and "Testing Localhost Apps" sections

### Key Discoveries:

- **Commands are markdown files**: All 12 commands in `plugins/qa-use/commands/*.md` (verified via codebase-locator agent)
- **Plugin config location**: `plugins/qa-use/.claude-plugin/plugin.json` (not at plugin root)
- **SKILL.md structure**: 248 lines, command-reference heavy, missing workflow patterns
- **test-update is simple**: `plugins/qa-use/commands/test-update.md:1-31` shows minimal AI editing logic (31 lines)
- **record command structure**: `plugins/qa-use/commands/record.md:1-47` has start/stop pattern, can be extended

## Quick Verification Reference

Common commands to verify the implementation:
- `bun run check:fix` - Format, lint, and typecheck (MANDATORY after each phase)
- `ls plugins/qa-use/commands/ | wc -l` - Should show 7 files (6 commands + .gitkeep)
- `grep -r "test-validate" plugins/qa-use/` - Should only appear in SKILL.md after removal

Key files to check:
- `plugins/qa-use/commands/record.md` - Enhanced with edit mode
- `plugins/qa-use/skills/qa-use/SKILL.md` - Rewritten with dual-path docs
- `plugins/qa-use/README.md` - Updated with blocks and tunnel mode
- `plugins/qa-use/.claude-plugin/plugin.json` - Version bumped, description updated

## What We're NOT Doing

- **NOT modifying CLI commands** in `src/cli/commands/` (50+ commands stay unchanged)
- **NOT changing skill behavior** - only command structure and documentation
- **NOT removing functionality** - deprecated commands move to SKILL.md documentation
- **NOT touching agents** - 5 agent files in `plugins/qa-use/agents/` remain unchanged
- **NOT modifying templates** - 3 YAML templates in `plugins/qa-use/skills/qa-use/templates/` unchanged
- **NOT changing references** - 5 reference docs in `plugins/qa-use/skills/qa-use/references/` unchanged (will be referenced from new SKILL.md)

## Implementation Approach

**Sequential phases with verification:**
1. **Enhance record command** - Add edit mode documentation (merge test-update functionality)
2. **Rewrite SKILL.md** - Complete rewrite with dual-path documentation and blocks concept
3. **Update README.md** - Add missing sections (blocks, localhost testing, updated command table)
4. **Remove deprecated commands** - Delete 6 command files and update plugin.json to v3.0.0

**Why this order:**
- Enhance record first to document the edit mode that replaces test-update
- SKILL.md rewrite before README ensures consistency
- README update references new SKILL.md structure
- Remove deprecated commands last after all documentation is complete

---

## Phase 1: Enhance record command with edit mode

### Overview

Extend the `record` command documentation to support editing existing tests with AI assistance, merging functionality from `test-update`. The enhanced record command will support three modes: `start` (new recording), `edit` (AI-assisted editing), and `stop` (generate YAML).

### Changes Required:

#### 1. Update record command documentation

**File**: `plugins/qa-use/commands/record.md`

**Changes**:
- Add `edit <test-name>` mode to argument table
- Update "What Happens" section to describe three modes
- Add examples showing edit workflow
- Preserve existing start/stop functionality

**New structure:**
```markdown
## Arguments

| Argument | Description |
|----------|-------------|
| `start [name]` | Start recording with optional test name |
| `edit <test-name>` | AI-assisted editing of existing test |
| `stop` | Stop recording and generate test YAML |

## What Happens

### Recording Mode (start/stop)
1. **start**: Creates browser session, enters recording mode
2. **actions**: You perform browser commands, they're tracked
3. **stop**: Generates test YAML with variables and semantic descriptions

### Edit Mode (edit)
1. Loads existing test definition
2. Understands your desired changes
3. Applies modifications
4. Validates and saves with confirmation

## Examples

### Recording a new test
```
/qa-use:record start login-test
# ... perform browser actions ...
/qa-use:record stop
```

### Editing an existing test
```
/qa-use:record edit login-test
```

### Recording from Logged-In State

To record a test that assumes the user is already logged in, first create a session with `--after-test-id`:

```bash
# Create session that runs login test first
qa-use browser create --after-test-id <login-test-uuid>

# Then start recording from the authenticated state
/qa-use:record start dashboard-test
```
```

### Success Criteria:

#### Automated Verification:
- [ ] Code quality check passes: `bun run check:fix`
- [ ] record.md contains edit mode: `grep -q "edit <test-name>" plugins/qa-use/commands/record.md`
- [ ] record.md has three modes documented: `grep -c "Mode" plugins/qa-use/commands/record.md` returns at least 2

#### Manual Verification:
- [ ] `/qa-use:record edit <test-name>` command is documented clearly
- [ ] Original `/qa-use:record start/stop` functionality is preserved
- [ ] Examples show both recording and editing workflows

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Rewrite SKILL.md with dual-path documentation

### Overview

Complete rewrite of SKILL.md following the agent-browser pattern. Focus on workflow-first approach with dual-path documentation (CLI commands first, plugin shortcuts second). Elevate blocks concept to prominence and add CI/CD integration section.

This is the most critical phase - SKILL.md becomes the authoritative source for all harnesses.

### Changes Required:

#### 1. Rewrite SKILL.md structure

**File**: `plugins/qa-use/skills/qa-use/SKILL.md`

**New Structure** (complete replacement):

```markdown
---
name: qa-use
description: E2E testing and browser automation with qa-use CLI. Use when the user needs to run tests, verify features, automate browser interactions, or debug test failures.
allowed-tools: Bash(qa-use *)
---

# qa-use

E2E testing and browser automation for AI-driven development workflows.

## Critical Insight: Plugin Commands as Shortcuts

**For AI Harnesses (codex, opencode, etc.):**

Plugin commands (slash commands like `/qa-use:verify`) are **convenience shortcuts** that wrap CLI workflows. Harnesses with only the Bash tool can access ALL functionality via CLI commands documented below.

**Pattern throughout this document:**
- **CLI Workflow**: Step-by-step CLI commands (works for ALL harnesses)
- **Plugin Shortcut**: Optional slash command (convenience)

## Core Workflow

### 1. Browser Control & Session Lifecycle

**CLI Workflow:**
```bash
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
```

**Plugin Shortcut:**
```
/qa-use:explore https://example.com
```
(Wraps create + goto + snapshot with autonomous exploration)

**Critical:** Always run `snapshot` before interacting. Never guess element refs.

### 2. Understanding Blocks

**What are blocks?**

Blocks are atomic recorded interactions from a browser session. They are:
- Automatically captured during any browser interaction (click, fill, goto, scroll, etc.)
- Stored server-side with the session
- Retrieved via `qa-use browser get-blocks`
- The foundation for test generation

**Why blocks matter:**
- **Record-once, replay-many**: Interactive recording becomes automated test
- **AI-friendly**: Agents can analyze blocks to understand user intent
- **Version control**: Blocks stored with session enable test iteration
- **Bridge CLI → Tests**: Natural workflow from exploration to automation

**How blocks work:**

```bash
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
```

**Plugin Shortcut:**
```
/qa-use:record start my_test
# ... perform interactions ...
/qa-use:record stop
```
(Wraps the interactive workflow with AI-powered test generation)

### 3. Test Management

**CLI Workflow:**
```bash
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
```

**Plugin Shortcut:**
```
/qa-use:test-run login --autofix
```
(Convenience shortcut for common test execution)

### 4. Test Sync Lifecycle

**CLI Workflow:**
```bash
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
```

**No Plugin Shortcut** - Use CLI commands directly

## Essential Commands

[Continue with detailed command reference, maintaining dual-path pattern...]

### Browser Session Management

[Document all browser commands with CLI examples]

### Element Interaction

[Document all interaction commands]

### Test Operations

[Document test commands including validate, info, runs]

### Logs & Debugging

[Document log commands]

## Common Patterns

### Pattern 1: Feature Verification

**CLI Workflow:**
```bash
# 1. Search for existing test
qa-use test list | grep "login"

# 2. Run test with autofix
qa-use test run login --autofix

# 3. Debug failures
qa-use browser logs console
```

**Plugin Shortcut:**
```
/qa-use:verify "login works with valid credentials"
```
(Wraps the above CLI workflow with AI-powered test discovery and analysis)

### Pattern 2: Record & Generate Test

**CLI Workflow:**
```bash
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
```

**Plugin Shortcut:**
```
/qa-use:record start my_test
# ... perform interactions ...
/qa-use:record stop
```

### Pattern 3: Authenticated Exploration

**CLI Workflow:**
```bash
# Create session that runs login test first
qa-use browser create --after-test-id <login-test-uuid>

# Session now authenticated, explore
qa-use browser goto /dashboard
qa-use browser snapshot
```

**Plugin Shortcut:**
```
/qa-use:explore /dashboard
```
(Automatically handles auth detection and session creation)

### Pattern 4: Edit Existing Test

**CLI Workflow:**
```bash
# 1. Open test file in editor
vim qa-tests/login.yaml

# 2. Validate syntax
qa-use test validate login

# 3. Run to verify
qa-use test run login
```

**Plugin Shortcut:**
```
/qa-use:record edit login
```
(AI-assisted editing with validation)

## CI/CD Integration

### Running Tests in CI

**Environment Variables:**
```bash
export QA_USE_API_KEY="your-api-key"
export QA_USE_REGION="us"  # Optional: "us" or "auto"
```

**Basic Test Execution:**
```bash
# Run all tests
qa-use test run --all

# Run specific tag
qa-use test run --tag smoke

# Exit codes: 0 = pass, 1 = fail
```

### GitHub Actions Example

```yaml
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
          QA_USE_API_KEY: ${{ secrets.QA_USE_API_KEY }}
```

### Test Artifacts

**Screenshots:**
- Automatically saved on failure
- Location: `/tmp/qa-use/downloads/` (local) or cloud (remote)

**Logs:**
- Console logs: `qa-use browser logs console -s <session-id>`
- Network logs: `qa-use browser logs network -s <session-id>`

## Advanced Topics

### Localhost Testing (Tunnel Mode)

**When to use tunnel mode:**

```
Testing localhost (http://localhost:3000)?
  ├─ YES → Use --tunnel
  │   └─ qa-use browser create --tunnel [--no-headless]
  │       (Starts local Playwright, creates localtunnel, keeps running)
  │
  └─ NO (Public URL) → Use remote browser (default)
      └─ qa-use browser create
          (Uses desplega.ai cloud browser via WebSocket)
```

**The `--tunnel` flag is a binary choice:**
- **Local tunnel mode**: Playwright on your machine + localtunnel
- **Remote mode**: WebSocket URL to cloud-hosted browser

**For test execution:**
```bash
# Local app
qa-use test run my_test --tunnel [--headful]

# Public app
qa-use test run my_test
```

**Plugin shortcuts handle tunnel detection automatically:**
```
/qa-use:explore http://localhost:3000
/qa-use:record start local_test
```

See [references/localhost-testing.md](references/localhost-testing.md) for troubleshooting.

### Session Persistence

Sessions are stored in `~/.qa-use.json` and have:
- **TTL**: 30 minutes (default)
- **Auto-resolve**: One active session = no `-s` flag needed
- **Cleanup**: Automatic on timeout or explicit `browser close`

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
```bash
# Process 1: Create session
qa-use browser create --tunnel
# Output: ws://localhost:12345/browser/abc123

# Process 2: Connect to session
qa-use browser goto https://example.com --ws-url ws://localhost:12345/browser/abc123
```

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

```yaml
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
```

See [references/test-format.md](references/test-format.md) for complete specification.

## Common Mistakes

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| `browser navigate <url>` | `browser goto <url>` |
| `browser destroy` | `browser close` |
| `browser close <session-id>` | `browser close` |
| Guessing element refs | Always `snapshot` first |
| Testing localhost without `--tunnel` | Use `--tunnel` flag |

## npx Alternative

All commands use `qa-use` assuming global install. For one-off use:
```bash
npx @desplega.ai/qa-use browser <command>
```
```

**Key Changes:**
- Added "Critical Insight" section explaining shortcuts upfront
- Elevated "Understanding Blocks" to section 2 (was buried in commands)
- Every workflow shows CLI first, plugin second
- Added CI/CD Integration section with GitHub Actions example
- Moved Localhost Testing to Advanced Topics
- Added Session Persistence, Block Limitations, WebSocket Sessions
- Removed command proliferation - 5 deprecated commands now appear as CLI examples only

### Success Criteria:

#### Automated Verification:
- [ ] Code quality check passes: `bun run check:fix`
- [ ] SKILL.md contains "Critical Insight" section: `grep -q "Critical Insight" plugins/qa-use/skills/qa-use/SKILL.md`
- [ ] SKILL.md contains "Understanding Blocks" section: `grep -q "Understanding Blocks" plugins/qa-use/skills/qa-use/SKILL.md`
- [ ] SKILL.md contains "CI/CD Integration" section: `grep -q "CI/CD Integration" plugins/qa-use/skills/qa-use/SKILL.md`
- [ ] All patterns show dual-path: `grep -c "Plugin Shortcut:" plugins/qa-use/skills/qa-use/SKILL.md` returns at least 4

#### Manual Verification:
- [ ] SKILL.md reads naturally with workflow-first approach
- [ ] CLI commands are shown before plugin shortcuts in every section
- [ ] Blocks concept is explained clearly and prominently
- [ ] Tunnel mode decision tree is clear in Advanced Topics
- [ ] No references to deprecated commands (test-validate, test-sync, etc.) as slash commands

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 3. This is the most critical phase.

---

## Phase 3: Update README.md with blocks and localhost testing

### Overview

Enhance README.md to include missing conceptual sections ("How qa-use Works" explaining blocks, "Testing Localhost Apps" guide) and update the command table to reflect the new 6-command structure. Reference the new SKILL.md sections for deeper dives.

### Changes Required:

#### 1. Update README.md

**File**: `plugins/qa-use/README.md`

**Changes**:

**A. Update Commands Table (after line 59)**

Replace the existing commands table with:

```markdown
## Commands

| Command | Description |
|---------|-------------|
| `/qa-use:verify <description>` | Verify a feature works (THE main command) |
| `/qa-use:explore <url or goal>` | Explore a web page autonomously |
| `/qa-use:record [start\|stop\|edit] [name]` | Record browser actions or edit existing tests |
| `/qa-use:verify-pr` | Verify PR changes automatically |
| `/qa-use:test-init` | Initialize test directory |
| `/qa-use:test-run [name] [flags]` | Run E2E tests |

**Note:** Commands like `test-validate`, `test-sync`, `test-diff`, `test-info`, and `test-runs` are available via CLI. See [SKILL.md](skills/qa-use/SKILL.md) for complete CLI documentation.
```

**B. Add "How qa-use Works" Section (after Quick Start, before AI-First Workflow)**

```markdown
## How qa-use Works

### The Blocks Concept

qa-use uses **blocks** to bridge interactive exploration and automated testing:

1. **Automatic Recording**: Every browser interaction (click, fill, goto, scroll) is recorded as a "block"
2. **Session Storage**: Blocks are stored server-side with your browser session
3. **Test Generation**: Blocks can be converted into test YAML with `qa-use browser generate-test`
4. **AI Understanding**: Blocks enable AI agents to analyze your intent and suggest improvements

**Example:**
```bash
qa-use browser create --tunnel --no-headless
qa-use browser goto https://example.com
qa-use browser snapshot        # Get element refs
qa-use browser click e1        # Recorded as block
qa-use browser fill e5 "text"  # Recorded as block
qa-use browser get-blocks      # See recorded blocks
qa-use browser generate-test -n "my_test"  # Convert to YAML
```

See [Understanding Blocks](skills/qa-use/SKILL.md#2-understanding-blocks) in SKILL.md for details.
```

**C. Add "Testing Localhost Apps" Section (after Browser Automation section)**

```markdown
## Testing Localhost Apps

The cloud cannot access `localhost` URLs directly. qa-use provides **tunnel mode** to test local applications:

### Quick Decision Tree

```
Testing localhost (http://localhost:3000)?
  ├─ YES → Add --tunnel flag
  │   qa-use browser create --tunnel [--no-headless]
  │   qa-use test run my_test --tunnel
  │
  └─ NO (Public URL) → Use default (no flag)
      qa-use browser create
      qa-use test run my_test
```

### How Tunnel Mode Works

When you use `--tunnel`:
1. Playwright browser starts on **your machine** (not in cloud)
2. A localtunnel is created to proxy API requests
3. The browser stays running for your test session
4. Use `--no-headless` to see the browser window

### Examples

```bash
# Interactive session with local app
qa-use browser create --tunnel --no-headless
qa-use browser goto http://localhost:3000

# Run test against localhost
qa-use test run login --tunnel --headful

# Record test from localhost
/qa-use:record start local_test
# (tunnel mode auto-detected)
```

See [Localhost Testing](skills/qa-use/SKILL.md#localhost-testing-tunnel-mode) in SKILL.md for troubleshooting.
```

**D. Update Common Flags Section (line 74)**

Replace the paragraph starting with "Important: When testing localhost URLs..." with:

```markdown
> **Important:** Testing localhost? Use `--tunnel` flag! See [Testing Localhost Apps](#testing-localhost-apps) section above.
```

#### 2. Verify References

**Files to check**:
- Ensure all SKILL.md section links are correct
- Ensure template and reference links work

### Success Criteria:

#### Automated Verification:
- [ ] Code quality check passes: `bun run check:fix`
- [ ] README has 6 commands in table: `grep -c "^| \`/qa-use:" plugins/qa-use/README.md` returns 6
- [ ] README contains "How qa-use Works" section: `grep -q "How qa-use Works" plugins/qa-use/README.md`
- [ ] README contains "Testing Localhost Apps" section: `grep -q "Testing Localhost Apps" plugins/qa-use/README.md`
- [ ] README mentions "Understanding Blocks": `grep -q "Understanding Blocks" plugins/qa-use/README.md`

#### Manual Verification:
- [ ] Command table shows 6 commands with note about CLI commands
- [ ] "How qa-use Works" explains blocks clearly
- [ ] "Testing Localhost Apps" decision tree is clear
- [ ] All SKILL.md section links work
- [ ] Flow from README → SKILL.md is natural

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Remove deprecated commands and update plugin.json

### Overview

Remove the 6 deprecated command files (test-validate, test-sync, test-diff, test-info, test-runs, test-update) and update plugin.json version and description to reflect the restructure. This is the final cleanup phase.

### Changes Required:

#### 1. Remove deprecated command files

**Files to delete:**
- `plugins/qa-use/commands/test-validate.md`
- `plugins/qa-use/commands/test-sync.md`
- `plugins/qa-use/commands/test-diff.md`
- `plugins/qa-use/commands/test-info.md`
- `plugins/qa-use/commands/test-runs.md`
- `plugins/qa-use/commands/test-update.md`

**Command:**
```bash
rm plugins/qa-use/commands/test-validate.md \
   plugins/qa-use/commands/test-sync.md \
   plugins/qa-use/commands/test-diff.md \
   plugins/qa-use/commands/test-info.md \
   plugins/qa-use/commands/test-runs.md \
   plugins/qa-use/commands/test-update.md
```

#### 2. Update plugin.json

**File**: `plugins/qa-use/.claude-plugin/plugin.json`

**Changes**:
- Bump version from `2.7.0` to `3.0.0` (breaking change)
- Update description to reflect simplified command set

```json
{
  "name": "qa-use",
  "version": "3.0.0",
  "description": "Simplified CLI-integrated plugin for E2E testing with 6 essential commands. Provides AI-first feature verification, browser automation, and test management. All CLI operations documented in SKILL.md for harness compatibility.",
  "author": {
    "name": "desplega.ai",
    "email": "contact@desplega.ai",
    "url": "https://desplega.ai"
  },
  "homepage": "https://github.com/desplega-ai/qa-use",
  "repository": "https://github.com/desplega-ai/qa-use",
  "license": "MIT",
  "keywords": [
    "qa",
    "testing",
    "e2e",
    "playwright",
    "cli",
    "desplega.ai",
    "browser",
    "automation",
    "feature-verification",
    "KISS"
  ]
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Code quality check passes: `bun run check:fix`
- [ ] Only 6 command files remain: `ls plugins/qa-use/commands/*.md | wc -l` returns 6 (plus .gitkeep = 7 total files)
- [ ] No deprecated command files exist: `ls plugins/qa-use/commands/test-{validate,sync,diff,info,runs,update}.md 2>/dev/null | wc -l` returns 0
- [ ] plugin.json version is 3.0.0: `grep -q '"version": "3.0.0"' plugins/qa-use/.claude-plugin/plugin.json`
- [ ] plugin.json mentions KISS: `grep -q "KISS" plugins/qa-use/.claude-plugin/plugin.json`

#### Manual Verification:
- [ ] Remaining commands directory contains only: verify.md, explore.md, record.md, verify-pr.md, test-run.md, test-init.md, .gitkeep
- [ ] plugin.json description accurately reflects the simplified structure
- [ ] No references to removed commands exist in remaining files

**Implementation Note**: After completing this phase, the restructure is complete. Verify that all 4 phases have been completed successfully.

---

## Testing Strategy

### Unit Testing
- **Not applicable** - This is a documentation and structure change, no code logic to test

### Integration Testing
- Verify each remaining command still invokes the qa-use skill correctly
- Test that SKILL.md examples are copy-pastable and work
- Verify plugin loads correctly after removing commands

### Manual Testing Steps

**After Phase 1:**
1. Verify `/qa-use:record edit <test-name>` is documented
2. Confirm `/qa-use:record start/stop` documentation is preserved
3. Check that edit mode examples are clear

**After Phase 2:**
1. Read through new SKILL.md for flow and clarity
2. Verify all CLI examples are correct
3. Test a few copy-paste examples from SKILL.md
4. Confirm blocks concept is clear to someone new

**After Phase 3:**
1. Read README from top to bottom for flow
2. Verify command table shows 6 commands
3. Test all SKILL.md links from README
4. Confirm "How qa-use Works" explains blocks clearly

**After Phase 4:**
1. `ls plugins/qa-use/commands/` should show only 7 files (6 commands + .gitkeep)
2. Verify no broken references to removed commands
3. Test that plugin still loads correctly
4. Verify plugin.json version is 3.0.0

## References

- **Research document**: `thoughts/taras/research/2026-02-04-qa-use-plugin-structure.md`
- **agent-browser SKILL.md**: https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md
- **Current plugin structure**: `plugins/qa-use/`
- **Planning template**: `cc-plugin/base/skills/planning/template.md`
