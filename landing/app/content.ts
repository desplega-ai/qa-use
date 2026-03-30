const year = new Date().getFullYear();

export const markdownContent = `# qa-use

> AI-powered browser automation and E2E testing

Built by [desplega labs](https://desplega.sh) — a [desplega.ai](https://desplega.ai) product.

Automate browsers with 37 CLI commands. Define and run E2E tests with YAML.
Works with Claude, Cursor, and any MCP client.

- **Get API Key**: https://app.desplega.ai
- **GitHub**: https://github.com/desplega-ai/qa-use
- **npm**: https://www.npmjs.com/package/@desplega.ai/qa-use
- **Website**: https://qa-use.dev

## Browser Automation

- **37 CLI Commands** — Navigate, click, fill, type, hover, drag, screenshot, and more.
- **REPL Mode** — Interactive browser sessions for exploration and debugging.
- **Dual Targeting** — Target by accessibility refs or natural language descriptions.

## E2E Testing

- **YAML Test Definitions** — Human-readable, version-controllable. 40+ actions, AI assertions.
- **Cloud Execution** — Sync tests to desplega.ai. Run in CI/CD with GitHub Actions.
- **Self-Healing** — AI auto-fixes broken selectors. Tests adapt as your UI evolves.

## Getting Started

\`\`\`bash
# Install
npm install -g @desplega.ai/qa-use

# Setup (get your API key at app.desplega.ai)
qa-use setup
\`\`\`

### Automate a browser

\`\`\`bash
qa-use browser create --no-headless
qa-use browser goto https://myapp.com
qa-use browser snapshot
qa-use browser click "Sign In"
qa-use browser fill e12 "user@example.com"
qa-use browser screenshot /tmp/shot.png
qa-use browser close
\`\`\`

### Write a test

\`\`\`yaml
# qa-tests/login.yaml
name: Login Test
variables:
  base_url: http://localhost:3000
  email: test@example.com
  password: secret123
steps:
  - action: goto
    url: \$base_url/login
  - action: fill
    target: email input
    value: \$email
  - action: fill
    target: password input
    value: \$password
  - action: click
    target: sign in button
  - action: to_be_visible
    target: dashboard
\`\`\`

\`\`\`bash
# Run against your local app (tunnel mode)
qa-use test run login --tunnel
\`\`\`

## MCP Integration

\`\`\`bash
# Add from the marketplace
claude plugin marketplace add desplega-ai/qa-use

# Then install the plugin
claude plugin install qa-use@desplega.ai

# Add as MCP server
claude mcp add desplega-qa -- npx @desplega.ai/qa-use mcp
\`\`\`

### Any other AI assistant

\`\`\`bash
# Run the MCP server
npx @desplega.ai/qa-use mcp

# Install the skill
npx skills add https://github.com/desplega-ai/qa-use --skill qa-use
\`\`\`

---

MIT License · © ${year} desplega labs · MADE BY BUILDERS FOR BUILDERS
`;

export const plainTextContent = `qa-use — AI-powered browser automation and E2E testing
======================================================

Built by desplega labs (https://desplega.sh)
A desplega.ai product (https://desplega.ai)

Automate browsers with 37 CLI commands. Define and run E2E tests with YAML.
Works with Claude, Cursor, and any MCP client.

Get API Key: https://app.desplega.ai
GitHub:      https://github.com/desplega-ai/qa-use
npm:         https://www.npmjs.com/package/@desplega.ai/qa-use
Website:     https://qa-use.dev

BROWSER AUTOMATION
------------------
- 37 CLI Commands    Navigate, click, fill, type, hover, drag, screenshot, and more.
- REPL Mode          Interactive browser sessions for exploration and debugging.
- Dual Targeting     Target by accessibility refs or natural language descriptions.

E2E TESTING
-----------
- YAML Test Definitions   Human-readable, version-controllable. 40+ actions, AI assertions.
- Cloud Execution         Sync tests to desplega.ai. Run in CI/CD with GitHub Actions.
- Self-Healing            AI auto-fixes broken selectors. Tests adapt as your UI evolves.

GETTING STARTED
---------------
# Install
$ npm install -g @desplega.ai/qa-use

# Setup (get your API key at app.desplega.ai)
$ qa-use setup

AUTOMATE A BROWSER
------------------
$ qa-use browser create --no-headless
$ qa-use browser goto https://myapp.com
$ qa-use browser snapshot
$ qa-use browser click "Sign In"
$ qa-use browser fill e12 "user@example.com"
$ qa-use browser screenshot /tmp/shot.png
$ qa-use browser close

WRITE A TEST
------------
# qa-tests/login.yaml
name: Login Test
variables:
  base_url: http://localhost:3000
  email: test@example.com
  password: secret123
steps:
  - action: goto
    url: \$base_url/login
  - action: fill
    target: email input
    value: \$email
  - action: fill
    target: password input
    value: \$password
  - action: click
    target: sign in button
  - action: to_be_visible
    target: dashboard

# Run against your local app (tunnel mode)
$ qa-use test run login --tunnel

MCP INTEGRATION
---------------
CLAUDE
------
# Add from the marketplace
$ claude plugin marketplace add desplega-ai/qa-use

# Then install the plugin
$ claude plugin install qa-use@desplega.ai

# Add as MCP server
$ claude mcp add desplega-qa -- npx @desplega.ai/qa-use mcp

ANY OTHER AI ASSISTANT
----------------------
# Run the MCP server
$ npx @desplega.ai/qa-use mcp

# Install the skill
$ npx skills add https://github.com/desplega-ai/qa-use --skill qa-use

---
MIT License · © ${year} desplega labs
MADE BY BUILDERS FOR BUILDERS
`;
