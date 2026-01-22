---
date: 2026-01-22
topic: "qa-use Plugin v2 Redesign"
status: draft
author: Claude (Opus 4.5)
related_research: thoughts/taras/research/2026-01-22-qa-use-plugin-v2-redesign.md
---

# qa-use Plugin v2 Redesign Implementation Plan

## Overview

Restructure the qa-use plugin from v0.1.1 to v2.0.0, transitioning from an MCP-centric approach to a CLI-wrapping architecture. The v2 plugin will follow a **Commands → Skills → Agents** hierarchy (inspired by ai-toolbox/desplega plugin), guiding users through `npx @desplega.ai/qa-use test ...` CLI workflows rather than direct MCP tool invocation.

Additionally, this plan includes a CLI enhancement to support an `env:` block in `.qa-use-tests.json` for unified configuration.

## Current State Analysis

**Plugin v0.1.1 Structure:**
- 2 skills: `qa-changes` (suggest tests from code changes), `run-qa-regression` (run tests via MCP)
- 1 agent: `qa-expert` (generic QA engineer)
- No commands (slash commands)
- MCP-centric approach assumes tools are available
- No guidance on CLI usage
- Incomplete README with placeholders

**CLI v2 Test Command:**
- 6 subcommands: `init`, `validate`, `run`, `list`, `export`, `sync`
- Comprehensive flags for test execution
- YAML/JSON test definition format with 80+ actions
- Config via `.qa-use-tests.json` (no `env:` block support)

### Key Discoveries:
- Plugin manifest: `plugins/qa-use/.claude-plugin/plugin.json:1-20`
- Current agent: `plugins/qa-use/agents/qa-expert.md:1-10`
- CLI test command entry: `src/cli/commands/test/index.ts:13-21`
- Config interface: `src/cli/lib/config.ts:9-20`
- Config loading: `src/cli/lib/config.ts:62-96`

## Desired End State

**Plugin v2.0.0 with:**
1. 5 commands wrapping CLI test subcommands (test-init, test-run, test-validate, test-sync, test-update)
2. 3 core skills (test-running, test-authoring, test-debugging) with templates
3. 2 specialized agents (test-analyzer, step-generator)
4. Updated plugin.json to v2.0.0
5. Complete README with usage documentation

**CLI Enhancement:**
- `env:` block support in `.qa-use-tests.json` for environment variable definitions
- Priority order: Shell env vars > Config `env:` block > Direct config fields > Defaults

## Quick Verification Reference

Common commands to verify the implementation:
- `bun typecheck` - TypeScript type checking
- `bun lint` - ESLint checking
- `bun test` - Run test suite
- `bun build` - Build TypeScript

Key files to check:
- `src/cli/lib/config.ts` - Config system with env: block
- `plugins/qa-use/.claude-plugin/plugin.json` - Plugin manifest
- `plugins/qa-use/commands/` - Command definitions
- `plugins/qa-use/skills/` - Skill definitions
- `plugins/qa-use/agents/` - Agent definitions

## What We're NOT Doing

1. **Not changing MCP server tools** - The MCP tools remain unchanged; we're adding CLI-wrapping commands as an alternative interface
2. **Not removing MCP functionality** - Existing MCP tools continue to work
3. **Not creating hooks** - Hooks directory remains placeholder (future enhancement)
4. **Not adding tests for plugin markdown files** - Plugin files are prompt templates, not testable code
5. **Not implementing test-list command** - The `test-run` command with `--all` covers this use case; `list` is informational and can be done via CLI directly

## Implementation Approach

**Phase 1 (CLI):** Add `env:` block support to config first, as it benefits all users immediately.

**Phases 2-5 (Plugin):** Progressively build the plugin structure:
- Phase 2 scaffolds the directory structure
- Phase 3 creates the core skills that commands will invoke
- Phase 4 creates the commands that users interact with
- Phase 5 adds specialized agents for complex tasks

**Phase 6 (Cleanup):** Documentation and removal of obsolete content.

---

## Phase 1: CLI Enhancement - env: Block Support

### Overview
Add `env:` block support to `.qa-use-tests.json` configuration file, allowing users to define environment variables in a single config file rather than managing shell environment separately.

### Changes Required:

#### 1. Update CliConfig Interface
**File**: `src/cli/lib/config.ts`
**Changes**: Add `env?: Record<string, string>` field to the `CliConfig` interface (around line 10).

```typescript
export interface CliConfig {
  env?: Record<string, string>;  // NEW: Environment variable definitions
  api_key?: string;
  api_url?: string;
  default_app_config_id?: string;
  test_directory?: string;
  defaults?: {
    headless?: boolean;
    persist?: boolean;
    timeout?: number;
    allow_fix?: boolean;
  };
}
```

#### 2. Apply env: Block in loadConfig()
**File**: `src/cli/lib/config.ts`
**Changes**: After loading the config file (around line 84), apply `env` block values to `process.env` before the existing environment override logic.

```typescript
// Apply env block from config (after file merge, before env override)
if (config.env) {
  for (const [key, value] of Object.entries(config.env)) {
    if (!process.env[key]) {  // Don't override existing shell env vars
      process.env[key] = value;
    }
  }
}

// Existing: Environment variables override config file
if (process.env.QA_USE_API_KEY) {
  config.api_key = process.env.QA_USE_API_KEY;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `bun typecheck`
- [x] Linting passes: `bun lint`
- [x] Existing tests pass: `bun test` (2 pre-existing integration test failures unrelated to config changes)

#### Manual Verification:
- [ ] Create a `.qa-use-tests.json` with `"env": { "QA_USE_API_KEY": "test-key" }` and verify the CLI picks it up
- [ ] Verify shell env vars still override config env block
- [ ] Verify existing config fields (`api_key`, `api_url`) still work

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to plugin restructure.

---

## Phase 2: Plugin Scaffolding

### Overview
Create the new plugin directory structure with `commands/` folder, update `plugin.json` to v2.0.0, and establish the foundation for the new architecture.

### Changes Required:

#### 1. Create Commands Directory
**Directory**: `plugins/qa-use/commands/`
**Changes**: Create the directory with a `.gitkeep` placeholder.

#### 2. Update Plugin Manifest
**File**: `plugins/qa-use/.claude-plugin/plugin.json`
**Changes**: Update version to `2.0.0`, update description, fix homepage URL.

```json
{
  "name": "qa-use",
  "version": "2.0.0",
  "description": "CLI-integrated plugin for E2E testing with qa-use. Provides slash commands, skills, and specialized agents for test authoring, execution, and debugging.",
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
    "desplega.ai"
  ]
}
```

#### 3. Create Skills Directory Structure
**Directories**:
- `plugins/qa-use/skills/test-running/`
- `plugins/qa-use/skills/test-authoring/`
- `plugins/qa-use/skills/test-debugging/`

### Success Criteria:

#### Automated Verification:
- [x] Directory structure exists: `ls -la plugins/qa-use/commands/ plugins/qa-use/skills/test-running/ plugins/qa-use/skills/test-authoring/ plugins/qa-use/skills/test-debugging/`
- [x] plugin.json is valid JSON: `cat plugins/qa-use/.claude-plugin/plugin.json | jq .`

#### Manual Verification:
- [ ] Plugin version shows as 2.0.0 in manifest
- [ ] Directory structure matches the proposed layout from research

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 3: Core Skills

### Overview
Create the three core skills that commands will invoke: `test-running`, `test-authoring`, and `test-debugging`. Each skill includes a `SKILL.md` and optionally a `template.md`.

### Changes Required:

#### 1. test-running Skill
**File**: `plugins/qa-use/skills/test-running/SKILL.md`
**Purpose**: Orchestrate test execution workflow via CLI

```markdown
---
name: test-running
description: Execute E2E tests using the qa-use CLI with real-time progress monitoring
---

# Test Running

This skill orchestrates the execution of E2E tests using the `qa-use` CLI (`npx @desplega.ai/qa-use test run`).

## Critical Constraints

- ALWAYS check for `.qa-use-tests.json` config before running tests
- ALWAYS validate test syntax before execution (unless user explicitly skips)
- NEVER assume tests exist - verify via `npx @desplega.ai/qa-use test list`
- If test fails and `--autofix` was not used, explain the failure and suggest `--autofix`
- If AI auto-fix succeeds, suggest `--update-local` to persist changes

## Workflow

1. **Prerequisites Check**
   - Verify `.qa-use-tests.json` exists (offer to create via `/qa-use:test-init` if missing)
   - Verify test directory exists
   - Verify the specified test exists

2. **Construct CLI Command**
   - Base: `npx @desplega.ai/qa-use test run <name>`
   - Add user-specified flags: `--headful`, `--autofix`, `--screenshots`, etc.
   - Add variable overrides via `--var key=value`

3. **Execute Test**
   - Run via Bash tool
   - Monitor output for SSE progress events
   - Parse results (passed/failed/skipped)

4. **Report Results**
   - Summarize step results with pass/fail counts
   - If screenshots captured, provide asset URLs
   - If test failed, invoke `test-debugging` skill for analysis

5. **Suggest Next Actions**
   - On success: suggest `--persist` to save to cloud
   - On failure with autofix: suggest `--update-local`
   - On failure without autofix: suggest `--autofix --update-local`

## CLI Reference

\`\`\`bash
# Basic run
npx @desplega.ai/qa-use test run <name>

# With options
npx @desplega.ai/qa-use test run <name> --headful --autofix --update-local

# Run all tests
npx @desplega.ai/qa-use test run --all

# With variable overrides
npx @desplega.ai/qa-use test run <name> --var email=test@example.com --var password=secret
\`\`\`
```

#### 2. test-authoring Skill
**File**: `plugins/qa-use/skills/test-authoring/SKILL.md`
**Purpose**: Create and edit test definitions

```markdown
---
name: test-authoring
description: Create and edit E2E test definitions in YAML format for qa-use
---

# Test Authoring

This skill helps users create and edit E2E test definitions in YAML format compatible with the qa-use CLI.

## Critical Constraints

- ALWAYS validate YAML syntax before saving
- ALWAYS preserve user's existing variable definitions when editing
- NEVER overwrite test files without explicit confirmation
- Use simple step format by default (action/target/value), not extended format
- Keep test definitions human-readable with descriptive step names

## Workflow

### Creating a New Test

1. **Understand Intent**
   - Ask what the user wants to test (login flow, form submission, etc.)
   - Identify the starting URL and target elements
   - Clarify expected outcomes/assertions

2. **Load Template**
   - Start from the basic test structure:
   \`\`\`yaml
   name: Test Name
   app_config: <app-config-id>
   variables:
     key: value
   steps:
     - action: goto
       url: /path
   \`\`\`

3. **Generate Steps**
   - Use simple step format (action/target/value)
   - For complex element identification, spawn `step-generator` agent
   - Add assertions after key interactions

4. **Add Variables**
   - Extract repeated values (emails, passwords, URLs) to variables
   - Use `$variable_name` syntax in step values

5. **Write File**
   - Save to `qa-tests/<name>.yaml`
   - Offer to validate via `npx @desplega.ai/qa-use test validate <name>`

### Editing an Existing Test

1. **Read Current Test**
   - Load the test definition from file
   - Understand existing steps and variables

2. **Understand Changes**
   - What steps to add/modify/remove?
   - Any new variables needed?
   - Any dependency changes?

3. **Apply Changes**
   - Modify the test definition
   - Preserve user's existing variable values
   - Confirm changes before writing

4. **Validate**
   - Run `npx @desplega.ai/qa-use test validate <name>`
   - Fix any validation errors

## Test Definition Format

\`\`\`yaml
name: Login Test
app_config: your-app-config-id
variables:
  email: test@example.com
  password: secret123
depends_on: setup-test  # Optional dependency
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

## Common Actions

| Action | Description | Example |
|--------|-------------|---------|
| `goto` | Navigate to URL | `action: goto, url: /login` |
| `fill` | Fill input field | `action: fill, target: email input, value: $email` |
| `click` | Click element | `action: click, target: submit button` |
| `to_be_visible` | Assert visible | `action: to_be_visible, target: success message` |
| `wait_for_url` | Wait for URL | `action: wait_for_url, url: /dashboard` |
| `ai_action` | AI-powered action | `action: ai_action, value: scroll to the pricing section` |
| `ai_assertion` | AI-powered assertion | `action: ai_assertion, value: verify cart shows 3 items` |
```

**File**: `plugins/qa-use/skills/test-authoring/template.md`
**Purpose**: Template for test definitions

```markdown
# Test Definition Template

\`\`\`yaml
name: <Test Name>
app_config: <app-config-id or use default from .qa-use-tests.json>
variables:
  <variable_name>: <default_value>
depends_on: <optional-dependency-test-name>
steps:
  # Navigation
  - action: goto
    url: <starting-path>

  # Interactions (fill, click, hover, etc.)
  - action: fill
    target: <human-readable element description>
    value: $<variable>

  - action: click
    target: <human-readable element description>

  # Assertions
  - action: to_be_visible
    target: <expected element>

  # AI-powered actions (when human-readable selectors are insufficient)
  - action: ai_action
    value: <natural language instruction>

  - action: ai_assertion
    value: <natural language verification>
\`\`\`

## Variable Syntax

Use `$variable_name` to reference variables:
- `value: $email` → Uses the `email` variable
- `url: /users/$user_id` → Interpolates `user_id` in URL

## Dependencies

Use `depends_on` to run prerequisite tests first:
- `depends_on: setup-user` → Runs `setup-user.yaml` before this test
- Dependencies are resolved recursively
```

#### 3. test-debugging Skill
**File**: `plugins/qa-use/skills/test-debugging/SKILL.md`
**Purpose**: Analyze failures and suggest fixes

```markdown
---
name: test-debugging
description: Analyze E2E test failures and suggest fixes for qa-use tests
---

# Test Debugging

This skill analyzes E2E test failures from qa-use and suggests actionable fixes.

## Critical Constraints

- Focus on ACTIONABLE fixes, not generic advice
- Distinguish between selector issues vs application changes vs timing issues
- NEVER modify tests without explicit user approval
- Always explain WHY a test failed before suggesting fixes
- Prefer `--autofix --update-local` when appropriate

## Workflow

1. **Collect Failure Information**
   - Parse the SSE log output for failure details
   - Identify which step failed and the error type
   - Check for screenshots if available

2. **Classify Failure Type**
   - **Selector not found**: Element changed or locator is too brittle
   - **Assertion failed**: Expected state differs from actual
   - **Timeout**: Element took too long to appear/become interactive
   - **Navigation error**: URL changed or redirect occurred
   - **JavaScript error**: Application threw an error

3. **Analyze Root Cause**
   - For selector issues: Check if element exists with different attributes
   - For assertions: Compare expected vs actual values
   - For timeouts: Check if element appears with different timing
   - Spawn `test-analyzer` agent for complex analysis

4. **Suggest Fixes**
   Based on failure type:

   **Selector Issues:**
   - Update the target description to be more specific
   - Add contextual information (e.g., "login button in the header")
   - Consider using `ai_action` for dynamic elements

   **Timing Issues:**
   - Add explicit wait steps before interactions
   - Increase step timeout
   - Add `wait_for_url` or `wait_for_selector` steps

   **Assertion Failures:**
   - Verify the expected outcome is still correct
   - Update assertion target or value
   - Check if application behavior changed

5. **Offer Resolution Options**
   - "Run with `--autofix` to let AI attempt automatic fixes"
   - "I can update the test file with these changes (show diff)"
   - "Run with `--autofix --update-local` to fix and persist changes"

## Common Failure Patterns

| Error Message | Likely Cause | Suggested Fix |
|--------------|--------------|---------------|
| "Element not found: ..." | Selector changed | Update target description |
| "Timeout waiting for ..." | Slow load / element not appearing | Add wait step or increase timeout |
| "Expected ... but got ..." | Assertion mismatch | Update expected value or assertion |
| "Navigation to ... failed" | URL changed | Update goto URL |
| "Element not interactable" | Covered by overlay | Add wait for overlay to close |
```

### Success Criteria:

#### Automated Verification:
- [x] Skill files exist: `ls plugins/qa-use/skills/test-running/SKILL.md plugins/qa-use/skills/test-authoring/SKILL.md plugins/qa-use/skills/test-debugging/SKILL.md`
- [x] Template file exists: `ls plugins/qa-use/skills/test-authoring/template.md`
- [x] YAML frontmatter is valid: `head -5 plugins/qa-use/skills/test-running/SKILL.md`

#### Manual Verification:
- [ ] Each skill has clear constraints section
- [ ] Each skill has actionable workflow steps
- [ ] test-authoring includes test definition format reference
- [ ] test-debugging includes common failure patterns

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 4: Commands (Slash Commands)

### Overview
Create the 5 slash commands that wrap the qa-use CLI test subcommands. Commands are thin wrappers that invoke skills with parsed arguments.

### Changes Required:

#### 1. test-init Command
**File**: `plugins/qa-use/commands/test-init.md`

```markdown
---
description: Initialize qa-use test directory with example test
argument-hint: (no arguments)
---

# /qa-use:test-init

Initialize the qa-use test directory with an example test file and optionally create a configuration file.

## Workflow

1. **Check Existing Setup**
   - Check if `qa-tests/` directory exists
   - Check if `.qa-use-tests.json` exists

2. **Initialize Test Directory**
   - Run: `npx @desplega.ai/qa-use test init`
   - This creates `qa-tests/` with `example.yaml`

3. **Offer Configuration Setup**
   - If `.qa-use-tests.json` doesn't exist, ask user:
     - "Would you like to create a configuration file?"
   - If yes, gather:
     - API key (or explain how to get one)
     - Default app config ID (optional)
     - Preferred defaults (headless, timeout, etc.)
   - Write `.qa-use-tests.json`

4. **Show Next Steps**
   \`\`\`
   Test directory initialized at qa-tests/

   Next steps:
   1. Edit qa-tests/example.yaml to customize the test
   2. Get your app_config_id from https://desplega.ai
   3. Run: /qa-use:test-run example
   \`\`\`

## Example Usage

\`\`\`
/qa-use:test-init
\`\`\`
```

#### 2. test-run Command
**File**: `plugins/qa-use/commands/test-run.md`

```markdown
---
description: Run E2E tests with qa-use CLI
argument-hint: [test-name] [--headful] [--autofix] [--update-local] [--screenshots] [--var key=value]
---

# /qa-use:test-run

Execute E2E tests using the qa-use CLI with real-time progress monitoring.

## Arguments

| Argument | Description |
|----------|-------------|
| `test-name` | Name of the test to run (without extension). Omit to list available tests. |
| `--headful` | Show browser window (default: headless) |
| `--autofix` | Enable AI self-healing for failed steps |
| `--update-local` | Update local test file after AI fixes |
| `--screenshots` | Capture screenshots at each step |
| `--all` | Run all tests in the test directory |
| `--var key=value` | Override a variable (can be used multiple times) |

## Workflow

1. **Parse Arguments**
   - Extract test name and flags from the command arguments
   - If no test name and no `--all`, list available tests and prompt for selection

2. **Invoke test-running Skill**
   - Pass test name and parsed flags to the skill
   - The skill handles prerequisites checking, execution, and result reporting

3. **Handle Results**
   - Display test results summary
   - On failure: suggest `--autofix` if not already used
   - On AI fix: suggest `--update-local` to persist

## Example Usage

\`\`\`
/qa-use:test-run example
/qa-use:test-run login --headful
/qa-use:test-run checkout --autofix --update-local
/qa-use:test-run --all
/qa-use:test-run login --var email=admin@test.com --var password=admin123
\`\`\`
```

#### 3. test-validate Command
**File**: `plugins/qa-use/commands/test-validate.md`

```markdown
---
description: Validate test definition syntax without running
argument-hint: [test-name]
---

# /qa-use:test-validate

Validate a test definition's syntax and configuration without executing it.

## Arguments

| Argument | Description |
|----------|-------------|
| `test-name` | Name of the test to validate (without extension). Omit to list available tests. |

## Workflow

1. **Parse Arguments**
   - Extract test name from command arguments
   - If no test name, list available tests and prompt for selection

2. **Run Validation**
   - Execute: `npx @desplega.ai/qa-use test validate <name>`

3. **Report Results**
   - On success: Show resolved configuration (app_config, variables, step count)
   - On failure: Show errors and offer to fix

4. **Offer Fixes** (if invalid)
   - If YAML syntax error: Show the error location and offer to fix
   - If missing app_config: Offer to add from `.qa-use-tests.json` default
   - If invalid action: Show valid actions list

## Example Usage

\`\`\`
/qa-use:test-validate example
/qa-use:test-validate login
\`\`\`
```

#### 4. test-sync Command
**File**: `plugins/qa-use/commands/test-sync.md`

```markdown
---
description: Sync tests between local files and cloud
argument-hint: [--pull|--push] [--dry-run]
---

# /qa-use:test-sync

Bidirectional sync between local test files and the desplega.ai cloud.

## Arguments

| Argument | Description |
|----------|-------------|
| `--pull` | Download tests from cloud to local (default) |
| `--push` | Upload local tests to cloud |
| `--dry-run` | Preview changes without applying |
| `--force` | Overwrite without prompting |

## Workflow

1. **Parse Arguments**
   - Determine direction: pull (default) or push
   - Check for dry-run mode

2. **Check Prerequisites**
   - Verify API key is configured
   - Verify test directory exists

3. **Execute Sync**
   - Pull: `npx @desplega.ai/qa-use test sync --pull`
   - Push: `npx @desplega.ai/qa-use test sync --push`
   - Add `--dry-run` if requested

4. **Report Results**
   - Show created/updated/skipped counts
   - For pull: Offer to review downloaded tests
   - For push: Show cloud URLs for uploaded tests

## Example Usage

\`\`\`
/qa-use:test-sync --pull
/qa-use:test-sync --push
/qa-use:test-sync --pull --dry-run
\`\`\`
```

#### 5. test-update Command
**File**: `plugins/qa-use/commands/test-update.md`

```markdown
---
description: AI-assisted test editing
argument-hint: [test-name]
---

# /qa-use:test-update

Edit an existing test definition with AI assistance.

## Arguments

| Argument | Description |
|----------|-------------|
| `test-name` | Name of the test to edit (without extension). Omit to list available tests. |

## Workflow

1. **Parse Arguments**
   - Extract test name from command arguments
   - If no test name, list available tests and prompt for selection

2. **Invoke test-authoring Skill** (editing mode)
   - Load current test definition
   - Understand user's desired changes
   - Apply modifications

3. **Validate Changes**
   - Run validation on updated test
   - Fix any issues

4. **Confirm and Save**
   - Show diff of changes
   - Confirm before writing

## Example Usage

\`\`\`
/qa-use:test-update login
/qa-use:test-update checkout
\`\`\`
```

### Success Criteria:

#### Automated Verification:
- [x] Command files exist: `ls plugins/qa-use/commands/*.md`
- [x] All 5 commands present: `ls plugins/qa-use/commands/ | wc -l` (should be 5)
- [x] YAML frontmatter valid: `head -5 plugins/qa-use/commands/test-run.md`

#### Manual Verification:
- [ ] Each command has clear argument-hint in frontmatter
- [ ] Each command describes the expected workflow
- [ ] Commands reference the appropriate skills
- [ ] Example usage sections are helpful

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 5: Specialized Agents

### Overview
Create two specialized agents: `test-analyzer` for deep failure analysis, and `step-generator` for generating test steps from natural language.

### Changes Required:

#### 1. test-analyzer Agent
**File**: `plugins/qa-use/agents/test-analyzer.md`

```markdown
---
name: test-analyzer
description: >
  Deep analysis of E2E test failures and results. Use when:
  (1) A test has failed and needs root cause analysis,
  (2) User wants to understand why a step failed,
  (3) Complex multi-step failures need investigation.
tools: [Read, Grep, Bash]
model: sonnet
color: red
---

# Test Analyzer

You are a specialized agent for analyzing E2E test failures from qa-use.

## Purpose

Perform deep analysis of test failures to identify root causes and suggest actionable fixes.

## Core Tasks

1. **Parse SSE Logs**
   - Identify failed step(s) and error messages
   - Extract timing information
   - Note retry attempts and their outcomes

2. **Analyze Failure Patterns**
   - Selector changes: Element attributes modified
   - Timing issues: Slow loads, race conditions
   - Application changes: New flows, different behavior
   - Environment issues: Network, authentication

3. **Generate Failure Report**
   - Clear statement of what failed
   - Specific error message and context
   - Root cause hypothesis
   - Recommended fix (selector update, timeout increase, etc.)

## Output Format

\`\`\`
## Failure Analysis

**Failed Step**: Step 3 - fill email input
**Error**: Element not found: email input
**Timestamp**: 00:04.2s

### Root Cause
The email input field's placeholder text changed from "Email" to "Enter your email address",
making the "email input" target description too generic.

### Recommended Fix
Update the step target to be more specific:
- Current: `target: email input`
- Suggested: `target: email input with placeholder "Enter your email address"`

Or use an AI action:
- `action: ai_action`
- `value: fill the email field with $email`
\`\`\`

## Constraints

- ALWAYS provide specific, actionable recommendations
- NEVER guess at issues without evidence from logs
- Include relevant log snippets in analysis
```

#### 2. step-generator Agent
**File**: `plugins/qa-use/agents/step-generator.md`

```markdown
---
name: step-generator
description: >
  Generate test steps from natural language descriptions. Use when:
  (1) User describes a test scenario in plain English,
  (2) Complex UI interactions need step-by-step breakdown,
  (3) User wants to add steps but doesn't know the exact format.
tools: [Read]
model: sonnet
color: blue
---

# Step Generator

You are a specialized agent for generating qa-use test steps from natural language descriptions.

## Purpose

Transform user descriptions like "login as admin user" into properly formatted qa-use test steps.

## Core Tasks

1. **Parse User Intent**
   - Identify actions (navigate, fill, click, verify)
   - Identify targets (inputs, buttons, links)
   - Identify values (text, variables)

2. **Generate Steps**
   - Use simple step format (action/target/value)
   - Prefer human-readable target descriptions
   - Use variables for dynamic values

3. **Add Assertions**
   - Include appropriate verification steps
   - Suggest `to_be_visible`, `wait_for_url`, etc.

## Example Transformations

**User Input**: "login as admin user with the test credentials"

**Generated Steps**:
\`\`\`yaml
steps:
  - action: goto
    url: /login
  - action: fill
    target: email input
    value: $admin_email
  - action: fill
    target: password input
    value: $admin_password
  - action: click
    target: login button
  - action: wait_for_url
    url: /dashboard
  - action: to_be_visible
    target: welcome message
\`\`\`

**User Input**: "add item to cart and verify cart count"

**Generated Steps**:
\`\`\`yaml
steps:
  - action: click
    target: add to cart button
  - action: to_be_visible
    target: cart icon with badge showing 1
\`\`\`

## Available Actions Reference

| Category | Actions |
|----------|---------|
| Navigation | `goto`, `wait_for_url`, `go_back`, `go_forward` |
| Input | `fill`, `clear`, `press_key`, `select_option` |
| Click | `click`, `double_click`, `hover` |
| Assert | `to_be_visible`, `to_have_text`, `to_have_value` |
| AI-Powered | `ai_action`, `ai_assertion`, `extract_structured_data` |

## Constraints

- Always suggest variables for values that should be configurable
- Prefer simple step format over extended format
- Include appropriate wait/assertion steps
- Keep target descriptions concise but unique
```

### Success Criteria:

#### Automated Verification:
- [x] Agent files exist: `ls plugins/qa-use/agents/test-analyzer.md plugins/qa-use/agents/step-generator.md`
- [x] YAML frontmatter valid: `head -10 plugins/qa-use/agents/test-analyzer.md`

#### Manual Verification:
- [ ] Each agent has clear trigger conditions in description
- [ ] Each agent specifies tools and model
- [ ] Example outputs are provided
- [ ] Constraints are clear

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 6: Documentation & Cleanup

### Overview
Update the README with comprehensive documentation, remove obsolete skills, and finalize the plugin.

### Changes Required:

#### 1. Remove Obsolete Skills
**Files to delete**:
- `plugins/qa-use/skills/qa-changes/` (entire directory)
- `plugins/qa-use/skills/run-qa-regression/` (entire directory)

**Rationale**: These MCP-centric skills are replaced by the new CLI-wrapping skills.

#### 2. Remove Obsolete Agent
**File to delete**:
- `plugins/qa-use/agents/qa-expert.md`

**Rationale**: The generic qa-expert is replaced by specialized agents (test-analyzer, step-generator).

#### 3. Update README
**File**: `plugins/qa-use/README.md`
**Changes**: Complete rewrite with new architecture documentation.

```markdown
# qa-use Plugin for Claude Code

A CLI-integrated plugin for E2E testing with [qa-use](https://github.com/desplega-ai/qa-use). Provides slash commands, skills, and specialized agents for test authoring, execution, and debugging.

## Installation

### From GitHub

Add the desplega marketplace:

\`\`\`bash
/plugin marketplace add desplega-ai/qa-use
\`\`\`

Install the qa-use plugin:

\`\`\`bash
/plugin install qa-use@desplega.ai
\`\`\`

### Prerequisites

- Node.js 20+
- API key from [desplega.ai](https://desplega.ai)

## Quick Start

1. **Initialize test directory**:
   \`\`\`
   /qa-use:test-init
   \`\`\`

2. **Edit the example test** at `qa-tests/example.yaml`

3. **Run your first test**:
   \`\`\`
   /qa-use:test-run example
   \`\`\`

## Commands

| Command | Description |
|---------|-------------|
| `/qa-use:test-init` | Initialize test directory with example test |
| `/qa-use:test-run [name] [flags]` | Run E2E tests |
| `/qa-use:test-validate [name]` | Validate test syntax |
| `/qa-use:test-sync [--pull\|--push]` | Sync with cloud |
| `/qa-use:test-update [name]` | AI-assisted test editing |

### Common Flags for test-run

- `--headful` - Show browser window
- `--autofix` - Enable AI self-healing
- `--update-local` - Persist AI fixes to local file
- `--screenshots` - Capture screenshots
- `--var key=value` - Override variables

## Skills

The plugin includes three core skills:

- **test-running** - Orchestrates test execution with progress monitoring
- **test-authoring** - Creates and edits test definitions
- **test-debugging** - Analyzes failures and suggests fixes

## Agents

Two specialized agents are available:

- **test-analyzer** - Deep analysis of test failures
- **step-generator** - Generate steps from natural language

## Configuration

Create `.qa-use-tests.json` in your project root:

\`\`\`json
{
  "env": {
    "QA_USE_API_KEY": "your-api-key"
  },
  "test_directory": "./qa-tests",
  "default_app_config_id": "your-app-config-id",
  "defaults": {
    "headless": true,
    "persist": false,
    "timeout": 300,
    "allow_fix": true
  }
}
\`\`\`

## Test Definition Format

\`\`\`yaml
name: Login Test
app_config: your-app-config-id
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
\`\`\`

## Resources

- [GitHub Repository](https://github.com/desplega-ai/qa-use)
- [Documentation](https://desplega.ai/how-to)
- [API Reference](https://desplega.ai/api)

## License

MIT
```

### Success Criteria:

#### Automated Verification:
- [x] Obsolete skills removed: `ls plugins/qa-use/skills/` (should show test-running, test-authoring, test-debugging only)
- [x] Obsolete agent removed: `ls plugins/qa-use/agents/` (should show test-analyzer.md, step-generator.md only)
- [x] README exists and is non-empty: `wc -l plugins/qa-use/README.md` (121 lines)

#### Manual Verification:
- [ ] README has complete Quick Start section
- [ ] All commands are documented
- [ ] Configuration example includes env: block
- [ ] No broken links in README

**Implementation Note**: After completing this phase, the plugin v2 redesign is complete. Create a final verification checklist:

- [ ] Plugin version is 2.0.0
- [ ] 5 commands exist
- [ ] 3 skills exist
- [ ] 2 agents exist
- [ ] CLI env: block support works
- [ ] README is complete

---

## Testing Strategy

### CLI Enhancement (Phase 1)
- Manual testing with `.qa-use-tests.json` containing `env:` block
- Verify shell env vars override config env block
- Verify existing config fields still work

### Plugin (Phases 2-6)
- Plugin files are prompt templates - no automated tests
- Manual verification by invoking commands in Claude Code
- Test each command with various argument combinations

### Integration Testing
1. `/qa-use:test-init` creates directory and example
2. `/qa-use:test-validate example` validates the example
3. `/qa-use:test-run example --headful` runs visually
4. `/qa-use:test-sync --pull --dry-run` previews sync

## References

- Research document: `thoughts/taras/research/2026-01-22-qa-use-plugin-v2-redesign.md`
- ai-toolbox plugin pattern: https://github.com/desplega-ai/ai-toolbox/tree/main/cc-plugin/base
- CLI test commands: `src/cli/commands/test/`
- Config system: `src/cli/lib/config.ts`
