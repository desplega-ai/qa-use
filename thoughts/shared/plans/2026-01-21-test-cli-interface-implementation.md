---
date: 2026-01-21T09:50:00Z
topic: "Test CLI Interface Implementation Plan"
author: claude
status: draft
autonomy: verbose
---

# Test CLI Interface Implementation Plan

## Overview

Implement a standalone CLI tool in qa-use that enables users to run test definitions from anywhere - a portable, npm-installable alternative to the Python `be/cli/` that executes tests via the desplega API.

**Target Experience:**
```bash
npm install -g @desplega.ai/qa-use
qa-use setup
qa-use test run login-flow
```

## Current State Analysis

### What Exists
- MCP server with 12 tools (`src/server.ts`)
- ApiClient with session/test management (`lib/api/index.ts`)
- Browser/tunnel management utilities
- Package bin entries for MCP server modes

### What's Missing
- TestDefinition types for YAML/JSON test files
- SSE streaming support in ApiClient
- CLI command structure (`src/cli/`)
- New ApiClient methods for `/vibe-qa/cli/*` endpoints
- Config file handling (`.qa-use-tests.json`)

### Key Files to Modify
- `lib/api/index.ts` - Add CLI methods (runCliTest, exportTest, etc.)
- `package.json` - Add commander dependency, update bin field
- `src/types.ts` or new `src/types/test-definition.ts` - Add TestDefinition types

### Key Files to Create
- `lib/api/sse.ts` - SSE parsing utility
- `src/cli/index.ts` - CLI entry point
- `src/cli/commands/*` - Command implementations
- `src/cli/lib/*` - CLI utilities (config, loader, runner, output)
- `bin/qa-use.js` - CLI binary entry

## Desired End State

1. Users can install qa-use globally and run tests from any directory
2. Test definitions stored as YAML/JSON files in `qa-tests/` directory
3. Real-time SSE progress output during test execution
4. Cloud sync capability (push local tests, pull from cloud)
5. Browser tunneling for localhost testing (automatic detection)

### Verification Commands
```bash
# Build and type check
bun run build

# Run existing tests
bun test

# Manual CLI verification
bun run cli setup
bun run cli test init
bun run cli test validate qa-tests/example.yaml
bun run cli test run example
```

## What We're NOT Doing

1. **Parallel test execution** - Deferred until `run-batch` API endpoint exists
2. **Interactive mode during tests** - Keep CLI simple, use MCP tools for interactive sessions
3. **Template generation from recordings** - Deferred until `generate-template` API endpoint
4. **Watch mode** - Phase 5 polish item, not MVP
5. **HTML reports** - Phase 5 polish item, not MVP

## Implementation Approach

Follow the three-phase approach from the research document:
1. **Phase 1**: Core API Integration - Add types, SSE support, and ApiClient methods
2. **Phase 2**: CLI Implementation - Build command structure and utilities
3. **Phase 3**: MCP Tools (Optional) - Wrap CLI functionality for AI assistants

---

## Phase 1: Core API Integration

### Overview
Add TypeScript types for test definitions and implement ApiClient methods for the `/vibe-qa/cli/*` endpoints with SSE streaming support.

### Changes Required

#### 1. TestDefinition Types (Auto-Generated)
**File**: `src/types/test-definition.ts` (new file, auto-generated)
**Changes**: Generate TypeScript types from the `/cli/schema` endpoint to keep them in sync

**Approach:**
1. Create a type generation script `scripts/generate-types.ts`
2. Fetch JSON Schema from `GET /vibe-qa/cli/schema`
3. Use `json-schema-to-typescript` to generate types
4. Output to `src/types/test-definition.ts`

```bash
# Add dev dependency
pnpm add -D json-schema-to-typescript

# Add npm script
# "generate:types": "bun scripts/generate-types.ts"
```

**Generated types will include:**
- StepAction enum (goto, fill, click, etc.)
- SimpleStep, ExtendedStep, Step union
- TestDefinition interface
- SSE event types (SSEStartEvent, SSEStepCompleteEvent, etc.)
- RunCliTestOptions, RunCliTestResult
- ValidationResult, ImportResult

**CI Integration:** Run type generation as part of build to catch schema drift.

Reference: Research document Section 6 (lines 1112-1222)

#### 2. SSE Parsing Utility
**File**: `lib/api/sse.ts` (new file)
**Changes**: Implement SSE parsing and streaming utilities

```typescript
// Functions to add:
// - parseSSE(chunk: string): SSEEvent[]
// - streamSSE(response: Response): AsyncGenerator<SSEEvent>
```

Reference: Research document Appendix A (lines 1354-1418)

#### 3. ApiClient CLI Methods
**File**: `lib/api/index.ts`
**Changes**: Add 5 new methods to ApiClient class

| Method | API Endpoint | Purpose |
|--------|--------------|---------|
| `runCliTest(options, onEvent?)` | `POST /cli/run` | Execute test with SSE streaming |
| `exportTest(testId, format?, includeDeps?)` | `GET /cli/export/{id}` | Export test to YAML/JSON |
| `validateTestDefinition(definitions)` | `POST /cli/validate` | Validate without running |
| `importTestDefinition(definitions, options?)` | `POST /cli/import` | Create/update tests |
| `getTestDefinitionSchema()` | `GET /cli/schema` | Get JSON Schema |

Reference: Research document Section 3.1 (lines 335-434)

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `bun run build`
- [ ] Existing tests pass: `bun test` (integration tests require API key)
- [x] New types export correctly from package

#### Manual Verification
- [ ] ApiClient methods callable (unit test or script)
- [ ] SSE parsing handles multi-event chunks correctly

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: CLI Implementation

### Overview
Build the CLI command structure using commander, implement config loading, test file discovery, and execution with progress output.

### Changes Required

#### 1. Dependencies
**File**: `package.json`
**Changes**: Add new dependencies

```json
{
  "dependencies": {
    "commander": "^12.0.0",
    "yaml": "^2.3.0",
    "glob": "^10.0.0"
  }
}
```

Also update `bin` field:
```json
{
  "bin": {
    "qa-use": "./bin/qa-use.js",
    "qa-use-mcp": "./bin/qa-use-mcp.js",
    "desplega-qa": "./bin/qa-use-mcp.js"
  }
}
```

#### 2. CLI Entry Point
**File**: `src/cli/index.ts` (new file)
**Changes**: Main CLI program with commander

```typescript
// Structure:
// - Parse args with commander
// - Register top-level commands: setup, info, serve
// - Register test subcommand group
```

Reference: Research document Section 3.2.3 (lines 555-580)

#### 3. CLI Commands Directory Structure
**Directory**: `src/cli/commands/` (new)

| File | Command | Description |
|------|---------|-------------|
| `setup.ts` | `qa-use setup` | Interactive API key configuration |
| `info.ts` | `qa-use info` | Show current config |
| `serve.ts` | `qa-use serve` | Start MCP server (existing) |
| `test/index.ts` | `qa-use test` | Test command group |
| `test/run.ts` | `qa-use test run` | Run local/cloud tests |
| `test/list.ts` | `qa-use test list` | List local/cloud tests |
| `test/export.ts` | `qa-use test export` | Export cloud test |
| `test/validate.ts` | `qa-use test validate` | Validate definition |
| `test/sync.ts` | `qa-use test sync` | Sync local/cloud |
| `test/init.ts` | `qa-use test init` | Initialize qa-tests/ |

Reference: Research document Section 3.2.1 (lines 506-537)

#### 4. CLI Utilities
**Directory**: `src/cli/lib/` (new)

| File | Purpose |
|------|---------|
| `config.ts` | Load/save `.qa-use-tests.json` |
| `loader.ts` | Discover and parse test files |
| `runner.ts` | Execute tests with SSE output |
| `output.ts` | Console formatting (colors, progress) |
| `browser.ts` | Browser tunneling for localhost |
| `id-injector.ts` | Inject IDs into YAML after persist |

Reference: Research document Sections 3.2.4-3.2.7 (lines 603-830)

#### 5. Binary Entry Point
**File**: `bin/qa-use.js` (new file)
**Changes**: Shebang entry for npm global install

```javascript
#!/usr/bin/env node
import '../dist/cli/index.js';
```

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles: `bun run build`
- [ ] CLI help works: `bun run cli --help`
- [ ] Test subcommands listed: `bun run cli test --help`

#### Manual Verification
- [ ] `qa-use setup` prompts for API key and saves to `.qa-use-tests.json`
- [ ] `qa-use test init` creates `qa-tests/` with example file
- [ ] `qa-use test list` shows files in `qa-tests/`
- [ ] `qa-use test validate <test>` validates against API
- [ ] `qa-use test run <test>` executes with SSE progress output

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: MCP Tools (Optional Enhancement)

### Overview
Add MCP tools that wrap CLI functionality, enabling AI assistants to use local test definitions directly.

### Changes Required

#### 1. New MCP Tools
**File**: `src/server.ts`
**Changes**: Add 6 new tools to the MCP server

| Tool | Purpose |
|------|---------|
| `run_local_tests` | Run local TestDefinitions via SSE |
| `export_to_local_test` | Export DB test to local YAML/JSON file |
| `validate_local_test` | Validate local test without running |
| `import_local_test` | Create/update cloud test from local file |
| `get_local_test_schema` | Get JSON Schema for local tests |
| `list_local_tests` | Discover local test files |

Reference: Research document Section 3.3 (lines 832-854) and Appendix B (lines 1422-1485)

### Success Criteria

#### Automated Verification
- [ ] MCP server starts: `bun run src/index.ts`
- [ ] Tools list includes new tools

#### Manual Verification
- [ ] `run_test_definitions` tool executes inline definitions
- [ ] `export_test` tool returns YAML/JSON content

**Implementation Note**: This phase is optional and can be implemented after Phase 2 is verified working.

---

## Testing Strategy

### Unit Tests
- SSE parsing utility
- Config file loading/saving
- Test file discovery and parsing
- ID injection into YAML

### Integration Tests
- ApiClient CLI methods against real API (with test key)
- Full CLI command flows

### Manual Testing Checklist
1. Fresh install: `npm install -g @desplega.ai/qa-use`
2. Setup flow: `qa-use setup` (enter API key)
3. Init project: `qa-use test init`
4. Create test: Copy example to `qa-tests/my-test.yaml`
5. Validate: `qa-use test validate my-test`
6. Run: `qa-use test run my-test`
7. Persist: `qa-use test run my-test --persist` (should inject ID)
8. Cloud list: `qa-use test list --cloud`
9. Export: `qa-use test export <id>`
10. Sync: `qa-use test sync --pull`

---

## Quick Verification Reference

### Common Commands
```bash
# Build
bun run build

# Type check
bun run typecheck

# Run tests
bun test

# CLI development
bun run cli --help
bun run cli test run <test>
```

### Key Files
- Primary implementation: `lib/api/index.ts`, `src/cli/`
- Types: `src/types/test-definition.ts`
- Tests: `src/cli/*.test.ts`, `lib/api/*.test.ts`
- Config: `package.json` (bin, dependencies)

---

## References

- Research document: `thoughts/shared/research/2026-01-20-test-cli-interface-implementation.md`
- API documentation: https://api.desplega.ai/vibe-qa/cli/docs.md
- Existing MCP tools: `src/server.ts` (lines 762-1060)
- Existing ApiClient: `lib/api/index.ts`
