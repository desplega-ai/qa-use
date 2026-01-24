---
date: 2026-01-24
author: Claude
git_branch: main
tags: [plugin, skills, documentation, refactoring]
status: draft
autonomy: autopilot
commit_per_phase: false
---

# Plugin Skill Documentation Simplification

## Overview

Restructure the qa-use plugin (`plugins/qa-use/`) to follow the agent-browser documentation pattern: a single comprehensive SKILL.md with command reference, plus separate `references/` and `templates/` directories for deep-dive content.

## Current State Analysis

The plugin currently has:
- **5 skills** in separate directories (browser-control, feature-verify, test-authoring, test-debugging, test-running)
- **4 agents** (browser-navigator, browser-recorder, step-generator, test-analyzer)
- **8 commands** as thin wrappers

**Problems identified:**
1. CLI invocation inconsistency (`qa-use` vs `npx @desplega.ai/qa-use`)
2. Skills are workflow-focused, not reference-focused
3. Detailed content scattered across multiple skill files
4. No `references/` or `templates/` directories
5. Inconsistent `argument-hint` format in commands

### Key Discoveries:
- `plugins/qa-use/skills/browser-control/SKILL.md:18-22` - mixes npx and global patterns
- `plugins/qa-use/skills/test-running/SKILL.md:28-50` - CLI pattern inconsistency
- `plugins/qa-use/commands/test-init.md:3` - uses `(no arguments)` parentheses
- `plugins/qa-use/README.md:12-18` - outdated `/plugin` install commands

## Desired End State

```
plugins/qa-use/
├── skills/
│   └── qa-use/
│       ├── SKILL.md              # Single comprehensive skill (agent-browser style)
│       ├── references/
│       │   ├── browser-commands.md
│       │   ├── test-format.md
│       │   ├── localhost-testing.md
│       │   └── failure-debugging.md
│       └── templates/
│           ├── basic-test.yaml
│           ├── auth-flow.yaml
│           └── form-test.yaml
├── agents/                       # Keep as-is
├── commands/                     # Simplified thin wrappers
├── README.md                     # Updated
└── .claude-plugin/plugin.json    # Version bumped to 2.3.0
```

Note: Old skill directories (browser-control, feature-verify, test-authoring, test-debugging, test-running) will be **deleted**.

**Verification of success:**
- Single unified SKILL.md exists at `skills/qa-use/SKILL.md`
- All CLI references use `qa-use` (not npx) with single note about npx alternative
- All commands have consistent `argument-hint` format
- `references/` contains 4 deep-dive documents
- `templates/` contains 3 ready-to-use YAML examples
- Old skill directories are deleted
- Plugin version is 2.3.0

## Quick Verification Reference

Commands to verify the implementation:
- `ls -la plugins/qa-use/skills/` - should only show `qa-use/` directory
- `ls -la plugins/qa-use/skills/qa-use/` - verify new structure exists
- `grep -r "npx @desplega.ai" plugins/qa-use/` - should return minimal hits (only in npx note)
- `grep version plugins/qa-use/.claude-plugin/plugin.json` - should show 2.3.0

Key files to check:
- `plugins/qa-use/skills/qa-use/SKILL.md` - main unified skill
- `plugins/qa-use/commands/*.md` - simplified thin wrappers
- `plugins/qa-use/README.md` - updated installation
- `plugins/qa-use/.claude-plugin/plugin.json` - version 2.3.0

## What We're NOT Doing

- **NOT** changing agents/ - these stay as-is (they define spawnable autonomous agents)
- **NOT** changing CLI behavior - documentation only

## Implementation Approach

1. Create the new unified SKILL.md following agent-browser pattern
2. Extract detailed content into references/
3. Create template test YAMLs
4. Update commands to be thin wrappers
5. Update README with current installation
6. Delete old skills and bump plugin version to 2.3.0

---

## Phase 1: Create New Skill Directory Structure

### Overview
Set up the new `skills/qa-use/` directory with SKILL.md skeleton, references/, and templates/ directories.

### Changes Required:

#### 1. Create Directory Structure
**Action**: Create directories and initial files

```bash
mkdir -p plugins/qa-use/skills/qa-use/references
mkdir -p plugins/qa-use/skills/qa-use/templates
```

#### 2. Create SKILL.md Skeleton
**File**: `plugins/qa-use/skills/qa-use/SKILL.md`
**Content**: Frontmatter + Quick Start section (following agent-browser pattern)

The SKILL.md should have:
- YAML frontmatter with `name`, `description`, `allowed-tools`
- Quick start section (4-5 lines showing core workflow)
- Core workflow explanation
- Commands section organized by category

### Success Criteria:

#### Automated Verification:
- [ ] Directory exists: `ls plugins/qa-use/skills/qa-use/`
- [ ] SKILL.md exists: `ls plugins/qa-use/skills/qa-use/SKILL.md`
- [ ] References dir exists: `ls plugins/qa-use/skills/qa-use/references/`
- [ ] Templates dir exists: `ls plugins/qa-use/skills/qa-use/templates/`

#### Manual Verification:
- [ ] SKILL.md has proper frontmatter with name and description
- [ ] Quick start section is present and follows agent-browser style (compact, copy-paste ready)

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 2: Write Unified SKILL.md Content

### Overview
Consolidate content from all 5 existing skills into the new unified SKILL.md, following agent-browser's command-reference style.

### Changes Required:

#### 1. SKILL.md Structure
**File**: `plugins/qa-use/skills/qa-use/SKILL.md`
**Content sections**:

1. **Frontmatter** (from research - agent-browser style):
```yaml
---
name: qa-use
description: E2E testing and browser automation with qa-use CLI. Use when the user needs to run tests, verify features, automate browser interactions, or debug test failures.
allowed-tools: Bash(qa-use *)
---
```

2. **Quick start** (5 commands showing core workflow):
```bash
qa-use browser create --viewport desktop  # Create browser session
qa-use browser goto https://example.com   # Navigate
qa-use browser snapshot                   # Get element refs
qa-use browser click e3                   # Interact by ref
qa-use browser close                      # Cleanup
```

3. **Core workflow** (numbered steps)

4. **Commands** (organized by category):
   - Browser session management
   - Navigation
   - Element interaction
   - Inspection
   - Logs (console, network) - NEW from browser-api-gaps implementation
   - Test generation - NEW from browser-api-gaps implementation
   - Test operations (run, validate, sync)

5. **Test format** (brief overview, link to reference)

6. **Failure debugging** (brief overview, link to reference)

7. **Deep-dive references** table

8. **Templates** table

#### 2. Content Sources
Pull content from:
- `skills/browser-control/SKILL.md` - browser commands (main source)
- `skills/test-running/SKILL.md` - test CLI commands
- `skills/test-authoring/SKILL.md` - test format overview
- `skills/test-debugging/SKILL.md` - failure classification summary
- `skills/feature-verify/SKILL.md` - verification workflow
- **NEW CLI commands** (from browser-api-gaps implementation):
  - `qa-use browser logs console` - view console logs
  - `qa-use browser logs network` - view network request logs
  - `qa-use browser generate-test` - generate test YAML from recorded session
  - `qa-use browser status` - now shows additional fields (app_url, recording_url, etc.)

### Success Criteria:

#### Automated Verification:
- [ ] SKILL.md word count > 1000: `wc -w plugins/qa-use/skills/qa-use/SKILL.md`
- [ ] Contains "Quick start": `grep -c "Quick start" plugins/qa-use/skills/qa-use/SKILL.md`
- [ ] Contains "## Commands": `grep -c "## Commands" plugins/qa-use/skills/qa-use/SKILL.md`
- [ ] No npx in command examples (except single note): `grep -c "npx @desplega.ai" plugins/qa-use/skills/qa-use/SKILL.md` should be 0-1

#### Manual Verification:
- [ ] Quick start section is copy-paste ready (no placeholder values)
- [ ] Commands are organized by category (Browser, Test, etc.)
- [ ] Style matches agent-browser (concise, reference-focused)
- [ ] All CLI examples use `qa-use` not `npx`
- [ ] New commands documented: `logs console`, `logs network`, `generate-test`

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 3: Create Reference Documents

### Overview
Extract detailed content from existing skills into separate reference documents in `references/`.

### Changes Required:

#### 1. browser-commands.md
**File**: `plugins/qa-use/skills/qa-use/references/browser-commands.md`
**Source**: `skills/browser-control/SKILL.md` lines 100-265 + new CLI commands
**Content**:
- Complete command reference for `qa-use browser` CLI
- All flags and options
- Common mistakes table
- Session management details
- **NEW**: Logs commands (`logs console`, `logs network`)
- **NEW**: Test generation (`generate-test`)
- **NEW**: Enhanced status output (app_url, recording_url, har_url, etc.)

#### 2. test-format.md
**File**: `plugins/qa-use/skills/qa-use/references/test-format.md`
**Source**: `skills/test-authoring/SKILL.md` + `skills/test-authoring/template.md`
**Content**:
- Full test YAML specification
- Variable syntax
- All available actions table
- Dependencies (depends_on)

#### 3. localhost-testing.md
**File**: `plugins/qa-use/skills/qa-use/references/localhost-testing.md`
**Source**: `skills/test-running/SKILL.md` (tunnel sections)
**Content**:
- Why tunnels are needed
- `--tunnel` flag usage
- `qa-use browser create --tunnel` workflow
- WebSocket URL reuse pattern

#### 4. failure-debugging.md
**File**: `plugins/qa-use/skills/qa-use/references/failure-debugging.md`
**Source**: `skills/test-debugging/SKILL.md` lines 65-153
**Content**:
- CODE BUG vs TEST BUG vs ENVIRONMENT classification
- Diagnostic questions for each
- Common failure patterns table
- Code investigation guidance

### Success Criteria:

#### Automated Verification:
- [ ] browser-commands.md exists: `ls plugins/qa-use/skills/qa-use/references/browser-commands.md`
- [ ] test-format.md exists: `ls plugins/qa-use/skills/qa-use/references/test-format.md`
- [ ] localhost-testing.md exists: `ls plugins/qa-use/skills/qa-use/references/localhost-testing.md`
- [ ] failure-debugging.md exists: `ls plugins/qa-use/skills/qa-use/references/failure-debugging.md`
- [ ] Each file has content: `wc -l plugins/qa-use/skills/qa-use/references/*.md`

#### Manual Verification:
- [ ] Each reference document has clear title and purpose
- [ ] Content extracted accurately from source skills
- [ ] No duplicate content between references and main SKILL.md

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 4: Create Template Test Files

### Overview
Create ready-to-use test YAML templates in `templates/`.

### Changes Required:

#### 1. basic-test.yaml
**File**: `plugins/qa-use/skills/qa-use/templates/basic-test.yaml`
**Content**: Simple navigation + assertion test

```yaml
name: Basic Test
description: Navigate and verify page element
app_config: $APP_CONFIG_ID
steps:
  - action: goto
    url: /
  - action: to_be_visible
    target: main content area
```

#### 2. auth-flow.yaml
**File**: `plugins/qa-use/skills/qa-use/templates/auth-flow.yaml`
**Content**: Login flow with variables for credentials

```yaml
name: Authentication Flow
description: Login with credentials and verify dashboard
app_config: $APP_CONFIG_ID
variables:
  email: test@example.com
  password: "********"
steps:
  - action: goto
    url: /login
  - action: fill
    target: email input
    value: $email
  - action: fill
    target: password input
    value: $password
  - action: click
    target: sign in button
  - action: wait_for_url
    url: /dashboard
  - action: to_be_visible
    target: welcome message
```

#### 3. form-test.yaml
**File**: `plugins/qa-use/skills/qa-use/templates/form-test.yaml`
**Content**: Form submission with validation

```yaml
name: Form Submission
description: Fill form and verify submission success
app_config: $APP_CONFIG_ID
variables:
  name: Test User
  email: test@example.com
  message: This is a test message
steps:
  - action: goto
    url: /contact
  - action: fill
    target: name input
    value: $name
  - action: fill
    target: email input
    value: $email
  - action: fill
    target: message textarea
    value: $message
  - action: click
    target: submit button
  - action: to_be_visible
    target: success message
```

### Success Criteria:

#### Automated Verification:
- [ ] basic-test.yaml exists: `ls plugins/qa-use/skills/qa-use/templates/basic-test.yaml`
- [ ] auth-flow.yaml exists: `ls plugins/qa-use/skills/qa-use/templates/auth-flow.yaml`
- [ ] form-test.yaml exists: `ls plugins/qa-use/skills/qa-use/templates/form-test.yaml`
- [ ] YAML is valid: `cat plugins/qa-use/skills/qa-use/templates/*.yaml | head -50`

#### Manual Verification:
- [ ] Templates are ready to use (just needs app_config_id)
- [ ] Variable placeholders are clearly marked
- [ ] Comments explain what to customize

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 5: Simplify Command Files

### Overview
Update all command files to be thin wrappers (<30 lines each) with consistent `argument-hint` format.

### Changes Required:

#### 1. Standardize argument-hint Format
All commands should use:
- `<required>` for required arguments
- `[optional]` for optional arguments
- No parentheses

| Command | Current | New |
|---------|---------|-----|
| test-init.md | `(no arguments)` | (remove argument-hint entirely) |
| test-run.md | Keep as-is | `[test-name] [--flags...]` |
| verify.md | Keep as-is | `<description>` |
| explore.md | Keep as-is | `<url or goal>` |

#### 2. Simplify Content
Each command file should have:
1. Frontmatter (description, argument-hint)
2. Title (h1)
3. Brief description (1-2 sentences)
4. Arguments table (if any)
5. "Invokes skill: qa-use" note
6. Example usage (2-3 examples max)

Remove verbose workflow sections - that detail lives in SKILL.md now.

### Files to Update:
- `commands/explore.md`
- `commands/record.md`
- `commands/test-init.md`
- `commands/test-run.md`
- `commands/test-sync.md`
- `commands/test-update.md`
- `commands/test-validate.md`
- `commands/verify.md`

### Success Criteria:

#### Automated Verification:
- [ ] No "(no arguments)" in commands: `grep -r "(no arguments)" plugins/qa-use/commands/`
- [ ] All commands under 40 lines: `wc -l plugins/qa-use/commands/*.md`
- [ ] Each has argument-hint or no hint: `grep -l "argument-hint" plugins/qa-use/commands/*.md`

#### Manual Verification:
- [ ] Each command file is concise (< 30 lines of content)
- [ ] Argument hints use consistent format
- [ ] Each references the qa-use skill

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 6: Update README, Delete Old Skills, Bump Version

### Overview
Update the README, delete the old skill directories, and bump the plugin version to 2.3.0.

### Changes Required:

#### 1. Update README.md
**File**: `plugins/qa-use/README.md`
**Changes**:
- Update installation section (verify `/plugin` commands are current)
- Update skills section to reference new unified skill
- Update references section to point to new `references/` directory
- Keep command table but simplify descriptions

#### 2. Delete Old Skill Directories
**Action**: Remove old skill directories completely

```bash
rm -rf plugins/qa-use/skills/browser-control
rm -rf plugins/qa-use/skills/feature-verify
rm -rf plugins/qa-use/skills/test-authoring
rm -rf plugins/qa-use/skills/test-debugging
rm -rf plugins/qa-use/skills/test-running
```

#### 3. Bump Plugin Version
**File**: `plugins/qa-use/.claude-plugin/plugin.json`
**Change**: Update version from `2.2.2` to `2.3.0`

```json
{
  "version": "2.3.0",
  ...
}
```

### Success Criteria:

#### Automated Verification:
- [ ] README updated: `grep -c "skills/qa-use/SKILL.md" plugins/qa-use/README.md`
- [ ] Old skills deleted: `ls plugins/qa-use/skills/` should only show `qa-use/`
- [ ] Version bumped: `grep "version" plugins/qa-use/.claude-plugin/plugin.json`

#### Manual Verification:
- [ ] README installation instructions are current
- [ ] Only `qa-use/` directory remains in skills/
- [ ] plugin.json shows version 2.3.0

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Testing Strategy

1. **Structure verification**: Check all new files/directories exist, old skills deleted
2. **Content verification**: Grep for key patterns (Quick start, Commands, etc.)
3. **Consistency verification**: Check no npx patterns remain in examples
4. **Version verification**: Confirm plugin.json shows 2.3.0
5. **Manual review**: Read through SKILL.md to verify agent-browser style

## References

- Related research: `thoughts/taras/research/2026-01-24-plugin-skill-inconsistencies.md`
- Browser API gaps plan: `thoughts/shared/plans/2026-01-24-browser-api-gaps.md` (new commands to document)
- Inspiration: [agent-browser SKILL.md](https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md)
- Current plugin: `plugins/qa-use/`
