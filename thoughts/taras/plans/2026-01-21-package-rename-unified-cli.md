---
date: 2026-01-21T15:45:00Z
topic: "Package Rename to @desplega.ai/qa-use with Unified CLI"
author: Claude
git_branch: main
status: draft
---

# Package Rename to @desplega.ai/qa-use with Unified CLI

## Overview

Rename the npm package from `@desplega.ai/qa-use-mcp` to `@desplega.ai/qa-use` and unify the CLI so that MCP functionality is accessible as a subcommand. This enables `npx @desplega.ai/qa-use test run` to work correctly (currently broken because npx runs the MCP binary instead of the test CLI).

## Current State Analysis

**Package name**: `@desplega.ai/qa-use-mcp`

**Current bin configuration** (`package.json:8-12`):
```json
"bin": {
  "qa-use": "./bin/qa-use.js",        // Test CLI (commander.js)
  "qa-use-mcp": "dist/src/index.js",  // MCP server (manual arg parsing)
  "desplega-qa": "dist/src/index.js"  // MCP server alias
}
```

**Problem**: When users run `npx @desplega.ai/qa-use-mcp test`, npm matches the package basename (`qa-use-mcp`) to the MCP binary, not the test CLI.

**Two separate entry points**:
- `src/cli/index.ts` - Test CLI with commander.js (setup, info, test commands)
- `src/index.ts` - MCP server with manual argument parsing (tunnel, --http, stdio modes)

## Desired End State

**Package name**: `@desplega.ai/qa-use`

**New bin configuration**:
```json
"bin": {
  "qa-use": "./bin/qa-use.js"
}
```

**Unified CLI structure**:
```
qa-use setup              # Configure API key
qa-use info               # Show configuration
qa-use test run           # Run tests
qa-use test list          # List tests
qa-use test init          # Initialize test directory
qa-use test validate      # Validate test definition
qa-use mcp                # Start MCP server (stdio mode)
qa-use mcp --http         # Start MCP server (HTTP mode)
qa-use mcp --port 8080    # HTTP mode with custom port
qa-use mcp tunnel         # Start tunnel mode
qa-use mcp tunnel --visible  # Tunnel with visible browser
```

**Verification**: `npx @desplega.ai/qa-use test run` runs the test CLI correctly.

### Key Discoveries:
- CLI uses commander.js (`src/cli/index.ts:7`)
- MCP server uses manual arg parsing (`src/index.ts:21-30`)
- Version is hardcoded in CLI (`src/cli/index.ts:13`) - should be fixed

## Quick Verification Reference

Common commands:
- `bun run build` - Compile TypeScript
- `bun run lint` - Run linter
- `bun run typecheck` - Type check
- `bun test` - Run tests

Key files:
- `src/cli/index.ts` - CLI entry point
- `src/cli/commands/mcp.ts` - NEW: MCP command (to be created)
- `package.json` - Package configuration
- `bin/qa-use.js` - Binary entry point

## What We're NOT Doing

- Keeping backward-compatible aliases (`qa-use-mcp`, `desplega-qa`)
- Migrating users automatically (clean break, old package deprecated)
- Changing MCP server functionality (only wrapping it in CLI)
- Writing unit tests for the new MCP command (manual verification sufficient)

## Implementation Approach

1. Create a new `mcp` command using commander.js that wraps the existing MCP server logic
2. Extract the arg parsing logic from `src/index.ts` into the new command
3. Update `package.json` with new name and single binary
4. Update all documentation and help text
5. Release as v2.0.0, deprecate old package

---

## Phase 1: Create MCP Command

### Overview
Add a new `mcp` subcommand to the existing CLI that provides all the MCP server functionality (stdio, HTTP, tunnel modes).

### Changes Required:

#### 1. Create MCP command module
**File**: `src/cli/commands/mcp.ts` (NEW)
**Changes**:
- Create commander.js command for `mcp`
- Add `tunnel` subcommand
- Add options: `--http`, `--port`, `--visible`, `--subdomain`
- Import and call the appropriate server start functions from existing modules

```typescript
// Proposed structure
import { Command } from 'commander';

export const mcpCommand = new Command('mcp')
  .description('Start the MCP server')
  .option('--http, --api', 'Run in HTTP API server mode')
  .option('-p, --port <port>', 'Port for HTTP server', '3000')
  .action(async (options) => {
    // Start stdio or HTTP mode
  });

mcpCommand
  .command('tunnel')
  .description('Run persistent WebSocket tunnel')
  .option('--visible', 'Show browser window')
  .option('-s, --subdomain <name>', 'Custom subdomain')
  .action(async (options) => {
    // Start tunnel mode
  });
```

#### 2. Register MCP command in CLI
**File**: `src/cli/index.ts`
**Changes**:
- Import `mcpCommand` from `./commands/mcp.js`
- Add `program.addCommand(mcpCommand)`
- Fix hardcoded version (import from package.json or use a constant)

#### 3. Simplify MCP entry point
**File**: `src/index.ts`
**Changes**:
- Remove manual argument parsing
- Keep it as a simple entry that starts stdio mode (for backward compatibility during transition)
- Or: Make it just re-export the CLI (decide during implementation)

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `bun run build`
- [x] Linting passes: `bun run lint`
- [x] Type check passes: `bun run typecheck`
- [x] Tests pass: `bun test` (2 pre-existing integration test failures unrelated to changes)

#### Manual Verification:
- [x] `bun run cli mcp --help` shows MCP help with all options
- [x] `bun run cli mcp` starts stdio server (test with MCP inspector)
- [x] `bun run cli mcp --http` starts HTTP server on port 3000
- [x] `bun run cli mcp --http --port 8080` starts HTTP server on port 8080
- [x] `bun run cli mcp tunnel --help` shows tunnel options
- [x] `bun run cli mcp tunnel` starts tunnel mode
- [x] Existing commands still work: `bun run cli setup --help`, `bun run cli test --help`

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 2: Update Package Configuration

### Overview
Update package.json with the new package name, single binary entry, and bump to v2.0.0.

### Changes Required:

#### 1. Update package.json
**File**: `package.json`
**Changes**:
```json
{
  "name": "@desplega.ai/qa-use",
  "version": "2.0.0",
  "description": "QA automation tool for browser testing with MCP server support",
  "bin": {
    "qa-use": "./bin/qa-use.js"
  }
}
```

#### 2. Update CLI version
**File**: `src/cli/index.ts`
**Changes**:
- Update version to '2.0.0' or implement dynamic version reading

### Success Criteria:

#### Automated Verification:
- [x] Build succeeds: `bun run build`
- [x] Package contents correct: `npm pack --dry-run 2>&1 | head -20`

#### Manual Verification:
- [x] `node dist/src/cli/index.js --version` shows 2.0.0
- [x] `node dist/src/cli/index.js --help` shows unified help
- [x] Only one binary (`qa-use`) in npm pack output

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 3: Update Documentation

### Overview
Update README, help text, and any other documentation to reflect the new package name and unified CLI.

### Changes Required:

#### 1. Update README
**File**: `README.md`
**Changes**:
- Update package name in installation instructions
- Update all `npx` examples to use `@desplega.ai/qa-use`
- Update CLI usage examples to show unified structure
- Add migration note for users of old package

#### 2. Update MCP help text
**File**: `src/cli/commands/mcp.ts`
**Changes**:
- Ensure help text shows correct command name (`qa-use mcp` not `qa-use-mcp`)
- Update examples in descriptions

#### 3. Update CLAUDE.md if needed
**File**: `CLAUDE.md`
**Changes**:
- Update any references to old package name

### Success Criteria:

#### Automated Verification:
- [x] No broken links in README: `grep -E '\[.*\]\(.*\)' README.md | head -10`
- [x] Build still works: `bun run build`

#### Manual Verification:
- [x] README installation section shows `@desplega.ai/qa-use`
- [x] All `npx` examples use new package name
- [x] Help text for all commands looks correct

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 4: Release and Deprecate

### Overview
Commit, push, publish the new package to npm, and deprecate the old one.

### Changes Required:

#### 0. Commit and push changes
**Commands**:
```bash
git add -A
git commit -m "Rename package to @desplega.ai/qa-use with unified CLI"
git push origin main
```

#### 1. Publish new package
**Commands**:
```bash
npm login
bun release
```

#### 2. Deprecate old package (manual)
**Deprecation message**: "This package has been renamed to @desplega.ai/qa-use. Please update your installation."

### Success Criteria:

#### Automated Verification:
- [ ] New package accessible: `npm view @desplega.ai/qa-use`
- [ ] Old package shows deprecation: `npm view @desplega.ai/qa-use-mcp`

#### Manual Verification:
- [ ] `npx @desplega.ai/qa-use --help` shows unified CLI
- [ ] `npx @desplega.ai/qa-use test --help` shows test commands (this is the main fix!)
- [ ] `npx @desplega.ai/qa-use mcp --help` shows MCP options
- [ ] `npx @desplega.ai/qa-use-mcp` shows deprecation warning

**Implementation Note**: This is the final phase. Verify everything works before marking complete.

---

## Testing Strategy

**Unit tests**: Not adding new tests for the MCP command wrapper (it delegates to existing tested code)

**Manual testing checklist**:
1. Build and run locally with `bun run cli`
2. Test all MCP modes (stdio, HTTP, tunnel)
3. Test all existing CLI commands (setup, info, test)
4. Pack and install locally to verify npx behavior
5. After publish, verify with fresh npx install

## References

- Related research: `thoughts/taras/research/2026-01-21-npm-release-test-cli-not-accessible.md`
- Current CLI: `src/cli/index.ts`
- Current MCP entry: `src/index.ts`
