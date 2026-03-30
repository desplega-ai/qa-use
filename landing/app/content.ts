const year = new Date().getFullYear();

export const markdownContent = `# qa-use

> AI-first browser testing for your CI/CD pipeline

Built by [desplega labs](https://desplega.sh) — a [desplega.ai](https://desplega.ai) product.

Create, run, and manage E2E tests with YAML definitions.
Works with Claude, VS Code Copilot, Cursor, and any MCP client.

- **GitHub**: https://github.com/desplega-ai/qa-use
- **npm**: https://www.npmjs.com/package/@desplega.ai/qa-use
- **Website**: https://qa-use.dev

## Features

- **AI-First Testing** — Verify features with natural language. Auto-generate tests from PRs.
- **YAML-Based Tests** — Human-readable, version-controllable. 40+ actions, AI assertions.
- **MCP Server** — Works with Claude, Copilot, Cursor, Gemini CLI, and any MCP client.
- **Browser CLI** — 29+ interactive commands. REPL mode for debugging.
- **Cloud Execution** — Sync tests to desplega.ai. Run in CI/CD with GitHub Actions.
- **Self-Healing** — AI auto-fixes broken selectors. Tests adapt as your UI evolves.

## Getting Started

\`\`\`bash
# Install
npm install -g @desplega.ai/qa-use

# Setup
qa-use setup

# Initialize tests
qa-use test init
\`\`\`

### Write your first test

\`\`\`yaml
# qa-tests/login.yaml
name: Login Test
steps:
  - action: goto
    url: /login
  - action: fill
    target: email input
    value: test@example.com
  - action: click
    target: login button
  - action: to_be_visible
    target: dashboard
\`\`\`

\`\`\`bash
# Run it
qa-use test run login
\`\`\`

## MCP Integration

\`\`\`bash
# Claude Code
claude mcp add desplega-qa -- npx @desplega.ai/qa-use mcp

# Standalone
npx @desplega.ai/qa-use mcp
\`\`\`

---

MIT License · © ${year} desplega labs · MADE BY BUILDERS FOR BUILDERS
`;

export const plainTextContent = `qa-use — AI-first browser testing for your CI/CD pipeline
==========================================================

Built by desplega labs (https://desplega.sh)
A desplega.ai product (https://desplega.ai)

Create, run, and manage E2E tests with YAML definitions.
Works with Claude, VS Code Copilot, Cursor, and any MCP client.

GitHub:  https://github.com/desplega-ai/qa-use
npm:     https://www.npmjs.com/package/@desplega.ai/qa-use
Website: https://qa-use.dev

FEATURES
--------
- AI-First Testing    Verify features with natural language. Auto-generate tests from PRs.
- YAML-Based Tests    Human-readable, version-controllable. 40+ actions, AI assertions.
- MCP Server          Works with Claude, Copilot, Cursor, Gemini CLI, and any MCP client.
- Browser CLI         29+ interactive commands. REPL mode for debugging.
- Cloud Execution     Sync tests to desplega.ai. Run in CI/CD with GitHub Actions.
- Self-Healing        AI auto-fixes broken selectors. Tests adapt as your UI evolves.

GETTING STARTED
---------------
# Install
$ npm install -g @desplega.ai/qa-use

# Setup
$ qa-use setup

# Initialize tests
$ qa-use test init

# Create a test (qa-tests/login.yaml)
name: Login Test
steps:
  - action: goto
    url: /login
  - action: fill
    target: email input
    value: test@example.com
  - action: click
    target: login button
  - action: to_be_visible
    target: dashboard

# Run it
$ qa-use test run login

MCP INTEGRATION
---------------
# Claude Code
$ claude mcp add desplega-qa -- npx @desplega.ai/qa-use mcp

# Standalone
$ npx @desplega.ai/qa-use mcp

---
MIT License · © ${year} desplega labs
MADE BY BUILDERS FOR BUILDERS
`;
