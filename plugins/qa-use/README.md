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
| `/qa-use:record [start\|stop] [name]` | Record browser actions into test YAML |
| `/qa-use:test-init` | Initialize test directory |
| `/qa-use:test-run [name] [flags]` | Run E2E tests |
| `/qa-use:test-validate [name]` | Validate test syntax |
| `/qa-use:test-sync [--pull\|--push]` | Sync with cloud |
| `/qa-use:test-update [name]` | AI-assisted test editing |

### Common Flags for test-run

- `--tunnel` - Start local browser with tunnel (required for localhost URLs!)
- `--headful` - Show browser window (use with `--tunnel`)
- `--autofix` - Enable AI self-healing
- `--update-local` - Persist AI fixes to local file
- `--download` - Download assets to `/tmp/qa-use/downloads/`
- `--var key=value` - Override variables

> **Important:** When testing localhost URLs, you MUST use `--tunnel`. The cloud cannot access your local machine directly!

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
