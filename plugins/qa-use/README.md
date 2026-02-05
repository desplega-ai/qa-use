# qa-use Plugin for Claude Code

A CLI-integrated plugin for E2E testing and browser automation with [qa-use](https://github.com/desplega-ai/qa-use). Provides slash commands, skills, and specialized agents for test authoring, execution, debugging, and AI-first feature verification.

## Installation

Install the qa-use plugin:

```bash
claude /mcp add qa-use -- npx @desplega.ai/qa-use mcp
```

### Prerequisites

- Node.js 20+
- API key from [desplega.ai](https://desplega.ai)

After installation, run `qa-use info` to verify your setup:

```bash
qa-use info
```

If browsers are missing, run:

```bash
qa-use install-deps
```

## Quick Start

1. **Initialize test directory**:
   ```
   /qa-use:test-init
   ```

2. **Edit the example test** at `qa-tests/example.yaml`

3. **Run your first test**:
   ```
   /qa-use:test-run example
   ```

## How qa-use Works

### The Blocks Concept

qa-use uses **blocks** to bridge interactive exploration and automated testing:

1. **Automatic Recording**: Every browser interaction (click, fill, goto, scroll) is recorded as a "block"
2. **Session Storage**: Blocks are stored server-side with your browser session
3. **Test Generation**: Blocks can be converted into test YAML with `qa-use browser generate-test`
4. **AI Understanding**: Blocks enable AI agents to analyze your intent and suggest improvements

**Example:**
```bash
qa-use browser create --tunnel --no-headless
qa-use browser goto https://example.com
qa-use browser snapshot        # Get element refs
qa-use browser click e1        # Recorded as block
qa-use browser fill e5 "text"  # Recorded as block
qa-use browser get-blocks      # See recorded blocks
qa-use browser generate-test -n "my_test"  # Convert to YAML
```

See [Understanding Blocks](skills/qa-use/SKILL.md#2-understanding-blocks) in SKILL.md for details.

## AI-First Workflow

The primary way to use this plugin is the **verify → explore → record → test** loop:

```
# Just implemented a login feature? Verify it works:
/qa-use:verify "login works with valid credentials"

# No test exists? The plugin will:
# 1. Explore the feature automatically
# 2. Generate a test YAML from exploration
# 3. Execute the test
# 4. Report results with specific recommendations
```

## Commands

| Command | Description |
|---------|-------------|
| `/qa-use:verify <description>` | Verify a feature works (THE main command) |
| `/qa-use:explore <url or goal>` | Explore a web page autonomously |
| `/qa-use:record [start\|stop\|edit] [name]` | Record browser actions or edit existing tests |
| `/qa-use:verify-pr` | Verify PR changes automatically |
| `/qa-use:test-init` | Initialize test directory |
| `/qa-use:test-run [name] [flags]` | Run E2E tests |

**Note:** Commands like `test-validate`, `test-sync`, `test-diff`, `test-info`, and `test-runs` are available via CLI. See [SKILL.md](skills/qa-use/SKILL.md) for complete CLI documentation.

### Common Flags for test-run

- `--tunnel` - Start local browser with tunnel (required for localhost URLs!)
- `--headful` - Show browser window (use with `--tunnel`)
- `--autofix` - Enable AI self-healing
- `--update-local` - Persist AI fixes to local file
- `--download` - Download assets to `/tmp/qa-use/downloads/`
- `--var key=value` - Override variables

> **Important:** Testing localhost? Use `--tunnel` flag! See [Testing Localhost Apps](#testing-localhost-apps) section above.

## Skill

The plugin provides a single unified skill:

| Skill | Description |
|-------|-------------|
| **qa-use** | E2E testing and browser automation |

See [skills/qa-use/SKILL.md](skills/qa-use/SKILL.md) for complete documentation.

### References

| Document | Description |
|----------|-------------|
| [browser-commands.md](skills/qa-use/references/browser-commands.md) | Complete browser CLI reference |
| [test-format.md](skills/qa-use/references/test-format.md) | Full test YAML specification |
| [localhost-testing.md](skills/qa-use/references/localhost-testing.md) | Tunnel setup for local development |
| [failure-debugging.md](skills/qa-use/references/failure-debugging.md) | Failure classification and diagnostics |

### Templates

| Template | Description |
|----------|-------------|
| [basic-test.yaml](skills/qa-use/templates/basic-test.yaml) | Simple navigation and assertion |
| [auth-flow.yaml](skills/qa-use/templates/auth-flow.yaml) | Login flow with credentials |
| [form-test.yaml](skills/qa-use/templates/form-test.yaml) | Form submission with validation |

## Agents

Four specialized agents are available:

| Agent | Description |
|-------|-------------|
| **browser-navigator** | Autonomous page exploration |
| **browser-recorder** | Records interactions and generates test YAML |
| **test-analyzer** | Deep analysis of test failures |
| **step-generator** | Generate steps from natural language |

## Browser Automation

The plugin wraps the `qa-use browser` CLI:

```bash
# Session management
qa-use browser create --viewport desktop
qa-use browser create --tunnel          # For localhost
qa-use browser list
qa-use browser close

# Navigation
qa-use browser goto https://example.com

# Interaction (always snapshot first!)
qa-use browser snapshot                 # Get element refs
qa-use browser click e3                 # Click by ref
qa-use browser fill e4 "value"          # Fill by ref

# Inspection
qa-use browser url
qa-use browser screenshot
qa-use browser logs console             # View console logs
qa-use browser logs network             # View network logs
```

## Testing Localhost Apps

The cloud cannot access `localhost` URLs directly. qa-use provides **tunnel mode** to test local applications:

### Quick Decision Tree

```
Testing localhost (http://localhost:3000)?
  ├─ YES → Add --tunnel flag
  │   qa-use browser create --tunnel [--no-headless]
  │   qa-use test run my_test --tunnel
  │
  └─ NO (Public URL) → Use default (no flag)
      qa-use browser create
      qa-use test run my_test
```

### How Tunnel Mode Works

When you use `--tunnel`:
1. Playwright browser starts on **your machine** (not in cloud)
2. A localtunnel is created to proxy API requests
3. The browser stays running for your test session
4. Use `--no-headless` to see the browser window

### Examples

```bash
# Interactive session with local app
qa-use browser create --tunnel --no-headless
qa-use browser goto http://localhost:3000

# Run test against localhost
qa-use test run login --tunnel --headful

# Record test from localhost
/qa-use:record start local_test
# (tunnel mode auto-detected)
```

See [Localhost Testing](skills/qa-use/SKILL.md#localhost-testing-tunnel-mode) in SKILL.md for troubleshooting.

## Configuration

### Environment Variables

```bash
export QA_USE_API_KEY="your-api-key"
```

### Config File

Create `.qa-use-tests.json` in your project root:

```json
{
  "api_key": "your-api-key",
  "test_directory": "./qa-tests",
  "default_app_config_id": "your-app-config-id"
}
```

Use `qa-use setup` for interactive configuration.

## Test Format

```yaml
name: Login Test
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

## Troubleshooting

### "Playwright Chromium browser is not installed"

```bash
qa-use install-deps
```

### Check your setup

```bash
qa-use info
```

## Resources

- [GitHub Repository](https://github.com/desplega-ai/qa-use)
- [Documentation](https://desplega.ai/how-to)
- [API Reference](https://desplega.ai/api)

## License

MIT
