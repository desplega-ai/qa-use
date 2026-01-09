# Research: Claude Code Plugin Best Practices for qa-use

**Date**: 2026-01-09T00:00:00Z
**Git Commit**: cf95bf6
**Branch**: main
**Repository**: desplega-ai/qa-use

---

## Research Question

How can we improve the Claude Code plugin in the qa-use repository to be an effective plugin for agentic coding? What are the best practices for Claude Code plugins?

---

## Executive Summary

The current qa-use Claude Code plugin is a minimal placeholder with basic structure. Based on comprehensive research of official documentation, best practices, and ecosystem examples, there are significant opportunities to transform it into a powerful agentic QA companion. The plugin can leverage the existing 13 MCP tools to provide automated QA workflows, intelligent test generation, and seamless integration with developer coding workflows.

---

## Current Plugin State

### Directory Structure
```
plugins/qa-use/
├── .claude-plugin/
│   └── plugin.json              # Basic metadata only
├── agents/
│   └── qa-expert.md             # Minimal agent definition
├── skills/
│   ├── qa-changes/
│   │   └── SKILL.md             # Placeholder with TODO examples
│   └── run-qa-regression/
│       ├── SKILL.md             # Placeholder with TODO examples
│       └── scripts/
│           └── run-tests.py     # Not implemented
├── hooks/
│   └── .gitkeep                 # Empty
├── scripts/
│   └── .gitkeep                 # Empty
└── README.md                    # Mostly placeholder
```

### Key Gaps Identified
1. **Skills lack concrete examples and detailed instructions**
2. **No hooks configured** for automated QA integration
3. **Agent definition is minimal** - missing detailed system prompt
4. **No MCP configuration** referencing the qa-use MCP server
5. **Scripts are not implemented**
6. **No commands** (slash commands) defined

---

## Claude Code Plugin Best Practices

### 1. Plugin Structure Requirements

**Official directory structure:**
```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # REQUIRED: Only file in this directory
├── commands/                 # Slash commands (e.g., /qa-test)
│   └── command-name.md
├── agents/                   # Subagent definitions
│   └── agent-name.md
├── skills/                   # Auto-invoked expertise
│   └── skill-name/
│       ├── SKILL.md         # Required per skill
│       └── resources/       # Optional supporting files
├── hooks/
│   └── hooks.json           # Event handler configuration
├── .mcp.json                # MCP server configuration
└── README.md
```

**Critical Rule**: All component directories must be at plugin root, NOT inside `.claude-plugin/`.

### 2. plugin.json Best Practices

```json
{
  "name": "qa-use",
  "version": "1.0.0",
  "description": "Agentic QA companion for automated E2E testing with browser automation",
  "author": {
    "name": "desplega.ai",
    "email": "contact@desplega.ai"
  },
  "repository": "https://github.com/desplega-ai/qa-use",
  "keywords": ["qa", "e2e", "testing", "browser-automation", "playwright"],
  "license": "MIT"
}
```

### 3. SKILL.md Best Practices

**Required frontmatter:**
```yaml
---
name: skill-name           # Lowercase, hyphens, max 64 chars
description: >             # CRITICAL: This triggers skill invocation
  Clear explanation of what the skill does AND when to use it.
  Include specific trigger conditions and examples.
---
```

**Description is the primary trigger mechanism.** Include:
- What the skill does
- Specific contexts/triggers for use
- Example scenarios

**Body content guidelines:**
- Keep under 5,000 words (ideally under 500 lines)
- Use imperative/infinitive form for instructions
- Include concrete examples of inputs/outputs
- Reference external files rather than embedding verbose content
- Progressive disclosure: metadata always loaded, body loaded on trigger

### 4. Agent Definition Best Practices

**Frontmatter fields:**
```yaml
---
name: agent-name           # Kebab-case, 3-50 characters
description: >             # Include trigger conditions and examples
  Expert QA agent for... Use when user asks about testing.
  <example>Run QA tests on my changes</example>
tools: [Read, Grep, Glob, Bash, mcp__qa-use__*]
model: sonnet              # Options: inherit, haiku, sonnet, opus
color: green               # Visual identifier
---
```

**System prompt structure:**
1. Core Purpose - Clear role definition
2. Numbered Responsibilities
3. Step-by-Step Process
4. Quality Standards
5. Output Format

### 5. Hooks Best Practices

**Available events:**
| Event | Use Case |
|-------|----------|
| `PreToolUse` | Validate/block operations before execution |
| `PostToolUse` | Run tests/linters after file changes |
| `Stop` | End-of-turn quality gates |
| `SessionStart` | Load context (git status, active tests) |
| `UserPromptSubmit` | Inject sprint/testing context |

**Example hooks.json for QA:**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit:*.ts|Edit:*.tsx|Write:*.ts",
        "hooks": [{
          "type": "command",
          "command": "${CLAUDE_PLUGIN_ROOT}/hooks/suggest-qa.sh"
        }]
      }
    ],
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "${CLAUDE_PLUGIN_ROOT}/hooks/qa-reminder.sh"
        }]
      }
    ]
  }
}
```

---

## Available qa-use MCP Tools (13 Tools)

The plugin can leverage these existing MCP tools:

### Session Management
| Tool | Purpose |
|------|---------|
| `ensure_installed` | Validate API key and install Playwright browsers |
| `register_user` | Register new user and get API key |
| `search_sessions` | Search/list sessions with pagination |
| `start_automated_session` | Start E2E test session for QA flows |
| `start_dev_session` | Start interactive debugging session |
| `monitor_session` | Monitor session status (alerts on needs_input/idle) |
| `interact_with_session` | Respond, pause, or close sessions |

### Test Management
| Tool | Purpose |
|------|---------|
| `search_automated_tests` | Search tests by ID or query |
| `run_automated_tests` | Execute multiple tests simultaneously |
| `search_automated_test_runs` | Search test runs with filtering |

### Configuration
| Tool | Purpose |
|------|---------|
| `update_configuration` | Update base_url, login creds, viewport |
| `get_configuration` | Get current app configuration |
| `reset_browser_sessions` | Cleanup all active browser sessions |

---

## Recommended Plugin Improvements

### 1. Enhanced Skills

#### qa-changes Skill (Rewrite)
```yaml
---
name: qa-changes
description: >
  Analyze code changes and suggest QA test cases using qa-use toolkit.
  Use when: (1) User makes code changes that affect UI/behavior,
  (2) Before creating a PR, (3) After implementing a feature,
  (4) User asks "what should I test?"
---

# QA Changes Analyzer

Analyze code changes and suggest appropriate QA test cases.

## Process

1. **Identify Changes**
   - Use `git diff` or read modified files
   - Categorize: UI changes, API changes, logic changes, config changes

2. **Check Existing Tests**
   - Use `search_automated_tests` to find related tests
   - Identify coverage gaps

3. **Suggest Test Cases**
   - Generate AAA-format test scenarios
   - Prioritize by risk and impact

4. **Offer to Create Tests**
   - Use `start_automated_session` to record new tests
   - Guide user through test creation

## Output Format
- Summary of changes analyzed
- Existing test coverage assessment
- Recommended new test cases with priority
- Option to create tests immediately
```

#### run-qa-regression Skill (Rewrite)
```yaml
---
name: run-qa-regression
description: >
  Run QA regression tests using qa-use MCP tools. Use when:
  (1) User asks to "run tests" or "run QA",
  (2) Before merging/deploying changes,
  (3) After significant code changes,
  (4) User wants to verify nothing is broken.
---

# QA Regression Runner

Execute and monitor regression tests systematically.

## Process

1. **Discover Tests**
   - Use `search_automated_tests` with self_only=true
   - Filter by relevance to recent changes

2. **Confirm Test Selection**
   - Present test list to user
   - Allow selection/deselection

3. **Execute Tests**
   - Use `run_automated_tests` with selected test_ids
   - Tests run in background

4. **Monitor Progress**
   - Use `monitor_session` with wait=true
   - Report status updates

5. **Report Results**
   - Summarize pass/fail counts
   - Highlight failures with details
   - Suggest remediation steps
```

### 2. New Slash Commands

#### /qa-test Command
```yaml
---
description: Run QA tests on your code changes
argument-hint: [test-name or "all"]
allowed-tools: mcp__qa-use__*, Read, Grep, Glob, Bash
---

Run QA regression tests for your current changes.

## Usage
- `/qa-test` - Run tests relevant to current changes
- `/qa-test all` - Run all registered tests
- `/qa-test login` - Run tests matching "login"

## Process
1. Analyze git changes to identify affected areas
2. Find relevant tests using search_automated_tests
3. Execute tests using run_automated_tests
4. Monitor and report results
```

#### /qa-record Command
```yaml
---
description: Record a new E2E test scenario
argument-hint: <test-description>
allowed-tools: mcp__qa-use__*, Read, Grep
---

Start an interactive session to record a new E2E test.

## Usage
- `/qa-record User can login with valid credentials`
- `/qa-record Shopping cart checkout flow`

## Process
1. Start dev session with start_dev_session
2. Guide user through the test scenario
3. Monitor session for completion
4. Confirm test was saved
```

### 3. Enhanced Agent Definition

```yaml
---
name: qa-expert
description: >
  Expert QA engineer for E2E testing with qa-use tools. Use when:
  (1) User asks about testing or QA,
  (2) User wants to verify code changes,
  (3) User needs help debugging test failures,
  (4) Proactively after significant code modifications.
  <example>Can you test my login changes?</example>
  <example>What tests should I run?</example>
  <example>Help me debug this test failure</example>
tools: [Read, Grep, Glob, Bash, mcp__qa-use__*]
model: sonnet
color: green
---

# QA Expert Agent

You are an expert QA engineer specializing in E2E testing using the qa-use toolkit.

## Core Responsibilities

1. **Test Analysis** - Analyze code changes and identify testing needs
2. **Test Execution** - Run appropriate regression tests
3. **Result Interpretation** - Analyze failures and suggest fixes
4. **Test Creation** - Help users create new test scenarios
5. **Coverage Assessment** - Identify gaps in test coverage

## Available Tools

You have access to qa-use MCP tools:
- `start_automated_session` - Run automated test scenarios
- `start_dev_session` - Interactive test recording/debugging
- `monitor_session` - Track test execution progress
- `search_automated_tests` - Find existing tests
- `run_automated_tests` - Execute multiple tests
- `search_automated_test_runs` - Review test history

## Process

### When Analyzing Changes
1. Review git diff or specified files
2. Search for related existing tests
3. Assess coverage and identify gaps
4. Recommend test execution or creation

### When Running Tests
1. Identify relevant tests
2. Confirm selection with user
3. Execute using run_automated_tests
4. Monitor progress with monitor_session (wait=true)
5. Report results clearly

### When Debugging Failures
1. Get detailed test run information
2. Analyze failure patterns
3. Correlate with code changes
4. Suggest specific fixes

## Output Standards
- Always provide clear summaries
- Include pass/fail counts
- Highlight critical failures first
- Offer next steps and recommendations
```

### 4. Hooks Configuration

**hooks/hooks.json:**
```json
{
  "description": "QA integration hooks for code changes",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit:*.ts|Edit:*.tsx|Edit:*.js|Edit:*.jsx|Write:*.ts|Write:*.tsx",
        "hooks": [{
          "type": "command",
          "command": "echo 'Consider running /qa-test to verify your changes'"
        }]
      }
    ],
    "SessionStart": [
      {
        "hooks": [{
          "type": "command",
          "command": "${CLAUDE_PLUGIN_ROOT}/hooks/load-qa-context.sh"
        }]
      }
    ]
  }
}
```

**hooks/load-qa-context.sh:**
```bash
#!/bin/bash
# Load QA context at session start
echo "QA Context:"
echo "- Recent test runs: Use /qa-test to run regression"
echo "- qa-use MCP server available for E2E testing"
```

---

## Reference Examples from Ecosystem

### Similar Plugins Analyzed
1. **pr-review-toolkit** - 6 specialized agents for PR analysis
2. **playwright-skill** - Browser automation skill pattern
3. **claude-code-test-runner** - Natural language E2E tests
4. **ClaudeCodeAgents** - QA-focused agents (Jenny, Karen)

### Key Patterns Observed
1. **Multi-agent workflows** - Different agents for different phases
2. **Progressive disclosure** - Minimal context until needed
3. **Clear triggers** - Descriptions that clearly indicate when to invoke
4. **Concrete examples** - Real usage examples in descriptions
5. **Tool integration** - Seamless MCP tool usage in skills

---

## Implementation Priorities

### Phase 1: Core Functionality
1. Rewrite `qa-changes` SKILL.md with concrete examples
2. Rewrite `run-qa-regression` SKILL.md with workflow steps
3. Enhance `qa-expert.md` agent with detailed system prompt

### Phase 2: Commands & Hooks
4. Create `/qa-test` command
5. Create `/qa-record` command
6. Add `hooks.json` with PostToolUse reminders

### Phase 3: Polish
7. Update README.md with complete documentation
8. Add example usage scenarios
9. Create reference documentation in skills

---

## Key Sources

**Official Documentation:**
- https://code.claude.com/docs/en/plugins
- https://code.claude.com/docs/en/plugins-reference
- https://code.claude.com/docs/en/skills
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/hooks

**GitHub Repositories:**
- https://github.com/anthropics/claude-plugins-official
- https://github.com/anthropics/claude-code/blob/main/plugins/README.md
- https://github.com/lackeyjb/playwright-skill
- https://github.com/firstloophq/claude-code-test-runner

**Community Resources:**
- https://claude-plugins.dev/
- https://github.com/darcyegb/ClaudeCodeAgents
- https://github.com/claudebase/marketplace
