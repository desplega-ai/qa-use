# qa-use Plugin for Claude Code

A CLI-integrated plugin for E2E testing and browser automation with [qa-use](https://github.com/desplega-ai/qa-use). Provides slash commands, skills, and specialized agents for test authoring, execution, debugging, and AI-first feature verification.

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

# On failure, it classifies the issue:
# - CODE BUG: Feature broken → points to relevant code
# - TEST BUG: Selector changed → suggests fix or auto-fixes
# - ENVIRONMENT: Network/auth issue → suggests retry
```

This positions qa-use as **infrastructure for AI-driven development workflows** - where Claude Code develops a feature, verifies it through automated testing, and iterates until green.

## Commands

### Feature Verification

| Command | Description |
|---------|-------------|
| `/qa-use:verify <description>` | Verify a feature works (THE main command) |
| `/qa-use:explore <url or goal>` | Explore a web page autonomously |
| `/qa-use:record [start\|stop] [name]` | Record browser actions into test YAML |

### Test Operations

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
- `--download` - Download assets (screenshots, recordings, HAR) to `/tmp/qa-use/downloads/`
- `--var key=value` - Override variables

## Skills

The plugin includes five core skills:

| Skill | Description |
|-------|-------------|
| **feature-verify** | Orchestrates feature verification: explore → test → analyze |
| **browser-control** | Low-level browser automation via `qa-use browser` CLI |
| **test-running** | Orchestrates test execution with progress monitoring |
| **test-authoring** | Creates and edits test definitions |
| **test-debugging** | Analyzes failures (CODE BUG vs TEST BUG vs ENVIRONMENT) |

## Agents

Four specialized agents are available:

| Agent | Description |
|-------|-------------|
| **browser-navigator** | Autonomous page exploration (snapshot → analyze → act loop) |
| **browser-recorder** | Records interactions and generates test YAML |
| **test-analyzer** | Deep analysis of test failures |
| **step-generator** | Generate steps from natural language |

## Browser Automation

The plugin wraps the `qa-use browser` CLI for AI-assisted browser automation:

```bash
# Session management
qa-use browser create --viewport desktop
qa-use browser list
qa-use browser close

# Navigation
qa-use browser goto https://example.com
qa-use browser back / forward / reload

# Element targeting (always snapshot first!)
qa-use browser snapshot           # Get refs
qa-use browser click e3           # Click by ref
qa-use browser fill e4 "value"    # Fill by ref
qa-use browser click --text "Submit button"  # Semantic selection

# Inspection
qa-use browser url
qa-use browser screenshot
```

## Command Cheat Sheet

| I want to... | Command |
|--------------|---------|
| Verify a feature works | `/qa-use:verify "description"` |
| Explore a page | `/qa-use:explore https://url` |
| Record a test | `/qa-use:record start` then `/qa-use:record stop` |
| Run existing test | `/qa-use:test-run <name>` |
| Debug a failure | Use `test-analyzer` agent via `/qa-use:test-run <name>` |
| Quick browser action | `qa-use browser <cmd>` (direct CLI) |

## Configuration

### Option 1: Environment Variables (recommended for CI/secrets)

```bash
export QA_USE_API_KEY="your-api-key"
export QA_USE_API_URL="https://api.desplega.ai"  # optional
```

### Option 2: Config File

Create `.qa-use-tests.json` in your project root:

```json
{
  "api_key": "your-api-key",
  "api_url": "https://api.desplega.ai",
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

You can also use an `env` block to set arbitrary environment variables:

```json
{
  "api_key": "your-api-key",
  "env": {
    "MY_CUSTOM_VAR": "value"
  }
}
```

**Note:** Shell environment variables override config file values. Use `qa-use setup` for interactive configuration.

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
