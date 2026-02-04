---
date: 2026-02-04T17:00:00Z
topic: "QA-Use Plugin Structure Research - Extreme Rethink for Clarity"
tags: ["research", "plugin", "architecture", "KISS"]
---

# QA-Use Plugin Structure Research

**Focus:** Plugin commands structure rethink for clarity and KISS principle
**Scope:** Plugin commands only (NOT CLI commands)

## Context

The research focuses on analyzing the current plugin structure at `plugins/qa-use/` to propose an extreme rethink for clarity and simplicity. The goal is to:

1. Identify which commands are critical vs discoverable via `--help`
2. Determine what should be SKILL documentation vs commands
3. Apply KISS principle by removing non-essential commands
4. Ensure other harnesses (codex, opencode) can discover functionality via SKILL.md

**Reference:** [agent-browser SKILL.md](https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md)

## Current Plugin Command Structure

### Plugin Commands (12 total in `plugins/qa-use/commands/`)

**High-Level Workflows (3):**
- `verify.md` - AI-first feature verification (search test → explore → create → run)
- `explore.md` - Autonomous browser exploration
- `record.md` - Record browser actions into test YAML

**Test Management (9):**
- `test-init.md` - Initialize test directory
- `test-run.md` - Run E2E tests
- `test-validate.md` - Validate test syntax
- `test-sync.md` - Sync local ↔ cloud tests
- `test-diff.md` - Compare local vs cloud
- `test-info.md` - Show test details
- `test-runs.md` - List test run history
- `test-update.md` - AI-assisted test editing
- `verify-pr.md` - PR-level feature verification

## Key Findings

### 1. Current Command Proliferation

**Plugin Layer (12 commands):**
- All invoke the `qa-use` skill
- Mix of high-level workflows (`verify`, `explore`, `record`) and low-level wrappers (`test-info`, `test-validate`, `test-diff`)

**CLI Layer (50+ commands - NOT changing):**
- `browser/*` (35 commands) - session, navigation, interaction, inspection
- `test/*` (12 commands) - management, sync, execution
- Root (5 commands) - setup, info, mcp, install-deps, update

### 2. Command Categories Analysis

#### **CRITICAL PLUGIN COMMANDS (Must Keep)**

These represent unique AI-driven workflows that warrant slash commands:

1. **`verify`** - THE main workflow (search → explore → create → run → report)
2. **`explore`** - Autonomous page exploration with reporting
3. **`record`** - Interactive test recording workflow
4. **`verify-pr`** - PR-level automated verification
5. **`test-run`** - Test execution (common enough to warrant shortcut)
6. **`test-init`** - Setup workflow (common first-time experience)

#### **DISCOVERABLE VIA SKILL.MD (Should Remove as Commands)**

These are simple wrappers around CLI commands with no added AI workflow:

- `test-validate` → `qa-use test validate` (simple wrapper)
- `test-sync` → `qa-use test sync --pull|--push` (simple wrapper)
- `test-diff` → `qa-use test diff` (simple wrapper)
- `test-info` → `qa-use test info` (simple wrapper)
- `test-runs` → `qa-use test runs` (simple wrapper)
- `test-update` → Should this be integrated into `record`/`verify`?

### 3. SKILL.md Should Document

Based on the agent-browser reference, SKILL.md should focus on:

#### **Core Workflow Pattern** (THE MOST IMPORTANT):

```markdown
## Core Workflow

1. **Browser Control & Session Lifecycle**
   - Create session: `qa-use browser create [--tunnel]`
   - Navigate: `qa-use browser goto <url>`
   - Snapshot: `qa-use browser snapshot` (ARIA tree with refs)
   - Interact: `qa-use browser click/fill/etc`
   - Close: `qa-use browser close`

2. **Getting Blocks from Browser Sessions**
   - What are blocks? Recorded interactions (click, fill, etc)
   - How to retrieve: `qa-use browser get-blocks`
   - Auto-recorded during any browser interaction
   - Foundation for test generation

3. **Test Management & Blocks Integration**
   - Generate from blocks: `qa-use browser generate-test -n "name"`
   - Run tests: `qa-use test run <name> [--tunnel]`
   - Validate syntax: `qa-use test validate <name>`
   - Inspect details: `qa-use test info <name>`

4. **Test Sync Lifecycle (export → sync push/pull)**
   - Export test from session: `qa-use browser generate-test`
   - Push to cloud: `qa-use test sync push [--id <uuid>|--all]`
   - Pull from cloud: `qa-use test sync pull [--id <uuid>]`
   - Compare versions: `qa-use test diff <file>`

5. **Running Tests & Debugging**
   - Local execution: `qa-use test run <name>`
   - Cloud execution: `qa-use test run --id <uuid>`
   - Debug failures: `qa-use browser logs console|network`
   - Visual inspection: `qa-use browser screenshot`

6. **Tunnel Mode (Localhost Testing)**
   - When needed: Testing `localhost:*` URLs
   - How to use: `--tunnel` flag creates local browser + API tunnel
   - Session creation: `qa-use browser create --tunnel [--no-headless]`
   - Test execution: `qa-use test run <name> --tunnel`
```

#### **Common Patterns to Document**:
- Login flow with session recording
- Multi-step forms with blocks
- Authenticated page exploration (--after-test-id)
- Data extraction with variables
- Conditional waits and assertions

### 4. Critical Concept: BLOCKS

**This is currently UNDER-DOCUMENTED and is the KEY differentiator:**

#### What are blocks?
- Atomic recorded interactions from a browser session
- Captured automatically during interaction (click, fill, goto, scroll, etc)
- Each action = 1 block
- Stored server-side with session
- Retrieved via `qa-use browser get-blocks`

#### How blocks integrate with tests:

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

#### Why this matters:
- **Record-once, replay-many**: Interactive recording becomes automated test
- **AI-friendly**: Agents can analyze blocks to understand user intent
- **Version control**: Blocks stored with session enable test iteration
- **Bridge CLI → Tests**: Natural workflow from exploration to automation

### 5. Tunnel vs Remote Decision Tree

Currently not clearly documented:

```
Testing localhost (http://localhost:3000)?
  ├─ YES → Use --tunnel
  │   └─ qa-use browser create --tunnel [--no-headless]
  │       (Starts local Playwright, creates localtunnel, keeps running)
  │
  └─ NO (Public URL) → Use remote browser (default)
      └─ qa-use browser create
          (Uses desplega.ai cloud browser via WebSocket)

For running tests:
  ├─ Local app → qa-use test run <name> --tunnel [--headful]
  └─ Public app → qa-use test run <name>
```

**Key insight:** The `--tunnel` flag is a binary choice between:
- **Local tunnel mode**: Playwright on your machine + localtunnel
- **Remote mode**: WebSocket URL to cloud-hosted browser

### 6. Documentation Gaps

**In plugins/qa-use/README.md:**
- ✓ Quick start is good
- ✓ Command tables exist
- ✗ No explanation of "blocks" concept
- ✗ No tunnel vs remote decision guidance
- ✗ No snapshot/ref explanation for new users
- ✗ Examples don't show block recording workflow

**In plugins/qa-use/skills/qa-use/SKILL.md:**
- ✓ Comprehensive browser command reference
- ✓ Test format overview
- ✗ Block concept buried in `get-blocks` command
- ✗ Tunnel mode hidden in options, not in workflow
- ✗ Missing: "How to go from exploration → blocks → test → sync"

**Missing Entirely:**
- Tunnel mode troubleshooting guide
- Session state management details (how long they live, auto-resolve)
- Block recording limitations (what's captured, what isn't)
- Export vs sync relationship (export deprecated?)

## Critical Insight: Plugin Commands as "Shortcuts"

Based on Taras's feedback, plugin commands (slash commands) are **shortcuts** for CLI workflows. This means:

### For Harnesses with Only Bash Tool (codex, opencode)

- They can only execute CLI commands: `qa-use browser create`, `qa-use test run`, etc.
- They read SKILL.md to discover available operations
- They **need to know** that slash commands exist as convenience shortcuts

### SKILL.md Must Document Both Paths

For EVERY workflow, document:

1. **CLI Path** (what harnesses use):
   ```bash
   qa-use browser create
   qa-use browser goto https://example.com
   qa-use browser snapshot
   ```

2. **Plugin Shortcut** (optional, if available):
   ```
   Or use: /qa-use:explore https://example.com
   ```

### Example Pattern in SKILL.md

```markdown
## Feature Verification

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
```

This ensures harnesses without plugin support can still discover and use all functionality via CLI.

## Proposed Restructure

### Minimal Plugin Command Set (6 commands)

**Keep as Slash Commands:**

1. **`/qa-use:verify <description>`** - AI-first feature verification
   - THE main workflow (90% of use cases)
   - Wraps: search test → explore → create → run → analyze failure

2. **`/qa-use:explore <url or goal>`** - Autonomous exploration
   - Unique workflow: navigate → analyze → report elements
   - Not replaceable by simple CLI wrapper

3. **`/qa-use:record [start|stop] [name]`** - Interactive recording
   - Stateful workflow: start → interact → stop → generate
   - Wraps multiple CLI commands with state management

4. **`/qa-use:verify-pr`** - PR-level verification
   - High-level: analyze diff → identify tests → run → report
   - Unique multi-step AI workflow

5. **`/qa-use:test-run [name] [flags]`** - Test execution
   - Common enough to warrant shortcut
   - Frequently used in AI → test → debug loops

6. **`/qa-use:test-init`** - Setup initialization
   - First-time user experience
   - Creates directory structure + example

**Remove as Commands (Document in SKILL.md instead):**

- `test-validate` → Document as `qa-use test validate`
- `test-sync` → Document sync workflow: `qa-use test sync pull|push`
- `test-diff` → Document as `qa-use test diff <file>`
- `test-info` → Document as `qa-use test info <name>`
- `test-runs` → Document as `qa-use test runs [--status failed]`

**Merge into Existing Commands:**

- `test-update` → **MERGE into `record` command**
  - Add AI-assisted editing to recording workflow
  - `/qa-use:record edit <test-name>` for updating existing tests

### Enhanced SKILL.md Structure

```markdown
# qa-use

E2E testing and browser automation for AI-driven development workflows.

## Core Workflow

### 1. Browser Control
[Session lifecycle, navigation, snapshot, interaction basics]
[Show BOTH: CLI commands AND plugin shortcuts where available]

### 2. Understanding Blocks
[What they are, how they're captured, why they matter]

### 3. Test Management
[Generate from blocks, run tests, validate, debug]

### 4. Test Sync Lifecycle
[Export → push to cloud → pull from cloud → diff]

## Essential Commands

**Pattern for EVERY command:**
- CLI usage (for all harnesses)
- Plugin shortcut (if available)
- Examples showing both approaches

### Browser Session Management
[create, list, status, close with flags and examples]
Plugin: `/qa-use:explore` (wraps create + goto + snapshot)

### Element Interaction
[goto, snapshot, click, fill, get-blocks, generate-test]
Plugin: `/qa-use:record` (wraps interactive workflow)

### Test Operations
[run, validate, info, runs with flags and examples]
Plugin: `/qa-use:test-run` (shortcut for common case)

### Test Sync
[sync push, sync pull, diff with version handling]
No plugin (document CLI only)

### Logs & Debugging
[logs console, logs network, screenshot]
No plugin (document CLI only)

## Common Patterns

### Pattern 1: Record & Generate Test
**CLI:** [Step-by-step CLI commands]
**Plugin:** `/qa-use:record start` → interact → `/qa-use:record stop`

### Pattern 2: Feature Verification
**CLI:** [test list, test run, logs, analysis steps]
**Plugin:** `/qa-use:verify "feature description"`

### Pattern 3: Authenticated Exploration
**CLI:** [create with --after-test-id, goto, snapshot workflow]
**Plugin:** `/qa-use:explore` (auto-detects auth needs)

### Pattern 4: Multi-Step Form
[Snapshot → fill multiple fields → submit → assert]
CLI only (show commands)

## CI/CD Integration

### Running Tests in CI
[Environment variables, --headless flag, exit codes]

### GitHub Actions Example
[YAML workflow showing test execution]

### Test Artifacts
[Screenshots, logs, recordings in CI]

## Advanced Topics

### Localhost Testing (Tunnel Mode)
[When to use, decision tree, troubleshooting]
Plugin: Both `/qa-use:explore` and `/qa-use:record` auto-detect localhost

### Session Persistence
[Auto-resolve, local storage, timeout behavior]

### Block Limitations
[What's captured, what isn't, manual editing]

### WebSocket Sessions
[--ws-url flag, sharing sessions across processes]
```

## Critical Recommendations

### 1. Simplify Plugin Commands (6 instead of 12)

**Action:** Remove 6 commands as slash commands, document in SKILL.md instead

**Why:**
- Reduces cognitive load for users
- KISS principle: Commands should represent workflows, not CLI wrappers
- Other harnesses (codex, opencode) can read SKILL.md for all CLI operations

**Commands to Remove:**
- test-validate (→ SKILL.md: `qa-use test validate`)
- test-sync (→ SKILL.md: sync push/pull workflow)
- test-diff (→ SKILL.md: `qa-use test diff`)
- test-info (→ SKILL.md: `qa-use test info`)
- test-runs (→ SKILL.md: `qa-use test runs`)
- test-update (→ evaluate: merge into record or remove)

### 2. Elevate "Blocks" Concept

**Action:** Make blocks a first-class concept in all documentation

**Why:**
- Currently buried in `get-blocks` help text
- THE KEY differentiator vs other browser automation
- Natural bridge between exploration → testing
- Enables AI to understand recorded intent

**Where to Add:**
- README.md: "How qa-use Works" section explaining blocks
- SKILL.md: Dedicated "Understanding Blocks" section
- Quick Start: Show blocks in record → generate workflow
- Examples: Add block-based test generation examples

### 3. Clarify Tunnel Mode

**Action:** Create decision tree and troubleshooting guide

**Why:**
- Currently hidden in `--tunnel` flag
- Critical for localhost testing (very common use case)
- Confusing for new users (when to use, how it works)
- Different behavior (local vs remote browser)

**Where to Add:**
- README.md: "Testing Localhost Apps" section
- SKILL.md: Dedicated "Localhost Testing (Tunnel Mode)" section
- Quick Start: Show both remote and tunnel examples
- Commands: Add decision tree to `browser create` help

### 4. Document Test Sync Lifecycle

**Action:** Create comprehensive sync workflow guide

**Why:**
- Currently spread across sync, export, diff commands
- Confusing relationship between commands
- Version tracking (version_hash) not explained
- Conflict resolution unclear

**Where to Add:**
- SKILL.md: "Test Sync Lifecycle" section with diagrams
- Examples: Show full workflow from local → cloud → team member
- Commands: Explain sync push/pull in relation to export

### 5. Restructure SKILL.md

**Action:** Follow agent-browser pattern with workflow-first approach

**Why:**
- Current SKILL.md is command-reference heavy
- Missing: conceptual understanding (blocks, tunnel, sessions)
- New users need workflow patterns, not command lists
- Other harnesses need to understand the full cycle

**Structure:**
1. Core Workflow (THE most important section)
2. Essential Commands (with context)
3. Common Patterns (with examples)
4. Localhost Testing (dedicated section)
5. Test Format Reference (link to deep-dive)
6. Advanced Topics (session management, blocks limitations)

## Questions for Taras - ANSWERED

1. **test-update command**: ✅ **MERGE into `record`**
   - Integrate AI-assisted editing into the recording workflow

2. **SKILL.md focus**: ✅ **Mention CI/CD patterns**
   - Include section on how tests work in CI environments
   - Document common CI patterns (GitHub Actions, etc.)

3. **Tunnel mode prominence**: ✅ **Advanced Topics section**
   - Not in Core Workflow (edge case for localhost development)
   - Dedicated section with decision tree and troubleshooting

4. **Agent harness assumptions**: ✅ **Only Bash tool available**
   - Harnesses like codex/opencode only have Bash
   - **CRITICAL**: Plugin commands must reference their CLI equivalents in SKILL.md
   - Users with only SKILL.md need to know the "shortcuts" (slash commands) map to CLI commands
   - Example: `/qa-use:test-run` → `Bash: qa-use test run`

## Implementation Plan

### Phase 1: Merge test-update into record (2-3 days)

1. Update `record` command to support editing mode:
   - `/qa-use:record start <name>` - Start new recording
   - `/qa-use:record edit <name>` - AI-assisted editing of existing test
   - `/qa-use:record stop` - Stop and generate YAML
2. Implement AI-powered test editing in record workflow
3. Add deprecation notice to `test-update` command

### Phase 2: Deprecate Non-Essential Commands (1 day)

1. Add deprecation warnings to 5 commands:
   - test-validate, test-sync, test-diff, test-info, test-runs
2. Update README.md to point to SKILL.md for these operations
3. Keep commands functional with deprecation notice

### Phase 3: Enhance SKILL.md (4-5 days)

**Critical:** Every command must show BOTH CLI and plugin paths

1. Add "Critical Insight" section explaining shortcuts
2. Add "Understanding Blocks" section (prominently)
3. Restructure to workflow-first with dual-path examples:
   - Show CLI commands first (for Bash-only harnesses)
   - Show plugin shortcuts second (convenience)
4. Add "CI/CD Integration" section
5. Move "Localhost Testing (Tunnel Mode)" to Advanced Topics
6. Add comprehensive examples for each pattern (both CLI + plugin)

### Phase 4: Update Documentation (2-3 days)

1. README.md: Add "How qa-use Works" with blocks explanation
2. README.md: Add "Testing Localhost Apps" quick guide
3. Update Quick Start to show both CLI and plugin approaches
4. Add decision trees (tunnel mode, test sync)
5. Ensure all examples show CLI path + optional plugin shortcut

### Phase 5: Remove Deprecated Commands (after 2 weeks)

1. Remove 5 deprecated command files (keep test-update merged)
2. Update plugin.json
3. Final SKILL.md polish
4. Announce changes

## Success Metrics

- **Reduced cognitive load**: 6 commands instead of 12 (50% reduction)
- **Clear workflows**: Blocks concept prominently documented
- **Tunnel clarity**: Users know when/how to use tunnel mode
- **Agent-friendly**: Other harnesses can discover via SKILL.md
- **KISS achieved**: Commands represent workflows, not CLI wrappers

## References

- [agent-browser SKILL.md](https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md) - Reference structure
- Current plugin README: `/plugins/qa-use/README.md`
- Current SKILL.md: `/plugins/qa-use/skills/qa-use/SKILL.md`
- CLI command implementations: `/src/cli/commands/`

---

## Final Decisions Summary

### ✅ APPROVED CHANGES

1. **Plugin Commands: 12 → 6** (50% reduction)
   - Keep: verify, explore, record (enhanced), verify-pr, test-run, test-init
   - Remove: test-validate, test-sync, test-diff, test-info, test-runs
   - Merge: test-update → record (add edit mode)

2. **test-update Integration**
   - `/qa-use:record start <name>` - New recording
   - `/qa-use:record edit <name>` - AI-assisted editing (merged from test-update)
   - `/qa-use:record stop` - Generate YAML

3. **SKILL.md Structure**
   - **Dual-path documentation**: CLI first, plugin shortcuts second
   - **Blocks concept**: Prominent, dedicated section
   - **Tunnel mode**: Advanced Topics (not core workflow)
   - **CI/CD section**: Added with GitHub Actions example

4. **Critical Pattern for All Commands**
   ```markdown
   ## Feature Verification

   **CLI Workflow** (for all harnesses):
   ```bash
   qa-use test run <name> --autofix
   qa-use browser logs console
   ```

   **Plugin Shortcut** (optional):
   ```
   /qa-use:verify "feature description"
   ```
   ```

5. **Agent Harness Support**
   - Assume only Bash tool available (codex, opencode)
   - All functionality discoverable via CLI commands in SKILL.md
   - Plugin commands are "shortcuts" that wrap CLI workflows

### 📋 NEXT STEPS

1. Implement test-update merge into record command
2. Add deprecation notices to 5 commands
3. Rewrite SKILL.md with dual-path documentation
4. Update all examples to show CLI + plugin approaches
5. Add CI/CD integration section
6. Move tunnel mode to Advanced Topics

---

**Research complete.** Approved by Taras. Ready for implementation.
