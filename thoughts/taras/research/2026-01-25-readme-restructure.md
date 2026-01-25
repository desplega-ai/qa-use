---
date: 2026-01-25
researcher: Claude
project: qa-use
topic: README Restructure - CLI Focus
git_branch: main
tags: [readme, documentation, cli, restructure]
status: complete
---

# README Restructure Research

## Research Question

How should the README.md be restructured to focus on the CLI instead of MCP, with MCP documentation moved to a separate MCP.md file? What makes sense for a solid OSS project?

## Summary

The qa-use package is a QA automation tool with two primary interfaces:
1. **CLI** (`qa-use`) - Command-line tool for test management, browser control, and configuration
2. **MCP Server** (`qa-use mcp`) - Model Context Protocol server for AI assistant integrations

The current README.md is ~1000 lines and heavily focused on MCP server configuration. For a solid OSS project, the README should prioritize the CLI as the primary user interface, with MCP as an advanced integration option documented separately.

## Key Findings

### 1. CLI Structure Overview

The CLI has 6 top-level commands defined in `src/cli/index.ts:25-30`:

| Command | Purpose | Subcommands |
|---------|---------|-------------|
| `setup` | Configure API key and settings | - |
| `info` | Show current configuration | - |
| `install-deps` | Install Playwright browsers | - |
| `test` | Manage and run tests | `init`, `list`, `run`, `validate`, `export`, `sync` |
| `browser` | Control remote browsers | 29 subcommands |
| `mcp` | Start MCP server | `tunnel` |

### 2. Core User Workflows

**Workflow A: Running Tests (Primary)**
```bash
qa-use setup                    # Configure API key
qa-use test init                # Create qa-tests/ with example.yaml
qa-use test run example         # Run the example test
qa-use test run --all           # Run all tests
```

**Workflow B: Browser Control (Interactive)**
```bash
qa-use browser create           # Start browser session
qa-use browser goto https://example.com
qa-use browser snapshot         # Get element refs
qa-use browser click e3         # Click by ref
qa-use browser run              # Interactive REPL mode
```

**Workflow C: MCP Integration (Advanced)**
```bash
qa-use mcp                      # Start stdio server
qa-use mcp --http               # Start HTTP server
qa-use mcp tunnel               # Start persistent tunnel
```

### 3. Existing Documentation Files

| File | Lines | Purpose |
|------|-------|---------|
| `README.md` | ~1000 | Main docs (MCP-heavy) |
| `SETUP.md` | ~344 | E2E test setup guide |
| `CONTRIBUTING.md` | ~281 | Development guide |
| `CLAUDE.md` | ~104 | AI assistant onboarding |

**Missing files:**
- `MCP.md` - Does not exist
- `VERCEL_DEPLOYMENT.md` - Referenced in README but doesn't exist

### 4. README Auto-Generation System

The script `scripts/generate-readme-tools.js` manages MCP tools documentation:
- Validates tools against `src/server.ts`
- Replaces content between `<!-- AUTO-GENERATED-TOOLS-START -->` and `<!-- AUTO-GENERATED-TOOLS-END -->`
- Run via: `bun run generate:readme`

This section (lines 689-795) should be moved to MCP.md.

### 5. Test Definition Format

Tests are YAML files in `qa-tests/` directory:

```yaml
name: Example Test
app_config: your-app-config-id
variables:
  email: test@example.com
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

**Supported actions:**
- Navigation: `goto`, `go_back`, `go_forward`, `reload`
- Input: `fill`, `type`, `click`, `hover`, `press`, `check`, `uncheck`, `select_option`
- Waiting: `wait_for_selector`, `wait_for_timeout`, `wait_for_load_state`
- Assertions: `to_be_visible`, `to_have_text`, `to_have_url`, `to_contain_text`
- Advanced: `ai_action`, `ai_assertion`, `extract_structured_data`

### 6. Package Identity

From `package.json`:
- **Name**: `@desplega.ai/qa-use`
- **Description**: "QA automation tool for browser testing with MCP server support"
- **Version**: 2.3.2
- **Binary**: `qa-use`
- **Keywords**: mcp, browser-automation, qa-testing, playwright, testing

Note: Description emphasizes "QA automation tool" first, with MCP as secondary.

## Proposed README Structure

### New README.md (CLI-focused, ~300-400 lines)

```markdown
# qa-use

QA automation tool for browser testing and E2E test management.

[![npm version](https://badge.fury.io/js/%40desplega.ai%2Fqa-use.svg)](...)

## Quick Start

\`\`\`bash
# Install globally
npm install -g @desplega.ai/qa-use

# Or use with npx
npx @desplega.ai/qa-use setup
\`\`\`

## Getting Started

### 1. Setup
\`\`\`bash
qa-use setup                    # Configure your API key
qa-use test init                # Initialize test directory
\`\`\`

### 2. Create Your First Test
Create `qa-tests/login.yaml`:
\`\`\`yaml
name: Login Test
steps:
  - action: goto
    url: /login
  - action: fill
    target: email input
    value: test@example.com
  - action: click
    target: login button
\`\`\`

### 3. Run Tests
\`\`\`bash
qa-use test run login           # Run single test
qa-use test run --all           # Run all tests
\`\`\`

## CLI Reference

### Test Commands
| Command | Description |
|---------|-------------|
| `qa-use test init` | Initialize test directory |
| `qa-use test run <name>` | Run a test |
| `qa-use test list` | List local tests |
| `qa-use test validate <name>` | Validate test syntax |
| `qa-use test sync` | Sync with cloud |

### Browser Commands
| Command | Description |
|---------|-------------|
| `qa-use browser create` | Start browser session |
| `qa-use browser goto <url>` | Navigate to URL |
| `qa-use browser snapshot` | Get element refs |
| `qa-use browser click <ref>` | Click element |
| `qa-use browser run` | Interactive REPL |

### Setup Commands
| Command | Description |
|---------|-------------|
| `qa-use setup` | Configure API key |
| `qa-use info` | Show configuration |
| `qa-use install-deps` | Install Playwright |

## Test Definition Format

[Link to SETUP.md or inline the essentials]

## Configuration

### Environment Variables
\`\`\`bash
QA_USE_API_KEY=xxx              # Required
QA_USE_REGION=us                # Optional: "us" or "auto"
\`\`\`

### Config File (~/.qa-use.json)
[Brief explanation, link to full docs]

## CI/CD Integration

[Basic GitHub Actions example]

## MCP Server

For AI assistant integration (Claude Desktop, VS Code Copilot, etc.), qa-use includes an MCP server. See [MCP.md](./MCP.md) for full documentation.

\`\`\`bash
qa-use mcp                      # Start MCP server
\`\`\`

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
```

### New MCP.md (~700-800 lines, moved from README)

Should contain:
1. MCP overview and use cases
2. All client configurations (Claude Desktop, Claude Code, Cline, Cursor, etc.)
3. Three modes: stdio, HTTP/SSE, tunnel
4. MCP Tools reference (auto-generated section)
5. HTTP API documentation
6. Docker/Vercel deployment
7. Security considerations

### Update generate-readme-tools.js

Modify to target MCP.md instead of README.md:
- Change `readmePath` from `README.md` to `MCP.md`
- Update markers to match new file

## Content Migration Plan

### From README.md to MCP.md
- Lines 1-11 (title, description about MCP) → Adapt for MCP.md intro
- Lines 30-230 (MCP client configurations) → Move entirely
- Lines 250-430 (HTTP Transport Mode) → Move entirely
- Lines 516-645 (Tunnel Mode) → Move entirely
- Lines 689-807 (MCP Tools auto-generated) → Move entirely
- Lines 809-876 (Configuration env vars) → Keep in README but simplify

### From README.md to Keep/Simplify
- Lines 14-28 (Quick Start) → Adapt for CLI focus
- Lines 645-688 (Installation) → Keep, simplify
- Lines 668-686 (Development) → Move to CONTRIBUTING.md
- Lines 877-937 (Usage Examples) → Adapt for CLI
- Lines 939-1004 (Testing, Architecture) → Simplify or move

### From SETUP.md to README.md
- Test definition format essentials
- Basic CI example
- Quick reference commands

## Code References

- CLI entry point: `src/cli/index.ts:20-33`
- Test command: `src/cli/commands/test/index.ts:7-21`
- Browser command: `src/cli/commands/browser/index.ts:47-84`
- MCP command: `src/cli/commands/mcp.ts:7-53`
- README generator: `scripts/generate-readme-tools.js:1-198`
- Config loader: `src/cli/lib/config.ts:63-111`
- Test loader: `src/cli/lib/loader.ts:28-141`

## Recommendations

1. **Create MCP.md first** - Move all MCP content before modifying README
2. **Update generate-readme-tools.js** - Point to MCP.md
3. **Restructure README.md** - Focus on CLI, keep it under 400 lines
4. **Add plugin section** - Document the Claude Code plugin integration (`qa-use`)
5. **Create missing VERCEL_DEPLOYMENT.md** - Or remove the reference
6. **Update package.json description** - Consider: "QA automation CLI for browser testing with E2E test management"
7. **Add badges** - npm version, license, build status

## Decisions

Based on review feedback:

1. **Test definition format** → Keep README short; link to SETUP.md for full details
2. **Browser command docs** → Show a couple examples in README and mention `--help` for full reference
3. **CI/CD documentation** → Include brief mention with `verify-pr` command example; detailed docs can live elsewhere
4. **Plugin integration** → Add section about the Claude Code plugin (`qa-use`) in the README
