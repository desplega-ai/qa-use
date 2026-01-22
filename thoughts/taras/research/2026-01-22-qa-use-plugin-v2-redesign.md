---
date: 2026-01-22
researcher: Claude (Sonnet 4.5)
research_type: codebase_analysis
status: complete
last_updated: 2026-01-22
git_branch: main
git_commit: 4cbeb97ecda18e9e05151294fb9c4ebde8fd0add
git_remote: git@github.com:desplega-ai/qa-use.git
tags:
  - plugin-redesign
  - qa-use
  - v2
  - test-command
  - cli
  - architecture
---

# Research: qa-use Plugin v2 Redesign

## Research Question

How should the `@plugins/qa-use` plugin be restructured for v2 to align with the qa-use CLI, focusing on the `test` command workflow? The plugin should follow a skills-based architecture with commands as prompt templates (inspired by ai-toolbox/cc-plugin/base), helping Claude Code users create, run, and update tests locally using npx/bunx commands.

## Summary

The current qa-use plugin (v0.1.1) is MCP-centric and doesn't guide users on CLI usage. The v2 qa-use CLI provides 6 test subcommands (init, validate, run, list, export, sync) with comprehensive flags and configuration support. The ai-toolbox plugin architecture follows a **Commands → Skills → Agents** pattern where commands are thin wrappers that invoke reusable skill modules.

**Key Recommendations:**
1. Restructure plugin with 5 command wrappers for test operations
2. Create 3 core skills (test-running, test-authoring, test-debugging)
3. Add 2 specialized agents (test-analyzer, step-generator)
4. Enhance `.qa-use-tests.json` to support `env:` block for easier configuration
5. Focus on guiding CLI usage rather than direct MCP tool invocation

## Detailed Findings

### 1. Current Plugin Structure (v0.1.1)

**Location:** `plugins/qa-use/`

```
plugins/qa-use/
├── .claude-plugin/plugin.json
├── README.md
├── agents/
│   └── qa-expert.md          # Generic QA expert agent
├── skills/
│   ├── qa-changes/SKILL.md   # Analyze code changes → suggest tests
│   └── run-qa-regression/SKILL.md  # Run tests via MCP tools
├── hooks/                    # Empty
└── scripts/                  # Empty
```

**plugin.json:** `plugins/qa-use/.claude-plugin/plugin.json:1-20`
- Name: `qa-use`
- Version: `0.1.1`
- Description: "A plugin to use qa-use in Claude Code"
- Repository: https://github.com/desplega-ai/qa-use

**Current Limitations:**
- MCP-centric approach (assumes MCP tools are available)
- No guidance on CLI commands (`npx qa-use test ...`)
- Generic agent without specialized workflows
- Skills focused on analyzing changes, not test authoring/execution
- Empty hooks and scripts directories

---

### 2. qa-use CLI v2 Test Command

**Entry Point:** `src/cli/index.ts:11,25`
**Test Command Registration:** `src/cli/commands/test/index.ts:13-21`

#### 2.1 Available Subcommands

| Command | File | Description |
|---------|------|-------------|
| `init` | `run.ts:72-75` | Initialize test directory with `example.yaml` |
| `validate` | `validate.ts:32-52` | Validate test syntax without running |
| `run` | `run.ts:85-111` | Execute test with real-time SSE progress |
| `list` | `list.ts:20-70` | List local or cloud tests |
| `export` | `export.ts:45-78` | Download cloud test to YAML/JSON |
| `sync` | `sync.ts:51-189` | Bidirectional sync (pull/push) |

#### 2.2 `qa-use test run` - Key Flags

**Location:** `src/cli/commands/test/run.ts:38-111`

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--id <uuid>` | string | - | Run cloud test by ID |
| `--all` | boolean | false | Run all tests in directory |
| `--persist` | boolean | false | Save test to cloud |
| `--headful` | boolean | false | Show browser window |
| `--autofix` | boolean | false | Enable AI self-healing |
| `--screenshots` | boolean | false | Capture screenshots |
| `--var <key=value>` | repeatable | {} | Variable overrides |
| `--app-config-id <uuid>` | string | - | App config ID |
| `--timeout <seconds>` | string | "300" | Timeout in seconds |
| `--update-local` | boolean | false | Update local file after AI fixes |
| `--verbose` | boolean | false | Show raw SSE events |

#### 2.3 Configuration System

**File:** `.qa-use-tests.json`
**Search Order:** Current directory → Home directory
**Env Override Priority:** `QA_USE_API_KEY`, `QA_USE_API_URL`

**Interface:** `src/cli/lib/config.ts:9-20`
```typescript
interface CliConfig {
  api_key?: string;
  api_url?: string;
  default_app_config_id?: string;
  test_directory?: string;           // default: "./qa-tests"
  defaults?: {
    headless?: boolean;              // default: true
    persist?: boolean;               // default: false
    timeout?: number;                // default: 300
    allow_fix?: boolean;             // default: true
  };
}
```

**Current Limitation:** No support for defining environment variables in the config file.

#### 2.4 Test Definition Format

**Location:** `src/types/test-definition.ts`
**Supported Formats:** `.yaml`, `.yml`, `.json`

```yaml
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
```

**Simple Steps:** `src/types/test-definition.ts:325-334`
**Extended Steps:** `src/types/test-definition.ts:343-352`
**80+ Actions Supported:** Including AI actions like `ai_action`, `ai_assertion`, `extract_structured_data`

#### 2.5 Test Loading System

**Location:** `src/cli/lib/loader.ts`

**Key Functions:**
- `discoverTests(directory)` (17-20) - Find all test files recursively
- `loadTestDefinition(filePath)` (28-37) - Parse YAML/JSON
- `resolveTestPath(testNameOrPath, directory)` (46-66) - Resolve names to paths
- `loadTestWithDeps(testName, directory)` (75-109) - Load with dependencies
- `loadAllTests(directory)` (117-131) - Load all tests
- `applyVariableOverrides(definitions, overrides)` (139-150) - Merge CLI vars

#### 2.6 Typical User Workflow

```bash
# 1. Initialize project
npx @desplega.ai/qa-use test init

# 2. Edit test file (qa-tests/example.yaml)

# 3. Validate syntax
npx @desplega.ai/qa-use test validate example

# 4. Run test
npx @desplega.ai/qa-use test run example

# 5. Run with AI self-healing
npx @desplega.ai/qa-use test run example --autofix --update-local

# 6. Save to cloud
npx @desplega.ai/qa-use test run example --persist

# 7. Sync with cloud
npx @desplega.ai/qa-use test sync --pull    # Download
npx @desplega.ai/qa-use test sync --push    # Upload

# 8. Export specific cloud test
npx @desplega.ai/qa-use test export <uuid> --format yaml
```

---

### 3. ai-toolbox Plugin Architecture Pattern

**Repository:** https://github.com/desplega-ai/ai-toolbox/tree/main/cc-plugin/base

#### 3.1 Directory Structure

```
cc-plugin/base/
├── .claude-plugin/plugin.json
├── commands/                 # User-facing slash commands
│   ├── research.md
│   ├── create-plan.md
│   ├── implement-plan.md
│   └── commit.md
├── skills/                   # Reusable prompt modules
│   ├── researching/
│   │   ├── SKILL.md
│   │   └── template.md
│   ├── planning/
│   │   ├── SKILL.md
│   │   └── template.md
│   └── implementing/
│       └── SKILL.md
├── agents/                   # Specialized sub-agents
│   ├── codebase-analyzer.md
│   ├── codebase-locator.md
│   ├── codebase-pattern-finder.md
│   └── web-search-researcher.md
└── hooks/                    # Lifecycle hooks
    └── validate-thoughts.py
```

#### 3.2 Architecture Hierarchy

**Flow:** `User → Command → Skill → Agents`

| Layer | Purpose | Invocation | Example |
|-------|---------|------------|---------|
| **Commands** | Thin wrappers, parse args, invoke skills | `/desplega:research` | `commands/research.md` |
| **Skills** | Reusable logic with constraints | Invoked by commands | `desplega:researching` |
| **Agents** | Parallel workers for specific tasks | Spawned via `Task` tool | `codebase-analyzer` |

#### 3.3 Command Pattern (Prompt Templates)

Commands are markdown files with YAML frontmatter:

```markdown
---
description: Document codebase as-is with thoughts directory
model: opus
argument-hint: [--autonomy=MODE] [query]
allowed-tools: Read, Grep, Glob
---

# Command Body (Prompt Template)

1. Parse arguments (e.g., --autonomy=autopilot|critical|verbose)
2. Invoke skill with parsed parameters
3. Handle edge cases (e.g., no query provided)

## Example Usage
- /research how does auth work
- /research --autonomy=autopilot document endpoints
```

**Key Insight:** Commands contain minimal logic - they are **argument parsers + skill invokers**.

#### 3.4 Skills Pattern

Skills are directories with:
1. **SKILL.md** - Instructions, workflow, constraints
2. **template.md** - Output structure template

**SKILL.md Structure:**
```markdown
# Skill Name

## Working Agreement
- Use AskUserQuestion for all questions
- Establish preferences upfront
- Autonomy mode determines interaction frequency

## Critical Constraints
[Explicit "DO NOT" list]

## Workflow
[Step-by-step process]

## Output Format
[Reference to template.md]
```

**Example Constraint (from researching skill):**
- DO NOT suggest improvements
- DO NOT critique implementation
- ONLY describe what exists

#### 3.5 Agents Pattern

Agents are markdown files with frontmatter defining their capabilities:

```markdown
---
name: codebase-analyzer
color: yellow
model: inherit
tools: Read, Grep, Glob, LS
---

# Codebase Analyzer

## Purpose
Analyze implementation details and trace data flow.

## Core Mandate
- Document code as it exists
- NO improvements, NO critiques

## Methodology
1. Read primary files
2. Trace function calls
3. Document patterns
```

**Available Agents:**
- `codebase-analyzer` - Implementation details
- `codebase-locator` - Find specific code
- `codebase-pattern-finder` - Identify patterns
- `web-search-researcher` - External research

#### 3.6 Hooks Pattern

Hooks are Python scripts that intercept tool calls:

**Example:** `hooks/validate-thoughts.py`
```python
def main():
    data = json.load(sys.stdin)
    tool_name = data.get("tool_name")
    tool_input = data.get("tool_input", {})

    # Validation logic
    if not is_valid:
        print(error_msg, file=sys.stderr)
        sys.exit(2)  # Block with feedback

    sys.exit(0)  # Allow
```

**Exit Codes:**
- `0` - Allow operation
- `2` - Block with error message (stderr)

#### 3.7 CLI Tool Wrapping Pattern

**Example:** `commands/commit.md` - Wraps `git` CLI
- Run `git status`, `git diff`
- Draft commit message
- Present plan for approval
- Execute `git add`, `git commit`

**Key Principle:** Guide users through CLI workflow, don't abstract it away.

---

### 4. Proposed Plugin Redesign

#### 4.1 New Structure

```
plugins/qa-use/
├── .claude-plugin/plugin.json
├── README.md
├── commands/                      # User entry points
│   ├── test-init.md              # /qa-use:test-init
│   ├── test-run.md               # /qa-use:test-run [name] [flags]
│   ├── test-validate.md          # /qa-use:test-validate [name]
│   ├── test-sync.md              # /qa-use:test-sync [--pull|--push]
│   └── test-update.md            # /qa-use:test-update [name]
├── skills/                        # Reusable workflows
│   ├── test-running/
│   │   ├── SKILL.md              # Run tests, monitor, report
│   │   └── template.md           # Test result template
│   ├── test-authoring/
│   │   ├── SKILL.md              # Create/edit tests
│   │   ├── template.md           # Test definition template
│   │   └── examples/             # Sample test definitions
│   │       ├── basic-login.yaml
│   │       ├── form-submission.yaml
│   │       └── api-interaction.json
│   └── test-debugging/
│       ├── SKILL.md              # Analyze failures, suggest fixes
│       └── template.md           # Debug report template
├── agents/                        # Specialized workers
│   ├── test-analyzer.md          # Analyze test results/failures
│   └── step-generator.md         # Generate steps from descriptions
├── hooks/                         # (Future) validation hooks
│   └── .gitkeep
└── scripts/                       # (Future) helper scripts
    └── .gitkeep
```

#### 4.2 Command Specifications

##### `/qa-use:test-init`
**Purpose:** Bootstrap test directory
**Arguments:** None
**Workflow:**
1. Check if `qa-tests/` exists
2. Run `npx qa-use test init`
3. Offer to create `.qa-use-tests.json` with config wizard
4. Show next steps (edit example.yaml, configure app_config_id)

##### `/qa-use:test-run [name] [flags]`
**Purpose:** Execute tests with real-time monitoring
**Arguments:**
- `[name]` - Optional test name
- `[flags]` - Optional: `--headful`, `--autofix`, `--update-local`, etc.

**Workflow:**
1. Invoke `test-running` skill
2. If no name provided, list available tests and ask user to select
3. Check for config file, offer to create if missing
4. Execute `npx qa-use test run <name> <flags>`
5. Stream SSE progress with formatted output
6. On failure: suggest `--autofix` if not used
7. On AI fix: suggest `--update-local` to persist changes

##### `/qa-use:test-validate [name]`
**Purpose:** Syntax check without execution
**Arguments:** `[name]` - Test name
**Workflow:**
1. If no name, list tests and ask
2. Execute `npx qa-use test validate <name>`
3. Display validation report (resolved config, steps, dependencies)
4. If invalid, show errors and offer to fix

##### `/qa-use:test-sync [--pull|--push]`
**Purpose:** Bidirectional cloud sync
**Arguments:** `--pull` (default) or `--push`
**Workflow:**
1. Check for API key in config
2. Execute `npx qa-use test sync <flag>`
3. Show sync summary (created/updated/skipped)
4. Offer to review changes if pull

##### `/qa-use:test-update [name]`
**Purpose:** AI-assisted test editing
**Arguments:** `[name]` - Test name
**Workflow:**
1. Invoke `test-authoring` skill
2. Load current test definition
3. Ask user what to change (add steps, modify selectors, etc.)
4. Optionally spawn `step-generator` agent for complex additions
5. Update test file
6. Offer to validate

#### 4.3 Skill Specifications

##### `test-running` Skill
**Purpose:** Orchestrate test execution workflow

**Critical Constraints:**
- Always check for config before running
- Never skip validation in production
- Always explain failure causes before suggesting autofix

**Workflow:**
1. Verify prerequisites (config, test exists)
2. Construct CLI command with user-specified flags
3. Execute via Bash tool
4. Monitor SSE output
5. Parse results (passed/failed/skipped)
6. Generate summary report
7. Suggest next actions based on outcome

##### `test-authoring` Skill
**Purpose:** Create and edit test definitions

**Critical Constraints:**
- Always validate YAML syntax before saving
- Preserve user's variable definitions
- Never overwrite tests without confirmation

**Workflow:**
1. Load existing test (if editing) or start from template
2. Understand user intent (what to test)
3. Identify elements to interact with
4. Generate step sequence
5. Add assertions
6. Define variables
7. Write to YAML file
8. Offer to validate

##### `test-debugging` Skill
**Purpose:** Analyze failures and suggest fixes

**Critical Constraints:**
- Focus on actionable fixes
- Distinguish between selector issues vs app changes
- Never modify tests without user approval

**Workflow:**
1. Parse failure logs/screenshots
2. Identify failure type (selector not found, assertion failed, timeout)
3. Suggest fixes:
   - Update selectors
   - Adjust timeouts
   - Add wait conditions
4. Offer to apply fixes or run with --autofix
5. If fixed, suggest --update-local to persist

#### 4.4 Agent Specifications

##### `test-analyzer` Agent
**Purpose:** Deep analysis of test results and failures

**Tools:** Read, Grep, Bash
**Spawned By:** `test-debugging` skill

**Tasks:**
- Parse SSE logs for failure patterns
- Extract screenshots/traces if available
- Identify root cause (selector, timing, app change)
- Generate detailed failure report

##### `step-generator` Agent
**Purpose:** Generate test steps from natural language descriptions

**Tools:** Read, context7 (for Playwright API docs)
**Spawned By:** `test-authoring` skill

**Tasks:**
- Parse user description ("login as admin")
- Identify required actions (goto, fill, click)
- Generate step sequence with target selectors
- Suggest variable usage

---

### 5. Proposed Enhancement: `env:` Config Support

#### 5.1 Problem Statement

Currently, `.qa-use-tests.json` does not support defining environment variables. Users must set `QA_USE_API_KEY` and other env vars in their shell or use a separate `.env` file, which fragments configuration.

#### 5.2 Proposed Solution

Add an `env:` block to `.qa-use-tests.json`:

```json
{
  "env": {
    "QA_USE_API_KEY": "sk-...",
    "QA_USE_API_URL": "https://api.desplega.ai",
    "QA_USE_REGION": "us"
  },
  "test_directory": "./qa-tests",
  "default_app_config_id": "uuid-here",
  "defaults": {
    "headless": true,
    "persist": false,
    "timeout": 300,
    "allow_fix": true
  }
}
```

#### 5.3 Implementation Location

**File:** `src/cli/lib/config.ts`

**Proposed Changes:**

1. **Update `CliConfig` interface** (lines 9-20):
```typescript
export interface CliConfig {
  env?: Record<string, string>;  // NEW
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

2. **Apply env vars in `loadConfig()`** (after line 84):
```typescript
// Apply env block from config
if (config.env) {
  for (const [key, value] of Object.entries(config.env)) {
    if (!process.env[key]) {  // Don't override existing env vars
      process.env[key] = value;
    }
  }
}

// Environment variables still override config file
if (process.env.QA_USE_API_KEY) {
  config.api_key = process.env.QA_USE_API_KEY;
}
```

#### 5.4 Benefits

1. **Single source of truth** - All config in one file
2. **Project-specific** - Config travels with project
3. **Easier onboarding** - New users just need one file
4. **Shell independence** - No need to set env vars in shell profile
5. **Shareable** - Team can share config template (minus secrets)

#### 5.5 Priority Order

With this enhancement, the priority order becomes:
1. **Shell env vars** (highest priority)
2. **Config `env:` block**
3. **Direct config fields** (e.g., `api_key`)
4. **Defaults** (lowest priority)

This ensures flexibility while providing convenience.

---

## Code References

### Current Plugin
- `plugins/qa-use/.claude-plugin/plugin.json:1-20` - Plugin manifest
- `plugins/qa-use/agents/qa-expert.md:1-10` - Current agent definition
- `plugins/qa-use/skills/qa-changes/SKILL.md:1-23` - Code change analysis skill
- `plugins/qa-use/skills/run-qa-regression/SKILL.md:1-22` - Regression runner skill

### qa-use CLI v2
- `src/cli/index.ts:11,25` - CLI entry point
- `src/cli/commands/test/index.ts:13-21` - Test command registration
- `src/cli/commands/test/run.ts:38-111` - Test run implementation
- `src/cli/commands/test/init.ts:11-55` - Test init implementation
- `src/cli/commands/test/validate.ts:32-52` - Test validation
- `src/cli/commands/test/sync.ts:51-189` - Cloud sync (pull/push)
- `src/cli/lib/config.ts:9-96` - Configuration system
- `src/cli/lib/loader.ts:17-150` - Test loading system
- `src/cli/lib/runner.ts:30-51` - Test execution
- `src/types/test-definition.ts:325-352` - Test format types

### ai-toolbox Reference
- [plugin.json](https://github.com/desplega-ai/ai-toolbox/blob/main/cc-plugin/base/.claude-plugin/plugin.json)
- [commands/research.md](https://github.com/desplega-ai/ai-toolbox/blob/main/cc-plugin/base/commands/research.md)
- [skills/researching/SKILL.md](https://github.com/desplega-ai/ai-toolbox/blob/main/cc-plugin/base/skills/researching/SKILL.md)
- [agents/codebase-analyzer.md](https://github.com/desplega-ai/ai-toolbox/blob/main/cc-plugin/base/agents/codebase-analyzer.md)
- [hooks/validate-thoughts.py](https://github.com/desplega-ai/ai-toolbox/blob/main/cc-plugin/base/hooks/validate-thoughts.py)

---

## Next Steps

### Phase 1: Plugin Restructure
1. Create new directory structure with commands/skills/agents
2. Implement 5 command wrappers (test-init, test-run, test-validate, test-sync, test-update)
3. Develop 3 core skills (test-running, test-authoring, test-debugging)
4. Create 2 specialized agents (test-analyzer, step-generator)
5. Update plugin.json with new version and structure

### Phase 2: CLI Enhancement
1. Implement `env:` block support in `.qa-use-tests.json`
2. Update `CliConfig` interface
3. Modify `loadConfig()` to apply env vars
4. Add tests for env precedence
5. Update CLI documentation

### Phase 3: Integration & Testing
1. Test plugin commands with real qa-use CLI
2. Validate skill workflows end-to-end
3. Test agent spawning and coordination
4. Document plugin usage with examples
5. Create migration guide from v0.1.1 to v2

### Phase 4: Documentation
1. Update plugin README with new architecture
2. Document each command with examples
3. Create skill reference guides
4. Add troubleshooting section
5. Record demo videos (optional)
