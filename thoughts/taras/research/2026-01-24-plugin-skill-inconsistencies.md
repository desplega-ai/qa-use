---
date: 2026-01-24
researcher: Claude
git_branch: main
tags: [plugin, skills, documentation, consistency]
status: complete
---

# Plugin Skill Documentation: Inconsistencies & Simplification Recommendations

## Research Question

Analyze the qa-use plugin directory (`plugins/qa-use/`) for inconsistent command hints, mentions, and documentation patterns. Provide recommendations for simplification inspired by the agent-browser project.

## Summary

The qa-use plugin has **5 skills**, **4 agents**, and **8 commands**. While functional, the documentation suffers from:

1. **Inconsistent CLI invocation patterns** - mixing `qa-use` and `npx @desplega.ai/qa-use`
2. **Verbose, process-focused skills** - describing workflows rather than providing reference material
3. **Scattered information** - the same CLI commands documented differently across files
4. **Missing structure** - no `references/` or `templates/` directories for deep-dive content

The agent-browser project provides an excellent model: a single, comprehensive SKILL.md with quick start, command reference, and links to separate reference documents.

## Detailed Findings

### 1. CLI Invocation Inconsistencies

**Current state**: Mixed usage throughout the plugin:

| File | Pattern Used |
|------|-------------|
| `browser-control/SKILL.md:18` | `npx @desplega.ai/qa-use browser <command>` |
| `browser-control/SKILL.md:22` | `qa-use browser ...` (assuming global) |
| `test-running/SKILL.md:28` | `npx @desplega.ai/qa-use test run <name>` |
| `test-running/SKILL.md:50` | `qa-use test run <name>` |
| `test-init.md:17` | `npx @desplega.ai/qa-use test init` |
| `README.md:29` | `qa-use info` |
| `feature-verify/SKILL.md:68` | `qa-use test run <name>` |

**Recommendation**: Standardize on `qa-use` (global install) throughout all documentation. Add a single note at the top of SKILL.md about npx alternative.

### 2. Skill Documentation Style

**Current state**: Skills are written as workflow descriptions with numbered steps:

```markdown
## Workflow

1. **Prerequisites Check**
   - Verify `.qa-use-tests.json` exists
   - Verify test directory exists

2. **Construct CLI Command**
   - Base: `npx @desplega.ai/qa-use test run <name>`
   ...
```

**agent-browser style**: Command reference with clear syntax:

```markdown
## Quick start

agent-browser open <url>        # Navigate to page
agent-browser snapshot -i       # Get interactive elements

## Commands

### Navigation
agent-browser open <url>      # Navigate to URL
agent-browser back            # Go back
```

**Recommendation**: Restructure skills to be command references first, workflow guidance second.

### 3. Current File Structure vs. Recommended

**Current structure**:
```
plugins/qa-use/
├── agents/
│   ├── browser-navigator.md
│   ├── browser-recorder.md
│   ├── step-generator.md
│   └── test-analyzer.md
├── commands/
│   ├── explore.md
│   ├── record.md
│   ├── test-init.md
│   ├── test-run.md
│   ├── test-sync.md
│   ├── test-update.md
│   ├── test-validate.md
│   └── verify.md
├── skills/
│   ├── browser-control/SKILL.md
│   ├── feature-verify/SKILL.md
│   ├── test-authoring/SKILL.md + template.md
│   ├── test-debugging/SKILL.md
│   └── test-running/SKILL.md
├── README.md
└── .claude-plugin/plugin.json
```

**Recommended structure** (inspired by agent-browser):
```
plugins/qa-use/
├── skills/
│   └── qa-use/
│       ├── SKILL.md              # Single comprehensive skill doc
│       ├── references/
│       │   ├── browser-sessions.md
│       │   ├── test-format.md
│       │   ├── localhost-testing.md
│       │   └── failure-debugging.md
│       └── templates/
│           ├── basic-test.yaml
│           ├── auth-flow.yaml
│           └── form-test.yaml
├── agents/                       # Keep as-is (used for spawning)
│   └── ...
├── commands/                     # Simplified thin wrappers
│   └── ...
├── README.md
└── .claude-plugin/plugin.json
```

### 4. Specific Inconsistencies Found

#### 4.1 Argument Hints

| File | argument-hint |
|------|---------------|
| `test-init.md:3` | `(no arguments)` |
| `test-run.md:3` | `[test-name] [--headful] ...` |
| `verify.md:3` | `<description of what to verify>` |
| `explore.md:3` | `<url or goal>` |

**Issue**: Inconsistent use of parentheses, angle brackets, and square brackets.

**Recommendation**: Standardize on:
- `<required>` for required arguments
- `[optional]` for optional arguments
- No parentheses for hints

#### 4.2 README Installation Commands

`README.md:12-18`:
```markdown
/plugin marketplace add desplega-ai/qa-use
/plugin install qa-use@desplega.ai
```

**Issue**: These `/plugin` commands may be outdated or specific to a particular Claude Code version.

**Recommendation**: Verify these commands work with current Claude Code plugin system, or update to current syntax.

#### 4.3 Command vs Skill Overlap

Several commands are thin wrappers that just invoke skills:

- `/qa-use:test-run` → invokes `test-running` skill
- `/qa-use:verify` → invokes `feature-verify` skill
- `/qa-use:explore` → spawns `browser-navigator` agent

**Recommendation**: Keep commands thin, move all detailed documentation to skills/references.

### 5. Content That Should Be In References

The following detailed content is embedded in skills but would be better as separate reference documents:

| Current Location | Suggested Reference |
|-----------------|---------------------|
| `browser-control/SKILL.md` lines 100-265 | `references/browser-commands.md` |
| `test-debugging/SKILL.md` lines 65-153 | `references/failure-classification.md` |
| `test-authoring/SKILL.md` lines 73-104 | `references/test-format.md` |
| `test-running/SKILL.md` lines 101-119 | `references/download-structure.md` |

## Recommendations

### High Priority

1. **Create unified SKILL.md**: Consolidate `browser-control`, `test-running`, `test-authoring` into one comprehensive SKILL.md following agent-browser pattern

2. **Standardize CLI invocation**: Use `qa-use` everywhere, add single note about npx at top

3. **Create references/ directory**: Move detailed content out of main skill doc

### Medium Priority

4. **Standardize argument-hint format**: Use `<required>` and `[optional]` consistently

5. **Simplify commands/**: Each command file should be <30 lines, just invoking the skill

6. **Add templates/**: Provide ready-to-use test YAML examples

### Lower Priority

7. **Verify README installation commands**: Ensure `/plugin` commands are current

8. **Add quick start section**: First thing in SKILL.md should be copy-paste workflow

## Code References

- `plugins/qa-use/skills/browser-control/SKILL.md:18` - npx vs global inconsistency
- `plugins/qa-use/skills/test-running/SKILL.md:28-50` - mixed CLI patterns
- `plugins/qa-use/commands/test-init.md:17` - npx pattern
- `plugins/qa-use/README.md:12-18` - potentially outdated plugin commands
- `plugins/qa-use/skills/test-debugging/SKILL.md:65-153` - content for references/

## External References

- [agent-browser SKILL.md](https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md) - exemplary skill documentation
- [agent-browser references/](https://github.com/vercel-labs/agent-browser/tree/main/skills/agent-browser/references) - deep-dive documentation pattern
- [agent-browser templates/](https://github.com/vercel-labs/agent-browser/tree/main/skills/agent-browser/templates) - ready-to-use scripts

## Next Steps

1. Create new unified `skills/qa-use/SKILL.md` following agent-browser pattern
2. Move detailed content to `skills/qa-use/references/`
3. Create example templates in `skills/qa-use/templates/`
4. Update commands/ to be thin wrappers
5. Update README to reflect new structure
