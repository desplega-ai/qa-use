# qa-use Plugin for Claude Code

A CLI-integrated plugin for E2E testing with [qa-use](https://github.com/desplega-ai/qa-use). Provides slash commands, skills, and specialized agents for test authoring, execution, and debugging.

## Installation

### From GitHub

Add the desplega marketplace:

```bash
/plugin marketplace add desplega-ai/qa-use
```

Install the qa-use plugin:

```bash
/plugin install qa-use@desplega.ai
```

### Prerequisites

- Node.js 20+
- API key from [desplega.ai](https://desplega.ai)

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

## Commands

| Command | Description |
|---------|-------------|
| `/qa-use:test-init` | Initialize test directory with example test |
| `/qa-use:test-run [name] [flags]` | Run E2E tests |
| `/qa-use:test-validate [name]` | Validate test syntax |
| `/qa-use:test-sync [--pull\|--push]` | Sync with cloud |
| `/qa-use:test-update [name]` | AI-assisted test editing |

### Common Flags for test-run

- `--headful` - Show browser window
- `--autofix` - Enable AI self-healing
- `--update-local` - Persist AI fixes to local file
- `--screenshots` - Capture screenshots
- `--var key=value` - Override variables

## Skills

The plugin includes three core skills:

- **test-running** - Orchestrates test execution with progress monitoring
- **test-authoring** - Creates and edits test definitions
- **test-debugging** - Analyzes failures and suggests fixes

## Agents

Two specialized agents are available:

- **test-analyzer** - Deep analysis of test failures
- **step-generator** - Generate steps from natural language

## Configuration

Create `.qa-use-tests.json` in your project root:

```json
{
  "env": {
    "QA_USE_API_KEY": "your-api-key"
  },
  "test_directory": "./qa-tests",
  "default_app_config_id": "your-app-config-id",
  "defaults": {
    "headless": true,
    "persist": false,
    "timeout": 300,
    "allow_fix": true
  }
}
```

## Test Definition Format

```yaml
name: Login Test
app_config: your-app-config-id
variables:
  email: test@example.com
  password: secret123
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

## Resources

- [GitHub Repository](https://github.com/desplega-ai/qa-use)
- [Documentation](https://desplega.ai/how-to)
- [API Reference](https://desplega.ai/api)

## License

MIT
