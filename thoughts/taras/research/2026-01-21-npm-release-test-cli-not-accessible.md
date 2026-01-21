---
date: 2026-01-21T15:30:00Z
topic: "npm Release Test CLI Not Accessible via npx"
researcher: Claude
git_branch: main
git_commit: 4ab9b05
tags: [npm, cli, distribution, npx]
status: complete
---

# Research: npm Release Test CLI Not Accessible via npx

## Research Question

Why does `npx -y @desplega.ai/qa-use-mcp@latest test` not work, even though the test CLI files are included in the npm package?

## Summary

The test CLI **is** included in the npm package, but it's not accessible via `npx @desplega.ai/qa-use-mcp` because **npm uses the package name to determine which binary to run**, and the package name (`qa-use-mcp`) matches the MCP server binary, not the test CLI binary.

## Root Cause

### How npx Resolves Binaries

When you run `npx @desplega.ai/qa-use-mcp`, npm:
1. Installs the package temporarily
2. Looks for a binary that matches the package's basename (`qa-use-mcp`)
3. Executes that binary with any additional arguments

### Current package.json Configuration

```json:package.json:8-12
"bin": {
  "qa-use": "./bin/qa-use.js",        // Test CLI
  "qa-use-mcp": "dist/src/index.js",  // MCP server
  "desplega-qa": "dist/src/index.js"  // MCP server alias
}
```

### The Mismatch

| Package name | `@desplega.ai/qa-use-mcp` |
|--------------|---------------------------|
| Binary npm runs | `qa-use-mcp` (MCP server) |
| Desired binary | `qa-use` (Test CLI) |

When user runs `npx @desplega.ai/qa-use-mcp test`, the `test` argument goes to the MCP server (`src/index.ts`), which shows its help text because it doesn't recognize "test" as a valid command.

## Verification

### Test CLI IS in the package

```bash
$ npm pack --dry-run 2>&1 | grep -E "cli|bin"
npm notice 91B bin/qa-use.js
npm notice 166B dist/src/cli/commands/info.d.ts
... (all CLI files present)
```

### But npx runs the wrong binary

```bash
$ npx -y @desplega.ai/qa-use-mcp@latest test --help
# Shows MCP server help, not test CLI help

$ npx -y @desplega.ai/qa-use-mcp@latest
# Also shows MCP server help
```

### Local install works correctly

```bash
$ npm install @desplega.ai/qa-use-mcp
$ npx qa-use test --help
# Works! Shows test CLI help
```

The difference: after local install, you can call `npx qa-use` which correctly runs the test CLI.

## Solution Options

### Option 1: Rename Package to `@desplega.ai/qa-use` (Recommended)

Rename the package so the default binary matches the test CLI, then add MCP as a subcommand.

**New bin structure:**
```json
"bin": {
  "qa-use": "./bin/qa-use.js"
}
```

**New CLI structure:**
```
qa-use setup              # Configure API key
qa-use info               # Show configuration
qa-use test run           # Run tests
qa-use test list          # List tests
qa-use mcp                # Start MCP server (stdio)
qa-use mcp --http         # Start MCP server (HTTP)
qa-use mcp tunnel         # Start tunnel mode
```

**Pros:**
- `npx @desplega.ai/qa-use test run` works as expected
- Single unified CLI entry point
- Cleaner command structure

**Cons:**
- Breaking change for existing users
- Need to deprecate `@desplega.ai/qa-use-mcp`

### Option 2: Keep Separate Package, Add qa-use-test Binary

Add a dedicated binary that matches test CLI usage:

```json
"bin": {
  "qa-use": "./bin/qa-use.js",
  "qa-use-mcp": "dist/src/index.js",
  "qa-use-test": "./bin/qa-use.js"  // New entry
}
```

Users would run: `npx @desplega.ai/qa-use-mcp qa-use-test run`

**Pros:**
- No breaking changes

**Cons:**
- Awkward command: `npx @desplega.ai/qa-use-mcp qa-use-test run`
- Package name still suggests MCP-only

### Option 3: Document the Workaround

Tell users to install globally or use the explicit binary name:

```bash
# Global install
npm install -g @desplega.ai/qa-use-mcp
qa-use test run

# Or explicit binary
npx -p @desplega.ai/qa-use-mcp qa-use test run
```

**Pros:**
- No code changes

**Cons:**
- Poor DX
- Confusing for new users

## Recommendation

**Option 1 (package rename)** is the cleanest solution. The current package name `qa-use-mcp` implies it's only for MCP, when it's actually a broader QA automation tool. Renaming to `@desplega.ai/qa-use` with `mcp` as a subcommand:

1. Makes the package name match its purpose
2. Enables `npx @desplega.ai/qa-use test run` to work as expected
3. Creates a unified CLI experience

## Code References

- package.json:8-12 - Current bin configuration
- src/index.ts - MCP server entry point
- src/cli/index.ts - Test CLI entry point
- bin/qa-use.js - CLI binary wrapper

## Open Questions

1. Should the old `@desplega.ai/qa-use-mcp` package be deprecated with a message pointing to `@desplega.ai/qa-use`?
2. Should the `desplega-qa` and `qa-use-mcp` binaries be kept as aliases for backwards compatibility?
