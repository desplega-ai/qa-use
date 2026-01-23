---
date: 2026-01-23
topic: qa-use Plugin Browser Feature Implementation
status: draft
source_research: thoughts/taras/research/2026-01-23-qa-use-plugin-browser-feature.md
---

# qa-use Plugin Browser Feature Implementation Plan

## Overview

Add browser automation features to the qa-use plugin (v2.0.0) to enable AI-first autonomous feature verification. This implements skills, agents, and commands that wrap the existing `qa-use browser` CLI to provide a unified workflow where Claude Code can develop features, verify them through browser automation, create tests, and iterate until green.

The strategic vision is **autonomous Claude Code instances using browser and test commands to reliably verify developed features** - positioning qa-use as infrastructure for AI-driven development workflows.

## Current State Analysis

**Existing Plugin Structure** (`plugins/qa-use/`):
- 5 commands: `test-init`, `test-run`, `test-validate`, `test-sync`, `test-update`
- 3 skills: `test-authoring`, `test-running`, `test-debugging`
- 2 agents: `test-analyzer`, `step-generator`
- Focus: Test-centric operations only

**Existing Browser CLI** (`src/cli/commands/browser/`):
- 28 browser commands implemented (create, goto, click, fill, snapshot, etc.)
- Session management via `~/.qa-use.json`
- ARIA-based element targeting with refs (e.g., `e3`)
- Optional `--text` flag for semantic element selection
- Remote browser sessions via desplega.ai API

### Key Discoveries:
- Plugin follows clear conventions: skills use `SKILL.md`, agents use frontmatter with `tools`, `model`, `color`
- Commands are thin wrappers that invoke skills
- CLI commands exist and are fully functional - plugin just needs to wrap them
- Research document at `thoughts/taras/research/2026-01-23-qa-use-plugin-browser-feature.md` contains detailed skill/agent content specs

## Desired End State

A plugin where Claude Code can:
1. Run `/qa-use:verify "login works"` on a fresh codebase
2. Automatically explore the feature if no test exists (via `browser-navigator` agent)
3. Generate a test YAML from exploration (via `browser-recorder` agent)
4. Execute the test and report results
5. Handle failures with actionable recommendations (code bug vs test bug vs environment)
6. Iterate until green without human intervention (for simple cases)

**Verification**: The plugin is complete when the acceptance test scenario in the research document can be executed end-to-end.

## Quick Verification Reference

Common commands to verify the implementation:
- `ls plugins/qa-use/` - Verify directory structure
- `cat plugins/qa-use/.claude-plugin/plugin.json` - Verify version bump
- `grep -r "browser" plugins/qa-use/` - Verify browser references

Key files to check:
- `plugins/qa-use/skills/feature-verify/SKILL.md` - Core skill
- `plugins/qa-use/agents/browser-navigator.md` - Exploration agent
- `plugins/qa-use/agents/browser-recorder.md` - Recording agent
- `plugins/qa-use/commands/verify.md` - Main entry point

## What We're NOT Doing

- **NOT modifying the CLI** - All browser commands already exist in `src/cli/commands/browser/`
- **NOT adding MCP tools** - Using CLI wrapper approach via Bash
- **NOT changing existing skills** - Only adding new ones (except test-debugging enhancement)
- **NOT implementing the CLI recording feature** - That's a separate browser CLI enhancement; the agent simulates recording by tracking commands
- **NOT adding semantic-first targeting** - That's a CLI enhancement; plugin uses existing `--text` flag

## Implementation Approach

Follow the dependency order from the research document:
1. Start with foundational skills (`browser-control`, enhanced `test-debugging`)
2. Build agents that depend on those skills (`browser-navigator`, `browser-recorder`)
3. Create the orchestration skill (`feature-verify`)
4. Add commands as thin wrappers
5. Update documentation

Each phase creates complete, testable artifacts. Verification happens by checking file structure and content matches the research specifications.

---

## Phase 1: Browser Control Skill (Foundation)

### Overview
Create the `browser-control` skill that documents how to use `qa-use browser` CLI commands. This skill serves as a reference for other skills and agents that need to perform browser operations.

### Changes Required:

#### 1. Create browser-control skill directory and SKILL.md
**File**: `plugins/qa-use/skills/browser-control/SKILL.md`
**Changes**: Create new file with:
- Prerequisites section (qa-use CLI installation)
- When to use guidance
- Critical constraints (session management, snapshot-before-action)
- Complete workflow documentation for:
  - Session management (create, list, close)
  - Navigation (goto, back, forward, reload)
  - Element targeting (snapshot → refs, or --text semantic)
  - Interactions (click, fill, type, press, check, select, scroll, hover)
  - Inspection (url, snapshot, screenshot, get-blocks)
  - Waiting (wait, wait-for-selector, wait-for-load)
  - Interactive mode (run)
- Session persistence notes
- Tips section

Content is fully specified in research document Section 5.2.

### Success Criteria:

#### Automated Verification:
- [ ] File exists: `ls plugins/qa-use/skills/browser-control/SKILL.md`
- [ ] Contains critical sections: `grep -E "Prerequisites|Session Management|Element Targeting|Critical Constraints" plugins/qa-use/skills/browser-control/SKILL.md`

#### Manual Verification:
- [ ] SKILL.md follows existing plugin skill format (compare with test-authoring/SKILL.md)
- [ ] All documented CLI commands match actual `qa-use browser --help` output
- [ ] Critical constraints are clear and actionable for an AI agent

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 2: Enhance Test Debugging Skill

### Overview
Enhance the existing `test-debugging` skill to differentiate between code bugs, test bugs, and environment issues. This enables the feature-verify skill to provide actionable failure analysis.

### Changes Required:

#### 1. Update test-debugging SKILL.md
**File**: `plugins/qa-use/skills/test-debugging/SKILL.md`
**Changes**:
- Add "Failure Type Classification" section with three categories:
  - **CODE BUG**: Feature doesn't work as expected (redirect logic broken, validation missing)
  - **TEST BUG**: Selector outdated, timing issue, assertion value changed
  - **ENVIRONMENT**: Network, auth, data issues
- Add diagnostic questions for each type
- Add "Code Investigation" section for code bugs (suggest relevant files to check)
- Update suggested fixes to include category-specific recommendations
- Preserve all existing content

### Success Criteria:

#### Automated Verification:
- [ ] File updated: `ls -la plugins/qa-use/skills/test-debugging/SKILL.md`
- [ ] Contains new sections: `grep -E "CODE BUG|TEST BUG|ENVIRONMENT" plugins/qa-use/skills/test-debugging/SKILL.md`
- [ ] Preserves existing content: `grep "Selector not found" plugins/qa-use/skills/test-debugging/SKILL.md`

#### Manual Verification:
- [ ] Three failure types are clearly distinguished with actionable next steps
- [ ] Code bug section helps identify relevant source files
- [ ] Existing failure patterns table is preserved

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 3: Browser Navigator Agent

### Overview
Create the `browser-navigator` agent for autonomous page exploration. This agent uses the snapshot → analyze → act loop to complete navigation goals and is spawned by the feature-verify skill.

### Changes Required:

#### 1. Create browser-navigator agent
**File**: `plugins/qa-use/agents/browser-navigator.md`
**Changes**: Create new file with frontmatter:
- name: browser-navigator
- description: Multi-line description with use cases
- tools: [Bash]
- model: sonnet
- color: blue

Content includes:
- Purpose: snapshot → analyze → act loop
- When Spawned section (by feature-verify, by user, for reconnaissance)
- Input Format (JSON with goal, start_url, max_steps)
- Methodology (detailed numbered steps)
- Output Format (JSON with success, goal_achieved, final_url, findings, steps_taken)
- Error Handling (stuck detection, login walls, CAPTCHAs)
- Constraints (session creation, snapshot-before-action, honest reporting)

Content is fully specified in research document Section 8.5.

### Success Criteria:

#### Automated Verification:
- [ ] File exists: `ls plugins/qa-use/agents/browser-navigator.md`
- [ ] Has required frontmatter: `head -10 plugins/qa-use/agents/browser-navigator.md | grep -E "tools:|model:|color:"`
- [ ] Specifies Bash tool: `grep "tools: \[Bash\]" plugins/qa-use/agents/browser-navigator.md`

#### Manual Verification:
- [ ] Agent follows existing agent format (compare with test-analyzer.md)
- [ ] Input/output formats are well-defined JSON structures
- [ ] Error handling covers common blockers (login, CAPTCHA)
- [ ] Constraints prevent unsafe behavior (no CAPTCHA bypass attempts)

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 4: Browser Recorder Agent

### Overview
Create the `browser-recorder` agent that observes browser commands and generates qa-use test YAML definitions with variable extraction and assertion inference.

### Changes Required:

#### 1. Create browser-recorder agent
**File**: `plugins/qa-use/agents/browser-recorder.md`
**Changes**: Create new file with frontmatter:
- name: browser-recorder
- description: Multi-line description with use cases
- tools: [Bash, Write]
- model: sonnet
- color: green

Content includes:
- Purpose: Track commands and generate test YAML
- When Spawned section (by feature-verify, by test-authoring, by user)
- Input Format (JSON with test_name, description, session_id, record_mode)
- Recording Process (attach, track commands, generate YAML)
- Output Format (complete YAML example with variables, steps, assertions)
- Smart Features:
  - Variable extraction (repeated values)
  - Secret detection (passwords, tokens)
  - Assertion inference (URL changes, element waits)
  - Cleanup (remove redundant waits)
- Constraints (preserve existing test structure if editing)

Content is fully specified in research document Section 8.6.

### Success Criteria:

#### Automated Verification:
- [ ] File exists: `ls plugins/qa-use/agents/browser-recorder.md`
- [ ] Has Write tool: `grep "Write" plugins/qa-use/agents/browser-recorder.md`
- [ ] Specifies output location: `grep "qa-tests" plugins/qa-use/agents/browser-recorder.md`

#### Manual Verification:
- [ ] Generated YAML format matches test-authoring template
- [ ] Variable extraction logic is clearly documented
- [ ] Secret detection covers common patterns (password, token, secret)
- [ ] Agent knows how to use Write tool for file creation

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 5: Feature Verify Skill (Core Orchestration)

### Overview
Create the `feature-verify` skill - the main orchestration skill that ties everything together. This is what Claude Code uses 90% of the time to verify features.

### Changes Required:

#### 1. Create feature-verify skill directory and SKILL.md
**File**: `plugins/qa-use/skills/feature-verify/SKILL.md`
**Changes**: Create new file with comprehensive workflow:

**Frontmatter**:
- name: feature-verify
- description: Verify developed features through automated testing

**Sections**:
1. **When to Use**: After implementing features, fixing bugs, before committing UI changes
2. **Invocation**: `/qa-use:verify <description>`
3. **Workflow** with 5 phases:
   - Phase 1: Understand Context (parse request, identify feature/URL/success criteria, check recent changes)
   - Phase 2: Find or Create Test (search qa-tests/, spawn browser-navigator if needed, spawn browser-recorder)
   - Phase 3: Execute Test (run with --autofix --screenshots, stream progress)
   - Phase 4: Handle Failure (capture context, spawn test-analyzer, classify failure type, provide recommendations)
   - Phase 5: Report Outcome (success format, persistent failure format with code references)
4. **Critical Constraints**: Never mark verified if failed, always screenshot on failure, specific fixes not generic advice, escalate after 3 attempts, clean up sessions

Content is fully specified in research document Section 8.4.

### Success Criteria:

#### Automated Verification:
- [ ] File exists: `ls plugins/qa-use/skills/feature-verify/SKILL.md`
- [ ] Contains all phases: `grep -E "Phase [1-5]" plugins/qa-use/skills/feature-verify/SKILL.md | wc -l` (should be 5)
- [ ] References agents: `grep -E "browser-navigator|browser-recorder|test-analyzer" plugins/qa-use/skills/feature-verify/SKILL.md`

#### Manual Verification:
- [ ] Workflow is clear and follows logical progression
- [ ] Each phase has explicit inputs/outputs
- [ ] Failure handling is comprehensive (code bug vs test bug vs environment)
- [ ] Success/failure output formats are well-defined

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 6: Commands (Entry Points)

### Overview
Create three new commands as thin wrappers: `verify`, `explore`, and `record`.

### Changes Required:

#### 1. Create verify command
**File**: `plugins/qa-use/commands/verify.md`
**Changes**: Create command that:
- description: Verify a feature works through automated testing
- argument-hint: <description of what to verify>
- Invokes feature-verify skill with the description
- Handles missing description gracefully (prompt user)

#### 2. Create explore command
**File**: `plugins/qa-use/commands/explore.md`
**Changes**: Create command that:
- description: Explore a web page using browser automation
- argument-hint: <url>
- Spawns browser-navigator agent with goal "explore and document the page"
- Handles session creation automatically

#### 3. Create record command
**File**: `plugins/qa-use/commands/record.md`
**Changes**: Create command that:
- description: Record browser actions into a test definition
- argument-hint: [start|stop] [test-name]
- On `start`: Creates session, announces recording mode
- On `stop`: Spawns browser-recorder to generate YAML

### Success Criteria:

#### Automated Verification:
- [ ] All files exist: `ls plugins/qa-use/commands/{verify,explore,record}.md`
- [ ] Verify has correct hint: `grep "argument-hint" plugins/qa-use/commands/verify.md`
- [ ] Commands follow format: `head -5 plugins/qa-use/commands/verify.md | grep "description:"`

#### Manual Verification:
- [ ] Commands follow existing command format (compare with test-run.md)
- [ ] Each command clearly delegates to appropriate skill/agent
- [ ] Argument handling is documented

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 7: Documentation and Version Bump

### Overview
Update plugin manifest with new version and keywords, and update README with new commands and AI-first workflow documentation.

### Changes Required:

#### 1. Update plugin.json
**File**: `plugins/qa-use/.claude-plugin/plugin.json`
**Changes**:
- Bump version from "2.0.0" to "2.1.0"
- Add keywords: "browser", "automation", "feature-verification"
- Update description to mention browser automation

#### 2. Update README.md
**File**: `plugins/qa-use/README.md`
**Changes**:
- Add "Browser Automation" section after "Quick Start"
- Add new commands to Commands table: `verify`, `explore`, `record`
- Add new skills to Skills section: `feature-verify`, `browser-control`
- Add new agents to Agents section: `browser-navigator`, `browser-recorder`
- Add "AI-First Workflow" section explaining the verify → explore → record → test loop
- Add command cheat sheet from research document Section 8.8

### Success Criteria:

#### Automated Verification:
- [ ] Version bumped: `grep '"version": "2.1.0"' plugins/qa-use/.claude-plugin/plugin.json`
- [ ] Keywords added: `grep "browser" plugins/qa-use/.claude-plugin/plugin.json`
- [ ] README mentions verify: `grep "verify" plugins/qa-use/README.md`
- [ ] README mentions browser: `grep "Browser" plugins/qa-use/README.md`

#### Manual Verification:
- [ ] README is cohesive and well-organized
- [ ] New commands are documented with examples
- [ ] AI-first workflow section explains the vision
- [ ] Command cheat sheet is practical and complete

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Testing Strategy

### Integration Testing
Since this is a plugin (markdown files, not code), testing focuses on:

1. **Structure Verification**: All files exist in correct locations
2. **Content Verification**: Files contain expected sections and references
3. **Convention Compliance**: New files match existing plugin conventions
4. **Cross-Reference Integrity**: Skills reference agents that exist, commands reference skills that exist

### Manual Acceptance Test
From research document:

```
# Scenario: Fresh Next.js app with login page

1. Claude Code implements a login feature
2. Claude Code runs: /qa-use:verify "login works with valid credentials"
3. Plugin responds: "No test found. Exploring feature..."
4. browser-navigator explores /login, identifies form elements
5. browser-recorder generates qa-tests/login.yaml
6. Plugin runs test, reports: "✅ Feature verified: 5/5 steps passed"

# Failure scenario:
7. User changes button text from "Submit" to "Sign In"
8. Claude Code runs: /qa-use:verify "login works"
9. Test fails at step 4 (click submit button)
10. Plugin reports: "TEST BUG: Button text changed. Suggested fix: update target"
11. Claude Code approves fix, test re-runs and passes
```

This acceptance test should be executable after full implementation.

## References
- Research: `thoughts/taras/research/2026-01-23-qa-use-plugin-browser-feature.md`
- Browser CLI Plan: `thoughts/taras/plans/2026-01-23-browser-subcommand.md`
- Plugin v2 Research: `thoughts/taras/research/2026-01-22-qa-use-plugin-v2-redesign.md`
